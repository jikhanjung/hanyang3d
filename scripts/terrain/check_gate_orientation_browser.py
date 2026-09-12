"""Check source-road gate axes, relocated Donuimun, and terrain support."""
import argparse
from playwright.sync_api import sync_playwright, expect
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:8000/gis/terrain/3d/')
parser.add_argument('--browser')
args=parser.parse_args()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1080}); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=240000)
 result=page.evaluate('''async()=>{
 const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d;
 const exp=JSON.parse(document.getElementById('experiment').textContent),points=[...exp.landmarks,...exp.suggested_anchors],R=6378137;
 const project=p=>[R*p.lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))];
 const warp=terrain3d.warp;
 t.scene.updateMatrixWorld(true);
 return t.buildings.children.filter(b=>b.userData.feature.road_axis).map(b=>{
 const f=b.userData.feature,[a,c]=f.road_axis.pixel_points.map(p=>warp(...p)),dx=c[0]-a[0],dz=-(c[1]-a[1]),len=Math.hypot(dx,dz);
 const model=b.children[0],arch=model.getObjectByName('stone-arch'),dir=new T.Vector3(0,0,-1).transformDirection(b.matrixWorld);
 const hits=x=>{const p=new T.Vector3(x,model.userData.archTestY,100);b.localToWorld(p);return new T.Raycaster(p,dir,0,200).intersectObject(arch,false).length};
 const target=f.source_position?warp(...f.source_position.pixel):project(f);
 return {id:f.id,yaw:b.rotation.y*180/Math.PI,aligned:Math.abs(Math.sin(b.rotation.y)*dx/len+Math.cos(b.rotation.y)*dz/len)>.999999,
 open:model.userData.centres.every(x=>hits(x)===0),stone:hits(f.symbol_size_m[0]*.45)>0,
 placementError:Math.hypot(b.userData.x-target[0],b.userData.y-target[1]),
 support:t.foundations.children.find(g=>g.userData.featureId===f.id).rotation.y===b.rotation.y};
 });}''')
 print(result,flush=True)
 assert len(result)==9
 assert all(r['aligned'] and r['open'] and r['stone'] and r['support'] and r['placementError']<2 for r in result)
 assert abs(next(r['yaw'] for r in result if r['id']=='heunginjimun')-90)<5
 assert page.evaluate("""()=>{const b=terrain3d.buildings.children.find(b=>b.userData.feature.id==='donuimun'),p=terrain3d.labels.children.find(p=>p.userData.name==='돈의문 터');return b.userData.x===p.userData.x&&b.userData.y===p.userData.y&&terrain3d.anchorError<0.0001}""")
 # Carving and height changes must preserve yaw and support clearance.
 rotations=page.evaluate('terrain3d.buildings.children.map(b=>b.rotation.y)')
 page.locator('#carve3d').uncheck();page.locator('#carve3d').check();page.locator('#height3d').select_option('2')
 assert page.evaluate('terrain3d.buildings.children.map(b=>b.rotation.y)')==rotations
 assert page.evaluate('terrain3d.buildings.children.every(b=>b.position.y-b.userData.boxHeight/2>b.userData.support.max*2)')
 page.locator('#height3d').select_option('1')
 for gate in ['heunginjimun','donuimun']:
  page.evaluate('''id=>{window.scrollTo(0,0);const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id===id);t.controls.enableDamping=false;t.controls.target.copy(b.position);t.camera.position.copy(b.position);t.camera.position.x+=110;t.camera.position.y+=110;t.camera.position.z+=70;t.controls.update()}''',gate)
  page.wait_for_timeout(500)
  page.screenshot(path='/tmp/hanyang-'+gate+'-aligned.png')
 assert not errors,errors
 print('Passed: nine road-aligned open gates, source-map Donuimun position, carving/height support and no JS errors',flush=True)
 browser.close()
