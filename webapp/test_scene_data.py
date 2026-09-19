import copy
import io
import json
import tempfile
from pathlib import Path
from django.test import TestCase, override_settings
from django.core.management import call_command
from django.core.management.base import CommandError
from webapp.models import SceneDataset
from webapp.scene_data import seed, digest, validate, load

@override_settings(CONTENT_SOURCE='database')
class SceneDataTests(TestCase):
    def setUp(self):call_command('seed_scene_data',stdout=io.StringIO())
    def bundle(self,key,value,expected=None):
        return {'schema_version':1,'datasets':{key:{'expected_sha256':expected or digest(load(key)),'data':value}},'buildings':{}}
    def apply(self,bundle,apply=False):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'update.json';path.write_text(json.dumps(bundle))
            out=io.StringIO();call_command('apply_scene_data',str(path),apply=apply,stdout=out);return json.loads(out.getvalue())
    def test_seed_preserves_edits_and_dry_run_does_not_write(self):
        value=load('settlement1907');value['max_houses']=900
        bundle=self.bundle('settlement1907',value)
        self.assertEqual(self.apply(bundle)['changed'],1)
        self.assertNotEqual(load('settlement1907')['max_houses'],900)
        self.assertEqual(self.apply(bundle,True)['changed'],1)
        call_command('seed_scene_data',stdout=io.StringIO())
        self.assertEqual(load('settlement1907')['max_houses'],900)
    def test_hash_conflict_rolls_back_whole_bundle(self):
        value=load('settlement1907');value['max_houses']=800
        bundle=self.bundle('settlement1907',value)
        bundle['datasets']['walking1907']={'expected_sha256':'bad','data':load('walking1907')}
        with self.assertRaises(CommandError):self.apply(bundle,True)
        self.assertNotEqual(load('settlement1907')['max_houses'],800)
    def test_invalid_geometry_is_rejected(self):
        value=load('infrastructure1907');value['roads']['features'][0]['centerline']=[[0,0],[float('nan'),2]]
        with self.assertRaises(CommandError):self.apply(self.bundle('infrastructure1907',value),True)
        value=load('settlement1907');value['max_houses']=1000000
        with self.assertRaises(CommandError):self.apply(self.bundle('settlement1907',value),True)
    def test_dynamic_response_revalidates_without_new_image(self):
        url='/api/scene-data/settlement1907/'
        a=self.client.get(url);self.assertEqual(a.status_code,200);self.assertNotIn('immutable',a['Cache-Control'])
        self.assertEqual(self.client.get(url,HTTP_IF_NONE_MATCH=a['ETag']).status_code,304)
        value=load('settlement1907');value['max_houses']=700;self.apply(self.bundle('settlement1907',value),True)
        b=self.client.get(url,HTTP_IF_NONE_MATCH=a['ETag']);self.assertEqual(b.status_code,200);self.assertEqual(b.json()['max_houses'],700);self.assertNotEqual(a['ETag'],b['ETag'])
    def test_route_change_requests_multiplayer_restart(self):
        value=load('walking1907');value['routes'][0]['pixel_points'][1][0]+=1
        self.assertTrue(self.apply(self.bundle('walking1907',value),True)['multiplayer_restart_required'])
    def test_unregistered_keys_and_public_writes_are_rejected(self):
        self.assertEqual(self.client.get('/api/scene-data/secrets/').status_code,404)
        self.assertEqual(self.client.post('/api/scene-data/settlement1907/',{}).status_code,405)

    def test_building_patch_and_page_use_database(self):
        call_command('import_content',stdout=io.StringIO())
        from webapp.models import Building
        building=Building.objects.get(key='dansungsa-1907');old=copy.deepcopy(building.map_config);new=copy.deepcopy(old);new['display_yaw_deg']=123
        value=load('settlement1907');value['max_houses']=321
        bundle=self.bundle('settlement1907',value);bundle['buildings'][building.key]={'expected_sha256':digest(old),'map_config':new}
        self.apply(bundle,True);building.refresh_from_db();self.assertEqual(building.map_config['display_yaw_deg'],123)
        page=self.client.get('/1907/');self.assertEqual(page.status_code,200);self.assertEqual(page.context['settlement1907']['max_houses'],321)
        self.assertIn('no-cache',page['Cache-Control'])
        result=io.StringIO();call_command('export_scene_data',building=[building.key],stdout=result);self.assertEqual(json.loads(result.getvalue())['buildings'][building.key]['expected_sha256'],digest(new))
