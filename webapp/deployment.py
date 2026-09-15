"""Readiness checks for immutable code + versioned, read-only map data."""
import hashlib
import json

from django.conf import settings
from .resources import RUNTIME_PREFIXES, public_resource_paths, resource_path


def runtime_report(verify_hashes=False, check_content=True):
    paths = public_resource_paths()
    missing = sorted(p for p in paths if not resource_path(p).is_file())
    errors = []
    if settings.REQUIRE_DATA_BUNDLE:
        try:
            manifest = json.loads((settings.RUNTIME_DATA_ROOT / 'manifest.json').read_text())
            if manifest['version'] != settings.APP_VERSION:
                errors.append('Data bundle version differs from image version')
            expected = {p for p in paths if p.startswith(RUNTIME_PREFIXES)}
            if set(manifest['files']) != expected:
                errors.append('Data bundle file inventory differs from image')
            for path in expected:
                record = manifest['files'].get(path)
                file = resource_path(path)
                if not record or not file.is_file():
                    continue
                if file.stat().st_size != record['size']:
                    errors.append('Size mismatch: ' + path)
                elif verify_hashes and hashlib.sha256(file.read_bytes()).hexdigest() != record['sha256']:
                    errors.append('Checksum mismatch: ' + path)
        except (OSError, ValueError, KeyError, TypeError):
            errors.append('Missing or invalid data bundle manifest')
    content, warnings = {}, []
    if check_content and settings.CONTENT_SOURCE == 'database':
        from django.db import DatabaseError
        from .models import Building, ContentImport, Story
        from .content import IMPORT_KEY
        try:
            if not ContentImport.objects.filter(key=IMPORT_KEY).exists():
                errors.append('Content database has not been initialized')
            content = {'buildings': Building.objects.filter(published=True).count(),
                       'stories': Story.objects.filter(published=True).count()}
            if content['buildings'] == 0:
                errors.append('Content database has no published buildings')
            if not errors:
                from .content import content_problems
                warnings = content_problems()
        except DatabaseError:
            errors.append('Content database is unavailable or migrations are missing')
    from pathlib import Path
    from deploy.host.backup_content import FAILURE_SENTINEL
    backup_failed = settings.CONTENT_SOURCE == 'database' and (Path(settings.DATABASES['default']['NAME']).parent / FAILURE_SENTINEL).exists()
    status = 'unhealthy' if missing or errors else ('degraded' if backup_failed else 'ok')
    return {'content_source': settings.CONTENT_SOURCE, 'content': content, 'content_warnings': warnings,
            'backup_failed': backup_failed, 'status': status,
            'version': settings.APP_VERSION, 'resources': len(paths),
            'missing': missing, 'errors': errors}
