import copy
from io import StringIO
import json
from pathlib import Path
import sqlite3
from tempfile import TemporaryDirectory

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.management import call_command, CommandError
from django.db.models.deletion import ProtectedError
from django.test import TestCase, SimpleTestCase, override_settings
from django.urls import reverse

from .content import load_buildings, load_stories
from .content_backup import backup_database
from .guide import render_guide, inline
from .models import Building, Citation, ContentImport, GuideSection, Resource, Story


@override_settings(CONTENT_SOURCE='database')
class BrokenReferenceTests(TestCase):
    """A row that points at a renderer, bridge or place the image no longer has must not break the page."""
    @classmethod
    def setUpTestData(cls):
        call_command('import_content', stdout=StringIO())

    def test_broken_references_are_skipped_and_reported(self):
        from .content import content_problems
        from .deployment import runtime_report
        self.assertEqual(content_problems(), [])
        building = Building.objects.filter(published=True).exclude(model_resource__renderer='').select_related('model_resource').first()
        Resource.objects.filter(pk=building.model_resource_id).update(renderer='removed_renderer')
        story = Story.objects.filter(target_type='bridge').first()
        Story.objects.filter(pk=story.pk).update(target_key='removed-bridge')
        problems = []
        features = load_buildings(problems)['features']
        self.assertIn(building.key, [f['id'] for f in features])
        stories = load_stories(problems)['stories']
        self.assertNotIn(story.key, [s['id'] for s in stories])
        # A model resource can be shared by several buildings; each affected row is reported once.
        shared = Building.objects.filter(published=True, model_resource_id=building.model_resource_id).count()
        self.assertEqual(len(problems), shared + 1, problems)
        self.assertTrue(any(building.key in p for p in problems) and any(story.key in p for p in problems), problems)
        self.assertEqual(self.client.get('/').status_code, 200)
        report = runtime_report()
        self.assertEqual(report['status'], 'ok')
        self.assertEqual(report['content_warnings'], problems)


