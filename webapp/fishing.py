"""One durable cast per account; elapsed time and rewards are server-authoritative."""
import secrets
import uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .economy import TradeError, catalog
from .models import Player, PlayerItem, FishingCast

MIN_WAIT=10
MAX_WAIT=10
CATCH_PERCENT=30

def fish(player, action, token=None, era=None):
    if action not in ('start','finish','cancel'):
        raise TradeError(400,'알 수 없는 낚시 동작이오.')
    with transaction.atomic():
        # Acquire the write lock before reading cast/inventory (also works on SQLite).
        Player.objects.filter(pk=player.pk).update(money=F('money'))
        cast=FishingCast.objects.filter(player=player).first()
        now=timezone.now()
        if action=='start':
            if type(era) is not int or era not in (1750,1907):raise TradeError(400,'낚시할 시대가 잘못되었소.')
            if not PlayerItem.objects.filter(player=player,item='fishing_rod',quantity__gt=0).exists():raise TradeError(400,'먼저 낚싯대를 마련하시오.')
            if 'river_fish' not in catalog()['items']:raise TradeError(503,'낚시 물품을 준비하고 있소.')
            if not cast or cast.status!='waiting' or now>cast.expires_at:
                cast,_=FishingCast.objects.update_or_create(player=player,defaults={'token':uuid.uuid4(),'era':era,'ready_at':now+timedelta(seconds=MIN_WAIT+secrets.randbelow(MAX_WAIT-MIN_WAIT+1)),'expires_at':now+timedelta(minutes=3),'status':'waiting','caught':False,'item':''})
            elif cast.era!=era:raise TradeError(409,'다른 시대에서 드리운 낚싯줄을 먼저 거두시오.')
        else:
            if not cast or str(cast.token)!=token:raise TradeError(409,'이 낚싯줄은 이미 거두었소.')
            if cast.status=='waiting':
                if action=='cancel' or now>cast.expires_at:
                    cast.status='cancelled';cast.save(update_fields=['status'])
                else:
                    if now<cast.ready_at:raise TradeError(409,'조금 더 기다리시오.')
                    if not PlayerItem.objects.filter(player=player,item='fishing_rod',quantity__gt=0).exists():raise TradeError(400,'낚싯대가 봇짐에 없소.')
                    cast.caught=secrets.randbelow(100)<CATCH_PERCENT
                    if cast.caught:
                        data=catalog();catches=[r for r in data['fishing']['catches'] if r['item'] in data['items'] and r['weight']>0]
                        if not catches:raise TradeError(503,'낚시 물품을 준비하고 있소.')
                        roll=secrets.randbelow(sum(r['weight'] for r in catches))
                        for entry in catches:
                            roll-=entry['weight']
                            if roll<0:cast.item=entry['item'];break
                        stock,created=PlayerItem.objects.get_or_create(player=player,item=cast.item,defaults={'quantity':1})
                        if not created:PlayerItem.objects.filter(pk=stock.pk).update(quantity=F('quantity')+1)
                    cast.status='finished';cast.save(update_fields=['caught','status','item'])
        return {'token':str(cast.token),'status':cast.status,'caught':cast.caught,'item':cast.item,'duration_ms':10000,'wait_ms':max(0,int((cast.ready_at-now).total_seconds()*1000)),
                'message':(f"{catalog()['items'].get(cast.item,{}).get('name','물고기')} 한 마리를 잡았소! 상인에게 팔 수 있소." if cast.caught else '입질 없이 줄을 거두었소. 다시 드리워 보시오.') if cast.status=='finished' else '낚싯줄을 거두었소.' if cast.status=='cancelled' else '찌를 바라보며 기다리는 중…'}
