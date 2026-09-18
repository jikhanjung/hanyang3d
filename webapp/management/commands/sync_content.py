import json

from django.conf import settings
from django.core.management.base import BaseCommand

from webapp.content import building_seeds
from webapp.content_sync import sync_content


class Command(BaseCommand):
    help = 'Git의 건물·이야기·물건·가게 JSON 변경을 운영 콘텐츠 DB에 반영합니다. 운영에서 편집한 항목은 덮어쓰지 않고 충돌로 보고합니다.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='변경을 저장합니다. 없으면 미리보기만 합니다.')

    def handle(self, *args, **options):
        report = sync_content(
            building_seeds(),
            json.loads((settings.BASE_DIR / 'gis/stories/doseong_stories.json').read_text()),
            (settings.BASE_DIR / 'docs/landmarks.md').read_text(),
            apply=options['apply'],
            economy_data=json.loads((settings.BASE_DIR / 'gis/characters/npcs.json').read_text()),
            guide_en=json.loads((settings.BASE_DIR / 'docs/landmarks_en.json').read_text()) if (settings.BASE_DIR / 'docs/landmarks_en.json').exists() else None)
        for line in report.lines():
            self.stdout.write(line)