@override_settings(CONTENT_SOURCE='database')
class SyncTests(TestCase):
    """Git JSON corrections reach the database without overwriting back-office edits."""
    @classmethod
    def setUpTestData(cls):
        call_command('import_content', stdout=StringIO())

    def data(self):
        return (json.loads((settings.BASE_DIR / 'gis/buildings/1750_landmarks.json').read_text()),
                json.loads((settings.BASE_DIR / 'gis/stories/doseong_stories.json').read_text()))

    def test_first_sync_is_clean_and_dry_run_writes_nothing(self):
        from .content_sync import sync_content, SYNC_KEY
        buildings, stories = self.data()
        report = sync_content(buildings, stories)
        self.assertEqual((report.created, report.updated, report.conflicts), ([], [], []))
        self.assertFalse(ContentImport.objects.filter(key=SYNC_KEY).exists())
        stories['stories'][0]['text'] = '미리보기 문장'
        sync_content(buildings, stories)
        self.assertNotEqual(Story.objects.get(key=stories['stories'][0]['id']).text, '미리보기 문장')

    def test_updates_untouched_rows_and_keeps_edits(self):
        from .content_sync import sync_content
        buildings, stories = self.data()
        untouched, edited = stories['stories'][0], stories['stories'][1]
        row = Story.objects.get(key=edited['id']); row.text = '운영자가 고친 본문'; row.save()
        untouched['text'] = 'Git에서 고친 본문'; untouched['sources'].append({'title': '추가 출처', 'url': 'https://example.org/a'})
        edited['text'] = 'Git에서도 고친 본문'
        feature = buildings['features'][0]; feature['symbol_size_m'] = [11, 12, 13]
        report = sync_content(buildings, stories, apply=True)
        self.assertIn(f"story {untouched['id']}", report.updated)
        self.assertEqual(Story.objects.get(key=untouched['id']).text, 'Git에서 고친 본문')
        self.assertEqual(Story.objects.get(key=untouched['id']).citations.count(), len(untouched['sources']))
        self.assertTrue(any(edited['id'] in c for c in report.conflicts), report.conflicts)
        self.assertEqual(Story.objects.get(key=edited['id']).text, '운영자가 고친 본문')
        self.assertEqual(Building.objects.get(key=feature['id']).map_config['symbol_size_m'], [11, 12, 13])
        # A later Git change to the synced row applies; a back-office edit without a Git change is kept.
        untouched['text'] = '두 번째 Git 수정'
        row = Building.objects.get(key=feature['id']); row.summary = '운영 설명'; row.save()
        report = sync_content(buildings, stories, apply=True)
        self.assertEqual(Story.objects.get(key=untouched['id']).text, '두 번째 Git 수정')
        self.assertEqual(Building.objects.get(key=feature['id']).summary, '운영 설명')

    def test_creates_new_and_respects_back_office_deletions(self):
        from .content_sync import sync_content
        buildings, stories = self.data()
        sync_content(buildings, stories, apply=True)
        new = copy.deepcopy(stories['stories'][0]); new['id'] = 'git-new-story'; new['title'] = '새 이야기'
        stories['stories'].append(new)
        report = sync_content(buildings, stories, apply=True)
        self.assertIn('story git-new-story', report.created)
        self.assertTrue(Story.objects.get(key='git-new-story').published)
        Story.objects.get(key='git-new-story').delete()
        report = sync_content(buildings, stories, apply=True)
        self.assertIn('story git-new-story', report.kept_deleted)
        self.assertFalse(Story.objects.filter(key='git-new-story').exists())

    def test_new_building_guide_preview_and_editorial_preservation(self):
        from .content_sync import sync_content
        buildings, stories = self.data()
        feature = copy.deepcopy(buildings['features'][-1])
        feature.update(id='new-estimated-site', name='추정 시설')
        buildings['features'].append(feature)
        guide = '## 추가 시설\n\n### 추정 시설\n\n추정 위치의 설명.\n\n### 다음 시설\n\n다른 설명.'
        report = sync_content(buildings, stories, guide_markdown=guide)
        self.assertIn('building new-estimated-site', report.created)
        self.assertFalse(GuideSection.objects.filter(title='추정 시설').exists())
        self.assertFalse(Building.objects.filter(key='new-estimated-site').exists())
        sync_content(buildings, stories, guide_markdown=guide, apply=True)
        section = Building.objects.get(key='new-estimated-site').guide_section
        self.assertEqual(section.body, '추정 위치의 설명.')
        section.body = '편집자가 보완한 설명'; section.save()
        report = sync_content(buildings, stories, guide_markdown=guide, apply=True)
        self.assertEqual(report.created, [])
        section.refresh_from_db()
        self.assertEqual(section.body, '편집자가 보완한 설명')


class SecretKeyTests(SimpleTestCase):
    def test_production_secret_requirement(self):
        from django.core.exceptions import ImproperlyConfigured
        from .secret_check import require_production_secret
        for bad in ('', 'short', 'replace-with-a-random-secret', 'replace-with-a-random-secret-' + 'x' * 20):
            with self.assertRaises(ImproperlyConfigured, msg=bad):
                require_production_secret(bad)
        require_production_secret('k' * 40)


class ImportTests(TestCase):
    def test_dry_run_and_atomic_failure(self):
        call_command('import_content', dry_run=True, stdout=StringIO())
        self.assertFalse(Building.objects.exists())
        self.assertFalse(Resource.objects.exists())
        # Only the goods seed of migration 0004 is recorded; the content import itself left nothing behind.
        self.assertFalse(ContentImport.objects.exclude(key='economy-import-v1').exists())
        Resource.objects.create(key='existing', name='운영 자료', kind='file', path='webapp/static/terrain3d.js')
        with self.assertRaises(CommandError):
            call_command('import_content', stdout=StringIO())
        self.assertEqual(Resource.objects.count(), 1)
        self.assertFalse(Building.objects.exists())


