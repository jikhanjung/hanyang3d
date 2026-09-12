"""Review schematic Yukjo compounds and compact mobile settings."""
import argparse
import os
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path',default=os.environ.get('CHROMIUM_PATH'));args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':750});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready || !document.getElementById("loading-retry").hidden',timeout=300000)
 assert page.evaluate('!!window.terrain3d?.ready'),errors
 result=page.evaluate('''async()=>{const t=terrain3d,T=await import('/webapp/static/vendor/three/three.module.js');t.renderer.setAnimationLoop(null);const g=t.buildings.children.find(b=>b.userData.feature.id==='gwanghwamun');t.controls.target.copy(g.position).add(new T.Vector3(0,0,350));t.camera.position.copy(g.position).add(new T.Vector3(380,500,1000));t.controls.update();t.updateBuildingNames();t.updateCompass();t.renderer.render(t.scene,t.camera);return t.buildings.children.filter(b=>b.userData.feature.display_model==='yukjo_compound').map(b=>({id:b.userData.feature.id,parts:b.getObjectByName('yukjo-compound').userData.parts.length,batches:b.getObjectByName('yukjo-compound').userData.batches.length,size:b.userData.feature.symbol_size_m}))}''')
 assert len(result)==11 and all(r['batches']<=6 and r['parts']>10 for r in result),result
 print('Compounds:',result,flush=True);page.screenshot(path='/tmp/yukjo-overview.png')
 contacts=page.evaluate('''()=>{const t=terrain3d,boxes=t.buildings.children.filter(b=>b.userData.feature.display_model==='yukjo_compound');let maxError=0;for(const ex of [1,2,1]){const input=document.getElementById('height3d');input.value=ex;input.onchange();for(const b of boxes)for(const p of b.getObjectByName('yukjo-compound').userData.parts){maxError=Math.max(maxError,Math.abs(b.position.y+p.root.position.y-(p.support.max*ex+.08)));if(b.position.y+p.root.position.y+p.footing.position.y-.15*p.footing.scale.y>p.support.min*ex)throw Error('floating foundation')}}return maxError}''')
 assert contacts<1e-6,contacts
 # Desktop settings remain visible; mobile starts compact and can expand/collapse.
 assert page.locator('#opacity3d').is_visible()
 page.set_viewport_size({'width':390,'height':844})
 assert not page.locator('#opacity3d').is_visible()
 assert not page.locator('#map-options a').is_visible()
 assert not page.locator('#first-person3d').is_visible() and page.locator('#map-options-toggle').is_visible()
 page.locator('#map-options-toggle').click();assert page.locator('#opacity3d').is_visible();assert page.locator('#map-options a').is_visible()
 assert page.locator('#map-options-toggle').get_attribute('aria-expanded')=='true'
 page.locator('#map-options-toggle').click();assert not page.locator('#opacity3d').is_visible()
 page.locator('#map-options-toggle').click();page.locator('#first-person3d').click();assert page.evaluate('terrain3d.firstPerson.active')
 page.locator('#map-options-toggle').click();assert page.evaluate('terrain3d.firstPerson.active')
 page.locator('#map-options-toggle').click()
 page.evaluate('terrain3d.updateCompass();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)');page.screenshot(path='/tmp/yukjo-mobile.png')
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('Ground contact and mobile settings passed',flush=True);b.close()
