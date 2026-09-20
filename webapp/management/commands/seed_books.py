"""Create the bookshop's missing catalogue entries without replacing edited stock/prices."""
import json
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from webapp.models import Item, Shop

class Command(BaseCommand):
    help = '회동서관 소설 3종과 상점을 없을 때만 추가합니다.'
    @transaction.atomic
    def handle(self, *args, **options):
        data = json.loads((settings.BASE_DIR / 'gis/characters/npcs.json').read_text())
        keys = ['book_chunhyang', 'book_guunmong', 'book_sukhyang']
        items = []
        for index, key in enumerate(keys):
            r = data['items'][key]
            item, _ = Item.objects.get_or_create(key=key, defaults=dict(
                name=r['name'], name_en=r['name_en'], unit=r['unit'], unit_en=r['unit_en'],
                price=r['price'], description=r['desc'], description_en=r['desc_en'],
                icon_shape='book', icon_color=r['icon']['color'], position=120+index))
            items.append(item)
        shop, created = Shop.objects.get_or_create(key='회동서관 별책', defaults={
            'about': data['shops']['회동서관 별책']['about'], 'position':120})
        if created:
            shop.items.add(*items)
        self.stdout.write('회동서관 책·상점 준비 완료 (기존 값 보존)')
