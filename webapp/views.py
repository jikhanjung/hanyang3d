import json

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponseNotModified, HttpResponseRedirect, JsonResponse
from django.utils.http import http_date
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST, require_safe
from .resources import assets, public_resource_paths, resource_path
from .deployment import runtime_report
from .guide import render_guide
from .stories import load_stories, stories_by_place



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
@ensure_csrf_cookie
def terrain3d(request, canvas_only=False):
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/doseong_modern_preview.json').read_text())
    if settings.CONTENT_SOURCE == 'database':
        from .content import load_buildings
        buildings = load_buildings()
    else:
        buildings = json.loads((settings.BASE_DIR / 'gis/buildings/1750_landmarks.json').read_text())
    water = json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())
    wall = json.loads((settings.BASE_DIR / 'gis/walls/doseong_city_wall.json').read_text())
    return render(request, 'terrain3d.html', {
        'experiment': experiment, 'buildings': buildings, 'water': water, 'wall': wall, 'stories': load_stories(),
        'canvas_only': canvas_only,
        'guide_anchors': render_guide()['anchors'],
        'app_version': settings.APP_VERSION,
        'walk_world_version': settings.WALK_WORLD_VERSION,
        'multiplayer_url': settings.MULTIPLAYER_URL,
        'npcs': json.loads((settings.BASE_DIR / 'gis/characters/npcs.json').read_text()),
        'wall_line': ' '.join(f'{x},{y}' for x, y in wall['centerline']),
        'water_line': ' '.join(f'{x},{y}' for x, y in water['centerline']),
    })


def serve_resource(request, resource, immutable=False):
    if resource not in public_resource_paths():
        raise Http404
    try:
        file = resource_path(resource)
    except ValueError:
        raise Http404
    if not file.is_file():
        raise Http404
    stat = file.stat()
    etag = f'"{stat.st_size:x}-{stat.st_mtime_ns:x}"'
    # Revalidation answers 304 without resending unchanged files.
    if etag in [tag.strip() for tag in request.headers.get('If-None-Match', '').split(',')]:
        response = HttpResponseNotModified()
    else:
        response = FileResponse(file.open('rb'))
    if resource.endswith('.bin.gz') and not isinstance(response, HttpResponseNotModified):
        # Stored pre-compressed; the browser inflates it transparently.
        response['Content-Type'] = 'application/octet-stream'
        response['Content-Encoding'] = 'gzip'
    response['ETag'] = etag
    response['Last-Modified'] = http_date(stat.st_mtime)
    if immutable:
        response['Cache-Control'] = 'public, max-age=31536000, immutable'
    elif file.suffix in {'.js', '.css', '.html', '.json', '.bin'}:
        response['Cache-Control'] = 'no-cache'
    return response


@require_safe
def resource(request, resource):
    return serve_resource(request, resource)


@require_safe
def versioned_resource(request, version, resource):
    # Files under the running release's version never change, so browsers may keep them.
    if version != settings.APP_VERSION:
        return HttpResponseRedirect('/' + resource)
    return serve_resource(request, resource, immutable=True)


@require_safe
def healthz(request):
    report = runtime_report()
    status = 503 if report['status'] == 'unhealthy' else 200
    # Requests through the public proxy carry X-Forwarded-For; they get only status and version. Container and
    # deploy checks call the app directly and still see counts, warnings and error messages.
    if 'HTTP_X_FORWARDED_FOR' in request.META:
        report = {'status': report['status'], 'version': report['version']}
    response = JsonResponse(report, status=status)
    response['Cache-Control'] = 'no-store'
    return response


@require_safe
def credits(request):
    vendor = settings.BASE_DIR / 'webapp/static/vendor'
    return render(request, 'credits.html', {
        'records': [record for record in assets() if record['id'] == 'asset-0001'],
        'three_license': (vendor / 'three/LICENSE').read_text(),
        'colyseus_license': (vendor / 'colyseus/LICENSE').read_text(),
    })


@require_safe
def guide(request):
    return render(request, 'guide.html', {'guide': render_guide(), 'stories': stories_by_place()})


@require_safe
@ensure_csrf_cookie
def player_state(request):
    from .economy import attach_cookie, player_for, state
    player, cookie = player_for(request)
    response = JsonResponse(state(player))
    response['Cache-Control'] = 'no-store'
    return attach_cookie(response, cookie)


@require_POST
def shop_trade(request):
    from .economy import TradeError, attach_cookie, player_for, state, trade
    try:
        body = json.loads(request.body or b'{}')
    except ValueError:
        body = None
    player, cookie = player_for(request)
    if not isinstance(body, dict):
        response = JsonResponse({'error': '요청 형식이 잘못되었소.', **state(player)}, status=400)
    else:
        try:
            player, message = trade(player, body.get('action'), body.get('shop'), body.get('item'), body.get('quantity'))
            response = JsonResponse({'message': message, **state(player)})
        except TradeError as error:
            player.refresh_from_db()
            response = JsonResponse({'error': error.message, **state(player)}, status=error.status)
    response['Cache-Control'] = 'no-store'
    return attach_cookie(response, cookie)
