from django.db import models
from django.contrib.auth.models import AbstractUser


class Branch(models.Model):
    name = models.CharField(max_length=100)  # masalan: "Lamborghini Tashkent"
    location = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = (
        ('top_management', 'Top Management'),
        ('sales_manager', 'Sales Manager'),
        ('warehouse_manager', 'Warehouse Manager'),
        ('service_master', 'Service Master'),
    )
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default='sales_manager')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff')
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)  # oylik maosh, USD

    @property
    def is_top_management(self):
        return self.role == 'top_management' or self.is_superuser


class Inventory(models.Model):
    ITEM_TYPES = (
        ('car', 'Avtomobil'),
        ('part', 'Ehtiyot qism'),
    )
    STATUS_CHOICES = (
        ('available', 'Available'),
        ('reserved', 'Reserved'),
        ('sold', 'Sold'),
        ('out_of_stock', 'Out of stock'),
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='inventories')
    item_type = models.CharField(max_length=10, choices=ITEM_TYPES)
    name = models.CharField(max_length=150)  # Masalan: "Lamborghini Revuelto V12" yoki "Carbon Ceramic Brake Kit"
    sku_or_vin = models.CharField(max_length=100, unique=True)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.IntegerField(default=1)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='available')

    class Meta:
        verbose_name_plural = 'inventories'

    def __str__(self):
        return f"[{self.item_type.upper()}] {self.name} - {self.sku_or_vin}"


class Order(models.Model):
    ORDER_TYPES = (
        ('car_sale', 'Avtomobil Sotuvi'),
        ('service', 'Texnik Xizmat'),
    )
    STATUS_CHOICES = (
        ('pending', 'Kutilmoqda'),
        ('in_progress', 'Jarayonda'),
        ('completed', 'Bajarildi'),
        ('cancelled', 'Bekor qilindi'),
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='orders')
    order_type = models.CharField(max_length=20, choices=ORDER_TYPES)
    customer_name = models.CharField(max_length=150)
    customer_phone = models.CharField(max_length=30)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='assigned_orders')
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"#{self.pk} {self.get_order_type_display()} - {self.customer_name}"


class Document(models.Model):
    """ERP hujjati (invoice, shartnoma, hisobot...). Fayl Amazon S3'da (yoki lokal diskda) saqlanadi."""
    KIND_CHOICES = (
        ('invoice', 'Invoice'),
        ('contract', 'Shartnoma'),
        ('report', 'Hisobot'),
        ('other', 'Boshqa'),
    )
    branch = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='documents')
    order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='other')
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to='documents/%Y/%m/')
    size = models.PositiveBigIntegerField(default=0)
    content_type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='documents')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class KpiTarget(models.Model):
    """Xodimning oylik KPI rejasi. Davr rejasi = oylik reja × oylar soni."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='kpi_target')
    monthly_revenue_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monthly_orders_target = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    availability_target = models.PositiveSmallIntegerField(default=90)  # omborchi uchun, %
    bonus_rate = models.PositiveSmallIntegerField(default=20)  # maoshga nisbatan maksimal bonus, %

    def __str__(self):
        return f"KPI: {self.user}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    inventory_item = models.ForeignKey(Inventory, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)

    @property
    def subtotal(self):
        return self.unit_price * self.quantity
