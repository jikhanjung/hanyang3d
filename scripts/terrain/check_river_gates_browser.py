"""Validate conceptual gate openings and source-map river/bridge interaction."""
import argparse
from playwright.sync_api import sync_playwright, expect
parser=argparse.ArgumentParser()
parser.add_argument("--url",default="http://127.0.0.1:8000/gis/terrain/3d/")
parser.add_argument("--browser")
args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='networkidle');page.wait_for_function('window.terrain3d?.ready',timeout=240000);page.wait_for_timeout(500)
 assert page.evaluate('terrain3d.bridges.children.length')==4
 assert page.evaluate('terrain3d.waterLayer.children.length')==5
 assert page.evaluate('terrain3d.buildings.children.filter(b=>b.children.some(c=>c.name==="gate-model")).length')==9
 # Test actual stone arch geometry: rays through the passage must not hit stone.
 assert page.evaluate('''async()=>{const T=await import('/webapp/static/vendor/three/three.module.js');terrain3d.scene.updateMatrixWorld(true);return terrain3d.buildings.children.filter(b=>b.userData.feature.category==='성문').every(b=>{const m=b.children[0],arch=m.getObjectByName('stone-arch');const pier=new T.Vector3(b.userData.feature.symbol_size_m[0]*.45,m.userData.archTestY,100);b.localToWorld(pier);if(!new T.Raycaster(pier,new T.Vector3(0,0,-1).transformDirection(b.matrixWorld),0,200).intersectObject(arch,false).length)return false;return m.userData.centres.every(x=>{const origin=new T.Vector3(x,m.userData.archTestY,100);b.localToWorld(origin);return new T.Raycaster(origin,new T.Vector3(0,0,-1).transformDirection(b.matrixWorld),0,200).intersectObject(arch,false).length===0})})}''')
 # Passage axes must follow the source road after TPS, including east-west Heunginjimun.
 assert page.evaluate("""()=>{const exp=JSON.parse(document.getElementById('experiment').textContent),pts=[...exp.landmarks,...exp.suggested_anchors],R=6378137;
 const project=p=>[R*p.lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))];
 const warp=terrain3d.warp;
 return terrain3d.buildings.children.filter(b=>b.userData.feature.road_axis).every(b=>{
 const [a,c]=b.userData.feature.road_axis.pixel_points.map(p=>warp(...p)),dx=c[0]-a[0],dz=-(c[1]-a[1]),len=Math.hypot(dx,dz);
 const aligned=Math.abs(Math.sin(b.rotation.y)*dx/len+Math.cos(b.rotation.y)*dz/len)>0.999999;
 const f=terrain3d.foundations.children.find(f=>f.userData.featureId===b.userData.feature.id);
 return aligned&&f.rotation.y===b.rotation.y&&(b.userData.feature.id!=='heunginjimun'||Math.abs(Math.sin(b.rotation.y))>.95);
 })}""")
 print(page.evaluate("terrain3d.buildings.children.filter(b=>b.userData.feature.road_axis).map(b=>({name:b.userData.feature.name,yawDegrees:b.rotation.y*180/Math.PI}))"))
 page.evaluate('terrain3d.controls.enableDamping=false;terrain3d.controls.update()')
 def point(group,i):
  return page.evaluate('''([group,i])=>{const b=terrain3d[group].children[i],v=b.position.clone();v.y+=b.userData.boxHeight/2;v.project(terrain3d.camera);const r=terrain3d.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2,name:b.userData.feature.name}}''',[group,i])
 # Inspect the east-west passage from its eastern approach.
 page.evaluate("""()=>{const b=terrain3d.buildings.children.find(b=>b.userData.feature.id==='heunginjimun');terrain3d.controls.target.copy(b.position);terrain3d.camera.position.copy(b.position);terrain3d.camera.position.x+=110;terrain3d.camera.position.y+=65;terrain3d.camera.position.z+=50;terrain3d.controls.update()}""")
 page.wait_for_timeout(800);page.screenshot(path='/tmp/hanyang-heunginjimun-oriented.png')
 page.locator('#home3d').click()
 q=point('buildings',8);page.mouse.click(q['x'],q['y']);page.locator('#focus-building').click();page.wait_for_timeout(800);page.screenshot(path='/tmp/hanyang-gate-model.png')
 page.locator('#water-focus').click();page.wait_for_timeout(800);page.locator('#clear-building').click();page.screenshot(path='/tmp/hanyang-creek-bridges.png')
 for i in range(4):
  # Clear/focus buttons scroll the page; pin the viewport before projecting targets.
  page.evaluate('window.scrollTo(0,0)')
  q=point('bridges',i);page.mouse.click(q['x'],q['y']);expect(page.locator('#building-name')).to_contain_text(q['name'],timeout=10000)
 page.locator('#height3d').select_option('2')
 assert page.evaluate('terrain3d.bridges.children.every(b=>Math.abs(b.position.y-(b.userData.z*2+b.userData.lift+b.userData.boxHeight/2))<1e-6)')
 page.locator('#water3d').uncheck();assert not page.evaluate('terrain3d.bridges.visible || terrain3d.waterLayer.visible')
 page.locator('#water3d').check();page.locator('#height3d').select_option('1')
 page.locator('details').filter(has_text='청계천·다리 원도 판독 보기').locator('summary').click();page.locator('details').filter(has_text='청계천·다리 원도 판독 보기').scroll_into_view_if_needed();page.screenshot(path='/tmp/hanyang-creek-reading.png')
 assert page.locator('details').filter(has_text='청계천·다리 원도 판독 보기').locator('svg circle').count()==4
 assert not errors,errors
 print('Passed: four open-arch gates; creek and 4 bridge meshes; bridge clicks; height rescale; visibility; original reading; no JS errors')
 b.close()
