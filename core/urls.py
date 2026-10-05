from django.conf import settings
from django.contrib import admin
from django.http import FileResponse
from django.shortcuts import redirect
from django.urls import include, path, re_path


def frontend(request):
    """React ilovasi (SPA): barcha sahifalar uchun index.html qaytariladi."""
    index = settings.FRONTEND_DIST / 'index.html'
    if index.exists():
        return FileResponse(open(index, 'rb'), content_type='text/html')
    # Build qilinmagan (development) — Vite dev serverga yo'naltiramiz.
    return redirect('http://localhost:5173' + request.path)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('erp.urls')),
    re_path(r'^(?!api/|admin/|static/).*$', frontend),
]
