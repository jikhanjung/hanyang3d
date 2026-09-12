"""Use connected OSM node IDs; preserve the historical source trace separately."""
import json, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'gis/waterways/downstream_osm_source.json'
ways={e['id']:e for e in json.loads(source.read_text())['elements']}
c,j,end=(ways[k] for k in [769631455,26084930,967550721])
join=j['nodes'].index(c['nodes'][-1])
def coords(points):return [[p['lon'],p['lat']] for p in points]
# Start east of the source-map terminus; the intervening connector is an estimate.
start=next(i for i,p in enumerate(c['geometry']) if p['lon']>=127.020)
record={'source':'OpenStreetMap contributors','license':'ODbL 1.0','retrieved_on':'2026-09-11','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'references':[f'https://www.openstreetmap.org/way/{k}' for k in [769631455,26084930,967550721]],'confluence_lonlat':coords([c['geometry'][-1]])[0],'cheonggye_lonlat':coords(c['geometry'][start:]),'south_lonlat':coords(j['geometry'][join:]+end['geometry'][1:]),'north_lonlat':coords(j['geometry'][:join+1]),'half_widths_m':{'cheonggye':18,'jungnang':40},'limitations':'현대 OSM 중심선으로 보완한 개관용 하류. 원도 끝에서 현대 중심선까지는 추정 연결이며, 당시 유로·하폭·깊이 복원이 아님. 중랑천 북쪽은 합류부 인접 구간만 표시.'}
p=root/'gis/waterways/doseong_cheonggyecheon.json'; data=json.loads(p.read_text());data['downstream']=record;p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('Confluence',record['confluence_lonlat'],'path sizes',*[len(record[k]) for k in ['cheonggye_lonlat','south_lonlat','north_lonlat']])
