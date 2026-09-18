"""Archive directly linked project/reference PDFs after the GLB queue finishes."""
import argparse
import hashlib
import json
import shutil
import subprocess
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import urlopen

from fetch_aks_architecture import ROOT, encoded

ARCHIVE = ROOT / 'data/texts/aks-hanyang'
MANIFEST = ROOT / 'docs/aks_pdf_manifest.json'
SOURCES = [
    ('https://dh.aks.ac.kr/Edu/wiki/index.php/한양도성_타임머신_2022', '/tmp/aks-edu-project.html'),
    ('https://dh.aks.ac.kr/hanyang2/wiki/index.php/2022_참고문헌', '/tmp/aks-2022-bibliography.html'),
]


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links = []; self.href = None; self.label = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a': self.href = dict(attrs).get('href'); self.label = []
    def handle_data(self, data):
        if self.href: self.label.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.href:
            self.links.append((self.href, ' '.join(''.join(self.label).split())))
            self.href = None


def save(data):
    tmp = MANIFEST.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(MANIFEST)


def validate(path):
    with path.open('rb') as f:
        if f.read(5) != b'%PDF-': raise ValueError('Not a PDF')
        f.seek(0); sha = hashlib.file_digest(f, 'sha256').hexdigest()
    info = subprocess.run(['pdfinfo', str(path)], check=True, capture_output=True, text=True).stdout
    pages = next(int(line.split(':')[1]) for line in info.splitlines() if line.startswith('Pages:'))
    return {'bytes': path.stat().st_size, 'sha256': sha, 'pages': pages}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--download', action='store_true')
    ap.add_argument('--wait-for-glb', action='store_true')
    ap.add_argument('--cached-pages', action='store_true', help='Use already fetched source HTML in /tmp')
    args = ap.parse_args()
    ARCHIVE.mkdir(parents=True, exist_ok=True)
    if MANIFEST.exists():
        data = json.loads(MANIFEST.read_text())
    else:
        entries = {}; sources = []
        for i, (url, cached) in enumerate(SOURCES):
            if args.cached_pages: raw = Path(cached).read_bytes()
            else:
                if i: time.sleep(3)
                with urlopen(encoded(url), timeout=120) as response: raw = response.read()
            local = ARCHIVE / f'source-{i + 1}.html'; local.write_bytes(raw)
            sources.append({'url': url, 'local_path': str(local.relative_to(ROOT)), 'sha256': hashlib.sha256(raw).hexdigest()})
            parser = Links(); parser.feed(raw.decode('utf-8'))
            for href, label in parser.links:
                target = urljoin(url, href).replace('http://dh.aks.ac.kr/', 'https://dh.aks.ac.kr/')
                parsed = urlsplit(target)
                if not parsed.path.lower().endswith('.pdf'): continue
                if parsed.hostname != 'dh.aks.ac.kr': continue
                rel = Path(unquote(parsed.path).lstrip('/'))
                if '..' in rel.parts: raise ValueError('Unsafe PDF path')
                entry = entries.setdefault(target, {'url': target, 'local_path': str((ARCHIVE / 'pdf' / rel).relative_to(ROOT)), 'references': [], 'status': 'pending'})
                entry['references'].append({'page': url, 'label': label})
        data = {'schema_version': 1, 'request_pause_seconds': 3, 'scope': 'PDF links directly present in the two requested pages; research archive only', 'sources': sources, 'documents': list(entries.values())}
        save(data)
    print(f'CATALOG {len(data["documents"])} PDFs', flush=True)
    if not args.download: return
    if args.wait_for_glb:
        print('WAITING for architecture GLB queue', flush=True)
        while any(m['status'] == 'pending' for m in json.loads((ROOT / 'docs/aks_architecture_manifest.json').read_text())['models']):
            time.sleep(30)
    for i, entry in enumerate(data['documents'], 1):
        path = ROOT / entry['local_path']
        if path.exists() and entry.get('sha256'):
            if validate(path)['sha256'] == entry['sha256']: continue
        if shutil.disk_usage(ARCHIVE).free < 5 * 1024 ** 3: raise RuntimeError('Disk reserve below 5 GiB')
        path.parent.mkdir(parents=True, exist_ok=True)
        part = path.with_suffix('.pdf.part')
        for attempt in range(2):
            time.sleep(3 if attempt == 0 else 10)
            try:
                with urlopen(encoded(entry['url']), timeout=120) as response, part.open('wb') as out:
                    shutil.copyfileobj(response, out, 1024 * 1024)
                result = validate(part); part.replace(path)
                entry.update(result, status='verified', downloaded_at=datetime.now(timezone.utc).isoformat()); entry.pop('error', None)
                print(f'{i}/{len(data["documents"])} OK {path.name}', flush=True)
                break
            except Exception as e:
                entry.update(status='failed', error=f'{type(e).__name__}: {e}')
                print(f'{i} attempt {attempt + 1} FAILED {e}', flush=True)
        save(data)
    failed = sum(e['status'] != 'verified' for e in data['documents'])
    print(f'FINISHED failed={failed}', flush=True)
    if failed: raise SystemExit(1)


if __name__ == '__main__':
    main()
