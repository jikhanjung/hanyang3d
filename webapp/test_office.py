import json
from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission, User
from django.test import TestCase, override_settings
from .models import Item, Player


@override_settings(CONTENT_SOURCE='files')
class OfficeTests(TestCase):
    """The office is staff-only; reads render for any staff user, writes need the model permission and leave a log."""
    def setUp(self):
        self.staff = User.objects.create_user('office', password='office-secret', is_staff=True)
        self.viewer = User.objects.create_user('viewer', password='viewer-secret', is_staff=True)
        self.staff.user_permissions.add(Permission.objects.get(codename='change_item'))
        Item.objects.create(key='paper', name='종이', unit='장', price=12, icon_shape='roll', icon_color='#ffffff', position=1)
        self.client.get('/api/player/')
        self.client.post('/api/account/register', json.dumps({'name': '사무검사', 'password': 'test-secret'}), content_type='application/json')

    def test_anonymous_and_plain_users_are_kept_out(self):
        self.assertEqual(self.client.get('/office/').status_code, 302)
        self.assertTrue(self.client.get('/office/')['Location'].startswith('/office/login/'))
        User.objects.create_user('player-like', password='x')
        self.client.login(username='player-like', password='x')
        self.assertEqual(self.client.get('/office/').status_code, 403)

    def test_pages_render_for_staff(self):
        self.client.login(username='viewer', password='viewer-secret')
        player = Player.objects.get(name='사무검사')
        for url in ['/office/', '/office/players/', f'/office/players/{player.pk}/', '/office/buildings/?year=1907&q=', '/office/items/', '/office/events/', '/office/events/agwanpacheon/']:
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
        self.assertContains(self.client.get('/office/players/'), '사무검사')
        self.assertContains(self.client.get('/office/events/agwanpacheon/'), 'procession')
        self.assertEqual(self.client.get('/office/events/none/').status_code, 404)
        # Without change_item the price form is not offered and the write is refused.
        self.assertNotContains(self.client.get('/office/items/'), 'name="price"')
        self.assertEqual(self.client.post('/office/items/paper/price/', {'price': 20}).status_code, 403)

    def test_price_change_is_logged(self):
        self.client.login(username='office', password='office-secret')
        self.assertContains(self.client.get('/office/items/'), 'name="price"')
        self.assertEqual(self.client.post('/office/items/paper/price/', {'price': 0}).status_code, 302)
        self.assertEqual(Item.objects.get(key='paper').price, 12)
        self.client.post('/office/items/paper/price/', {'price': 20})
        self.assertEqual(Item.objects.get(key='paper').price, 20)
        self.assertEqual(LogEntry.objects.filter(object_repr__contains='종이').count(), 1)
