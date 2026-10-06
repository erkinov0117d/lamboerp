"""Xodimlar KPI'si: reja, haqiqiy natija, bajarilish foizi va bonus."""
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Sum
from django.utils import timezone

from .models import Inventory, KpiTarget, Order

LOW_STOCK_THRESHOLD = 5

PERIODS = {
    'month': 'Joriy oy',
    'prev_month': "O'tgan oy",
    'quarter': "So'nggi 3 oy",
    'year': "So'nggi 12 oy",
}

# Rol bo'yicha standart oylik reja (xodimga alohida reja berilmagan bo'lsa)
DEFAULT_TARGETS = {
    'sales_manager': {'monthly_revenue_target': Decimal('150000'), 'monthly_orders_target': Decimal('0.5')},
    'service_master': {'monthly_revenue_target': Decimal('7000'), 'monthly_orders_target': Decimal('1')},
    'warehouse_manager': {},
}
KPI_ROLES = tuple(DEFAULT_TARGETS)
ORDER_TYPE = {'sales_manager': 'car_sale', 'service_master': 'service'}

REVENUE_WEIGHT = Decimal('0.7')
ORDERS_WEIGHT = Decimal('0.3')
MAX_RATIO = Decimal('1.5')
MIN_FOR_BONUS = Decimal('0.7')


def period_range(period):
    """(start, end, months) qaytaradi."""
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if period == 'month':
        return month_start, now, 1
    if period == 'prev_month':
        prev_start = (month_start - timedelta(days=1)).replace(day=1)
        return prev_start, month_start, 1
    if period == 'year':
        return now - timedelta(days=365), now, 12
    return now - timedelta(days=91), now, 3  # quarter


def get_target(user):
    target = getattr(user, 'kpi_target', None)
    if target is None:
        target = KpiTarget(user=user, **DEFAULT_TARGETS.get(user.role, {}))
    return target


def _ratio(actual, target):
    if not target:
        return None
    return min(Decimal(actual) / Decimal(target), MAX_RATIO)


def rating(score):
    if score is None:
        return 'none'
    if score >= 1:
        return 'excellent'
    if score >= Decimal('0.8'):
        return 'good'
    if score >= Decimal('0.6'):
        return 'fair'
    return 'low'


def compute(user, period='quarter'):
    start, end, months = period_range(period)
    target = get_target(user)
    result = {
        'user_id': user.id,
        'username': user.username,
        'full_name': user.get_full_name() or user.username,
        'role': user.role,
        'role_display': user.get_role_display(),
        'branch': user.branch_id,
        'branch_name': user.branch.name if user.branch else None,
        'salary': user.salary,
        'bonus_rate': target.bonus_rate,
        'targets': {
            'monthly_revenue': target.monthly_revenue_target,
            'monthly_orders': target.monthly_orders_target,
            'availability': target.availability_target,
        },
    }

    if user.role in ORDER_TYPE:
        done = Order.objects.filter(
            assigned_to=user, order_type=ORDER_TYPE[user.role], status='completed',
            created_at__gte=start, created_at__lt=end,
        ).aggregate(revenue=Sum('total_price'), count=Count('id'))
        revenue = done['revenue'] or Decimal('0')
        count = done['count']
        revenue_target = target.monthly_revenue_target * months
        orders_target = target.monthly_orders_target * months
        rev_ratio = _ratio(revenue, revenue_target)
        cnt_ratio = _ratio(count, orders_target)
        if rev_ratio is None and cnt_ratio is None:
            score = None
        elif rev_ratio is None or cnt_ratio is None:
            score = rev_ratio if cnt_ratio is None else cnt_ratio
        else:
            score = rev_ratio * REVENUE_WEIGHT + cnt_ratio * ORDERS_WEIGHT
        result['metrics'] = [
            {'key': 'revenue', 'label': 'Daromad', 'unit': 'usd', 'actual': revenue,
             'target': revenue_target, 'ratio': rev_ratio, 'weight': REVENUE_WEIGHT},
            {'key': 'orders', 'label': 'Sotilgan avtomobillar' if user.role == 'sales_manager' else 'Bajarilgan servislar',
             'unit': 'count', 'actual': count, 'target': orders_target, 'ratio': cnt_ratio, 'weight': ORDERS_WEIGHT},
        ]
    elif user.role == 'warehouse_manager' and user.branch_id:
        # Ombor holati joriy holat bo'yicha baholanadi (davrga bog'liq emas).
        parts = Inventory.objects.filter(branch_id=user.branch_id, item_type='part')
        total = parts.count()
        healthy = parts.filter(stock_quantity__gt=LOW_STOCK_THRESHOLD).count()
        availability = (Decimal(healthy) * 100 / total) if total else Decimal('0')
        score = _ratio(availability, target.availability_target)
        result['metrics'] = [
            {'key': 'availability', 'label': "Yetarli qoldiqdagi qismlar", 'unit': 'percent',
             'actual': availability.quantize(Decimal('0.1')), 'target': target.availability_target,
             'ratio': score, 'weight': Decimal('1')},
        ]
    else:
        score = None
        result['metrics'] = []

    bonus = Decimal('0')
    if score is not None and score >= MIN_FOR_BONUS:
        bonus = user.salary * months * target.bonus_rate / 100 * score
    result.update({
        'score': score.quantize(Decimal('0.001')) if score is not None else None,
        'rating': rating(score),
        'bonus': bonus.quantize(Decimal('1'), ROUND_HALF_UP),
        'months': months,
    })
    return result
