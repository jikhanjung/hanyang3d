import json
from django.test import TestCase, Client, override_settings
from .models import Player, EventProgress
from .events import definition as _definition, definitions, last_checkpoint, validate
def definition():return _definition('agwanpacheon')
from .economy import catalog
def definition_shops():return catalog()['shops']

class HistoricalEventTests(TestCase):
    def setUp(self):
        self.client.get('/api/player/')
        self.client.post('/api/account/register',json.dumps({'name':'회상검사','password':'test-secret'}),content_type='application/json')
    def post(self,**data):return self.client.post('/api/events/agwanpacheon/',json.dumps(data),content_type='application/json')
    def test_auth_version_order_resume_completion_replay(self):
        self.assertEqual(Client().post('/api/events/agwanpacheon/',data='{}',content_type='application/json').status_code,401)
        # The caretaker's bundle opens the visit: refused before it is received, granted once, never sold.
        self.assertEqual(self.post(action='start',version=definition()['version']).status_code,409)
        self.assertEqual(self.post(action='keepsake').json(),{'item':'legation_keepsake','received':True})
        self.assertEqual(self.post(action='keepsake').json()['received'],False)
        self.assertEqual(self.client.get('/api/player/').json()['items'],{'legation_keepsake':1})
        shop=next(iter(definition_shops()))
        self.assertEqual(self.client.post('/api/shop/trade',json.dumps({'action':'sell','shop':shop,'item':'legation_keepsake','quantity':1}),content_type='application/json').status_code,400)
        self.assertEqual(self.post(action='start',version=99).status_code,409)
        self.assertEqual(self.post(action='start',version=definition()['version']).json()['checkpoint'],0)
        self.assertEqual(self.post(action='checkpoint',checkpoint=3,version=definition()['version']).status_code,409)
        self.assertEqual(last_checkpoint(definition()),13)
        self.assertEqual(self.post(action='complete',version=definition()['version']).status_code,409)
        for i in range(1,last_checkpoint(definition())+1):self.assertEqual(self.post(action='checkpoint',checkpoint=i,version=definition()['version']).json()['checkpoint'],i)
        first=self.post(action='complete',version=definition()['version']).json()
        self.assertEqual(first['status'],'completed')
        self.assertEqual(self.post(action='complete',version=definition()['version']).json()['completed_at'],first['completed_at'])
        self.assertEqual(self.post(action='restart',version=definition()['version']).json()['checkpoint'],0)
        self.assertEqual(self.post(action='status').json()['completed_at'],first['completed_at'])
        self.assertEqual(EventProgress.objects.count(),1)
    def test_old_route_requires_restart_but_new_account_uses_current_version(self):
        self.post(action='keepsake');current=definition()['version']
        self.assertEqual(self.post(action='status').json()['version'],current)
        row=EventProgress.objects.get();row.definition_version=current-1;row.status='active';row.checkpoint=4;row.save()
        self.assertEqual(self.post(action='start',version=current).status_code,409)
        restarted=self.post(action='restart',version=current).json()
        self.assertEqual((restarted['version'],restarted['checkpoint']),(current,0))
    @override_settings(CONTENT_SOURCE='files')
    def test_flashback_page_is_separate(self):
        self.assertEqual(self.client.get('/events/agwanpacheon/').context['historical_event']['date'],'1896-02-11')
        page=self.client.get('/1907/')
        self.assertIsNone(page.context['historical_event'])
        # The base scene learns only what it needs from each visit: slug, keepsake giver and transition captions.
        self.assertEqual([v['slug'] for v in page.context['historical_events']],['agwanpacheon'])
        self.assertEqual(page.context['historical_events'][0]['keepsake']['giver_building'],'russian-legation-1907')
        self.assertEqual(self.client.get('/events/no-such-visit/').status_code,404)
        self.assertEqual(self.post_to('no-such-visit',action='status').status_code,404)
    def post_to(self,slug,**data):return self.client.post(f'/api/events/{slug}/',json.dumps(data),content_type='application/json')
    def test_every_definition_validates(self):
        for slug,data in definitions().items():
            validate(data)
            self.assertEqual(data['slug'],slug)
            self.assertGreaterEqual(last_checkpoint(data),1)

class ActionBarTests(TestCase):
    def setUp(self):
        self.client.get('/api/player/')
        self.client.post('/api/account/register',json.dumps({'name':'액션검사','password':'test-secret'}),content_type='application/json')
    def post(self,**data):return self.client.post('/api/player/action-bar/',json.dumps(data),content_type='application/json')
    def test_other_browser_empty_layout_and_legacy_cannot_overwrite(self):
        slots=['horse_reins']+[None]*9
        self.assertIsNone(self.client.get('/api/player/').json()['action_bar'])
        self.assertEqual(self.post(slots=slots,revision=0,import_legacy=True).status_code,200)
        other=Client();other.get('/api/player/');other.post('/api/account/login',json.dumps({'name':'액션검사','password':'test-secret'}),content_type='application/json')
        self.assertEqual(other.get('/api/player/').json()['action_bar'],slots)
        self.assertEqual(self.post(slots=[None]*10,revision=1).status_code,200)
        self.assertEqual(self.post(slots=slots,revision=2,import_legacy=True).status_code,409)
        self.assertEqual(other.get('/api/player/').json()['action_bar'],[None]*10)
        self.assertEqual(self.post(slots=slots,revision=1).status_code,409)
    def test_validation_and_anonymous(self):
        self.assertEqual(Client(enforce_csrf_checks=True).post('/api/player/action-bar/',data='{}',content_type='application/json').status_code,403)
        self.assertEqual(Client().post('/api/player/action-bar/',data='{}',content_type='application/json').status_code,401)
        for slots in [[None],['not-an-item']+[None]*9,[{}]+[None]*9]:self.assertEqual(self.post(slots=slots,revision=0).status_code,400)
        self.assertEqual(self.post(slots=[None]*10,revision=True).status_code,400)
