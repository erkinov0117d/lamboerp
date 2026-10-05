from rest_framework.permissions import SAFE_METHODS, BasePermission

# Rol -> ko'rish mumkin bo'lgan ombor mahsulot turlari
ITEM_TYPE_READ_BY_ROLE = {
    'sales_manager': ('car',),
    'warehouse_manager': ('part',),
    'service_master': ('part',),
}

# Rol -> yaratish/o'zgartirish mumkin bo'lgan ombor mahsulot turlari
ITEM_TYPE_WRITE_BY_ROLE = {
    'sales_manager': ('car',),
    'warehouse_manager': ('part',),
    'service_master': (),
}

# Rol -> boshqaradigan buyurtma turi (yo'q bo'lsa — faqat o'qish)
ORDER_TYPE_BY_ROLE = {
    'sales_manager': 'car_sale',
    'service_master': 'service',
}


def is_top(user):
    return bool(user and user.is_authenticated and user.is_top_management)


class IsTopManagement(BasePermission):
    message = "Bu amal faqat Bosh Boshqarma (Top Management) uchun ruxsat etilgan."

    def has_permission(self, request, view):
        return is_top(request.user)


class BranchScopedPermission(BasePermission):
    """
    Top Management — barcha filiallar bo'yicha to'liq ruxsat.
    Qolgan rollar — faqat o'z filiali doirasida; yozish huquqi
    `view.write_roles` ro'yxatidagi rollarga beriladi.
    """
    message = "Sizda bu amal uchun ruxsat yo'q."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if is_top(user):
            return True
        if user.branch_id is None:
            self.message = 'Foydalanuvchi hech qaysi filialga biriktirilmagan.'
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role in getattr(view, 'write_roles', ())

    def has_object_permission(self, request, view, obj):
        user = request.user
        if is_top(user):
            return True
        return obj.branch_id == user.branch_id
