"""Per-account resource cooldown shared across eras and browser sessions."""
import secrets
from datetime import timedelta
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from .economy import TradeError,catalog
from .models import Player,PlayerItem,HerbHarvest

def gather(player,action,node=None):
    now=timezone.now()
    if action=='status':
        return {'cooldowns':{r.node:max(0,int((r.next_at-now).total_seconds()*1000)) for r in HerbHarvest.objects.filter(player=player,next_at__gt=now)}}
    if action!='gather' or not isinstance(node,str) or node not in {r['id'] for r in catalog()['herbs']['nodes']}:raise TradeError(400,'그곳에는 채집할 약초가 없소.')
    if 'mountain_herb' not in catalog()['items']:raise TradeError(503,'약초 물품을 준비하고 있소.')
    with transaction.atomic():
        Player.objects.filter(pk=player.pk).update(money=F('money'))
        row=HerbHarvest.objects.filter(player=player,node=node).first()
        if row and row.next_at>now:raise TradeError(409,'이곳의 약초가 다시 자라려면 기다려야 하오.')
        HerbHarvest.objects.update_or_create(player=player,node=node,defaults={'next_at':now+timedelta(minutes=5)})
        caught=secrets.randbelow(100)<80
        if caught:
            stock,created=PlayerItem.objects.get_or_create(player=player,item='mountain_herb',defaults={'quantity':1})
            if not created:PlayerItem.objects.filter(pk=stock.pk).update(quantity=F('quantity')+1)
        return {'caught':caught,'cooldown_ms':300000,'message':'산약초 한 묶음을 모았소. 약재상에게 가져가 보시오.' if caught else '쓸 만한 약초를 얻지 못했소. 다른 포기를 찾아보시오.'}
