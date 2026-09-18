"""One-time, atomic import. Existing editorial data is never overwritten."""
import hashlib
import json
import re

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from webapp.content import IMPORT_KEY, building_seeds
from webapp.guide import anchor
from webapp.model_resources import MODEL_RESOURCES
from webapp.models import Building, Citation, ContentImport, GuideSection, Resource, Story
from webapp.resources import public_resource_paths


class Command(BaseCommand):
    help = '기존 JSON·안내 문서를 빈 콘텐츠 DB로 한 번만 가져옵니다. 기존 편집 자료를 덮어쓰지 않습니다.'
    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    @transaction.atomic
    def handle(self, *args, **options):
        if ContentImport.objects.filter(key=IMPORT_KEY).exists():
            self.stdout.write('이미 가져온 자료입니다. 편집·삭제된 운영 자료를 그대로 유지합니다.')
            return
        if any(m.objects.exists() for m in (Building, Story, GuideSection, Resource)):
            raise CommandError('콘텐츠가 이미 존재합니다. 빈 DB에서만 최초 가져오기를 실행할 수 있습니다.')
        buildings = building_seeds()
        stories = json.loads((settings.BASE_DIR / 'gis/stories/doseong_stories.json').read_text())
        guide = (settings.BASE_DIR / 'docs/landmarks.md').read_text()
        resources = {}
        for key, (name, path, renderer) in MODEL_RESOURCES.items():
            resource = Resource(key='model-' + key.replace('_', '-'), name=name, kind='model', path=path, renderer=key)
            resource.full_clean(); resource.save(); resources[key] = resource
        for path in sorted(public_resource_paths()):
            key = 'file-' + hashlib.sha256(path.encode()).hexdigest()[:24]
            resource = Resource(key=key, name=path, kind='file', path=path)
            resource.full_clean(); resource.save()
        sections = []
        matches = list(re.finditer(r'^(#{1,3}) (.+)$', guide, re.M))
        for i, match in enumerate(matches):
            body = guide[match.end():matches[i+1].start() if i+1 < len(matches) else len(guide)].strip()
            section = GuideSection.objects.create(key=f'guide-{i:03}', title=match[2], level=len(match[1]), body=body, position=i, published=True)
            sections.append(section)
        def section_for(label):
            for section in sections:
                if anchor(section.title) == label:
                    return section
            combined = {'사정전 터': '사정전·강녕전·교태전 터', '강녕전 터': '사정전·강녕전·교태전 터', '교태전 터': '사정전·강녕전·교태전 터', '좌포도청': '좌포도청·우포도청', '우포도청': '좌포도청·우포도청'}
            for section in sections:
                if section.title == combined.get(label) or re.search(r'^\|\s*' + re.escape(label) + r'\s*\|', section.body, re.M):
                    return section
            raise CommandError('건물의 상세 설명을 찾지 못했습니다: ' + label)
        by_key = {}
        for i, feature in enumerate(buildings['features']):
            data = dict(feature)
            key, name, category = (data.pop(k) for k in ('id', 'name', 'category'))
            info = data.pop('info')
            renderer = data.pop('display_model', '')
            model_key = next((k for k, row in MODEL_RESOURCES.items() if row[2] == renderer), 'box')
            if category == '성문': model_key = 'city_gate'
            if key == 'jongmyo': model_key = 'jongmyo'
            name_en = data.pop('name_en', '')
            b = Building(key=key, name=name, category=category, summary=info['summary'], period=info['period'], in_1750=info['in_1750'], map_config=data, model_resource=resources[model_key], guide_section=section_for(name.split(' · ')[0]), position=i, published=True,
                         name_en=name_en, summary_en=info.get('summary_en', ''), period_en=info.get('period_en', ''), in_1750_en=info.get('in_1750_en', ''))
            b.full_clean(); b.save(); by_key[key] = b
            for j, src in enumerate(info['sources']):
                citation = Citation(building=b, position=j, title=src['title'], url=src['url'], title_en=src.get('title_en', ''))
                citation.full_clean(); citation.save()
        for i, row in enumerate(stories['stories']):
            target = row['target']
            s = Story(key=row['id'], building=by_key[target['key']] if target['type'] == 'landmark' else None, target_type=target['type'], target_key='' if target['type'] == 'landmark' else target['key'], title=row['title'], year=row['year'] or '', legend=row['legend'], text=row['text'], position=i, published=True,
                      title_en=row.get('title_en', ''), text_en=row.get('text_en', ''))
            s.full_clean(); s.save()
            for j, src in enumerate(row['sources']):
                citation = Citation(story=s, position=j, title=src['title'], url=src['url'], title_en=src.get('title_en', ''))
                citation.full_clean(); citation.save()
        ContentImport.objects.create(key=IMPORT_KEY, metadata={'buildings': {k:v for k,v in buildings.items() if k != 'features'}, 'stories': {k:v for k,v in stories.items() if k != 'stories'}})
        self.stdout.write(f'건물 {Building.objects.count()}, 이야기 {Story.objects.count()}, 상세 설명 {GuideSection.objects.count()}, 리소스 {Resource.objects.count()}')
        if options['dry_run']:
            transaction.set_rollback(True)
            self.stdout.write('검증만 완료했습니다. DB 변경은 저장하지 않았습니다.')
