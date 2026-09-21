"""Account-scoped, checkpointed historical visits. No economy rewards or authority over player movement."""
import json
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .economy import TradeError, catalog
from .models import EventProgress, PlayerItem


def definition():
    return json.loads((settings.BASE_DIR/'gis/events/agwanpacheon.json').read_text())


def last_checkpoint(data):
    """Checkpoint 0 is 'started'; then the stages before the route, one per route point, and the stages after."""
    return len(data.get('stages_before',[]))+len(data['route'])+len(data.get('stages_after',[]))


def has_keepsake(player, data):
    return PlayerItem.objects.filter(player=player, item=data['keepsake_item'], quantity__gt=0).exists()


def progress(player, action, checkpoint=None, version=None):
    data=definition();last=last_checkpoint(data)
    if action not in ('status','start','checkpoint','complete','restart','keepsake'):
        raise TradeError(400,'잘못된 회상 요청입니다.')
    if action=='keepsake':
        # The caretaker's bundle: given once, free, never sold; owning it is what opens the visit.
        if data['keepsake_item'] not in catalog()['items']:raise TradeError(500,'꾸러미 물건이 등록되지 않았습니다.')
        with transaction.atomic():
            _,created=PlayerItem.objects.get_or_create(player=player,item=data['keepsake_item'],defaults={'quantity':1})
        return {'item':data['keepsake_item'],'received':created}
    if action!='status' and (type(version) is not int or version!=data['version']):
        raise TradeError(409,'회상 내용이 변경되었습니다. 새로고침해 주세요.')
    if action in ('start','restart') and not has_keepsake(player,data):
        raise TradeError(409,'러시아공사관 관리인에게 낡은 꾸러미를 받아 오세요.')
    with transaction.atomic():
        # One row per account/event; no currency or inventory side effects.
        row,_=EventProgress.objects.get_or_create(player=player,event_id=data['id'],defaults={'definition_version':data['version']})
        if row.definition_version!=data['version']:
            if action not in ('status','restart'):raise TradeError(409,'새 버전의 회상을 처음부터 시작해 주세요.')
        if action=='restart':
            row.checkpoint=0;row.status='active';row.definition_version=data['version']
        elif action=='start' and row.status=='new':row.status='active'
        elif action=='checkpoint':
            if type(checkpoint) is not int or not 0<=checkpoint<=last:raise TradeError(400,'잘못된 확인 지점입니다.')
            if row.status!='active' or checkpoint>row.checkpoint+1:raise TradeError(409,'차례대로 길을 따라가 주세요.')
            row.checkpoint=max(row.checkpoint,checkpoint)
        elif action=='complete':
            if row.checkpoint!=last or row.status not in ('active','completed'):raise TradeError(409,'아직 회상을 끝까지 보지 않았습니다.')
            row.status='completed'
            if row.completed_at is None:row.completed_at=timezone.now()
        if action!='status':row.save()
        return {'event_id':row.event_id,'version':row.definition_version,'status':row.status,'checkpoint':row.checkpoint,'completed_at':row.completed_at.isoformat() if row.completed_at else None}
