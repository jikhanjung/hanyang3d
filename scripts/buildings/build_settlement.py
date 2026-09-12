"""Deterministic speculative roadside placement; not historic parcel reconstruction."""
import json,random,math,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
root=Path(__file__).resolve().parents[2];rng=random.Random(1750)
wall=json.loads((root/'gis/walls/doseong_city_wall.json').read_text());water=json.loads((root/'gis/waterways/doseong_cheonggyecheon.json').read_text())
road=Image.open(root/'gis/roads/doseong_road_mask.png').getchannel('A');size=road.size
allowed=Image.new('L',size);draw=ImageDraw.Draw(allowed);draw.polygon([tuple(p) for p in wall['centerline']],fill=255)
# Conservative source-map precinct outlines; no claim of cadastral boundaries.
precincts=[{'name':'경복궁 터','polygon':[[1040,735],[1280,745],[1320,1138],[1020,1138]]},{'name':'창덕궁·창경궁·후원','polygon':[[1610,675],[1980,670],[2030,1335],[1640,1345]]},{'name':'종묘','polygon':[[1770,1340],[1990,1335],[2000,1480],[1770,1490]]},{'name':'경덕궁','polygon':[[770,1190],[1005,1190],[1015,1410],[775,1430]]},{'name':'사직단','polygon':[[745,1050],[935,1050],[945,1180],[745,1180]]},{'name':'문묘·성균관','polygon':[[1930,940],[2070,940],[2070,1130],[1930,1130]]},{'name':'육조거리','polygon':[[1090,1135],[1220,1135],[1220,1405],[1090,1405]]}]
for p in precincts:
 draw.polygon([tuple(q) for q in p['polygon']],fill=0)
 draw.line([tuple(q) for q in p['polygon']+[p['polygon'][0]]],fill=0,width=17)
draw.line([tuple(p) for p in wall['centerline']],fill=0,width=35)
for o in wall['openings']:
 x,y=o['pixel'];draw.ellipse((x-24,y-24,x+24,y+24),fill=0)
for i,(a,b) in enumerate(zip(water['centerline'],water['centerline'][1:])):
 draw.line([tuple(a),tuple(b)],fill=0,width=int(2*max(water['half_widths_px'][i:i+2])+38))
near=np.asarray(road.filter(ImageFilter.MaxFilter(25)))>0
clear=np.asarray(road.filter(ImageFilter.MaxFilter(7)))==0
valid=(np.asarray(allowed)>0)&near&clear
ink=np.asarray(road)>0;features=[]
for y in range(700,2260,3):
 for x in range(650,2570,3):
  px=x+rng.uniform(-.6,.6);py=y+rng.uniform(-.6,.6)
  if not valid[round(py),round(px)]:continue
  ys,xs=np.nonzero(ink[y-34:y+35,x-34:x+35]);
  if not len(xs):continue
  xs=xs+x-34;ys=ys+y-34;dist=(xs-px)**2+(ys-py)**2;k=int(np.argmin(dist));rx,ry=int(xs[k]),int(ys[k]);local=(xs-rx)**2+(ys-ry)**2<13**2
  xy=np.array([xs[local],ys[local]],float)
  if xy.shape[1]<3:continue
  vals,vec=np.linalg.eigh(np.cov(xy));v=vec[:,-1];angle=math.atan2(v[1],v[0])
  commercial=1100<px<2460 and 1370<py<1515 and dist[k]<18**2
  shop=commercial and rng.random()<.72
  features.append([round(px,2),round(py,2),round(angle,4),round(rng.uniform(5,8) if shop else rng.uniform(4.5,7.5),2),round(rng.uniform(4,6),2),round(rng.uniform(2.6,3.5),2),int(shop),round(rng.random(),5),rx,ry])
rng.shuffle(features)
record={'schema_version':2,'source_sha256':wall['source_sha256'],'road_mask_sha256':hashlib.sha256((root/'gis/roads/doseong_road_mask.png').read_bytes()).hexdigest(),'seed':1750,'placement':{'candidate_band_pixels':[3,12],'candidate_step_pixels':3,'roof_edge_setback_m':[2,9],'mode':'street_frontage','description':'도로 가장자리 가까운 한 줄 위주. 변형 지도에서 실제 거리로 거르고 출입구와 차양은 길을 향한다.'},'columns':['pixel_x','pixel_y','road_angle_radians','width_m','depth_m','wall_height_m','shop','rank','road_edge_pixel_x','road_edge_pixel_y'],'features':features,'precinct_exclusions':precincts,'historical_reference':{'year':1780,'area':'한성부 관할 전체(성 밖 포함)','registered_households':38742,'registered_population':201070,'url':'https://encykorea.aks.ac.kr/Article/E0061730'},'scenario':{'private_buildings_range':[30000,60000],'assumed_buildings_per_registered_household':[.8,1.5],'interpretation':'호는 건물 동수가 아니다. 공유 주거와 부속채를 고려한 가정 범위를 둔 규모 감각이며 조사로 확인된 건물 수가 아님. 1750년 전후 화면에 1780년 기록을 참고한 시기 차이가 있음.','display_scope':'도성 안 추출된 길 주변만 표시. 모델 한 동은 추정 배치 한 동이며 전체 한성부 건물 수를 대표하는 환산 기호가 아님.'},'limitations':['원도는 주택 필지·개별 건물의 직접 근거가 아님.','길 주변 배치·상가 비율·초가와 기와 비율·치수는 시각화 가정.','궁궐·제례 공간은 원도의 보수적 제외 다각형으로 비우며 정밀 경계가 아님.']}
out=root/'gis/buildings/doseong_settlement.json';out.write_text(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n');print('Candidates',len(features),'shops',sum(f[6] for f in features))
preview=Image.open(root/'data/maps/src-0001/asset-0001.jpg').convert('RGB');d=ImageDraw.Draw(preview)
for x,y,*rest in features:d.rectangle((x-1,y-1,x+1,y+1),fill='#a53229' if rest[4] else '#358394')
preview.resize((1139,1000)).save('/tmp/settlement-plan.jpg')
