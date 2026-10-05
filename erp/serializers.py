from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from . import services
from .models import Branch, Inventory, Order, OrderItem, User
from .permissions import ORDER_TYPE_BY_ROLE, ITEM_TYPE_WRITE_BY_ROLE


class BranchSerializer(serializers.ModelSerializer):
    staff_count = serializers.IntegerField(source='staff.count', read_only=True)

    class Meta:
        model = Branch
        fields = ['id', 'name', 'location', 'phone', 'created_at', 'staff_count']
        read_only_fields = ['created_at']


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True, default=None)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'role', 'role_display', 'branch', 'branch_name']
        read_only_fields = fields


class ERPTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login javobiga foydalanuvchi profili va rolini qo'shadi."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['branch'] = user.branch_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class BranchScopedMixin:
    """Top Management bo'lmagan foydalanuvchilar uchun filialni avtomatik o'rnatadi."""

    def _user(self):
        return self.context['request'].user

    def validate_branch(self, branch):
        user = self._user()
        if not user.is_top_management and branch != user.branch:
            raise serializers.ValidationError("Faqat o'zingiz biriktirilgan filial bilan ishlay olasiz.")
        return branch

    def apply_branch(self, attrs):
        user = self._user()
        if not user.is_top_management and 'branch' not in attrs and self.instance is None:
            if user.branch is None:
                raise serializers.ValidationError({'branch': 'Foydalanuvchi hech qaysi filialga biriktirilmagan.'})
            attrs['branch'] = user.branch
        if self.instance is None and 'branch' not in attrs:
            raise serializers.ValidationError({'branch': 'Bu maydon majburiy.'})
        return attrs


class InventorySerializer(BranchScopedMixin, serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    item_type_display = serializers.CharField(source='get_item_type_display', read_only=True)
    is_low_stock = serializers.SerializerMethodField()

    LOW_STOCK_THRESHOLD = 5

    class Meta:
        model = Inventory
        fields = ['id', 'branch', 'branch_name', 'item_type', 'item_type_display', 'name',
                  'sku_or_vin', 'price', 'stock_quantity', 'status', 'is_low_stock']

    def get_is_low_stock(self, obj):
        return obj.item_type == 'part' and obj.stock_quantity <= self.LOW_STOCK_THRESHOLD

    def validate_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Narx manfiy bo'lishi mumkin emas.")
        return value

    def validate_stock_quantity(self, value):
        if value < 0:
            raise serializers.ValidationError("Qoldiq manfiy bo'lishi mumkin emas.")
        return value

    def validate(self, attrs):
        attrs = self.apply_branch(attrs)
        user = self._user()
        item_type = attrs.get('item_type', getattr(self.instance, 'item_type', None))
        allowed = ITEM_TYPE_WRITE_BY_ROLE.get(user.role)
        if not user.is_top_management and allowed is not None and item_type not in allowed:
            raise serializers.ValidationError({'item_type': f"Sizning rolingiz '{item_type}' turidagi mahsulotlarni boshqara olmaydi."})
        return attrs


class OrderItemSerializer(serializers.ModelSerializer):
    inventory_item = serializers.PrimaryKeyRelatedField(queryset=Inventory.objects.all())
    inventory_name = serializers.CharField(source='inventory_item.name', read_only=True)
    item_type = serializers.CharField(source='inventory_item.item_type', read_only=True)
    sku_or_vin = serializers.CharField(source='inventory_item.sku_or_vin', read_only=True)
    unit_price = serializers.DecimalField(max_digits=12, decimal_places=2, required=False)
    subtotal = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = OrderItem
        fields = ['id', 'inventory_item', 'inventory_name', 'item_type', 'sku_or_vin',
                  'quantity', 'unit_price', 'subtotal']

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Miqdor kamida 1 bo'lishi kerak.")
        return value


class OrderSerializer(BranchScopedMixin, serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(queryset=Branch.objects.all(), required=False)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    assigned_to_name = serializers.SerializerMethodField()
    order_type_display = serializers.CharField(source='get_order_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = OrderItemSerializer(many=True, required=False)

    class Meta:
        model = Order
        fields = ['id', 'branch', 'branch_name', 'order_type', 'order_type_display',
                  'customer_name', 'customer_phone', 'assigned_to', 'assigned_to_name',
                  'total_price', 'status', 'status_display', 'items', 'created_at', 'updated_at']
        read_only_fields = ['total_price', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to is None:
            return None
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def validate(self, attrs):
        attrs = self.apply_branch(attrs)
        user = self._user()
        order_type = attrs.get('order_type', getattr(self.instance, 'order_type', None))
        allowed = ORDER_TYPE_BY_ROLE.get(user.role)
        if not user.is_top_management and allowed is not None and order_type != allowed:
            raise serializers.ValidationError({'order_type': f"Sizning rolingiz '{order_type}' buyurtmalarini boshqara olmaydi."})

        branch = attrs.get('branch', getattr(self.instance, 'branch', None))
        assignee = attrs.get('assigned_to')
        if assignee is not None and assignee.branch_id != branch.id and not assignee.is_top_management:
            raise serializers.ValidationError({'assigned_to': 'Xodim boshqa filialga biriktirilgan.'})

        items = attrs.get('items')
        if self.instance is None and not items:
            raise serializers.ValidationError({'items': "Buyurtmada kamida bitta pozitsiya bo'lishi kerak."})
        if items is not None:
            if not items:
                raise serializers.ValidationError({'items': "Buyurtmada kamida bitta pozitsiya bo'lishi kerak."})
            if order_type == 'car_sale' and not any(i['inventory_item'].item_type == 'car' for i in items):
                raise serializers.ValidationError({'items': "Avtomobil sotuvi buyurtmasida kamida bitta avtomobil bo'lishi kerak."})
            if order_type == 'service' and any(i['inventory_item'].item_type == 'car' for i in items):
                raise serializers.ValidationError({'items': "Servis buyurtmasiga faqat ehtiyot qismlar biriktiriladi."})
        return attrs

    def create(self, validated_data):
        items = validated_data.pop('items')
        validated_data.setdefault('assigned_to', self._user())
        return services.create_order(validated_data, items)

    def update(self, instance, validated_data):
        items = validated_data.pop('items', None)
        return services.update_order(instance, validated_data, items)
