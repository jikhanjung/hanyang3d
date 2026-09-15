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
    path('api/player/', views.player_state, name='player-state'),
    path('api/shop/trade', views.shop_trade, name='shop-trade'),
    path('api/account/register', views.account_register, name='account-register'),
    path('api/account/login', views.account_login, name='account-login'),
    path('api/account/logout', views.account_logout, name='account-logout'),
    path('gis/terrain/3d/', views.terrain3d, name='terrain3d'),
    path('gis/terrain/', views.terrain_overlay, name='terrain-overlay'),
    path('', views.terrain3d, {'canvas_only': True}, name='home'),
    path('gis/', views.dashboard, name='dashboard'),
    path('gis/index.html', views.dashboard),
    path('v/<str:version>/<path:resource>', views.versioned_resource, name='versioned-resource'),
    path('<path:resource>', views.resource, name='resource'),
]
