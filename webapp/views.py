import json

from django.conf import settings
from django.http import FileResponse, Http404, HttpResponseNotModified, HttpResponseRedirect, JsonResponse
from django.utils.http import http_date
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST, require_safe
from .resources import assets, public_resource_paths, resource_path
from .i18n import localize, t
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
    from .economy import catalog
    experiment = json.loads((settings.BASE_DIR / 'gis/control_points/doseong_modern_preview.json').read_text())
    if settings.CONTENT_SOURCE == 'database':
        from .content import load_buildings
        buildings = load_buildings()
    else:
        buildings = json.loads((settings.BASE_DIR / 'gis/buildings/1750_landmarks.json').read_text())
    water = json.loads((settings.BASE_DIR / 'gis/waterways/doseong_cheonggyecheon.json').read_text())
    wall = json.loads((settings.BASE_DIR / 'gis/walls/doseong_city_wall.json').read_text())
    return render(request, 'terrain3d.html', {
        'experiment': experiment, 'buildings': localize(buildings, request.lang), 'water': localize(water, request.lang), 'wall': wall, 'stories': localize(load_stories(), request.lang),
        'canvas_only': canvas_only,
        'guide_anchors': render_guide(request.lang)['anchors'],
        'app_version': settings.APP_VERSION,
        'walk_world_version': settings.WALK_WORLD_VERSION,
        'multiplayer_url': settings.MULTIPLAYER_URL,
        'npcs': localize(catalog(), request.lang),
        'wall_line': ' '.join(f'{x},{y}' for x, y in wall['centerline']),
        'water_line': ' '.join(f'{x},{y}' for x, y in water['centerline']),
    })


@require_safe
@ensure_csrf_cookie
def seoul1907(request):
    from .economy import catalog
    config = json.loads((settings.BASE_DIR / 'gis/control_points/seoul1907.json').read_text())
    if settings.CONTENT_SOURCE == 'database':
        from .content import load_buildings
        buildings = load_buildings(scene_year=1907)
    else:
        buildings = json.loads((settings.BASE_DIR / 'gis/buildings/1907_landmarks.json').read_text())
    from .scene_data import load
    infrastructure = load('infrastructure1907')
    response = render(request, 'seoul1907.html', {'npcs': localize(catalog(), request.lang), 'people1907': localize(load('people1907'), request.lang), 'trams1907': load('trams1907'), 'walking1907': load('walking1907'), 'multiplayer_url': settings.MULTIPLAYER_URL, 'walk_world_version': settings.WALK_WORLD_VERSION, 'infrastructure': infrastructure, 'settlement1907': load('settlement1907'), 'map': config, 'buildings': localize(buildings, request.lang), 'app_version': settings.APP_VERSION})

    response['Cache-Control']='no-cache, must-revalidate'
    return response


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
    return render(request, 'guide.html', {'guide': render_guide(request.lang), 'stories': stories_by_place(request.lang)})


@require_safe
@ensure_csrf_cookie
def player_state(request):
    from .economy import player_from_cookie, state
    response = JsonResponse(state(player_from_cookie(request)))
    response['Cache-Control'] = 'no-store'
    return response


def _json_body(request):
    try:
        body = json.loads(request.body or b'{}')
    except ValueError:
        return None
    return body if isinstance(body, dict) else None


def _no_store(response):
    response['Cache-Control'] = 'no-store'
    return response


@require_POST
def account_register(request):
    from .accounts import AccountError, register
    from .economy import attach_cookie, catalog, cookie_value, player_from_cookie, state
    body = _json_body(request)
    if body is None:
        return _no_store(JsonResponse({'error': t('요청 형식이 잘못되었소.', request.lang), 'logged_in': False}, status=400))
    try:
        player = register(request, player_from_cookie(request), body.get('name'), body.get('password'), catalog()['wallet']['start'])
    except AccountError as error:
        return _no_store(JsonResponse({'error': error.message, 'logged_in': False}, status=error.status))
    return _no_store(attach_cookie(JsonResponse({'message': t('{name}, 어서 오시오.', request.lang, name=player.name), **state(player)}), cookie_value(player)))


@require_POST
def account_login(request):
    from .accounts import AccountError, login
    from .economy import attach_cookie, cookie_value, state
    body = _json_body(request)
    if body is None:
        return _no_store(JsonResponse({'error': t('요청 형식이 잘못되었소.', request.lang), 'logged_in': False}, status=400))
    try:
        player = login(request, body.get('name'), body.get('password'))
    except AccountError as error:
        return _no_store(JsonResponse({'error': error.message, 'logged_in': False}, status=error.status))
    return _no_store(attach_cookie(JsonResponse({'message': f'{player.name}, 다시 오셨구려.', **state(player)}), cookie_value(player)))


@require_POST
def account_logout(request):
    from .economy import COOKIE
    response = _no_store(JsonResponse({'logged_in': False}))
    response.delete_cookie(COOKIE, samesite='Lax')
    return response


@require_POST
def shop_trade(request):
    from .economy import TradeError, player_from_cookie, state, trade
    body = _json_body(request)
    player = player_from_cookie(request)
    if not player or not player.name_key:
        return _no_store(JsonResponse({'error': '먼저 이름을 대고 들어오시오. (로그인)', 'logged_in': False}, status=401))
    if body is None:
        return _no_store(JsonResponse({'error': t('요청 형식이 잘못되었소.', request.lang), **state(player)}, status=400))
    try:
        player, message = trade(player, body.get('action'), body.get('shop'), body.get('item'), body.get('quantity'), request.lang)
        response = JsonResponse({'message': message, **state(player)})
    except TradeError as error:
        player.refresh_from_db()
        response = JsonResponse({'error': error.message, **state(player)}, status=error.status)
    return _no_store(response)


@require_safe
def walk_ticket(request):
    """A one-minute ticket naming the logged-in account, for joining walking together."""
    from .economy import player_from_cookie
    from .walk_ticket import make_ticket
    player = player_from_cookie(request)
    if not player or not player.name_key:
        return _no_store(JsonResponse({'error': '먼저 이름을 대고 들어오시오. (로그인)'}, status=401))
    secret = settings.WALK_TICKET_SECRET
    return _no_store(JsonResponse({'name': player.name, 'ticket': make_ticket(player.name, secret) if secret else None}))


@require_safe
def scene_dataset(request, key):
    from .scene_data import DATASETS, load, digest
    from django.http import JsonResponse
    if key not in DATASETS: raise Http404
    data=load(key);etag='"'+digest(data)+'"'
    response=HttpResponseNotModified() if request.headers.get('If-None-Match')==etag else JsonResponse(data)
    response['ETag']=etag;response['Cache-Control']='no-cache, must-revalidate'
    return response
