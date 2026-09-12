"""Verify the commemorative house-site markers and their settings toggle."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
EXPECTED={'jeongdojeon_site':('정도전 집터',37.572539,126.979405),'songsiyeol_site':('송시열 집터',37.58861,126.99689)}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 result=page.evaluate('''ids=>{const t=terrain3d;t.renderer.setAnimationLoop(null);return ids.map(id=>{
  const b=t.buildings.children.find(b=>b.userData.feature.id===id);if(!b)throw Error('missing site: '+id);
  const marker=b.getObjectByName('site-marker');if(!marker||b.material.visible)throw Error('marker model missing: '+id);
  const tag=t.nameTags.find(n=>n.tag.userData.featureId===id);
  const f=b.userData.feature;
  return {id,name:f.name,lat:f.lat,lon:f.lon,parts:marker.children.length,label:tag.tag.userData.name,
   grounded:b.userData.z>b.userData.support.max,status:f.position_status,modern:!!f.modern_position};
 })}''',list(EXPECTED))
 for row in result:
  name,lat,lon=EXPECTED[row['id']]
  assert row['name']==name and row['label']==name,row
  assert abs(row['lat']-lat)<1e-6 and abs(row['lon']-lon)<1e-6,row
  # The markers are modern commemorative points, so their provenance must stay recorded.
  assert row['modern'] and row['parts']==4 and row['grounded'],row
 print(result,flush=True)
 toggle=page.evaluate('''ids=>{const t=terrain3d,read=()=>ids.map(id=>{
   const b=t.buildings.children.find(b=>b.userData.feature.id===id),tag=t.nameTags.find(n=>n.tag.userData.featureId===id);
   return [b.visible,tag.tag.visible]});
  const box=document.getElementById('sites3d');const before=read();
  box.checked=false;box.onchange();t.updateBuildingNames();const off=read();
  box.checked=true;box.onchange();t.updateBuildingNames();const on=read();
  const others=t.buildings.children.filter(b=>b.userData.feature.display_model!=='site_marker').every(b=>b.visible);
  return {before,off,on,others}}''',list(EXPECTED))
 assert all(v==[True,True] for v in toggle['before']+toggle['on']),toggle
 assert all(v==[False,False] for v in toggle['off']),toggle
 assert toggle['others'],toggle
 assert not errors,errors
 print('PASS: both house-site markers placed, labelled, grounded and switched by the 유명인 집터 setting',flush=True);b.close()
