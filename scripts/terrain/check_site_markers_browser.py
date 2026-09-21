"""Verify the remembered house sites: both Song Siyeol's and Jeong Dojeon's stone markers and the settings toggle."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
EXPECTED={'jeongdojeon_site':('정도전 집터',37.572539,126.979405,'site-marker'),'songsiyeol_site':('송시열 집터(옛터)',37.58861,126.99689,'site-marker')}
SONGSIYEOL_PIXEL=[2060,724]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 result=page.evaluate('''rows=>{const t=terrain3d;t.renderer.setAnimationLoop(null);return rows.map(([id,model])=>{
  const b=t.buildings.children.find(b=>b.userData.feature.id===id);if(!b)throw Error('missing site: '+id);
  const marker=b.getObjectByName(model);if(!marker||b.material.visible)throw Error('site model missing: '+id);
  const tag=t.nameTags.find(n=>n.tag.userData.featureId===id);
  const f=b.userData.feature;
  return {id,name:f.name,lat:f.lat,lon:f.lon,meshes:marker.children.length,parts:marker.userData.parts?.length??0,label:tag.tag.userData.name,
   size:f.symbol_size_m,grounded:b.userData.z>b.userData.support.max,status:f.position_status,modern:!!f.modern_position,pixel:f.source_position?.pixel??null};
 })}''',[[k,v[3]] for k,v in EXPECTED.items()])
 rows={r['id']:r for r in result}
 for row in result:
  name,lat,lon,_=EXPECTED[row['id']]
  assert row['name']==name and row['label']==name,row
  assert abs(row['lat']-lat)<1e-6 and abs(row['lon']-lon)<1e-6,row
  # The markers are modern commemorative points, so their provenance must stay recorded.
  assert row['modern'] and row['grounded'],row
 print(result,flush=True)
 # Since the 2026-09-21 review Song Siyeol's site is a small stone too: sixty years after his death, no house is claimed.
 song=rows['songsiyeol_site']
 assert max(song['size'])<=12 and song['meshes']==4,song
 # In 1750 Jeong Dojeon's house was long gone, so only a small stone stands on the original what3words point.
 jeong=rows['jeongdojeon_site']
 assert jeong['pixel'] is None and jeong['status']=='user_supplied_modern_point' and max(jeong['size'])<=3 and jeong['meshes']==4,jeong
 # The Song Siyeol marker is a display point: north-east of Seonggyungwan and inside the city wall.
 placement=page.evaluate('''async()=>{const t=terrain3d;
  const wall=await (await fetch('/gis/walls/doseong_city_wall.json')).json(),poly=wall.centerline;
  const inside=(x,y)=>{let c=false;for(let i=0,n=poly.length;i<n;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n];
   if((y1>y)!==(y2>y)&&x<x1+(y-y1)*(x2-x1)/(y2-y1))c=!c}return c};
  const site=t.buildings.children.find(b=>b.userData.feature.id==='songsiyeol_site');
  const school=t.buildings.children.find(b=>b.userData.feature.name.includes('성균관'));
  return {pixel:site.userData.feature.source_position.pixel,inside:inside(...site.userData.feature.source_position.pixel),
   east:site.position.x-school.position.x,north:school.position.z-site.position.z,
   metresFromSchool:Math.hypot(site.position.x-school.position.x,site.position.z-school.position.z)}}''')
 print(placement,flush=True)
 assert placement['pixel']==SONGSIYEOL_PIXEL and placement['inside'],placement
 assert placement['east']>0 and placement['north']>0,placement
 assert 100<placement['metresFromSchool']<250,placement
 # The stone sits on the what3words point itself, outside the 1750 Saboksi office drawn beside it.
 spot=page.evaluate('''()=>{const t=terrain3d,R=6378137,rad=Math.PI/180;
  const project=(lon,lat)=>[R*lon*rad,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
  const at=id=>t.buildings.children.find(b=>b.userData.feature.id===id);
  const j=at('jeongdojeon_site'),s=at('saboksi'),f=j.userData.feature,[sw,,sd]=s.userData.feature.symbol_size_m;
  const point=project(f.lon,f.lat),g=Math.cos(2*Math.atan(Math.exp(point[1]/R))-Math.PI/2);
  return {offsetM:Math.hypot(j.userData.x-point[0],j.userData.y-point[1])*g,
   outsideSaboksi:Math.abs(j.position.x-s.position.x)>sw/2||Math.abs(j.position.z-s.position.z)>sd/2}}''')
 print(spot,flush=True)
 assert spot['offsetM']<1 and spot['outsideSaboksi'],spot
 # Name tags only show within their level's reach, so read each site from a viewpoint just above it.
 toggle=page.evaluate('''ids=>{const t=terrain3d,read=()=>ids.map(id=>{
   const b=t.buildings.children.find(b=>b.userData.feature.id===id),tag=t.nameTags.find(n=>n.tag.userData.featureId===id);
   t.camera.position.copy(b.position).add({x:0,y:120,z:160});t.controls.target.copy(b.position);t.controls.update();t.updateBuildingNames();
   return [b.visible,tag.tag.visible]});
  const box=document.getElementById('sites3d');const before=read();
  box.checked=false;box.onchange();t.updateBuildingNames();const off=read();
  box.checked=true;box.onchange();t.updateBuildingNames();const on=read();
  const others=t.buildings.children.filter(b=>!['house_site','site_marker'].includes(b.userData.feature.display_model)).every(b=>b.visible);
  return {before,off,on,others}}''',list(EXPECTED))
 assert all(v==[True,True] for v in toggle['before']+toggle['on']),toggle
 assert all(v==[False,False] for v in toggle['off']),toggle
 assert toggle['others'],toggle
 assert not errors,errors
 print('PASS: Song Siyeol compound and Jeong Dojeon stone placed, labelled, grounded and switched by the 유명인 집터 setting',flush=True);b.close()
