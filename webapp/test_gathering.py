import json
from datetime import timedelta
from unittest.mock import patch
from django.test import TestCase,Client
from django.utils import timezone
from django.core.management import call_command
from .models import Player,PlayerItem,FishingCast,HerbHarvest,Item
from .economy import catalog,sell_price

class GatheringTests(TestCase):
    def setUp(self):
        self.client.get('/api/player/')
        self.client.post('/api/account/register',data=json.dumps({'name':'낚시검사','password':'test-secret'}),content_type='application/json')
        self.player=Player.objects.get(name='낚시검사')
        self.node=catalog()['herbs']['nodes'][0]['id']
    def post(self,url,**data):return self.client.post(url,data=json.dumps(data),content_type='application/json')
    def rod(self):PlayerItem.objects.create(player=self.player,item='fishing_rod',quantity=1)
    def ready(self):FishingCast.objects.filter(player=self.player).update(ready_at=timezone.now()-timedelta(seconds=1))
    def test_login_csrf_rod_and_valid_actions(self):
        self.assertEqual(Client().post('/api/fishing',data='{}',content_type='application/json').status_code,401)
        self.assertEqual(Client(enforce_csrf_checks=True).post('/api/herbs',data='{}',content_type='application/json').status_code,403)
        self.assertEqual(self.post('/api/fishing',action='start',era=1907).status_code,400)
        self.rod()
        for era in [True,1700,None]:self.assertEqual(self.post('/api/fishing',action='start',era=era).status_code,400)
        self.assertEqual(self.post('/api/herbs',action='gather',node='made-up').status_code,400)
    def test_cast_wait_repeat_request_and_reward_only_once(self):
        self.rod();a=self.post('/api/fishing',action='start',era=1750).json();b=self.post('/api/fishing',action='start',era=1750).json()
        self.assertEqual(a['token'],b['token']);self.assertGreaterEqual(a['wait_ms'],18000);self.assertLessEqual(a['wait_ms'],30000)
        self.assertEqual(self.post('/api/fishing',action='finish',token=a['token']).status_code,409)
        self.ready()
        with patch('webapp.fishing.secrets.randbelow',return_value=14):
            for _ in range(3):self.assertTrue(self.post('/api/fishing',action='finish',token=a['token']).json()['caught'])
        self.assertEqual(PlayerItem.objects.get(player=self.player,item='river_fish').quantity,1)
        c=self.post('/api/fishing',action='start',era=1907).json();self.assertNotEqual(a['token'],c['token'])
        self.assertEqual(self.post('/api/fishing',action='finish',token=a['token']).status_code,409)
    def test_other_account_cannot_redeem_cast_and_has_separate_herbs(self):
        self.rod();cast=self.post('/api/fishing',action='start',era=1907).json();self.ready()
        with patch('webapp.gathering.secrets.randbelow',return_value=0):self.post('/api/herbs',action='gather',node=self.node)
        other=Client();other.post('/api/account/register',data=json.dumps({'name':'다른나그네','password':'test-secret'}),content_type='application/json')
        result=other.post('/api/fishing',data=json.dumps({'action':'finish','token':cast['token']}),content_type='application/json')
        self.assertEqual(result.status_code,409)
        with patch('webapp.gathering.secrets.randbelow',return_value=0):
            result=other.post('/api/herbs',data=json.dumps({'action':'gather','node':self.node}),content_type='application/json')
        self.assertEqual(result.status_code,200);self.assertTrue(result.json()['caught'])

    def test_failure_cancellation_expiry_and_missing_rod(self):
        self.rod();a=self.post('/api/fishing',action='start',era=1907).json();self.ready()
        with patch('webapp.fishing.secrets.randbelow',return_value=15):self.assertFalse(self.post('/api/fishing',action='finish',token=a['token']).json()['caught'])
        a=self.post('/api/fishing',action='start',era=1907).json();self.post('/api/fishing',action='cancel',token=a['token']);self.ready()
        self.assertEqual(self.post('/api/fishing',action='finish',token=a['token']).json()['status'],'cancelled')
        a=self.post('/api/fishing',action='start',era=1907).json();FishingCast.objects.filter(player=self.player).update(expires_at=timezone.now()-timedelta(seconds=1));self.assertEqual(self.post('/api/fishing',action='finish',token=a['token']).json()['status'],'cancelled')
        a=self.post('/api/fishing',action='start',era=1907).json();self.ready();PlayerItem.objects.filter(player=self.player,item='fishing_rod').delete();self.assertEqual(self.post('/api/fishing',action='finish',token=a['token']).status_code,400)
        self.assertFalse(PlayerItem.objects.filter(player=self.player,item='river_fish').exists())
    def test_herb_probability_cooldown_and_account_scoping(self):
        with patch('webapp.gathering.secrets.randbelow',return_value=79):self.assertTrue(self.post('/api/herbs',action='gather',node=self.node).json()['caught'])
        self.assertEqual(self.post('/api/herbs',action='gather',node=self.node).status_code,409)
        self.assertIn(self.node,self.post('/api/herbs',action='status').json()['cooldowns'])
        HerbHarvest.objects.filter(player=self.player).update(next_at=timezone.now()-timedelta(seconds=1))
        with patch('webapp.gathering.secrets.randbelow',return_value=80):self.assertFalse(self.post('/api/herbs',action='gather',node=self.node).json()['caught'])
        self.assertEqual(PlayerItem.objects.get(player=self.player,item='mountain_herb').quantity,1)
    def test_catches_sell_through_existing_merchant_without_double_spend(self):
        for item,shop in [('river_fish','내어물전'),('mountain_herb','약재상')]:
            PlayerItem.objects.create(player=self.player,item=item,quantity=1);before=Player.objects.get(pk=self.player.pk).money
            r=self.post('/api/shop/trade',action='sell',shop=shop,item=item,quantity=1);self.assertEqual(r.status_code,200);self.assertEqual(r.json()['money'],before+sell_price(item))
            self.assertEqual(self.post('/api/shop/trade',action='sell',shop=shop,item=item,quantity=1).status_code,400)
    def test_seed_preserves_existing_prices_and_player_inventory(self):
        self.rod();Item.objects.filter(key='fishing_rod').update(price=99)
        call_command('seed_fishing');self.assertEqual(Item.objects.get(key='fishing_rod').price,99);self.assertEqual(PlayerItem.objects.get(player=self.player,item='fishing_rod').quantity,1)
