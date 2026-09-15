from django.urls import path
from django.contrib import admin
from django.contrib.staticfiles.views import serve as serve_static
from . import views

urlpatterns = [
    path('backoffice/', admin.site.urls),
    path('static/<path:path>', serve_static, {'insecure': True}),
    path('credits/', views.credits, name='credits'),
    path('guide/', views.guide, name='guide'),
    path('healthz', views.healthz, name='healthz'),
    path('gis/terrain/3d/', views.terrain3d, name='terrain3d'),
    path('gis/terrain/', views.terrain_overlay, name='terrain-overlay'),
    path('', views.terrain3d, {'canvas_only': True}, name='home'),
    path('gis/', views.dashboard, name='dashboard'),
    path('gis/index.html', views.dashboard),
    path('v/<str:version>/<path:resource>', views.versioned_resource, name='versioned-resource'),
    path('<path:resource>', views.resource, name='resource'),
]
