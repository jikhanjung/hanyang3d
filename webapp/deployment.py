"""Readiness checks for immutable code + versioned, read-only map data."""
import hashlib
import json

from django.conf import settings
from .resources import RUNTIME_PREFIXES, public_resource_paths, resource_path


def runtime_report(verify_hashes=False):
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
    return {'status': 'unhealthy' if missing or errors else 'ok',
            'version': settings.APP_VERSION, 'resources': len(paths),
            'missing': missing, 'errors': errors}
