import json
from django.core.management.base import BaseCommand
from webapp.models import Building, SceneDataset
from webapp.scene_data import DATASETS, digest, seed

class Command(BaseCommand):
    help='데이터 갱신용 현재 값과 비교 해시를 내보냅니다. 계정·비밀 설정은 포함하지 않습니다.'
    def add_arguments(self,parser):
        parser.add_argument('--dataset',action='append',choices=list(DATASETS),default=[])
        parser.add_argument('--building',action='append',default=[])
    def handle(self,*args,**options):
        result={'schema_version':1,'datasets':{},'buildings':{}}
        keys=options['dataset'] or ([] if options['building'] else list(DATASETS))
        for key in keys:
            row=SceneDataset.objects.filter(key=key).first();data=row.data if row else seed(key)
            result['datasets'][key]={'expected_sha256':digest(data),'data':data}
        for key in options['building']:
            data=Building.objects.get(key=key).map_config
            result['buildings'][key]={'expected_sha256':digest(data),'map_config':data}
        self.stdout.write(json.dumps(result,ensure_ascii=False,indent=2))
