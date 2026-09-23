import hashlib
import json
from django.conf import settings
from django.test import SimpleTestCase, TestCase, override_settings
from django.core.management import call_command
from io import StringIO
from .resources import public_resource_paths, resource_path

@override_settings(CONTENT_SOURCE='files')
class Seoul1907Tests(TestCase):
    def test_seosomun_gate_and_road_registration(self):
        from .content import building_seeds
        from .scene_data import seed, validate
        data = seed('infrastructure1907')
        validate('infrastructure1907', data)
        gate = next(f for f in building_seeds()['features'] if f['id']=='souimun-1907')
        opening = next(o for o in data['wall']['openings'] if o['id']==gate['id'])
        self.assertEqual(gate['source_position']['pixel'], [470, 2620])
        self.assertEqual(opening['pixel'], gate['source_position']['pixel'])
        self.assertIn(opening['pixel'], data['wall']['centerline'])
        roads = {r['id']: r['centerline'] for r in data['roads']['features']}
        self.assertIn(opening['pixel'], roads['seosomun-street-1907'])
        self.assertIn(roads['seosomun-street-1907'][-1], roads['taepyeong-road-1907'])
        self.assertEqual(roads['jeongdong-street-1907'][-1], roads['deoksugung-south-street-1907'][0])

    def test_tipsy_sitter_bubble_translation(self):
        def sitter(lang):
            data = self.client.get('/1907/?lang='+lang).context['people1907']
            return next(r for r in data['storytellers'] if r.get('id')=='jongno-alley-tipsy-1907')
        ko, en = sitter('ko'), sitter('en')
        self.assertEqual(ko['mode'], 'bubble')
        self.assertEqual(len(ko['dialogue']['lines']), 12)
        self.assertNotEqual(ko['dialogue']['lines'][1]['text'], en['dialogue']['lines'][1]['text'])

    def test_horse_dealer_period_dialogue_and_trade(self):
        response = self.client.get('/1907/')
        dealer = response.context['people1907']['horse_dealer']
        self.assertContains(response, 'id="people3d"')
        self.assertEqual(dealer['placement']['temporal']['start_year'], 1907)
        self.assertIn('fictional', dealer['placement']['position_status'])
        nodes = dealer['nodes']
        reached, pending = set(), ['hello']
        while pending:
            key = pending.pop()
            if key in reached:
                continue
            reached.add(key)
            for option in nodes[key]['options']:
                if 'next' in option:
                    self.assertIn(option['next'], nodes)
                    pending.append(option['next'])
        self.assertEqual(reached, set(nodes))
        self.assertTrue(any(o.get('action') == 'shop' for o in nodes['hello']['options']))
        english = self.client.get('/1907/?lang=en').context['people1907']['horse_dealer']
        self.assertEqual(english['name'], 'Horse dealer')
        for key in nodes:
            self.assertNotEqual(nodes[key]['text'], english['nodes'][key]['text'])

    def test_bookseller_dialogue_graph_and_provenance(self):
        response = self.client.get('/1907/')
        data = response.context['people1907']
        nodes = data['storyteller']['nodes']
        reached, pending = set(), ['hello']
        while pending:
            key = pending.pop()
            if key in reached:
                continue
            reached.add(key)
            self.assertIn(key, nodes)
            for option in nodes[key]['options']:
                if 'next' in option:
                    pending.append(option['next'])
        self.assertEqual(reached, set(nodes))
        stories = [n for n in nodes.values() if 'story_id' in n]
        self.assertEqual(len(stories), 16)
        for node in stories:
            self.assertTrue(node['sources'])
            self.assertLessEqual(int(node['event_date']['start'][:4]), 1907)
            # Follow only the continuation, not the menu/back links: each story
            # must finish, retain provenance and allow returning one scene.
            current, seen = node, set()
            for part in range(1, node['story_parts'] + 1):
                self.assertEqual(current['story_part'], part)
                self.assertTrue(current['sources'])
                self.assertEqual(current.get('story_id', current.get('parent_story_id')), node['story_id'])
                if part < node['story_parts']:
                    following = current['options'][0]['next']
                    self.assertNotIn(following, seen)
                    seen.add(following)
                    previous = node['story_id'] if part == 1 else f"{node['story_id']}-part-{part}"
                    current = nodes[following]
                    self.assertTrue(any(o.get('next') == previous for o in current['options']))
            self.assertEqual(current['story_part'], current['story_parts'])
        ids = {f['id'] for f in response.context['buildings']['features']}
        self.assertIn(data['storytellers'][0]['building'], ids)
        english = self.client.get('/1907/?lang=en').context['people1907']['storyteller']
        self.assertEqual(english['name'], 'The bookseller')
        self.assertTrue(all(english['nodes'][key]['text'] != n['text'] for key, n in nodes.items()))

    def test_separate_period_view_and_sources(self):
        response = self.client.get('/1907/')
        self.assertContains(response, '1907년경')
        self.assertContains(response, 'seoul1907.js')
        self.assertIn('csrftoken', response.cookies)
        self.assertContains(response, 'id="walk-together"')
        self.assertContains(response, 'id="people-1907"')
        self.assertContains(response, 'id="walking-1907"')
        self.assertNotContains(response, 'id="buildings"')
        self.assertNotContains(response, 'terrain3d.js')
        self.assertContains(self.client.get('/1907/?lang=en'), 'Around 1907')
        self.assertContains(self.client.get('/credits/'), 'Wikimedia Commons')
        self.assertEqual(self.client.post('/1907/').status_code, 405)

    def test_assets_and_affine_mapping(self):
        config = json.loads((settings.BASE_DIR / 'gis/control_points/seoul1907.json').read_text())
        for key, digest in [('original_url', 'input_sha256'), ('image_url', 'image_sha256')]:
            path = config[key].lstrip('/')
            self.assertIn(path, public_resource_paths())
            self.assertEqual(hashlib.sha256(resource_path(path).read_bytes()).hexdigest(), config[digest])
        c = config['coefficients']
        # Pixel y points south; negative determinant prevents mirroring east/north.
        self.assertLess(c[1][0] * c[2][1] - c[1][1] * c[2][0], 0)
        dem = json.loads(resource_path('gis/georeferenced/terrain3d/dem.json').read_text())
        xmin,ymin,xmax,ymax = dem['bounds_3857']
        left,top,right,bottom = config['crop']
        for px in (left,right):
            for py in (top,bottom):
                x,y = [c[0][k]+px*c[1][k]+py*c[2][k] for k in (0,1)]
                self.assertTrue(xmin<x<xmax and ymin<y<ymax)
        self.assertTrue(all(p['residual_ground_m']<60 for p in config['checks']))


