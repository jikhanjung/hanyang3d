from django.urls import path
from . import views

urlpatterns = [
    path('healthz', views.healthz, name='healthz'),
    path('gis/terrain/3d/', views.terrain3d, name='terrain3d'),
    path('gis/terrain/', views.terrain_overlay, name='terrain-overlay'),
    path('', views.dashboard, name='dashboard'),
    path('gis/', views.dashboard),
    path('gis/index.html', views.dashboard),
    path('<path:resource>', views.resource, name='resource'),
]
