from datetime import timedelta
from decimal import Decimal

from django.db.models import Count, F, ProtectedError, Q, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from . import kpi, services
from .models import Branch, Inventory, Order, OrderItem, User
from .permissions import (
    ITEM_TYPE_READ_BY_ROLE, ORDER_TYPE_BY_ROLE,
    BranchScopedPermission, IsTopManagement, is_top,
)
from .serializers import (
    BranchSerializer, ERPTokenObtainPairSerializer, InventorySerializer,
    KpiTargetSerializer, OrderSerializer, StaffSalarySerializer, UserSerializer,
)

LOW_STOCK_THRESHOLD = InventorySerializer.LOW_STOCK_THRESHOLD


# ---------- Auth ----------

class ERPTokenObtainPairView(TokenObtainPairView):
    serializer_class = ERPTokenObtainPairSerializer


@api_view(['GET'])
def me(request):
    return Response(UserSerializer(request.user).data)


# ---------- Helpers ----------

class BranchScopedQuerysetMixin:
    """Top Management bo'lmagan foydalanuvchilar faqat o'z filiali ma'lumotlarini ko'radi."""

    def scope_by_branch(self, qs):
        user = self.request.user
        if is_top(user):
            branch = self.request.query_params.get('branch')
            return qs.filter(branch_id=branch) if branch else qs
        return qs.filter(branch_id=user.branch_id)


# ---------- Business ViewSets ----------

class BranchViewSet(viewsets.ModelViewSet):
    queryset = Branch.objects.all().order_by('name')
    serializer_class = BranchSerializer
    permission_classes = [IsTopManagement]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'location']


class UserViewSet(BranchScopedQuerysetMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    """Xodimlar ro'yxati. Maoshni (PATCH salary) faqat Top Management o'zgartiradi."""
    serializer_class = UserSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'first_name', 'last_name']
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_permissions(self):
        if self.action == 'partial_update':
            return [IsTopManagement()]
        return [BranchScopedPermission()]

    def get_queryset(self):
        qs = self.scope_by_branch(User.objects.select_related('branch').order_by('branch__name', 'role', 'username'))
        role = self.request.query_params.get('role')
        return qs.filter(role=role) if role else qs

    def partial_update(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = StaffSalarySerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(user, context={'request': request}).data)


class InventoryViewSet(BranchScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = InventorySerializer
    permission_classes = [BranchScopedPermission]
    write_roles = ('sales_manager', 'warehouse_manager')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'sku_or_vin']
    ordering_fields = ['name', 'price', 'stock_quantity']
    ordering = ['item_type', 'name']

    def get_queryset(self):
        user = self.request.user
        qs = self.scope_by_branch(Inventory.objects.select_related('branch'))
        if not is_top(user):
            qs = qs.filter(item_type__in=ITEM_TYPE_READ_BY_ROLE.get(user.role, ()))

        params = self.request.query_params
        if params.get('item_type'):
            qs = qs.filter(item_type=params['item_type'])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('low_stock') in ('1', 'true'):
            qs = qs.filter(item_type='part', stock_quantity__lte=LOW_STOCK_THRESHOLD)
        return qs

    def perform_destroy(self, instance):
        try:
            instance.delete()
        except ProtectedError:
            raise ValidationError({'detail': "Bu mahsulot buyurtmalarda ishlatilgan — o'chirib bo'lmaydi."})


class OrderViewSet(BranchScopedQuerysetMixin, viewsets.ModelViewSet):
    serializer_class = OrderSerializer
    permission_classes = [BranchScopedPermission]
    write_roles = ('sales_manager', 'service_master')
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['customer_name', 'customer_phone']
    ordering_fields = ['created_at', 'total_price', 'status']

    def get_queryset(self):
        user = self.request.user
        qs = self.scope_by_branch(
            Order.objects.select_related('branch', 'assigned_to')
            .prefetch_related('items__inventory_item')
        )
        if not is_top(user) and user.role in ORDER_TYPE_BY_ROLE:
            qs = qs.filter(order_type=ORDER_TYPE_BY_ROLE[user.role])

        params = self.request.query_params
        if params.get('order_type'):
            qs = qs.filter(order_type=params['order_type'])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('assigned_to') == 'me':
            qs = qs.filter(assigned_to=user)
        return qs

    def perform_destroy(self, instance):
        services.delete_order(instance)