@override_settings(CONTENT_SOURCE='database')
class Seoul1907BuildingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('import_content', stdout=StringIO())

    def test_period_isolation_and_editable_content(self):
        from .content import load_buildings, content_problems
        from .models import Building
        self.assertEqual(len(load_buildings()['features']), 114)
        self.assertEqual(len(load_buildings(scene_year=1907)['features']), 77)
        self.assertEqual(content_problems(), [])
        b = Building.objects.get(key='geunjeongjeon-1907')
        b.full_clean()
        b.summary = '운영 편집 보존 확인'
        b.save()
        call_command('sync_content', apply=True, stdout=StringIO())
        self.assertEqual(self.client.get('/1907/').context['buildings']['features'][0]['info']['summary'], '운영 편집 보존 확인')
        self.assertNotContains(self.client.get('/'), 'geunjeongjeon-1907')

    def test_map_hash_cannot_cross_periods(self):
        from .models import Building
        from django.core.exceptions import ValidationError
        b = Building.objects.get(key='geunjeongjeon-1907')
        b.map_config['scene_year'] = 1750
        with self.assertRaises(ValidationError):
            b.full_clean()


    def test_upgrade_registers_new_renderer_without_overwriting_existing(self):
        from .models import Building, Resource
        Building.objects.filter(map_config__scene_year=1907).exclude(key__in=['geunjeongjeon-1907','junghwajeon-1907','injeongjeon-1907']).delete()
        Resource.objects.get(key='model-landmark-1907').delete()
        call_command('sync_content', stdout=StringIO())
        self.assertFalse(Resource.objects.filter(key='model-landmark-1907').exists())
        call_command('sync_content', apply=True, stdout=StringIO())
        self.assertTrue(Resource.objects.filter(key='model-landmark-1907').exists())
        self.assertEqual(Building.objects.filter(map_config__scene_year=1907).count(), 77)

    def test_temporal_bounds_and_source_provenance(self):
        from .content import load_buildings
        features = {f['id']: f for f in load_buildings(scene_year=1907)['features']}
        self.assertEqual(features['hwangudan-1907']['temporal']['existence']['end_year'], 1913)
        self.assertEqual(features['daehanmun-1907']['temporal']['depiction']['end_year'], 1970)
        self.assertIsNone(features['daehanmun-1907']['temporal']['existence']['end_year'])
        self.assertEqual(features['jeongdong-church-1907']['temporal']['depiction']['end_year'], 1926)
        for f in features.values():
            self.assertEqual(f['temporal']['depiction']['reference_year'], 1907)
            if f['temporal']['existence']['start_year'] is not None:
                self.assertLessEqual(f['temporal']['existence']['start_year'], 1907)
            self.assertEqual(f['source_position']['source_asset'], 'asset-0024')
            self.assertTrue(f['info']['sources'])
