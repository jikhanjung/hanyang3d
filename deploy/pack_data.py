"""Package only web-allowlisted runtime assets, checking catalogued originals."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'webapp.settings')
import django
django.setup()
from webapp.resources import RUNTIME_PREFIXES, assets, public_resource_paths


def pack(version):
    destination = ROOT / '.build' / ('runtime-' + version)
    destination.mkdir(parents=True, exist_ok=True)
    original_hashes = {a['local_path']: a['sha256'] for a in assets()}
    manifest = {'version': version, 'files': {}}
    for path in sorted(p for p in public_resource_paths() if p.startswith(RUNTIME_PREFIXES)):
        source = ROOT / path
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        if path in original_hashes and digest != original_hashes[path]:
            raise SystemExit('Catalog checksum mismatch: ' + path)
        target = destination / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        target.chmod(0o644)
        manifest['files'][path] = {'size': source.stat().st_size, 'sha256': digest}
    (destination / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (destination / 'manifest.json').chmod(0o644)
    output = ROOT / 'dist' / ('hanyang3d-data-' + version + '.tar.gz')
    output.parent.mkdir(exist_ok=True)
    with tarfile.open(output, 'w:gz') as archive:
        for path in [*manifest['files'], 'manifest.json']:
            archive.add(destination / path, arcname=path)
    print(f'Packaged {len(manifest["files"])} runtime files: {output}')


if __name__ == '__main__':
    import re
    if len(sys.argv) != 2 or not re.fullmatch(r'v\d+\.\d+\.\d+', sys.argv[1]):
        raise SystemExit('Usage: pack_data.py vX.Y.Z')
    pack(sys.argv[1])
