"""Check a horizontal 3D compass and single-row mobile menu."""
import argparse
import os
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path',default=os.environ.get('CHROMIUM_PATH'));args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':750});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready || !document.getElementById("loading-retry").hidden',timeout=300000)
 assert page.evaluate('!!window.terrain3d?.ready'),errors
 result=page.evaluate('''async()=>{const t=terrain3d,T=await import('/webapp/static/vendor/three/three.module.js');t.renderer.setAnimationLoop(null);const c=t.compass,original=t.camera.quaternion.clone(),out=[];for(const pitch of [0,-Math.PI/6,-Math.PI/2,Math.PI/6])for(const yaw of [0,-Math.PI/2,-Math.PI,Math.PI/2]){t.camera.rotation.set(pitch,yaw,0,'YXZ');t.updateCompass();if(c.camera.quaternion.angleTo(t.camera.quaternion)>1e-7)throw Error('orientation differs');const normal=new T.Vector3(0,1,0).applyQuaternion(c.north.quaternion);if(normal.distanceTo(new T.Vector3(0,1,0))>1e-7)throw Error('needle no longer horizontal');const vertices=c.north.geometry.attributes.position;if(Math.min(...Array.from({length:vertices.count},(_,i)=>vertices.getZ(i)))!==-1)throw Error('north is not -Z');out.push({...document.getElementById('first-person-compass').dataset})}t.camera.quaternion.copy(original);t.updateCompass();return out}''')
 for i,row in enumerate(result[:4]):assert abs(float(row['yaw'])-[0,90,180,270][i])<.01,row
 assert {float(r['pitch']) for r in result}=={0,-30,-90,30},result
 assert page.locator('#first-person-compass').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
 assert page.locator('#first-person-compass canvas').count()==1
 page.evaluate('terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)');page.screenshot(path='/tmp/compass-desktop.png')
 page.set_viewport_size({'width':390,'height':844})
 assert not page.locator('#first-person3d').is_visible()
 assert not page.locator('#opacity3d').is_visible()
 title=page.locator('.map-title').bounding_box();toggle=page.locator('#map-options-toggle').bounding_box()
 assert abs(title['y']+title['height']/2-toggle['y']-toggle['height']/2)<2
 assert page.locator('#map-controls').bounding_box()['height']<=50
 page.locator('#map-options-toggle').click();assert page.locator('#first-person3d').is_visible();assert page.locator('#opacity3d').is_visible()
 page.locator('#first-person3d').click();assert page.evaluate('terrain3d.firstPerson.active')
 assert not page.locator('#first-person3d').is_visible()
 page.evaluate('terrain3d.updateCompass();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)');page.screenshot(path='/tmp/compass-mobile.png')
 page.locator('#map-options-toggle').click();page.locator('#first-person3d').click();assert not page.evaluate('terrain3d.firstPerson.active')
 assert not page.locator('#first-person3d').is_visible()
 assert not errors,errors
 print('PC/mobile 3D compass: 16 yaw/pitch poses; fixed north/horizontal model; transparent background; compact menu and walking toggle passed',flush=True);b.close()
