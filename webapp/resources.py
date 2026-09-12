"""Shared allowlist and optional external runtime-data resolution."""
import csv
from pathlib import Path
from django.conf import settings

RUNTIME_PREFIXES = ('data/maps/', 'data/cadastral/', 'gis/georeferenced/')


def assets():
    with (settings.BASE_DIR / 'data/catalog/assets.csv').open() as f:
        return list(csv.DictReader(f))


def public_resource_paths():
    # Only catalogued originals and selected review artifacts are web-accessible.
    allowed = {a['local_path'] for a in assets()}
    allowed.update({
        'gis/georeferenced/terrain3d/dem.json',
        'gis/walls/doseong_city_wall.json',
        'webapp/static/city_wall.js',
        'webapp/static/jongmyo.js',
        'webapp/static/yukjo.js',
        'webapp/static/compass3d.js',
        'webapp/static/walk_joystick.js',
        'gis/walls/gyeongbokgung_wall.json',
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
        'gis/control_points/seoul_terrain_manifest.json',
        'webapp/static/terrain3d.js',
        'webapp/static/ground_support.js',
        'webapp/static/channel_terrain.js',
        'webapp/static/terrain_worker.js',
        *('webapp/static/vendor/three/' + name for name in
          ('three.module.js', 'three.core.js', 'OrbitControls.js', 'LICENSE')),
        'gis/roads/1908_gyeonghaeng_reading.json',
        'gis/georeferenced/readings/index.html',
        'gis/control_points/doseong_modern_preview.json',
        'webapp/static/vendor/leaflet/leaflet.js',
        'webapp/static/vendor/leaflet/leaflet.css',
        'webapp/static/doseong_overlay.js',
        'webapp/static/tps.js',
        'data/catalog/sources.csv', 'data/catalog/assets.csv',
        'gis/control_points/1908_sheet_join_experiment.json',
        'gis/control_points/1908_gwanin_gyeonghaeng_points.csv',
        'gis/georeferenced/review/index.html',
        *('gis/georeferenced/1908_join/' + name for name in
          ('index.html', 'point-crops.jpg', 'report.json', 'source-warped.png', 'target.jpg')),
    })
    return allowed


def resource_path(resource):
    root = settings.RUNTIME_DATA_ROOT if resource.startswith(RUNTIME_PREFIXES) else settings.BASE_DIR
    file = (root / resource).resolve()
    if not file.is_relative_to(root.resolve()):
        raise ValueError('Resource outside configured root')
    return file
