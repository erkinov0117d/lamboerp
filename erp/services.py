"""Buyurtma va ombor qoldig'i bilan bog'liq biznes-logika."""
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from .models import Inventory, Order, OrderItem


def _refresh_status(item):
    if item.status == 'sold':
        return
    if item.stock_quantity > 0:
        item.status = 'available'
    else:
        item.status = 'reserved' if item.item_type == 'car' else 'out_of_stock'


def reserve_items(order, items_data):
    """Buyurtmaga pozitsiyalarni qo'shadi va ombordan qoldiqni ayiradi."""
    total = Decimal('0')
    for data in items_data:
        inv = Inventory.objects.select_for_update().get(pk=data['inventory_item'].pk)
        qty = data.get('quantity', 1)
        if inv.branch_id != order.branch_id:
            raise ValidationError({'items': f"'{inv.name}' boshqa filialga tegishli."})
        if inv.status == 'sold' or inv.stock_quantity < qty:
            raise ValidationError({'items': f"'{inv.name}' uchun omborda yetarli qoldiq yo'q (mavjud: {inv.stock_quantity})."})
        inv.stock_quantity -= qty
        _refresh_status(inv)
        inv.save(update_fields=['stock_quantity', 'status'])
        unit_price = data.get('unit_price') or inv.price
        OrderItem.objects.create(order=order, inventory_item=inv, quantity=qty, unit_price=unit_price)
        total += unit_price * qty
    return total


def release_items(order):
    """Buyurtma pozitsiyalarini omborga qaytaradi."""
    for oi in order.items.all():
        inv = Inventory.objects.select_for_update().get(pk=oi.inventory_item_id)
        inv.stock_quantity += oi.quantity
        if inv.status == 'sold':
            inv.status = 'available'
        _refresh_status(inv)
        inv.save(update_fields=['stock_quantity', 'status'])


def mark_cars_sold(order):
    for oi in order.items.select_related('inventory_item'):
        inv = oi.inventory_item
        if inv.item_type == 'car' and inv.stock_quantity == 0:
            inv.status = 'sold'
            inv.save(update_fields=['status'])


def unmark_cars_sold(order):
    for oi in order.items.select_related('inventory_item'):
        inv = oi.inventory_item
        if inv.status == 'sold':
            inv.status = 'available'
            _refresh_status(inv)
            inv.save(update_fields=['status'])


def recalc_total(order):
    order.total_price = sum((oi.subtotal for oi in order.items.all()), Decimal('0'))
    order.save(update_fields=['total_price', 'updated_at'])


@transaction.atomic
def create_order(validated_data, items_data):
    order = Order.objects.create(**validated_data)
    if order.status == 'cancelled':
        raise ValidationError({'status': "Buyurtmani 'cancelled' holatida yaratib bo'lmaydi."})
    order.total_price = reserve_items(order, items_data)
    order.save(update_fields=['total_price'])
    if order.status == 'completed' and order.order_type == 'car_sale':
        mark_cars_sold(order)
    return order


@transaction.atomic
def update_order(order, validated_data, items_data=None):
    old_status = order.status
    new_status = validated_data.get('status', old_status)

    if old_status in ('completed', 'cancelled') and items_data is not None:
        raise ValidationError({'items': "Yakunlangan yoki bekor qilingan buyurtma pozitsiyalarini o'zgartirib bo'lmaydi."})
    if old_status == 'cancelled' and new_status != 'cancelled':
        raise ValidationError({'status': "Bekor qilingan buyurtmani qayta ochib bo'lmaydi."})

    if 'branch' in validated_data and validated_data['branch'] != order.branch and items_data is None:
        raise ValidationError({'branch': "Filialni o'zgartirishda pozitsiyalarni ham qayta yuboring."})

    for attr, value in validated_data.items():
        setattr(order, attr, value)
    order.save()

    if items_data is not None:
        release_items(order)
        order.items.all().delete()
        reserve_items(order, items_data)
        recalc_total(order)

    if new_status == 'cancelled' and old_status != 'cancelled':
        release_items(order)
    elif new_status == 'completed' and order.order_type == 'car_sale':
        mark_cars_sold(order)
    elif old_status == 'completed' and new_status in ('pending', 'in_progress'):
        unmark_cars_sold(order)
    return order


@transaction.atomic
def delete_order(order):
    if order.status in ('pending', 'in_progress'):
        release_items(order)
    order.delete()
