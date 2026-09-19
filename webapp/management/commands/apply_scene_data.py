import json
import sys
from pathlib import Path
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from webapp.models import Building, SceneDataset
from webapp.scene_data import DATASETS, digest, seed, validate

class Command(BaseCommand):
    help='비교 해시가 있는 갱신을 검증하고 --apply로 원자적으로 저장합니다.'
    def add_arguments(self,parser):
        parser.add_argument('bundle',help='JSON 경로 또는 표준 입력 -')
        parser.add_argument('--apply',action='store_true')
    @transaction.atomic
    def handle(self,*args,**options):
        try:
            raw=sys.stdin.read(4_000_001) if options['bundle']=='-' else Path(options['bundle']).read_text()
            if len(raw)>4_000_000:raise CommandError('갱신 파일이 너무 큽니다.')
            bundle=json.loads(raw)
            if bundle.get('schema_version')!=1 or set(bundle)-{'schema_version','datasets','buildings'}:raise CommandError('지원하지 않는 갱신 형식입니다.')
            changes=[];restart=False
            for key,item in bundle.get('datasets',{}).items():
                if key not in DATASETS:raise CommandError('지원하지 않는 데이터: '+key)
                row=SceneDataset.objects.select_for_update().filter(key=key).first()
                current=row.data if row else seed(key)
                if item['expected_sha256']!=digest(current):raise CommandError('운영 수정과 충돌: '+key)
                validate(key,item['data'])
                if current!=item['data']:
                    row=row or SceneDataset(key=key);row.data=item['data'];row.full_clean();changes.append(row)
                    restart|=key=='walking1907'
            for key,item in bundle.get('buildings',{}).items():
                row=Building.objects.select_for_update().get(key=key)
                if item['expected_sha256']!=digest(row.map_config):raise CommandError('운영 수정과 충돌: '+key)
                if row.map_config!=item['map_config']:
                    row.map_config=item['map_config'];row.full_clean();changes.append(row)
            if options['apply']:
                for row in changes:row.save()
            self.stdout.write(json.dumps({'applied':options['apply'],'changed':len(changes),'multiplayer_restart_required':restart},ensure_ascii=False))
        except (KeyError,TypeError,ValueError,ValidationError,Building.DoesNotExist) as error:
            raise CommandError(str(error)) from error
