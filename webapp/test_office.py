import json
from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import Permission, User
from django.test import TestCase, override_settings
from .models import EventProgress, Item, Player


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

    def test_money_adjustment_and_event_reset_need_permission_reason_and_log(self):
        player = Player.objects.get(name='사무검사')
        progress = EventProgress.objects.create(player=player, event_id='agwanpacheon-1896', definition_version=3, status='completed', checkpoint=13)
        money_url, reset_url = f'/office/players/{player.pk}/money/', f'/office/players/{player.pk}/events/{progress.pk}/reset/'
        self.client.login(username='viewer', password='viewer-secret')
        self.assertNotContains(self.client.get(f'/office/players/{player.pk}/'), 'name="delta"')
        self.assertEqual(self.client.post(money_url, {'delta': 100, 'reason': '검사'}).status_code, 403)
        self.assertEqual(self.client.post(reset_url, {'reason': '검사'}).status_code, 403)
        self.staff.user_permissions.add(Permission.objects.get(codename='change_player'), Permission.objects.get(codename='change_eventprogress'))
        self.client.login(username='office', password='office-secret')
        self.assertContains(self.client.get(f'/office/players/{player.pk}/'), 'name="delta"')
        before = player.money
        self.client.post(money_url, {'delta': 100, 'reason': ''})          # no reason: refused
        self.client.post(money_url, {'delta': -(before + 1), 'reason': '너무 많이'})  # below zero: refused
        self.client.post(money_url, {'delta': 0, 'reason': '영'})           # zero: refused
        self.assertEqual(Player.objects.get(pk=player.pk).money, before)
        self.client.post(money_url, {'delta': 150, 'reason': '검사 지급'})
        self.assertEqual(Player.objects.get(pk=player.pk).money, before + 150)
        self.client.post(reset_url, {'reason': '다시 보기 요청'})
        progress.refresh_from_db()
        self.assertEqual((progress.status, progress.checkpoint, progress.completed_at), ('new', 0, None))
        logs = LogEntry.objects.filter(object_id=str(player.pk)).order_by('id')
        self.assertEqual(logs.count(), 2)
        self.assertIn('검사 지급', logs[0].change_message); self.assertIn('다시 보기 요청', logs[1].change_message)
        self.assertContains(self.client.get(f'/office/players/{player.pk}/'), '다시 보기 요청')