# ---------- KPI ----------

class KpiView(APIView):
    """
    GET /api/v1/kpi/?period=month|prev_month|quarter|year&branch=&role=
    Top Management — barcha xodimlar; qolganlar — faqat o'z KPI'si.
    """

    def get(self, request):
        period = request.query_params.get('period', 'quarter')
        if period not in kpi.PERIODS:
            raise ValidationError({'period': f"Mumkin bo'lgan qiymatlar: {', '.join(kpi.PERIODS)}"})

        user = request.user
        if is_top(user):
            staff = User.objects.filter(role__in=kpi.KPI_ROLES, is_active=True) \
                .select_related('branch', 'kpi_target').order_by('branch__name', 'role', 'username')
            if request.query_params.get('branch'):
                staff = staff.filter(branch_id=request.query_params['branch'])
            if request.query_params.get('role'):
                staff = staff.filter(role=request.query_params['role'])
        else:
            staff = [user] if user.role in kpi.KPI_ROLES else []

        results = sorted((kpi.compute(u, period) for u in staff),
                         key=lambda r: r['score'] if r['score'] is not None else -1, reverse=True)
        scored = [r['score'] for r in results if r['score'] is not None]
        return Response({
            'period': period,
            'period_label': kpi.PERIODS[period],
            'periods': kpi.PERIODS,
            'results': results,
            'totals': {
                'staff_count': len(results),
                'bonus': sum((r['bonus'] for r in results), Decimal('0')),
                'avg_score': (sum(scored) / len(scored)).quantize(Decimal('0.001')) if scored else None,
                'above_target': sum(1 for s in scored if s >= 1),
            },
        })


class KpiTargetView(APIView):
    """PUT/PATCH /api/v1/kpi/<user_id>/target/ — xodim KPI rejasi (faqat Top Management)."""
    permission_classes = [IsTopManagement]

    def patch(self, request, user_id):
        user = get_object_or_404(User, pk=user_id, role__in=kpi.KPI_ROLES)
        target = kpi.get_target(user)
        serializer = KpiTargetSerializer(target, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=user)
        return Response(kpi.compute(User.objects.select_related('kpi_target', 'branch').get(pk=user.pk),
                                    request.query_params.get('period', 'quarter')))

    put = patch


# ---------- Analytics ----------

