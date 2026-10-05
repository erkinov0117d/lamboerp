from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Branch, Inventory, Order, OrderItem, User


@admin.register(Branch)
class BranchAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'phone', 'created_at')
    search_fields = ('name', 'location')


@admin.register(User)
class ERPUserAdmin(UserAdmin):
    list_display = ('username', 'first_name', 'last_name', 'role', 'branch', 'is_staff')
    list_filter = ('role', 'branch', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (('ERP', {'fields': ('role', 'branch')}),)
    add_fieldsets = UserAdmin.add_fieldsets + (('ERP', {'fields': ('role', 'branch')}),)


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'item_type', 'sku_or_vin', 'branch', 'price', 'stock_quantity', 'status')
    list_filter = ('item_type', 'status', 'branch')
    search_fields = ('name', 'sku_or_vin')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'order_type', 'customer_name', 'branch', 'assigned_to', 'total_price', 'status', 'created_at')
    list_filter = ('order_type', 'status', 'branch')
    search_fields = ('customer_name', 'customer_phone')
    inlines = [OrderItemInline]
