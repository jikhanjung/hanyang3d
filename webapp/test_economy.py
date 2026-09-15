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
        self.account('나그네', 'secret-pass')

    def account(self, name, password, mode='register', client=None):
        client = client or self.client
        return client.post(f'/api/account/{mode}', data=json.dumps({'name': name, 'password': password}), content_type='application/json', HTTP_X_CSRFTOKEN=self.token)

    def post(self, **body):
        return self.client.post('/api/shop/trade', data=json.dumps(body), content_type='application/json', HTTP_X_CSRFTOKEN=self.token)

    def test_visiting_creates_no_player_and_accounts_hold_the_purse(self):
        data = catalog()
        self.assertEqual(self.start.json(), {'logged_in': False})
        self.assertEqual(Player.objects.count(), 1)  # only the registered account from setUp
        state = self.client.get('/api/player/').json()
        self.assertEqual(state, {'logged_in': True, 'name': '나그네', 'money': data['wallet']['start'], 'items': {}})
        self.assertTrue(self.client.cookies[COOKIE]['httponly'])
        self.assertTrue(Player.objects.get().password.startswith(('pbkdf2_', 'argon2', 'bcrypt', 'scrypt')))
        # A forged cookie is not accepted.
        forged = Client()
        forged.cookies[COOKIE] = signing.dumps(str(Player.objects.get().token), salt='wrong-salt')
        self.assertEqual(forged.get('/api/player/').json(), {'logged_in': False})

    def test_register_login_logout_and_name_rules(self):
        other = Client(enforce_csrf_checks=True)
        other.get('/api/player/')
        token = other.cookies['csrftoken'].value
        post = lambda url, body: other.post(url, data=json.dumps(body), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.assertEqual(post('/api/account/register', {'name': 'ＮＡＧＥＵＮＥ', 'password': 'another-pass'}).status_code, 200)
        self.assertEqual(post('/api/account/register', {'name': 'nageune', 'password': 'another-pass'}).status_code, 409)  # same name key
        self.assertEqual(post('/api/account/register', {'name': '나그네', 'password': 'x' * 10}).status_code, 409)
        self.assertEqual(post('/api/account/register', {'name': 'Аlice', 'password': 'x' * 10}).status_code, 400)
        self.assertEqual(post('/api/account/register', {'name': '짧은암호', 'password': '12345'}).status_code, 400)
        self.assertEqual(post('/api/account/logout', {}).json(), {'logged_in': False})
        other.cookies.pop(COOKIE, None)
        self.assertEqual(other.get('/api/player/').json(), {'logged_in': False})
        self.assertEqual(post('/api/account/login', {'name': '나그네', 'password': 'wrong-pass'}).status_code, 401)
        login = post('/api/account/login', {'name': '나그네', 'password': 'secret-pass'})
        self.assertEqual((login.status_code, login.json()['name']), (200, '나그네'))

    def test_anonymous_purse_is_kept_on_sign_up(self):
        import uuid
        legacy = Player.objects.create(token=uuid.uuid4(), money=1234)
        client = Client(enforce_csrf_checks=True)
        client.get('/api/player/')
        client.cookies[COOKIE] = signing.dumps(str(legacy.token), salt=SALT)
        response = client.post('/api/account/register', data=json.dumps({'name': '옛손님', 'password': 'legacy-pass'}), content_type='application/json', HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        self.assertEqual(response.json()['money'], 1234)
        legacy.refresh_from_db()
        self.assertEqual(legacy.name, '옛손님')

    def test_login_guessing_is_limited(self):
        from .models import LoginAttempt
        statuses = [self.account('나그네', f'wrong-{i}', mode='login').status_code for i in range(11)]
        self.assertEqual(statuses[:10], [401] * 10)
        self.assertEqual(statuses[10], 429)
        self.assertTrue(all(len(a.ip_hash) == 64 and '127.0.0.1' not in a.ip_hash for a in LoginAttempt.objects.all()))

    def test_trade_requires_login(self):
        anonymous = Client(enforce_csrf_checks=True)
        anonymous.get('/api/player/')
        response = anonymous.post('/api/shop/trade', data=json.dumps({'action': 'buy', 'shop': '면포전', 'item': 'cotton_bolt', 'quantity': 1}), content_type='application/json', HTTP_X_CSRFTOKEN=anonymous.cookies['csrftoken'].value)
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Trade.objects.exists())

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
        self.assertEqual(response.json()['name'], '나그네')
        response = self.post(action='sell', shop='선전', item='cotton_bolt', quantity=2)
        self.assertEqual(response.json()['money'], data['wallet']['start'] - 2 * price + 2 * sell_price('cotton_bolt'))
        self.assertEqual(response.json()['items'], {})
        self.assertFalse(PlayerItem.objects.exists())
        self.assertEqual(list(Trade.objects.order_by('created_at').values_list('action', 'money_delta')), [('buy', -2 * price), ('sell', 2 * sell_price('cotton_bolt'))])

    def test_only_one_horse_can_be_owned(self):
        data = catalog()
        price = data['items']['horse_reins']['price']
        self.assertEqual(self.post(action='buy', shop='말 장수', item='horse_reins', quantity=2).status_code, 400)
        response = self.post(action='buy', shop='말 장수', item='horse_reins', quantity=1)
        self.assertEqual((response.status_code, response.json()['items']), (200, {'horse_reins': 1}))
        again = self.post(action='buy', shop='말 장수', item='horse_reins', quantity=1)
        self.assertEqual(again.status_code, 400)
        self.assertIn('족하오', again.json()['error'])
        self.assertEqual(self.client.get('/api/player/').json()['money'], data['wallet']['start'] - price)
        self.assertEqual(self.post(action='buy', shop='면포전', item='horse_reins', quantity=1).status_code, 400)

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


class WalkTicketTests(TestCase):
    def test_ticket_names_the_logged_in_account(self):
        import hashlib, hmac, base64
        from django.test import override_settings
        client = Client(enforce_csrf_checks=True)
        client.get('/api/player/')
        self.assertEqual(client.get('/api/walk-ticket').status_code, 401)
        client.post('/api/account/register', data=json.dumps({'name': '함께걷기', 'password': 'walk-pass-1'}), content_type='application/json', HTTP_X_CSRFTOKEN=client.cookies['csrftoken'].value)
        with override_settings(WALK_TICKET_SECRET='ticket-test-secret'):
            data = client.get('/api/walk-ticket').json()
        payload, signature = data['ticket'].split('.')
        self.assertEqual(signature, hmac.new(b'ticket-test-secret', payload.encode(), hashlib.sha256).hexdigest())
        body = json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
        self.assertEqual(body['name'], '함께걷기')
        with override_settings(WALK_TICKET_SECRET=''):
            self.assertIsNone(client.get('/api/walk-ticket').json()['ticket'])