class AnalyticsView(APIView):
    """Umumiy savdo, ombor va servis statistikasi (Top Management)."""
    permission_classes = [IsTopManagement]

    def get(self, request):
        branch_id = request.query_params.get('branch')
        orders = Order.objects.all()
        inventory = Inventory.objects.all()
        branches = Branch.objects.all()
        if branch_id:
            orders = orders.filter(branch_id=branch_id)
            inventory = inventory.filter(branch_id=branch_id)
            branches = branches.filter(pk=branch_id)

        completed = orders.filter(status='completed')
        zero = Decimal('0')

        def revenue(qs):
            return qs.aggregate(s=Sum('total_price'))['s'] or zero

        by_branch = []
        for b in branches.order_by('name'):
            b_orders = orders.filter(branch=b)
            b_completed = b_orders.filter(status='completed')
            by_branch.append({
                'branch_id': b.id,
                'branch_name': b.name,
                'revenue': revenue(b_completed),
                'car_sales_revenue': revenue(b_completed.filter(order_type='car_sale')),
                'service_revenue': revenue(b_completed.filter(order_type='service')),
                'cars_sold': OrderItem.objects.filter(
                    order__in=b_completed, inventory_item__item_type='car'
                ).aggregate(s=Sum('quantity'))['s'] or 0,
                'orders_total': b_orders.count(),
                'orders_active': b_orders.filter(status__in=('pending', 'in_progress')).count(),
                'inventory_value': inventory.filter(branch=b).aggregate(
                    s=Sum(F('price') * F('stock_quantity'))
                )['s'] or zero,
                'staff_count': b.staff.count(),
                'payroll_monthly': b.staff.aggregate(s=Sum('salary'))['s'] or zero,
            })

        # Ish haqi fondi: filial tanlanmagan bo'lsa, bosh ofis (filialsiz) xodimlari ham kiradi.
        staff = User.objects.filter(is_active=True)
        staff = staff.filter(branch_id=branch_id) if branch_id else staff
        payroll_monthly = staff.aggregate(s=Sum('salary'))['s'] or zero
        payroll = {
            'staff_count': staff.count(),
            'monthly': payroll_monthly,
            'yearly': payroll_monthly * 12,
            'by_role': [
                {'role': r['role'], 'role_display': dict(User.ROLE_CHOICES)[r['role']],
                 'count': r['count'], 'monthly': r['total'] or zero}
                for r in staff.values('role').annotate(count=Count('id'), total=Sum('salary')).order_by('-total')
            ],
        }

        since = timezone.now() - timedelta(days=365)
        monthly = (
            completed.filter(created_at__gte=since)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(
                revenue=Sum('total_price'),
                car_sales=Sum('total_price', filter=Q(order_type='car_sale')),
                service=Sum('total_price', filter=Q(order_type='service')),
            )
            .order_by('month')
        )

        low_stock = inventory.filter(item_type='part', stock_quantity__lte=LOW_STOCK_THRESHOLD) \
            .select_related('branch').order_by('stock_quantity')

        top_parts = (
            OrderItem.objects.filter(order__in=orders.filter(order_type='service').exclude(status='cancelled'))
            .values('inventory_item__name')
            .annotate(used=Sum('quantity'))
            .order_by('-used')[:5]
        )

        return Response({
            'sales': {
                'total_revenue': revenue(completed),
                'car_sales_revenue': revenue(completed.filter(order_type='car_sale')),
                'service_revenue': revenue(completed.filter(order_type='service')),
                'orders_by_status': dict(orders.values_list('status').annotate(c=Count('id'))),
                'orders_by_type': dict(orders.values_list('order_type').annotate(c=Count('id'))),
            },
            'payroll': payroll,
            'inventory': {
                'cars_available': inventory.filter(item_type='car', status='available').aggregate(
                    s=Sum('stock_quantity'))['s'] or 0,
                'cars_reserved': inventory.filter(item_type='car', status='reserved').count(),
                'cars_sold': inventory.filter(item_type='car', status='sold').count(),
                'parts_sku_count': inventory.filter(item_type='part').count(),
                'parts_units': inventory.filter(item_type='part').aggregate(s=Sum('stock_quantity'))['s'] or 0,
                'total_value': inventory.aggregate(s=Sum(F('price') * F('stock_quantity')))['s'] or zero,
                'low_stock': [
                    {'id': i.id, 'name': i.name, 'sku': i.sku_or_vin,
                     'stock_quantity': i.stock_quantity, 'branch_name': i.branch.name}
                    for i in low_stock
                ],
            },
            'service': {
                'active': orders.filter(order_type='service', status__in=('pending', 'in_progress')).count(),
                'completed': completed.filter(order_type='service').count(),
                'top_parts_used': [
                    {'name': p['inventory_item__name'], 'used': p['used']} for p in top_parts
                ],
            },
            'by_branch': by_branch,
            'monthly_revenue': [
                {'month': m['month'].strftime('%Y-%m'), 'revenue': m['revenue'],
                 'car_sales': m['car_sales'] or zero, 'service': m['service'] or zero}
                for m in monthly
            ],
        })