@override_settings(CONTENT_SOURCE='database')
class ContentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('import_content', stdout=StringIO())
        cls.editor = get_user_model().objects.create_superuser(username='editor', password='Test-password-only-3921')

    def test_import_preserves_data_and_editorial_changes(self):
        source = json.loads((settings.BASE_DIR / 'gis/stories/doseong_stories.json').read_text())
        from .i18n import localize
        # The database adds label_en for targets; otherwise Korean and English match the file.
        loaded = load_stories()
        self.assertEqual(localize(loaded, 'ko'), localize(source, 'ko'))
        self.assertEqual([s['title_en'] for s in loaded['stories']], [s['title_en'] for s in source['stories']])
        self.assertTrue(all(s['text_en'] for s in loaded['stories']))
        self.assertEqual(Building.objects.count(), 114)
        self.assertEqual(Resource.objects.count(), 112)
        originals = json.loads((settings.BASE_DIR / 'gis/buildings/1750_landmarks.json').read_text())['features']
        for original, actual in zip(originals, load_buildings()['features']):
            for key, value in original.items():
                if key != 'display_model': self.assertEqual(actual[key], value, (original['id'], key))
        original_guide = (settings.BASE_DIR / 'docs/landmarks.md').read_text()
        from .guide import render_markdown
        self.assertEqual(render_guide(), render_markdown(original_guide))
        building = Building.objects.get(key='honghwamun')
        building.summary = '운영자가 편집한 설명'; building.save()
        story = Story.objects.get(key='honghwamun-military-tax'); story.delete()
        call_command('import_content', stdout=StringIO())
        building.refresh_from_db()
        self.assertEqual(building.summary, '운영자가 편집한 설명')
        self.assertFalse(Story.objects.filter(key='honghwamun-military-tax').exists())

    def test_public_data_updates_without_restart_and_drafts_stay_hidden(self):
        building = Building.objects.get(key='honghwamun')
        story = Story.objects.get(key='honghwamun-military-tax')
        story.text = 'DB에서 고친 이야기'; story.save()
        building.summary = 'DB에서 고친 건물'; building.save()
        section = building.guide_section
        render_guide()  # warm renderer cache, then edit without a process restart
        section.body = '관리자가 수정한 상세 설명'; section.save()
        self.assertIn('DB에서 고친 건물', [f['info']['summary'] for f in self.client.get('/').context['buildings']['features']])
        self.assertIn('DB에서 고친 이야기', [s['text'] for s in self.client.get('/').context['stories']['stories']])
        self.assertContains(self.client.get('/guide/'), '관리자가 수정한 상세 설명')
        story.published = False; story.save()
        self.assertNotIn('DB에서 고친 이야기', [s['text'] for s in self.client.get('/').context['stories']['stories']])
        self.assertNotContains(self.client.get('/guide/'), 'DB에서 고친 이야기')
        story.published = True; story.save()
        building.published = False; building.save()
        self.assertNotIn(building.key, [f['id'] for f in load_buildings()['features']])
        self.assertNotIn(story.key, [s['id'] for s in load_stories()['stories']])
        section.published = False; section.save()
        self.assertNotContains(self.client.get('/guide/'), '관리자가 수정한 상세 설명')

    def test_model_resource_changes_and_protection(self):
        building = Building.objects.get(key='honghwamun')
        resource = building.model_resource
        with self.assertRaises(ProtectedError): resource.delete()
        building.model_resource = Resource.objects.get(renderer='throne_hall', kind='model')
        building.save()
        actual = next(f for f in load_buildings()['features'] if f['id'] == building.key)
        self.assertEqual(actual['display_model'], 'throne_hall')
        building.model_resource = Resource.objects.filter(kind='file').first()
        with self.assertRaises(ValidationError): building.full_clean()
        resource.path = 'webapp/settings.py'
        with self.assertRaises(ValidationError): resource.full_clean()
        resource.path = 'webapp/static/palace.js'; resource.renderer = 'arbitrary-code'
        with self.assertRaises(ValidationError): resource.full_clean()

    def test_validates_targets_geometry_and_urls(self):
        s = Story.objects.get(key='honghwamun-military-tax')
        s.target_key = 'bad'
        with self.assertRaises(ValidationError): s.full_clean()
        s.target_type = 'bridge'; s.building = None
        with self.assertRaises(ValidationError): s.full_clean()
        b = Building.objects.get(key='honghwamun')
        b.map_config = copy.deepcopy(b.map_config); b.map_config['symbol_size_m'] = [1, float('nan'), 2]
        with self.assertRaises(ValidationError): b.full_clean()
        citation = Citation.objects.filter(story__isnull=False).first()
        citation.url = 'javascript:alert(1)'
        with self.assertRaises(ValidationError): citation.full_clean()
        self.assertNotIn('href=', inline('[위험](javascript:alert)'))
        self.assertIn('&lt;script&gt;', inline('<script>bad</script>'))

    def test_backoffice_permissions_forms_and_static(self):
        url = reverse('admin:webapp_building_changelist')
        self.assertEqual(self.client.get(url).status_code, 302)
        ordinary = get_user_model().objects.create_user(username='visitor', password='Test-password-only-123')
        self.client.force_login(ordinary)
        self.assertEqual(self.client.get(url).status_code, 302)
        self.client.force_login(self.editor)
        for model in ('building', 'story', 'resource', 'guidesection'):
            self.assertEqual(self.client.get(reverse(f'admin:webapp_{model}_changelist')).status_code, 200)
        b = Building.objects.get(key='honghwamun')
        page = self.client.get(reverse('admin:webapp_building_change', args=[b.pk]))
        self.assertContains(page, '짧은 소개')
        self.assertContains(page, '고급 배치 설정')
        response = self.client.get('/static/admin/css/base.css'); self.assertEqual(response.status_code, 200); response.close()
        self.assertIn(self.client.get('/static/../webapp/settings.py').status_code, (400, 404))

    def test_export_does_not_include_accounts_and_wont_overwrite(self):
        with TemporaryDirectory() as root:
            path = Path(root) / 'export.json'
            call_command('export_content', str(path), stdout=StringIO())
            data = json.loads(path.read_text())
            self.assertEqual(sum(r['model'] == 'webapp.building' for r in data), 114)
            self.assertTrue(all(r['model'].startswith('webapp.') for r in data))
            self.assertNotIn('Test-password', path.read_text())
            with self.assertRaises(CommandError): call_command('export_content', str(path), stdout=StringIO())

    def test_readiness_requires_initialized_database(self):
        ContentImport.objects.all().delete()
        self.assertEqual(self.client.get('/healthz').status_code, 503)


