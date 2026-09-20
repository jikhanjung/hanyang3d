import io
import uuid
from django.test import TestCase
from django.core.management import call_command
from .economy import trade, TradeError
from .models import Item, Shop, Player, PlayerItem

class BookshopTests(TestCase):
    def test_seed_preserves_edits_and_stock_then_trade_uses_database_price(self):
        call_command('seed_books', stdout=io.StringIO())
        item=Item.objects.get(key='book_chunhyang');item.price=23;item.save()
        shop=Shop.objects.get(key='회동서관 별책');shop.items.remove(Item.objects.get(key='book_guunmong'))
        call_command('seed_books', stdout=io.StringIO())
        item.refresh_from_db();self.assertEqual(item.price,23)
        self.assertFalse(shop.items.filter(key='book_guunmong').exists())
        player=Player.objects.create(token=uuid.uuid4(),money=100,name='독자',name_key='독자')
        trade(player,'buy',shop.key,item.key,1)
        player.refresh_from_db();self.assertEqual(player.money,77)
        self.assertEqual(PlayerItem.objects.get(player=player,item=item.key).quantity,1)
        with self.assertRaises(TradeError):trade(player,'buy',shop.key,'book_guunmong',1)
