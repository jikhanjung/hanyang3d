import json
from django.test import TestCase
from django.core.management import call_command
from io import StringIO
from django.conf import settings
from pathlib import Path
from tempfile import TemporaryDirectory


class ReviewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("import_content", stdout=StringIO())

    def test_health_reports_missing_runtime_data(self):
        response = self.client.get('/healthz')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version'], settings.APP_VERSION)
        with TemporaryDirectory() as root, self.settings(RUNTIME_DATA_ROOT=Path(root), REQUIRE_DATA_BUNDLE=True):
            response = self.client.get('/healthz')
            self.assertEqual(response.status_code, 503)
            self.assertIn('data/maps/src-0001/asset-0001.jpg', response.json()['missing'])
            self.assertTrue(response.json()['errors'])
        self.assertEqual(self.client.post('/healthz').status_code, 405)
        public = self.client.get('/healthz', HTTP_X_FORWARDED_FOR='203.0.113.9').json()
        self.assertEqual(set(public), {'status', 'version'})

    def test_runtime_mount_is_used_without_exposing_unlisted_files(self):
        with TemporaryDirectory() as root, self.settings(RUNTIME_DATA_ROOT=Path(root)):
            directory = Path(root) / 'data/maps/src-0001'
            directory.mkdir(parents=True)
            (directory / 'asset-0001.jpg').write_bytes(b'external-runtime-asset')
            (directory / 'private.txt').write_text('not public')
            response = self.client.get('/data/maps/src-0001/asset-0001.jpg')
            self.assertEqual(b''.join(response.streaming_content), b'external-runtime-asset')
            response.close()
            self.assertEqual(self.client.get('/data/maps/src-0001/private.txt').status_code, 404)
            self.assertEqual(self.client.get('/webapp/static/terrain3d.js').status_code, 200)

    def test_terrain_preview_is_explicitly_unvalidated(self):
        response = self.client.get('/gis/terrain/')
        self.assertContains(response, '정밀 정합 미검증')
        self.assertContains(response, '독립 검사점은 0개')
        self.assertContains(response, 'OpenTopoMap')
        self.assertContains(response, 'matrix_pixel_to_3857')
        self.assertEqual(self.client.post('/gis/terrain/').status_code, 405)

    def test_map_dependencies_are_served(self):
        for path in ('webapp/static/vendor/leaflet/leaflet.js',
                     'webapp/static/vendor/leaflet/leaflet.css',
                     'webapp/static/doseong_overlay.js',
                     'webapp/static/tps.js',
                     'gis/control_points/doseong_modern_preview.json'):
            response = self.client.get('/' + path)
            self.assertEqual(response.status_code, 200)
            response.close()

    def test_dashboard(self):
        for url in ('/gis/', '/gis/index.html'):
            response = self.client.get(url)
            self.assertContains(response, '도엽 연결 보기')
            self.assertContains(response, '3.31')

    def test_credits_and_map_link(self):
        self.assertContains(self.client.get('/'), 'id="credits-link" href="/credits/"')
        response = self.client.get('/credits/')
        for text in ('FABDEM V1.2', 'CC BY-NC-SA 4.0', '서울역사박물관', 'Three.js', 'Permission is hereby granted'):
            self.assertContains(response, text)

    def test_web_release_does_not_change_walking_world(self):
        with self.settings(APP_VERSION='v9.9.9'):
            response = self.client.get('/')
            self.assertEqual(response.context['walk_world_version'], 'v0.2.4')
            self.assertEqual(response.context['app_version'], 'v9.9.9')

    def test_home_opens_fullscreen_3d(self):
        response = self.client.get('/')
        self.assertContains(response, '<body class="canvas-only">')
        self.assertContains(response, 'id="scene"')
        self.assertContains(response, '/webapp/static/terrain3d.js')
        self.assertNotContains(response, '도엽 연결 보기')
        self.assertNotContains(self.client.get('/gis/terrain/3d/'), '<body class="canvas-only">')

    def test_review_and_map_resources(self):
        for url in ('/gis/georeferenced/1908_join/index.html',
                    '/gis/georeferenced/readings/index.html',
                    '/gis/roads/1908_gyeonghaeng_reading.json',
                    '/gis/georeferenced/review/index.html',
                    '/gis/georeferenced/1908_join/source-warped.png',
                    '/data/cadastral/src-0017/asset-0012.jpg',
                    '/gis/control_points/1908_gwanin_gyeonghaeng_points.csv'):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 200, url)
            response.close()

    def test_private_and_missing_paths_are_not_served(self):
        for url in ('/.git/config', '/webapp/settings.py', '/data/catalog/',
                    '/gis/../webapp/settings.py',
                    '/data/cadastral/src-0017/detail-2026-09-08.html',
                    '/gis/georeferenced/1908_join/missing.png'):
            self.assertEqual(self.client.get(url).status_code, 404, url)

    def test_versioned_resources_are_immutable_and_revalidate(self):
        response = self.client.get(f'/v/{settings.APP_VERSION}/webapp/static/terrain3d.js')
        self.assertEqual(response.status_code, 200)
        self.assertIn('immutable', response['Cache-Control'])
        etag = response['ETag']
        response.close()
        self.assertEqual(self.client.get('/webapp/static/terrain3d.js', HTTP_IF_NONE_MATCH=etag).status_code, 304)
        response = self.client.get('/v/v0.0.0/webapp/static/terrain3d.js')
        self.assertEqual((response.status_code, response['Location']), (302, '/webapp/static/terrain3d.js'))
        self.assertEqual(self.client.get('/v/%s/webapp/static/../settings.py' % settings.APP_VERSION).status_code, 404)
        self.assertContains(self.client.get('/'), f'/v/{settings.APP_VERSION}/webapp/static/terrain3d.js')
        response = self.client.get('/gis/georeferenced/terrain3d/channel_refined.bin.gz')
        self.assertEqual((response.status_code, response['Content-Encoding'], response['Content-Type']), (200, 'gzip', 'application/octet-stream'))
        response.close()

    def test_landmark_guide_is_served_on_the_site(self):
        response = self.client.get('/guide/')
        self.assertContains(response, '<h3 id="창덕궁">')
        self.assertContains(response, '<h3 id="숭례문">')
        self.assertContains(response, '<tr id="의정부">')
        self.assertNotContains(response, 'github.com')
        self.assertEqual(self.client.post('/guide/').status_code, 405)
        home = self.client.get('/')
        self.assertContains(home, 'href="/guide/"')
        self.assertNotContains(home, 'blob/main/docs/landmarks.md')
        self.assertContains(home, 'id="guide-anchors"')

    def test_place_names_are_served(self):
        for path in ('webapp/static/placenames.js', 'gis/placenames/doseong_placenames.json'):
            response = self.client.get('/' + path)
            self.assertEqual(response.status_code, 200, path)
            response.close()
        self.assertContains(self.client.get('/'), 'id="placenames3d"')

    def test_place_stories_point_at_real_places(self):
        data = json.loads((settings.BASE_DIR / 'gis/stories/doseong_stories.json').read_text())
        landmarks = {f['id']: f['name'].split(' · ')[0] for f in json.loads((settings.BASE_DIR / 'gis/buildings/1750_landmarks.json').read_text())['features']}
        bridges = {b['id']: b['name'] for b in json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())['bridges']}
        places = {f['name']: f['name'] for f in json.loads((settings.BASE_DIR / 'gis/placenames/doseong_placenames.json').read_text())['features']}
        known = {'landmark': landmarks, 'bridge': bridges, 'place': places}
        ids = [story['id'] for story in data['stories']]
        self.assertEqual(len(ids), len(set(ids)))
        for story in data['stories']:
            target = story['target']
            self.assertIn(target['key'], known[target['type']], story['id'])
            self.assertEqual(target['label'], known[target['type']][target['key']], story['id'])
            self.assertTrue(story['title'] and story['text'] and story['sources'], story['id'])
            self.assertIsInstance(story['legend'], bool, story['id'])
            for source in story['sources']:
                self.assertTrue(source['url'].startswith('https://'), story['id'])
        home = self.client.get('/')
        self.assertContains(home, 'id="stories"')
        guide = self.client.get('/guide/')
        if data['stories']:
            self.assertContains(guide, 'id="장소-이야기"')
            self.assertContains(guide, data['stories'][0]['title'])

    def test_npc_data_is_consistent_and_sourced(self):
        data = json.loads((settings.BASE_DIR / 'gis/characters/npcs.json').read_text())
        zones = json.loads((settings.BASE_DIR / 'gis/buildings/doseong_sijeon.json').read_text())['signs']['zones']
        for tree in (data['keeper']['nodes'], data['officer']['nodes'], data['merchant']['nodes'], data['horse_dealer']['nodes']):
            self.assertIn('hello', tree)
            for node_id, node in tree.items():
                for option in node.get('options', []):
                    self.assertTrue(option.get('next') in tree or option.get('action') in ('close', 'shop'), (node_id, option))
                for source in node.get('sources', []):
                    self.assertTrue(source['url'].startswith('https://'), (node_id, source))
        # Keeper, officer and horse dealer lines that state facts must carry a source.
        for tree in (data['keeper']['nodes'], data['officer']['nodes'], data['horse_dealer']['nodes']):
            for node_id, node in tree.items():
                if node_id != 'hello':
                    self.assertTrue(node.get('sources'), node_id)
        for zone in zones:
            shop = data['shops'][zone['hangul']]
            self.assertTrue(shop['items'] and all(item in data['items'] for item in shop['items']), zone['hangul'])
        for item in data['items'].values():
            self.assertTrue(isinstance(item['price'], int) and item['price'] > 0 and item['icon']['shape'] in ('bolt', 'roll', 'fish'))
        self.assertContains(self.client.get('/'), 'id="npcs"')

    def test_read_only(self):
        self.assertEqual(self.client.post('/').status_code, 405)
        self.assertEqual(self.client.post('/data/catalog/assets.csv').status_code, 405)

    def test_3d_scene_and_local_dependencies(self):
        response = self.client.get('/gis/terrain/3d/')
        self.assertContains(response, '5개 보정점으로 맞춘')
        self.assertContains(response, '고도')
        self.assertEqual(self.client.post('/gis/terrain/3d/').status_code, 405)
        for path in ('webapp/static/terrain3d.js',
                     'webapp/static/city_wall.js',
                     'webapp/static/settlement.js',
                     'webapp/static/pedestrians.js',
                     'webapp/static/trees.js',
                     'webapp/static/orbit_navigation.js',
                     'webapp/static/granite.js',
                     'gis/vegetation/doseong_trees.json',
                     'gis/roads/doseong_walking_routes.json',
                     'gis/buildings/doseong_settlement.json',
                     'gis/roads/doseong_road_mask.png',
                     'gis/roads/doseong_road_mask.json',
                     'gis/walls/doseong_city_wall.json',
                     'webapp/static/ground_support.js',
                     'webapp/static/channel_terrain.js',
                     'webapp/static/terrain_worker.js',
                     'webapp/static/vendor/three/three.module.js',
                     'webapp/static/vendor/three/three.core.js',
                     'webapp/static/vendor/three/OrbitControls.js',
                     'gis/georeferenced/terrain3d/dem.json',
                     'gis/control_points/seoul_terrain_manifest.json'):
            response = self.client.get('/' + path)
            self.assertEqual(response.status_code, 200, path)
            response.close()
