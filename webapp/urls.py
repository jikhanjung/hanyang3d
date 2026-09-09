from django.urls import path
from . import views

urlpatterns = [
    path('gis/terrain/', views.terrain_overlay, name='terrain-overlay'),
    path('', views.dashboard, name='dashboard'),
    path('gis/', views.dashboard),
    path('gis/index.html', views.dashboard),
    path('<path:resource>', views.resource, name='resource'),
]
