"""Archive publicly linked AKS architectural GLBs sequentially, with a polite pause.

Raw pages/models stay out of Git; provenance and validated hashes are committed.
No model is automatically licensed for redistribution or installed into the app.
"""
import argparse
import hashlib
import json
import shutil
import struct
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[2]
ARCHIVE=ROOT/'data/models/aks-hanyang'
MANIFEST=ROOT/'docs/aks_architecture_manifest.json'
PAGES=['2020_3D모델링-건축물','3D모델링-건축물','2022_3D모델링-건축물']
BASE='https://dh.aks.ac.kr/hanyang2/wiki/index.php/'

class Rows(HTMLParser):
    def __init__(self):
        super().__init__();self.rows=[];self.row=None;self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr':self.row={'cells':[],'links':[]}
        if self.row is None:return
        if tag in ('td','th'):self.cell=[]
        if tag=='a':
            href=dict(attrs).get('href')
            if href:self.row['links'].append(href)
    def handle_data(self,text):
        if self.cell is not None:self.cell.append(text)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            if self.row is not None:self.row['cells'].append(' '.join(''.join(self.cell).split()))
            self.cell=None
        if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None

def encoded(url):
    return quote(url,safe=':/?=&%+~#')

def validate(path):
    size=path.stat().st_size
    with path.open('rb') as f:
        header=f.read(12)
        if len(header)!=12:raise ValueError('Truncated GLB header')
        magic,version,length=struct.unpack('<4sII',header)
        if magic!=b'glTF' or version!=2 or length!=size:raise ValueError('Invalid GLB magic/version/length')
        meta=None;chunks=[]
        while f.tell()<size:
            raw=f.read(8)
            if len(raw)!=8:raise ValueError('Truncated chunk header')
            count,kind=struct.unpack('<II',raw)
            if count%4 or f.tell()+count>size:raise ValueError('Invalid chunk size')
            if kind==0x4e4f534a:meta=json.loads(f.read(count))
            else:f.seek(count,1)
            chunks.append(kind)
        if not meta or not chunks or chunks[0]!=0x4e4f534a:raise ValueError('Missing glTF JSON')
    sha=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):sha.update(chunk)
    external=[o['uri'] for k in ('buffers','images') for o in meta.get(k,[]) if 'uri' in o and not o['uri'].startswith('data:')]
    return {'bytes':size,'sha256':sha.hexdigest(),'glb_version':version,'mesh_count':len(meta.get('meshes',[])),
            'material_count':len(meta.get('materials',[])),'external_uris':external,'extensions_required':meta.get('extensionsRequired',[])}

def save(data):
    MANIFEST.parent.mkdir(parents=True,exist_ok=True)
    tmp=MANIFEST.with_suffix('.json.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(MANIFEST)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--download',action='store_true');parser.add_argument('--pause',type=float,default=3)
    args=parser.parse_args();pause=max(3,args.pause);last_end=0
    def request(url):
        nonlocal last_end
        wait=pause-(time.monotonic()-last_end)
        if wait>0:time.sleep(wait)
        try:
            req=Request(encoded(url),headers={'User-Agent':'Hanyang3D-reference-archive/1.0 (sequential; 3s minimum delay)'})
            with urlopen(req,timeout=120) as response:
                yield response
        finally:last_end=time.monotonic()
    from contextlib import contextmanager
    request=contextmanager(request)
    old=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    previous={m['url']:m for m in old.get('models',[])}
    models={};pages=[];ARCHIVE.mkdir(parents=True,exist_ok=True)
    for title in PAGES:
        url=BASE+title
        with request(url) as response:raw=response.read()
        local=ARCHIVE/(title+'.html');local.write_bytes(raw)
        rows=Rows();rows.feed(raw.decode('utf-8'))
        pages.append({'title':title,'url':url,'local_html':str(local.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest()})
        for row in rows.rows:
            for href in row['links']:
                for target in parse_qs(urlsplit(href).query).get('url',[]):
                    if not target.lower().endswith('.glb'):continue
                    url=target if '://' in target else 'https://'+target
                    if url.startswith('http://'):url='https://'+url[7:]
                    if urlsplit(url).hostname!='dh.aks.ac.kr':continue
                    rel=unquote(urlsplit(url).path).split('/glb/',1)[-1]
                    if '..' in Path(rel).parts or rel.startswith('/'):raise ValueError('Unsafe archive path')
                    model=models.setdefault(url,{'url':url,'local_path':str((ARCHIVE/'glb'/rel).relative_to(ROOT)),
                        'references':[],'status':'pending','asset_license':'unconfirmed; page content license is not assumed to cover GLB'})
                    model['references'].append({'page':BASE+title,'viewer':href,'cells':row['cells']})
                    if url in previous:
                        for key,value in previous[url].items():
                            if key not in ('references','url','local_path'):model[key]=value
    data={'schema_version':1,'checked_at':datetime.now(timezone.utc).isoformat(),'request_pause_seconds':pause,
          'scope':'GLB links in the three user-supplied architecture tables; no guessed asset paths',
          'pages':pages,'models':list(models.values())}
    save(data);print(f'Discovered {len(models)} unique GLBs in {len(pages)} pages',flush=True)
    if not args.download:return
    for i,m in enumerate(data['models'],1):
        path=ROOT/m['local_path']
        if path.exists():
            try:
                result=validate(path)
                if m.get('sha256')==result['sha256']:
                    m.update(result,status='verified');print(f'{i}/{len(models)} cached {path.name}',flush=True);continue
            except (ValueError,OSError):pass
        if shutil.disk_usage(ARCHIVE).free<5*1024**3:raise RuntimeError('Archive disk reserve below 5 GiB')
        path.parent.mkdir(parents=True,exist_ok=True);part=path.with_suffix('.glb.part')
        for attempt in range(1,3):
            try:
                with request(m['url']) as response,part.open('wb') as f:
                    while chunk:=response.read(1024*1024):f.write(chunk)
                result=validate(part);part.replace(path)
                m.update(result,status='verified',downloaded_at=datetime.now(timezone.utc).isoformat());m.pop('error',None)
                print(f'{i}/{len(models)} OK {result["bytes"]} {path.name}',flush=True);break
            except Exception as e:
                m.update(status='failed',error=f'{type(e).__name__}: {e}')
                print(f'{i}/{len(models)} attempt {attempt} FAILED {path.name}: {e}',flush=True)
                if attempt==1:time.sleep(max(10,pause))
        save(data)
    save(data)
    good=[m for m in data['models'] if m['status']=='verified']
    print(f'FINISHED verified={len(good)} failed={len(models)-len(good)} bytes={sum(m["bytes"] for m in good)}',flush=True)
    if len(good)!=len(models):raise SystemExit(1)

if __name__=='__main__':main()
