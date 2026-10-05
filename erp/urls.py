from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = DefaultRouter()
router.register('branches', views.BranchViewSet, basename='branch')
router.register('users', views.UserViewSet, basename='user')
router.register('inventory', views.InventoryViewSet, basename='inventory')
router.register('orders', views.OrderViewSet, basename='order')

auth_urlpatterns = [
    path('token/', views.ERPTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', views.me, name='me'),
]

urlpatterns = [
    path('auth/', include(auth_urlpatterns)),
    path('v1/analytics/', views.AnalyticsView.as_view(), name='analytics'),
    path('v1/', include(router.urls)),
]
