import json
from django.test import TestCase, Client, override_settings
from .models import Player, EventProgress

class HistoricalEventTests(TestCase):
    def setUp(self):
        self.client.get('/api/player/')
        self.client.post('/api/account/register',json.dumps({'name':'회상검사','password':'test-secret'}),content_type='application/json')
    def post(self,**data):return self.client.post('/api/events/agwanpacheon/',json.dumps(data),content_type='application/json')
    def test_auth_version_order_resume_completion_replay(self):
        self.assertEqual(Client().post('/api/events/agwanpacheon/',data='{}',content_type='application/json').status_code,401)
        self.assertEqual(self.post(action='start',version=99).status_code,409)
        self.assertEqual(self.post(action='start',version=1).json()['checkpoint'],0)
        self.assertEqual(self.post(action='checkpoint',checkpoint=3,version=1).status_code,409)
        for i in range(1,8):self.assertEqual(self.post(action='checkpoint',checkpoint=i,version=1).json()['checkpoint'],i)
        first=self.post(action='complete',version=1).json()
        self.assertEqual(first['status'],'completed')
        self.assertEqual(self.post(action='complete',version=1).json()['completed_at'],first['completed_at'])
        self.assertEqual(self.post(action='restart',version=1).json()['checkpoint'],0)
        self.assertEqual(self.post(action='status').json()['completed_at'],first['completed_at'])
        self.assertEqual(EventProgress.objects.count(),1)
    @override_settings(CONTENT_SOURCE='files')
    def test_flashback_page_is_separate(self):
        self.assertEqual(self.client.get('/events/agwanpacheon/').context['historical_event']['date'],'1896-02-11')
        self.assertIsNone(self.client.get('/1907/').context['historical_event'])

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
