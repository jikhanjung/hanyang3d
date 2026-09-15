import json

from django.core import signing
from django.test import Client, TestCase

from .economy import COOKIE, SALT, catalog, sell_price
from .models import Player, PlayerItem, Trade


class EconomyTests(TestCase):
    def setUp(self):
        self.client = Client(enforce_csrf_checks=True)
        self.start = self.client.get('/api/player/')
        self.token = self.client.cookies['csrftoken'].value

    def post(self, **body):
        return self.client.post('/api/shop/trade', data=json.dumps(body), content_type='application/json', HTTP_X_CSRFTOKEN=self.token)

    def test_player_cookie_and_state_are_server_side(self):
        data = catalog()
        self.assertEqual(self.start.json(), {'money': data['wallet']['start'], 'items': {}})
        cookie = self.start.cookies[COOKIE]
        self.assertTrue(cookie['httponly'])
        self.client.get('/api/player/')
        self.assertEqual(Player.objects.count(), 1)
        # A forged or tampered cookie is not accepted; it starts a new player instead of taking over one.
        forged = Client()
        forged.cookies[COOKIE] = signing.dumps(str(Player.objects.get().token), salt='wrong-salt')
        forged.get('/api/player/')
        self.assertEqual(Player.objects.count(), 2)

    def test_trade_requires_csrf(self):
        response = self.client.post('/api/shop/trade', data=json.dumps({'action': 'buy', 'shop': '면포전', 'item': 'cotton_bolt', 'quantity': 1}), content_type='application/json')
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Trade.objects.exists())

    def test_buy_and_sell_use_server_prices(self):
        data = catalog()
        price = data['items']['cotton_bolt']['price']
        response = self.post(action='buy', shop='면포전', item='cotton_bolt', quantity=2, price=1)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['money'], data['wallet']['start'] - 2 * price)
        self.assertEqual(response.json()['items'], {'cotton_bolt': 2})
        response = self.post(action='sell', shop='선전', item='cotton_bolt', quantity=2)
        self.assertEqual(response.json()['money'], data['wallet']['start'] - 2 * price + 2 * sell_price('cotton_bolt'))
        self.assertEqual(response.json()['items'], {})
        self.assertFalse(PlayerItem.objects.exists())
        self.assertEqual(list(Trade.objects.order_by('created_at').values_list('action', 'money_delta')), [('buy', -2 * price), ('sell', 2 * sell_price('cotton_bolt'))])

    def test_invalid_trades_change_nothing(self):
        player = Player.objects.get()
        before = player.money
        for body, status in [
            (dict(action='buy', shop='면포전', item='silk_red', quantity=1), 400),     # not sold in this shop
            (dict(action='buy', shop='없는가게', item='cotton_bolt', quantity=1), 400),
            (dict(action='buy', shop='면포전', item='gold', quantity=1), 400),
            (dict(action='buy', shop='면포전', item='cotton_bolt', quantity=0), 400),
            (dict(action='buy', shop='면포전', item='cotton_bolt', quantity=100), 400),
            (dict(action='buy', shop='면포전', item='cotton_bolt', quantity='5'), 400),
            (dict(action='steal', shop='면포전', item='cotton_bolt', quantity=1), 400),
            (dict(action='sell', shop='면포전', item='cotton_bolt', quantity=1), 400),  # nothing to sell
        ]:
            self.assertEqual(self.post(**body).status_code, status, body)
        Player.objects.filter(pk=player.pk).update(money=10)
        self.assertEqual(self.post(action='buy', shop='면포전', item='cotton_bolt', quantity=1).status_code, 400)
        player.refresh_from_db()
        self.assertEqual(player.money, 10)
        self.assertFalse(PlayerItem.objects.exists() or Trade.objects.exists())
        self.assertNotEqual(before, 10)

    def test_trades_are_rate_limited(self):
        statuses = [self.post(action='buy', shop='내어물전', item='dried_pollack', quantity=1).status_code for _ in range(6)]
        self.assertEqual(statuses[:5], [200] * 5)
        self.assertEqual(statuses[5], 429)
