from django.contrib.auth import views as auth_views
from django.urls import path
from . import views

app_name = 'office'
urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('login/', auth_views.LoginView.as_view(template_name='office/login.html', redirect_authenticated_user=True), name='login'),
    path('logout/', auth_views.LogoutView.as_view(next_page='office:login'), name='logout'),
    path('players/', views.players, name='players'),
    path('players/<int:pk>/', views.player_detail, name='player'),
    path('players/<int:pk>/money/', views.player_money, name='player-money'),
    path('players/<int:pk>/events/<int:progress_pk>/reset/', views.player_event_reset, name='player-event-reset'),
    path('buildings/', views.buildings, name='buildings'),
    path('items/', views.items, name='items'),
    path('items/<slug:key>/price/', views.item_price, name='item-price'),
    path('events/', views.events, name='events'),
    path('events/<slug:slug>/', views.event_detail, name='event'),
]
