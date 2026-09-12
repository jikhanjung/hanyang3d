"""Verify the remembered house compounds, their sizing rule and the settings toggle."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
EXPECTED={'jeongdojeon_site':('정도전 집터',37.572539,126.979405),'songsiyeol_site':('송시열 집터',37.58861,126.99689)}
SONGSIYEOL_PIXEL=[2060,724]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 result=page.evaluate('''ids=>{const t=terrain3d;t.renderer.setAnimationLoop(null);return ids.map(id=>{
  const b=t.buildings.children.find(b=>b.userData.feature.id===id);if(!b)throw Error('missing site: '+id);
  const marker=b.getObjectByName('house-site');if(!marker||b.material.visible)throw Error('house model missing: '+id);
  const tag=t.nameTags.find(n=>n.tag.userData.featureId===id);
  const f=b.userData.feature;
  return {id,name:f.name,lat:f.lat,lon:f.lon,meshes:marker.children.length,parts:marker.userData.parts.length,label:tag.tag.userData.name,
   size:f.symbol_size_m,grounded:b.userData.z>b.userData.support.max,status:f.position_status,modern:!!f.modern_position};
 })}''',list(EXPECTED))
 for row in result:
  name,lat,lon=EXPECTED[row['id']]
  assert row['name']==name and row['label']==name,row
  assert abs(row['lat']-lat)<1e-6 and abs(row['lon']-lon)<1e-6,row
  # The markers are modern commemorative points, so their provenance must stay recorded.
  assert row['modern'] and row['parts']>40 and row['meshes']<=8 and row['grounded'],row
  assert abs(row['size'][0]*2-row['size'][2])<=2,row
 print(result,flush=True)
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
 # Jeong Dojeon's compound is sized from the two office blocks beside it, as requested.
 sizing=page.evaluate('''()=>{const t=terrain3d,span=id=>{const b=t.buildings.children.find(b=>b.userData.feature.id===id);
   const [w,,d]=b.userData.feature.symbol_size_m,yaw=b.rotation.y;
   return Math.abs(w*Math.sin(yaw))+Math.abs(d*Math.cos(yaw))};
  const site=t.buildings.children.find(b=>b.userData.feature.id==='jeongdojeon_site').userData.feature;
  return {northSouth:site.symbol_size_m[2],eastWest:site.symbol_size_m[0],offices:span('hojo')+span('hunguk')}}''')
 print(sizing,flush=True)
 assert abs(sizing['northSouth']-sizing['offices'])<3,sizing
 assert abs(sizing['eastWest']-sizing['northSouth']/2)<1,sizing
 toggle=page.evaluate('''ids=>{const t=terrain3d,read=()=>ids.map(id=>{
   const b=t.buildings.children.find(b=>b.userData.feature.id===id),tag=t.nameTags.find(n=>n.tag.userData.featureId===id);
   return [b.visible,tag.tag.visible]});
  const box=document.getElementById('sites3d');const before=read();
  box.checked=false;box.onchange();t.updateBuildingNames();const off=read();
  box.checked=true;box.onchange();t.updateBuildingNames();const on=read();
  const others=t.buildings.children.filter(b=>b.userData.feature.display_model!=='house_site').every(b=>b.visible);
  return {before,off,on,others}}''',list(EXPECTED))
 assert all(v==[True,True] for v in toggle['before']+toggle['on']),toggle
 assert all(v==[False,False] for v in toggle['off']),toggle
 assert toggle['others'],toggle
 assert not errors,errors
 print('PASS: both house compounds placed, sized, labelled, grounded and switched by the 유명인 집터 setting',flush=True);b.close()
