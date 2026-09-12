import json
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlencode
root=Path(__file__).resolve().parents[2]
query='[out:json][timeout:45];way[waterway~"river|stream"][name~"청계천|중랑천"](37.53,127.005,37.59,127.08);out body geom;'
url='https://overpass-api.de/api/interpreter'
req=Request(url,data=urlencode({'data':query}).encode(),headers={'User-Agent':'Hanyang3D source-map research'})
with urlopen(req,timeout=65) as r:data=json.load(r)
p=root/'gis/waterways/downstream_osm_source.json';p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print([(e['id'],e.get('tags',{}).get('name'),len(e.get('geometry',[]))) for e in data['elements']])
