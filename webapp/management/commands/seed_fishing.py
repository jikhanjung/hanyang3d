"""Add only fishing-owned catalog entries; preserve existing editorial and player data."""
import json
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from webapp.models import Item,Shop
class Command(BaseCommand):
    help='낚싯대·민물고기·산약초·낚시꾼과 약재상 상점이 없을 때만 추가합니다.'
    @transaction.atomic
    def handle(self,*args,**options):
        data=json.loads((settings.BASE_DIR/'gis/characters/npcs.json').read_text())
        for key in ['fishing_rod','river_fish','mountain_herb']:
            r=data['items'][key]
            Item.objects.get_or_create(key=key,defaults=dict(name=r['name'],name_en=r['name_en'],unit=r['unit'],unit_en=r['unit_en'],price=r['price'],description=r['desc'],description_en=r['desc_en'],icon_shape=r['icon']['shape'],icon_color=r['icon']['color'],use=r.get('use',''),max_owned=r.get('max_owned'),position=100))
        shop,created=Shop.objects.get_or_create(key='청계천 낚시꾼',defaults={'about':data['shops']['청계천 낚시꾼']['about'],'position':100})
        if created:shop.items.add(Item.objects.get(key='fishing_rod'))
        Shop.objects.get_or_create(key='약재상',defaults={'about':data['shops']['약재상']['about'],'position':101})
        self.stdout.write('낚시·약초 물품 준비 완료 (기존 값 보존)')
