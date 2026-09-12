"""Browser checks for palace models, shared ground, title and current-map credits."""
import argparse
import os
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:18014')
parser.add_argument('--chromium-path',default=os.environ.get('CHROMIUM_PATH'))
args=parser.parse_args()
version=(Path(__file__).resolve().parents[2]/'deploy/DOCKER_VERSION').read_text().strip()
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':750});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url.rstrip('/')+'/',wait_until='domcontentloaded')
 page.wait_for_function('window.terrain3d?.ready || !document.getElementById("loading-retry").hidden',timeout=300000)
 assert page.evaluate('!!window.terrain3d?.ready'),errors
 print('ready',flush=True)
 assert page.locator('.map-title').inner_text()=='한양3D '+version
 result=page.evaluate('''async()=>{const t=terrain3d,T=await import('/webapp/static/vendor/three/three.module.js');t.renderer.setAnimationLoop(null);const j=t.buildings.children.find(b=>b.userData.feature.id==='jongmyo'),m=j.getObjectByName('jongmyo-jeongjeon');t.controls.target.copy(j.position);t.camera.position.copy(j.position).add(new T.Vector3(25,50,115));t.controls.update();t.renderer.render(t.scene,t.camera);return {chambers:m.userData.chambers,doors:m.children.filter(m=>m.name==='shrine-door').length,walls:t.palaceWall.segments.length,clearance:t.palaceWall.segments.every(s=>Number.isFinite(s.support.max))}}''')
 assert result['chambers']==result['doors']==15 and result['walls']>100 and result['clearance'],result
 print(result,flush=True);page.screenshot(path='/tmp/jongmyo.png')
 page.evaluate('''async()=>{const t=terrain3d,T=await import('/webapp/static/vendor/three/three.module.js'),g=t.buildings.children.find(b=>b.userData.feature.id==='gwanghwamun');t.controls.target.copy(g.position).add(new T.Vector3(0,0,-300));t.camera.position.copy(g.position).add(new T.Vector3(650,650,700));t.controls.update();t.renderer.render(t.scene,t.camera)}''');page.screenshot(path='/tmp/palace-wall.png')
 result=page.evaluate('''async()=>{const t=terrain3d,T=await import('/webapp/static/vendor/three/three.module.js'),wall=t.palaceWall,mesh=wall.group.children[0],matrix=new T.Matrix4();let ok=true,maxGap=-Infinity;for(const ex of [1,2,1]){const h=document.getElementById('height3d');h.value=ex;h.onchange();wall.segments.forEach((s,i)=>{mesh.getMatrixAt(i,matrix);const bottom=matrix.elements[13]-matrix.elements[5]/2,top=matrix.elements[13]+matrix.elements[5]/2;ok&&=bottom<s.support.min*ex && top>s.support.max*ex;maxGap=Math.max(maxGap,bottom-s.support.min*ex)})}const before=Array.from(mesh.instanceMatrix.array);const opacity=document.getElementById('opacity3d');opacity.value=0;opacity.oninput();ok&&=before.every((v,i)=>v===mesh.instanceMatrix.array[i]);opacity.value=50;opacity.oninput();return {ok,maxGap}}''')
 assert result['ok'],result
 print('ground and opacity',result,flush=True)
 page.set_viewport_size({'width':390,'height':844});page.evaluate('''async()=>{await new Promise(requestAnimationFrame);terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)}''');page.screenshot(path='/tmp/palace-mobile.png')
 assert page.locator('.map-title').is_visible() and page.locator('#map-options-toggle').is_visible()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.goto(args.url.rstrip('/')+'/credits/');text=page.locator('main').inner_text()
 assert all(s in text for s in ['도성대지도','FABDEM','Three.js','15칸'])
 assert all(s not in text for s in ['Leaflet','OpenTopoMap','1908','부분도8'])
 assert not errors,errors
 print('mobile/credits/errors passed',flush=True);b.close()
