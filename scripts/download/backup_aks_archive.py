"""Copy completed AKS reference files to the existing NAS; never prune copies."""
import argparse
import hashlib
import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEST = Path('/nas/JikhanJung/hanyang3d_backup/research/aks-hanyang')


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4 * 1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def write_json(path, value):
    tmp = path.with_name(path.name + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    args = parser.parse_args()
    if not os.path.ismount('/nas'):
        raise RuntimeError('NAS must be mounted; refusing local fallback')
    DEST.mkdir(parents=True, exist_ok=True)
    status_path = DEST / 'backup_status.json'
    status = json.loads(status_path.read_text()) if status_path.exists() else {'files': {}}
    while True:
        pending = 0
        files = {}
        snapshots = {}
        for name, key in [('aks_architecture_manifest.json', 'models'), ('aks_pdf_manifest.json', 'documents'), ('aks_objects_manifest.json', 'models')]:
            source = ROOT / 'docs' / name
            if not source.exists():
                continue
            data = json.loads(source.read_text())
            snapshots[name] = data
            for entry in data[key]:
                pending += entry['status'] == 'pending'
                if name == 'aks_objects_manifest.json':
                    active = any(data.get(state) and category in entry.get('categories', [])
                                 for category, state in [('복식', 'costume_download'), ('물품', 'object_download'), ('음식', 'food_download')])
                    pending += active and entry['status'] == 'catalogued_not_downloaded'
                if entry['status'] == 'verified':
                    files[entry['local_path']] = entry['sha256']
        for base in [ROOT / 'data/models/aks-hanyang', ROOT / 'data/texts/aks-hanyang']:
            if base.exists():
                for path in base.rglob('*'):
                    if path.is_file() and path.suffix in ('.html', '.md'):
                        files[str(path.relative_to(ROOT))] = digest(path)
        for path in (ROOT / 'docs').glob('aks_*'):
            if path.is_file() and path.suffix in ('.json', '.csv', '.md') and path.name not in snapshots:
                files[str(path.relative_to(ROOT))] = digest(path)
        for relative, expected in files.items():
            rel = Path(relative)
            if rel.is_absolute() or '..' in rel.parts:
                raise ValueError('Unsafe manifest path')
            src, dst = ROOT / rel, DEST / rel
            old = status['files'].get(relative, {})
            if dst.exists() and old.get('sha256') == expected and dst.stat().st_size == old.get('bytes') and dst.stat().st_mtime_ns == old.get('mtime_ns'):
                continue
            if shutil.disk_usage(DEST).free < src.stat().st_size + 5 * 1024 ** 3:
                raise RuntimeError('NAS reserve below 5 GiB')
            dst.parent.mkdir(parents=True, exist_ok=True)
            part = dst.with_name(dst.name + '.part')
            shutil.copyfile(src, part)
            if digest(part) != expected:
                raise RuntimeError(f'NAS checksum mismatch: {relative}')
            part.replace(dst)
            status['files'][relative] = {'sha256': expected, 'bytes': dst.stat().st_size, 'mtime_ns': dst.stat().st_mtime_ns, 'verified_at': datetime.now(timezone.utc).isoformat()}
            write_json(status_path, status)
            print(f'VERIFIED {relative}', flush=True)
        # Publish a manifest only after its verified files have arrived.
        (DEST / 'docs').mkdir(exist_ok=True)
        for name, data in snapshots.items():
            write_json(DEST / 'docs' / name, data)
        status.update(checked_at=datetime.now(timezone.utc).isoformat(), pending_downloads=pending)
        write_json(status_path, status)
        print(f'PASS files={len(status["files"])} pending_downloads={pending}', flush=True)
        if not args.watch or not pending:
            break
        time.sleep(30)


if __name__ == '__main__':
    main()
