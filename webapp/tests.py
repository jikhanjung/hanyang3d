from django.test import SimpleTestCase
from django.conf import settings
from pathlib import Path
from tempfile import TemporaryDirectory


class ReviewTests(SimpleTestCase):
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
        for url in ('/', '/gis/', '/gis/index.html'):
            response = self.client.get(url)
            self.assertContains(response, '도엽 연결 보기')
            self.assertContains(response, '3.31')

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
