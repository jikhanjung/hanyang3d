import sqlite3

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from webapp.content_backup import backup_database


class Command(BaseCommand):
    help = 'SQLite 온라인 백업을 검증한 뒤 저장합니다. 백업의 로그인 세션은 제거합니다.'
    def add_arguments(self, parser):
        parser.add_argument('output')
    def handle(self, *args, **options):
        try:
            backup_database(settings.DATABASES['default']['NAME'], options['output'])
        except (OSError, ValueError, sqlite3.DatabaseError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write('백업 무결성·외래 키 검사 완료. 복원 시 다시 로그인해야 합니다.')