class BackupTests(SimpleTestCase):
    def test_backup_includes_committed_wal_and_removes_sessions(self):
        with TemporaryDirectory() as root:
            source, target = Path(root) / 'source.sqlite3', Path(root) / 'backup.sqlite3'
            with sqlite3.connect(source) as db:
                db.execute('PRAGMA journal_mode=WAL')
                db.execute('CREATE TABLE story (id INTEGER PRIMARY KEY, text TEXT)')
                db.execute('CREATE TABLE django_session (session_key TEXT)')
                db.execute("INSERT INTO story VALUES (1, '운영 편집')")
                db.execute("INSERT INTO django_session VALUES ('bearer-secret')")
                db.commit()
                backup_database(source, target)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM django_session').fetchone()[0], 1)
            with sqlite3.connect(target) as restored:
                self.assertEqual(restored.execute('SELECT text FROM story').fetchone()[0], '운영 편집')
                self.assertEqual(restored.execute('SELECT COUNT(*) FROM django_session').fetchone()[0], 0)
                restored.execute("INSERT INTO story VALUES (2, '복원 뒤 수정')")
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(ValueError): backup_database(source, target)

    def test_failed_backup_never_prunes_and_success_clears_failure(self):
        from deploy.host.backup_content import run_backup, FAILURE_SENTINEL
        with TemporaryDirectory() as root:
            source = Path(root) / 'source.sqlite3'
            directory = Path(root) / 'backups'; directory.mkdir()
            old = []
            from datetime import datetime, timedelta
            for i in range(25):
                stamp = (datetime(2026, 1, 1) + timedelta(hours=i)).strftime('%Y%m%d_%H%M%S_%f')
                path = directory / f'content_{stamp}.sqlite3'
                path.write_bytes(b'previous backup'); old.append(path)
            with self.assertRaises(ValueError): run_backup(source, directory, min_free_bytes=0)
            self.assertTrue(all(p.exists() for p in old))
            source.write_bytes(b'not a database')
            with self.assertRaises(sqlite3.DatabaseError): run_backup(source, directory, min_free_bytes=0)
            self.assertTrue(all(p.exists() for p in old))
            self.assertTrue((source.parent / FAILURE_SENTINEL).exists())
            source.unlink()
            with sqlite3.connect(source) as db:
                db.execute('CREATE TABLE t (id INTEGER)'); db.commit()
            result = run_backup(source, directory, min_free_bytes=0)
            self.assertTrue(result.exists())
            self.assertEqual(len(list(directory.glob('content_*.sqlite3'))), 24)
            self.assertFalse((source.parent / FAILURE_SENTINEL).exists())
            self.assertFalse(list(directory.glob('*.sqlite3-wal')))

    def test_pre_deploy_snapshots_keep_the_newest(self):
        from deploy.host.backup_content import snapshot_before_deploy
        import os
        with TemporaryDirectory() as root:
            source = Path(root) / 'source.sqlite3'
            with sqlite3.connect(source) as db:
                db.execute('CREATE TABLE t (id INTEGER)'); db.commit()
            directory = Path(root) / 'pre-deploy'; directory.mkdir()
            other = directory / 'keep-me.sqlite3'; other.write_bytes(b'not ours')
            for i in range(4):
                old = directory / f'content_v0.3.{i}_20260101_00000{i}.sqlite3'
                old.write_bytes(b'old'); os.utime(old, (1000 + i, 1000 + i))
            snapshot_before_deploy(source, directory / 'content_v0.3.9_20260915_120000.sqlite3', keep=2)
            names = sorted(p.name for p in directory.iterdir())
            self.assertEqual(names, ['content_v0.3.3_20260101_000003.sqlite3', 'content_v0.3.9_20260915_120000.sqlite3', 'keep-me.sqlite3'])
            with self.assertRaises(ValueError): snapshot_before_deploy(source, directory / 'content_v0.4.0_20260915_130000.sqlite3', keep=0)

    def test_backup_removes_deleted_session_bytes(self):
        from contextlib import closing
        with TemporaryDirectory() as root:
            source, target = Path(root) / 'source.sqlite3', Path(root) / 'backup.sqlite3'
            with closing(sqlite3.connect(source)) as db:
                db.execute('PRAGMA secure_delete=OFF')
                db.execute('CREATE TABLE django_session (session_key TEXT)')
                db.executemany('INSERT INTO django_session VALUES (?)', [('EXPIRED_BEARER_' + str(i) + 'x'*500,) for i in range(200)])
                db.commit(); db.execute('DELETE FROM django_session'); db.commit()
            self.assertIn(b'EXPIRED_BEARER_', source.read_bytes())
            backup_database(source, target)
            self.assertNotIn(b'EXPIRED_BEARER_', target.read_bytes())
            self.assertEqual(sorted(p.name for p in Path(root).iterdir()), ['backup.sqlite3', 'source.sqlite3'])
