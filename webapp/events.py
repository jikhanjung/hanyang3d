"""Account-scoped, checkpointed historical visits (quests). No economy rewards or authority over player movement.

Each visit is a JSON definition in gis/events/<slug>.json (schema 2). The server only needs to know how many
checkpoints the stages add up to, which keepsake item opens the visit, and which base scene hosts it; the client
framework (webapp/static/historical_event.js) and its stage modules interpret the rest.
"""
import json
from functools import lru_cache
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .economy import TradeError, catalog
from .models import EventProgress, PlayerItem

EVENT_DIR = 'gis/events'
STAGE_TYPES = ('talk', 'talks', 'module')


@lru_cache(maxsize=4)
def _definitions(stamp):
    result = {}
    for path in sorted((settings.BASE_DIR / EVENT_DIR).glob('*.json')):
        data = json.loads(path.read_text())
        result[data['slug']] = data
    return result


def definitions():
    """All visits keyed by slug, re-read when any definition file changes."""
    stamp = tuple(sorted((p.name, p.stat().st_mtime_ns) for p in (settings.BASE_DIR / EVENT_DIR).glob('*.json')))
    return _definitions(stamp)


def definition(slug):
    data = definitions().get(slug)
    if data is None:
        raise KeyError(slug)
    return data


def summaries(base_scene):
    """What a base scene needs from its visits: the keepsake giver dialogue, the item and the transition captions."""
    return [{'slug': d['slug'], 'id': d['id'], 'keepsake': d['keepsake'], 'transition': d['transition']}
            for d in definitions().values() if d.get('base_scene') == base_scene]


def stage_checkpoints(stage):
    if stage['type'] in ('talk', 'talks'):
        return 1
    if stage['type'] == 'module':
        return stage.get('checkpoints', len(stage.get('route', [])))
    raise ValueError(f"unknown stage type {stage['type']!r}")


def last_checkpoint(data):
    """Checkpoint 0 is 'started'; every stage adds its own checkpoints in order."""
    return sum(stage_checkpoints(s) for s in data['stages'])


def validate(data):
    """Raise ValueError for a definition the server or client could not run."""
    for key in ('id', 'slug', 'version', 'base_scene', 'keepsake', 'transition', 'stages', 'sources'):
        if key not in data:
            raise ValueError(f"{data.get('slug', '?')}: missing {key}")
    if type(data['version']) is not int:
        raise ValueError(f"{data['slug']}: version must be an integer")
    if data['keepsake']['item'] not in catalog()['items']:
        raise ValueError(f"{data['slug']}: keepsake item {data['keepsake']['item']!r} is not in the goods catalog")
    for stage in data['stages']:
        if stage['type'] not in STAGE_TYPES:
            raise ValueError(f"{data['slug']}: stage {stage.get('key')} has unknown type {stage['type']!r}")
        if stage_checkpoints(stage) < 1:
            raise ValueError(f"{data['slug']}: stage {stage.get('key')} adds no checkpoint")
    if last_checkpoint(data) < 1:
        raise ValueError(f"{data['slug']}: no checkpoints")


def has_keepsake(player, data):
    return PlayerItem.objects.filter(player=player, item=data['keepsake']['item'], quantity__gt=0).exists()


def progress(player, slug, action, checkpoint=None, version=None):
    try:
        data = definition(slug)
    except KeyError:
        raise TradeError(404, '그런 회상은 없습니다.')
    last = last_checkpoint(data)
    if action not in ('status', 'start', 'checkpoint', 'complete', 'restart', 'keepsake'):
        raise TradeError(400, '잘못된 회상 요청입니다.')
    if action == 'keepsake':
        # The giver's keepsake: handed over once, free, never sold; owning it is what opens the visit.
        if data['keepsake']['item'] not in catalog()['items']:
            raise TradeError(500, '꾸러미 물건이 등록되지 않았습니다.')
        with transaction.atomic():
            _, created = PlayerItem.objects.get_or_create(player=player, item=data['keepsake']['item'], defaults={'quantity': 1})
        return {'item': data['keepsake']['item'], 'received': created}
    if action != 'status' and (type(version) is not int or version != data['version']):
        raise TradeError(409, '회상 내용이 변경되었습니다. 새로고침해 주세요.')
    if action in ('start', 'restart') and not has_keepsake(player, data):
        raise TradeError(409, data['keepsake'].get('missing') or '이 회상을 여는 물건을 먼저 받아 오세요.')
    with transaction.atomic():
        # One row per account/event; no currency or inventory side effects.
        row, _ = EventProgress.objects.get_or_create(player=player, event_id=data['id'], defaults={'definition_version': data['version']})
        if row.definition_version != data['version']:
            if action not in ('status', 'restart'):
                raise TradeError(409, '새 버전의 회상을 처음부터 시작해 주세요.')
        if action == 'restart':
            row.checkpoint = 0; row.status = 'active'; row.definition_version = data['version']
        elif action == 'start' and row.status == 'new':
            row.status = 'active'
        elif action == 'checkpoint':
            if type(checkpoint) is not int or not 0 <= checkpoint <= last:
                raise TradeError(400, '잘못된 확인 지점입니다.')
            if row.status != 'active' or checkpoint > row.checkpoint + 1:
                raise TradeError(409, '차례대로 진행해 주세요.')
            row.checkpoint = max(row.checkpoint, checkpoint)
        elif action == 'complete':
            if row.checkpoint != last or row.status not in ('active', 'completed'):
                raise TradeError(409, '아직 회상을 끝까지 보지 않았습니다.')
            row.status = 'completed'
            if row.completed_at is None:
                row.completed_at = timezone.now()
        if action != 'status':
            row.save()
        return {'event_id': row.event_id, 'version': row.definition_version, 'status': row.status, 'checkpoint': row.checkpoint,
                'completed_at': row.completed_at.isoformat() if row.completed_at else None}
