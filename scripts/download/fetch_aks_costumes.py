"""Download only the already catalogued costume GLBs, sequentially and resumably."""
import argparse
import csv
import fcntl
import hashlib
import json
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from fetch_aks_architecture import ROOT, encoded, validate

MANIFEST = ROOT / 'docs/aks_objects_manifest.json'
ARCHIVE = ROOT / 'data/models/aks-hanyang/costumes'


def refresh_catalog(data):
    """Keep the human-readable inventory in sync without recrawling source pages."""
    catalog = ROOT / 'docs/aks_objects_catalog.csv'
    with catalog.open(newline='') as source:
        reader = csv.DictReader(source)
        fields, rows = reader.fieldnames, list(reader)
    models = {m['url']: m for m in data['models']}
    labels = {'verified': '검증 완료', 'failed': '실패', 'catalogued_not_downloaded': '목록만 확보'}
    for row in rows:
        model = models.get(row['glb_url'])
        if model:
            row['download_status'] = labels.get(model['status'], model['status'])
    tmp = catalog.with_suffix('.csv.tmp')
    with tmp.open('w', newline='') as target:
        writer = csv.DictWriter(target, fieldnames=fields, lineterminator='\n')
        writer.writeheader()
        writer.writerows(rows)
    tmp.replace(catalog)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--pause', type=float, default=3)
    args = parser.parse_args()
    pause = max(3, args.pause)
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    with (ARCHIVE / '.download.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        data = json.loads(MANIFEST.read_text())
        models = [m for m in data['models'] if '복식' in m['categories']]
        print(f'Costume models: {len(models)}; minimum pause: {pause}s', flush=True)
        if not args.download:
            return
        data['costume_download'] = {'started_at': datetime.now(timezone.utc).isoformat(), 'pause_seconds': pause}

        def save():
            tmp = MANIFEST.with_suffix('.json.tmp')
            tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
            tmp.replace(MANIFEST)

        last_end = 0
        for index, model in enumerate(models, 1):
            url = model['url']
            if urlsplit(url).hostname != 'dh.aks.ac.kr' or urlsplit(url).scheme != 'https':
                raise ValueError('Unexpected archive host or scheme')
            # URL hash preserves distinct models with identical basenames.
            path = ARCHIVE / (hashlib.sha256(url.encode()).hexdigest()[:16] + '_' + Path(model['filename']).name)
            model['local_path'] = str(path.relative_to(ROOT))
            if path.exists():
                result = validate(path)
                if model.get('sha256') == result['sha256']:
                    model.update(result, status='verified')
                    print(f'{index}/{len(models)} cached {path.name}', flush=True)
                    continue
            if shutil.disk_usage(ARCHIVE).free < 10 * 1024**3:
                save()
                raise RuntimeError('Less than 10 GiB disk reserve')
            part = path.with_suffix('.glb.part')
            for attempt in range(2):
                time.sleep(max(0, pause - (time.monotonic() - last_end)))
                try:
                    request = Request(encoded(url), headers={'User-Agent': 'Hanyang3D-reference-archive/1.0 (sequential; 3s minimum delay)'})
                    with urlopen(request, timeout=120) as response, part.open('wb') as out:
                        while chunk := response.read(1024 * 1024):
                            if shutil.disk_usage(ARCHIVE).free < 10 * 1024**3:
                                raise RuntimeError('Less than 10 GiB disk reserve')
                            out.write(chunk)
                    result = validate(part)
                    part.replace(path)
                    model.update(result, status='verified', downloaded_at=datetime.now(timezone.utc).isoformat())
                    model.pop('error', None)
                    print(f'{index}/{len(models)} OK {result["bytes"]} {path.name}', flush=True)
                    break
                except Exception as error:
                    model.update(status='failed', error=f'{type(error).__name__}: {error}')
                    print(f'{index}/{len(models)} attempt {attempt+1} FAILED {path.name}: {error}', flush=True)
                    if isinstance(error, RuntimeError):
                        save()
                        raise
                    if attempt == 0:
                        time.sleep(60 if isinstance(error, HTTPError) and error.code in (429, 503) else 10)
                finally:
                    last_end = time.monotonic()
            save()
        good = [m for m in models if m['status'] == 'verified']
        data['costume_download'].update(completed_at=datetime.now(timezone.utc).isoformat(), verified=len(good), failed=len(models)-len(good))
        save()
        refresh_catalog(data)
        print(f'FINISHED verified={len(good)} failed={len(models)-len(good)} bytes={sum(m["bytes"] for m in good)}', flush=True)
        if len(good) != len(models):
            raise SystemExit(1)


if __name__ == '__main__':
    main()
