"""Browser interaction checks for the historical site markers."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument("--url",default="http://127.0.0.1:8000/gis/terrain/3d/")
parser.add_argument("--browser")
args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='networkidle');page.wait_for_function('window.terrain3d?.ready',timeout=240000);page.wait_for_timeout(1000)
 assert page.evaluate('terrain3d.buildings.children.length')==17
 assert page.evaluate('terrain3d.foundations.children.length')==17
 assert page.evaluate('terrain3d.buildings.children.every(b=>b.userData.z>b.userData.support.max)')
 assert page.evaluate('terrain3d.foundations.children.every(f=>f.userData.top>f.userData.bottom)')
 assert page.evaluate('terrain3d.labels.children.length')==8
 assert page.evaluate('terrain3d.labels.children.every(p=>p.isSprite && p.material.sizeAttenuation===false && p.scale.x<.02)')
 assert page.evaluate("terrain3d.buildings.children.filter(b=>b.userData.feature.position_status==='existing_calibration_anchor').every(b=>terrain3d.labels.children.some(p=>p.userData.x===b.userData.x && p.userData.y===b.userData.y))")
 page.locator('#anchors3d').uncheck();assert not page.evaluate('terrain3d.labels.visible')
 page.locator('#anchors3d').check()
 def point(i):
  return page.evaluate('''i=>{const b=terrain3d.buildings.children[i],v=b.position.clone();v.y+=b.userData.boxHeight/2;v.project(terrain3d.camera);const r=terrain3d.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2,name:b.userData.feature.name}}''',i)
 for i in range(17):
  q=point(i);page.mouse.move(q['x'],q['y']);page.wait_for_timeout(80)
  assert page.locator('#building-tooltip').inner_text()==q['name'],q
  assert page.locator('#building-tooltip').is_visible(),q
  page.mouse.click(q['x'],q['y']);page.mouse.move(20,30)
  assert q['name'] in page.locator('#building-name').inner_text(),q
 page.screenshot(path='/tmp/hanyang-building-boxes.png')
 page.locator('#focus-building').click();page.wait_for_timeout(500)
 assert page.evaluate('terrain3d.camera.position.distanceTo(terrain3d.controls.target)<1000')
 page.screenshot(path='/tmp/hanyang-building-support.png')
 page.locator('#home3d').click();page.wait_for_timeout(700)
 page.locator('#height3d').select_option('2')
 assert page.evaluate('terrain3d.buildings.children.every(b=>Math.abs(b.position.y-(b.userData.z*2+b.userData.boxHeight/2))<1e-6)')
 assert page.evaluate('terrain3d.foundations.children.every(f=>f.scale.y===2)')
 q=point(0);page.mouse.click(q['x'],q['y']);assert q['name'] in page.locator('#building-name').inner_text()
 page.locator('#buildings3d').uncheck();assert not page.evaluate('terrain3d.buildings.visible');assert not page.evaluate('terrain3d.foundations.visible');assert page.locator('#clear-building').is_hidden()
 page.locator('#buildings3d').check();page.locator('#height3d').select_option('1')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('Passed: all 12 boxes hover/click, pinned names, elevation rescale, visibility/reset, mobile width, no JS errors')
 b.close()
