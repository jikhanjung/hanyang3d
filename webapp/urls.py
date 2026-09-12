from django.urls import path
from . import views

urlpatterns = [
    path('credits/', views.credits, name='credits'),
    path('healthz', views.healthz, name='healthz'),
    path('gis/terrain/3d/', views.terrain3d, name='terrain3d'),
    path('gis/terrain/', views.terrain_overlay, name='terrain-overlay'),
    path('', views.terrain3d, {'canvas_only': True}, name='home'),
    path('gis/', views.dashboard, name='dashboard'),
    path('gis/index.html', views.dashboard),
    path('<path:resource>', views.resource, name='resource'),
]
