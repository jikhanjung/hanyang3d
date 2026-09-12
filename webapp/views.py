import json

from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_safe
from .resources import assets, public_resource_paths, resource_path
from .deployment import runtime_report



@require_safe
def dashboard(request):
    records = assets()
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/1908_sheet_join_experiment.json').read_text())
    available = [a for a in records if resource_path(a['local_path']).is_file()]
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
def terrain3d(request, canvas_only=False):
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/doseong_modern_preview.json').read_text())
    buildings = json.loads((settings.BASE_DIR / 'gis/buildings/1750_landmarks.json').read_text())
    water = json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())
    wall = json.loads((settings.BASE_DIR / 'gis/walls/doseong_city_wall.json').read_text())
    return render(request, 'terrain3d.html', {
        'experiment': experiment, 'buildings': buildings, 'water': water, 'wall': wall,
        'canvas_only': canvas_only,
        'wall_line': ' '.join(f'{x},{y}' for x, y in wall['centerline']),
        'water_line': ' '.join(f'{x},{y}' for x, y in water['centerline']),
    })


@require_safe
def resource(request, resource):
    if resource not in public_resource_paths():
        raise Http404
    try:
        file = resource_path(resource)
    except ValueError:
        raise Http404
    if not file.is_file():
        raise Http404
    response = FileResponse(file.open('rb'))
    if file.suffix in {'.js', '.css', '.html', '.json'}:
        response['Cache-Control'] = 'no-cache'
    return response


@require_safe
def healthz(request):
    report = runtime_report()
    response = JsonResponse(report, status=200 if report['status'] == 'ok' else 503)
    response['Cache-Control'] = 'no-store'
    return response


@require_safe
def credits(request):
    vendor = settings.BASE_DIR / 'webapp/static/vendor'
    return render(request, 'credits.html', {
        'records': assets(),
        'three_license': (vendor / 'three/LICENSE').read_text(),
        'leaflet_license': (vendor / 'leaflet/LICENSE').read_text(),
    })
