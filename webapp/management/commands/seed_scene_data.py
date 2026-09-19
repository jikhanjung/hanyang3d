from django.core.management.base import BaseCommand
from django.db import transaction
from webapp.models import SceneDataset
from webapp.scene_data import DATASETS, seed, validate

class Command(BaseCommand):
    help='아직 등록되지 않은 장면 데이터만 초기화하며 기존 편집을 보존합니다.'
    @transaction.atomic
    def handle(self,*args,**options):
        count=0
        for key in DATASETS:
            data=seed(key);validate(key,data)
            _,created=SceneDataset.objects.get_or_create(key=key,defaults={'data':data});count+=created
        self.stdout.write(f'장면 데이터 최초 등록 {count}개. 기존 값은 보존했습니다.')
