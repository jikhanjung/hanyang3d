"""Account-scoped, checkpointed historical visits. No economy rewards or authority over player movement."""
import json
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from .economy import TradeError
from .models import EventProgress


def definition():
    return json.loads((settings.BASE_DIR/'gis/events/agwanpacheon.json').read_text())


def progress(player, action, checkpoint=None, version=None):
    data=definition();last=len(data['route'])-1
    if action not in ('status','start','checkpoint','complete','restart'):
        raise TradeError(400,'잘못된 회상 요청입니다.')
    if action!='status' and (type(version) is not int or version!=data['version']):
        raise TradeError(409,'회상 내용이 변경되었습니다. 새로고침해 주세요.')
    with transaction.atomic():
        # One row per account/event; no currency or inventory side effects.
        row,_=EventProgress.objects.get_or_create(player=player,event_id=data['id'])
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
            if row.checkpoint!=last or row.status not in ('active','completed'):raise TradeError(409,'아직 공사관에 도착하지 않았습니다.')
            row.status='completed'
            if row.completed_at is None:row.completed_at=timezone.now()
        if action!='status':row.save()
        return {'event_id':row.event_id,'version':row.definition_version,'status':row.status,'checkpoint':row.checkpoint,'completed_at':row.completed_at.isoformat() if row.completed_at else None}
