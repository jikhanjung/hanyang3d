import csv
import json
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from django.shortcuts import render
from django.views.decorators.http import require_safe


def assets():
    with (settings.BASE_DIR / 'data/catalog/assets.csv').open() as f:
        return list(csv.DictReader(f))


@require_safe
def dashboard(request):
    records = assets()
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/1908_sheet_join_experiment.json').read_text())
    available = [a for a in records if (settings.BASE_DIR / a['local_path']).is_file()]
    return render(request, 'dashboard.html', {
        'asset_count': len(available),
        'image_count': sum(a['media_type'] == 'image/jpeg' for a in available),
        'point_count': len(experiment['controls']) + len(experiment['checks']),
        'check_rmse': experiment['result']['metrics']['check']['rmse_px'],
    })


@require_safe
def terrain_overlay(request):
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/doseong_modern_preview.json').read_text())
    return render(request, 'terrain_overlay.html', {'experiment': experiment})


@require_safe
def terrain3d(request):
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/doseong_modern_preview.json').read_text())
    return render(request, 'terrain3d.html', {'experiment': experiment})


@require_safe
def resource(request, resource):
    # Only catalogued originals and selected review artifacts are web-accessible.
    allowed = {a['local_path'] for a in assets()}
    allowed.update({
        'gis/georeferenced/terrain3d/dem.json',
        'gis/control_points/seoul_terrain_manifest.json',
        'webapp/static/terrain3d.js',
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
    file = (settings.BASE_DIR / resource).resolve()
    if resource not in allowed or not file.is_relative_to(settings.BASE_DIR) or not file.is_file():
        raise Http404
    response = FileResponse(file.open('rb'))
    if file.suffix in {'.js', '.css', '.html', '.json'}:
        response['Cache-Control'] = 'no-cache'
    return response
