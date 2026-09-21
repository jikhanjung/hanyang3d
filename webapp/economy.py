"""Server-authoritative shop trades.

The browser never decides prices, coins or pack contents. Players log in with a name and password (webapp/accounts.py);
a signed, HttpOnly cookie then identifies the account. Goods, prices and each shop's goods come from the content
database (Item, Shop; edited in the back office, seeded from gis/characters/npcs.json); dialogue and the wallet
settings stay in that JSON.
"""
import json
import math
import uuid
from datetime import timedelta
from functools import lru_cache

from django.conf import settings
from django.core import signing
from django.db import DatabaseError, transaction
from django.utils import timezone

from .i18n import t
from .models import Player, PlayerItem, Trade

COOKIE = 'hanyang3d_player'
SALT = 'hanyang3d.player'
MAX_QUANTITY = 99
TRADES_PER_SECOND = 5


@lru_cache(maxsize=2)
def _catalog(mtime):
    return json.loads((settings.BASE_DIR / 'gis/characters/npcs.json').read_text())


def catalog():
    path = settings.BASE_DIR / 'gis/characters/npcs.json'
    data = dict(_catalog(path.stat().st_mtime_ns))
    try:
        from .models import Item, Shop
        items = {i.key: i.as_catalog() for i in Item.objects.filter(published=True)}
        shops = {s.key: {'about': s.about, 'items': [i.key for i in s.items.all() if i.key in items]}
                 for s in Shop.objects.filter(published=True).prefetch_related('items')}
    except DatabaseError:
        return data  # no content database (file-only preview): the seed JSON is shown as is
    if items or shops:
        data['items'], data['shops'] = items, shops
    return data


class TradeError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status, self.message = status, message


def player_from_cookie(request):
    """The player named by a valid signed cookie, or None. Nothing is created by just visiting."""
    raw = request.COOKIES.get(COOKIE)
    if not raw:
        return None
    try:
        token = uuid.UUID(signing.loads(raw, salt=SALT))
    except (signing.BadSignature, ValueError, TypeError):
        return None
    return Player.objects.filter(token=token).first()


def cookie_value(player):
    return signing.dumps(str(player.token), salt=SALT)


def attach_cookie(response, value):
    if value:
        response.set_cookie(COOKIE, value, max_age=365 * 24 * 3600, httponly=True, samesite='Lax',
                            secure=settings.SESSION_COOKIE_SECURE)
    return response


def state(player):
    if not player or not player.name_key:
        return {'logged_in': False}
    return {'logged_in': True, 'name': player.name, 'money': player.money, 'action_bar': player.action_bar, 'action_bar_revision': player.action_bar_revision, 'items': {i.item: i.quantity for i in player.items.all()}}


def sell_price(item):
    data = catalog()
    return math.floor(data['items'][item]['price'] * data['wallet']['sell_rate'])


def trade(player, action, shop, item, quantity, lang='ko'):
    data = catalog()
    if action not in ('buy', 'sell'):
        raise TradeError(400, t('알 수 없는 거래입니다.', lang))
    if type(quantity) is not int or not 1 <= quantity <= MAX_QUANTITY:
        raise TradeError(400, t('수량은 1~{max} 사이여야 하오.', lang, max=MAX_QUANTITY))
    if shop not in data['shops']:
        raise TradeError(400, t('그런 가게는 없소.', lang))
    if item not in data['items']:
        raise TradeError(400, t('그런 물건은 없소.', lang))
    if action == 'buy' and item not in data['shops'][shop]['items']:
        raise TradeError(400, t('이 가게에서 파는 물건이 아니오.', lang))
    with transaction.atomic():
        player = Player.objects.select_for_update().get(pk=player.pk)
        if Trade.objects.filter(player=player, created_at__gte=timezone.now() - timedelta(seconds=1)).count() >= TRADES_PER_SECOND:
            raise TradeError(429, t('너무 빨리 거래하고 있소. 잠시 뒤에 하시오.', lang))
        row = data['items'][item]
        name, unit = (row.get('name_en') or row['name'], row.get('unit_en') or row['unit']) if lang == 'en' else (row['name'], row['unit'])
        stock = PlayerItem.objects.filter(player=player, item=item).first()
        if action == 'buy':
            # Some goods (a horse's reins) make sense only once in a pack.
            limit = data['items'][item].get('max_owned')
            if limit and (stock.quantity if stock else 0) + quantity > limit:
                raise TradeError(400, t('{name}은(는) {limit}{unit}이면 족하오.', lang, name=name, limit=limit, unit=unit))
            cost = data['items'][item]['price'] * quantity
            if player.money < cost:
                raise TradeError(400, t('엽전이 모자라오.', lang))
            player.money -= cost
            if stock:
                stock.quantity += quantity; stock.save()
            else:
                PlayerItem.objects.create(player=player, item=item, quantity=quantity)
            delta, message = -cost, t('{name} {quantity}{unit}을(를) 샀소.', lang, name=name, quantity=quantity, unit=unit)
        else:
            # A keepsake that opens a historical visit is not merchandise.
            if row.get('use') == 'flashback':
                raise TradeError(400, t('{name}은(는) 팔 물건이 아니오.', lang, name=name))
            if not stock or stock.quantity < quantity:
                raise TradeError(400, t('봇짐에 그만큼 없소.', lang))
            gain = sell_price(item) * quantity
            player.money += gain
            stock.quantity -= quantity
            if stock.quantity:
                stock.save()
            else:
                stock.delete()
            delta, message = gain, t('{name} {quantity}{unit}을(를) 팔았소.', lang, name=name, quantity=quantity, unit=unit)
        player.save()
        Trade.objects.create(player=player, action=action, shop=shop, item=item, quantity=quantity,
                             money_delta=delta, money_after=player.money)
    return player, message
