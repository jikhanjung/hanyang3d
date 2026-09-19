"""Inventory costume/object/food model links; never download model binaries."""
import fcntl,hashlib,json,time
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote,urljoin,urlsplit,parse_qs
from urllib.request import Request,urlopen
from fetch_aks_architecture import ROOT,Rows,encoded

HOME='https://dh.aks.ac.kr/hanyang2/wiki/index.php/대문'
OUT=ROOT/'data/models/aks-hanyang/catalog-pages';OUT.mkdir(parents=True,exist_ok=True)
MANIFEST=ROOT/'docs/aks_objects_manifest.json'
# Share the downloader lock: a recrawl must not erase hashes/status mid-download.
lock_path=ROOT/'data/models/aks-hanyang/costumes/.download.lock';lock_path.parent.mkdir(parents=True,exist_ok=True)
catalog_lock=lock_path.open('w');fcntl.flock(catalog_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
previous=json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
class Links(HTMLParser):
 def __init__(self):super().__init__();self.hrefs=[]
 def handle_starttag(self,tag,attrs):
  if tag=='a' and dict(attrs).get('href'):self.hrefs.append(dict(attrs)['href'])
last=0
def get(url):
 global last
 time.sleep(max(0,3-(time.monotonic()-last)))
 try:
  with urlopen(Request(encoded(url),headers={'User-Agent':'Hanyang3D-reference-catalog/1.0 (HTML only; sequential 3s delay)'}),timeout=90) as r:return r.read()
 finally:last=time.monotonic()
raw=get(HOME);(OUT/'home.html').write_bytes(raw);links=Links();links.feed(raw.decode('utf-8'))
queue=[];seen=set();pages=[];models={}
for href in links.hrefs:
 title=unquote(urlsplit(href).path).rsplit('/',1)[-1]
 if '3D' in title and any(word in title for word in ['복식','물품','음식']):queue.append(urljoin(HOME,href))
while queue:
 url=queue.pop(0);title=unquote(urlsplit(url).path).rsplit('/',1)[-1]
 if title in seen:continue
 seen.add(title);raw=get(url);local=OUT/(title+'.html');local.write_bytes(raw)
 text=raw.decode('utf-8');rows=Rows();rows.feed(text)
 category='복식' if '복식' in title else '음식' if '음식' in title else '물품'
 year=2020 if title.startswith('2020') else 2022 if title.startswith('2022') else 2021
 count=0
 for row in rows.rows:
  for href in row['links']:
   targets=parse_qs(urlsplit(href).query).get('url',[])
   if urlsplit(href).path.lower().endswith('.glb'):targets.append(urljoin(url,href))
   for target in targets:
    if not target.lower().endswith('.glb'):continue
    model_url=target if '://' in target else 'https://'+target
    if model_url.startswith('http://'):model_url='https://'+model_url[7:]
    model=models.setdefault(model_url,{'url':model_url,'format':'GLB','filename':unquote(urlsplit(model_url).path).rsplit('/',1)[-1],
       'categories':[],'production_years':[],'references':[],'status':'catalogued_not_downloaded','historical_period':'not_reviewed','production_method':'not_reviewed','asset_license':'unconfirmed'})
    if category not in model['categories']:model['categories'].append(category)
    if year not in model['production_years']:model['production_years'].append(year)
    model['references'].append({'page':url,'viewer':href,'cells':row['cells'],'links':row['links']});count+=1
 pages.append({'title':title,'url':url,'category':category,'production_year':year,'linked_glbs':count,'sha256':hashlib.sha256(raw).hexdigest()})
 print(title,count,flush=True)
 # The 2020 general-object page may link dedicated regalia/instrument tables.
 if year==2020:
  links=Links();links.feed(text)
  for href in links.hrefs:
   sub=unquote(urlsplit(href).path).rsplit('/',1)[-1]
   if sub.startswith('2020_3D') and any(w in sub for w in ['복식','물품','의장물','악기','조형','제기']):queue.append(urljoin(url,href))
for old in previous.get('models',[]):
 if old['url'] in models:
  current=models[old['url']]
  for key,value in old.items():
   if key not in ('url','format','filename','categories','production_years','references','catalog_present'):current[key]=value
  current['catalog_present']=True
 else:
  models[old['url']]={**old,'catalog_present':False}
data={'schema_version':1,'source_home':HOME,'scope':'Home-linked costume/object/food tables; URL-matched archive status retained','pages':pages,'models':list(models.values())}
for key in ('costume_download','object_download','food_download'):
 if key in previous:data[key]=previous[key]
tmp=MANIFEST.with_suffix('.json.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmp.replace(MANIFEST)
print('TOTAL',len(models),'unique GLBs; no binaries requested',flush=True)
