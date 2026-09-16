import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');args=parser.parse_args()
root=Path(__file__).resolve().parents[2]
ids=[f['id'] for f in json.loads((root/'gis/buildings/1750_landmarks.json').read_text())['features'] if f.get('position_status')=='estimated_region']
assert len(ids)==11
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1100,'height':850});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 rows=page.evaluate('''ids=>{const t=terrain3d;t.renderer.setAnimationLoop(null);return ids.map(id=>{
 const b=t.buildings.children.find(b=>b.userData.feature.id===id),f=b.userData.feature,m=b.children.find(c=>c.name);
 return {id,model:m?.name,grounded:b.userData.z>b.userData.support.max,status:f.position_status,stories:f.info.stories.length,
 overlaps:t.buildings.children.filter(o=>o!==b&&Math.abs(o.position.x-b.position.x)<(o.userData.feature.symbol_size_m[0]+f.symbol_size_m[0])/2&&Math.abs(o.position.z-b.position.z)<(o.userData.feature.symbol_size_m[2]+f.symbol_size_m[2])/2).map(o=>o.userData.feature.id)};
 })}''',ids)
 for r in rows:
  assert not r['overlaps'],r
  assert r['grounded'] and r['status']=='estimated_region' and r['stories']>0,r
  assert r['model'] in ('garden-pavilion','yukjo-compound'),r
 print(json.dumps(rows,ensure_ascii=False),flush=True)
 for id in ['cheonguijeong','gungisi','aeryeonjeong']:
  xy=page.evaluate('''id=>{const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id===id);t.controls.target.copy(b.position);t.camera.position.copy(b.position).add(b.position.clone().set(25,30,42));t.controls.update();t.updateBuildingNames();t.renderer.render(t.scene,t.camera);const v=b.position.clone().project(t.camera),r=t.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}}''',id)
  page.mouse.click(xy['x'],xy['y']);page.wait_for_timeout(150)
  popup=page.locator('#building-popup');assert '추정 위치' in popup.inner_text(),popup.inner_text()
  assert '이야기' in popup.inner_text(),popup.inner_text()
  page.screenshot(path=f'/tmp/hanyang-{id}.png')
 assert not errors,errors
 print('PASS: estimated landmarks, stories, model rendering and popup')
 b.close()
