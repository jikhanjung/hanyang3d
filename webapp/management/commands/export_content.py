import os
from pathlib import Path

from django.core import serializers
from django.core.management.base import BaseCommand, CommandError

from webapp.models import Building, Citation, ContentImport, GuideSection, Resource, Story


class Command(BaseCommand):
    help = '콘텐츠만 JSON으로 내보냅니다. 계정·비밀번호·세션은 포함하지 않습니다.'
    def add_arguments(self, parser):
        parser.add_argument('output')
    def handle(self, *args, **options):
        data = serializers.serialize('json', [obj for model in (Resource, GuideSection, Building, Story, Citation, ContentImport) for obj in model.objects.order_by('pk')], indent=2, ensure_ascii=False)
        try:
            fd = os.open(Path(options['output']), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except OSError as exc:
            raise CommandError('새 파일에만 내보낼 수 있습니다: ' + str(exc)) from exc
        with os.fdopen(fd, 'w') as out:
            out.write(data + '\n')
        self.stdout.write('콘텐츠 내보내기 완료')
