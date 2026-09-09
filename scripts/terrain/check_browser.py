"""Run against a live Django server; requires Playwright and Chromium."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:8000/gis/terrain/3d/")
parser.add_argument("--browser")
args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='networkidle')
 page.wait_for_function('window.terrain3d?.ready',timeout=30000)
 print(page.evaluate('({anchors:terrain3d.anchorCount,error:terrain3d.anchorError,range:terrain3d.elevationRange,calls:terrain3d.renderer.info.render.calls})'))
 assert page.evaluate('terrain3d.anchorCount===5 && terrain3d.anchorError<0.0001')
 page.screenshot(path='/tmp/hanyang-terrain3d.png')
 page.locator('#opacity3d').fill('0');assert page.evaluate('terrain3d.historical.material.opacity')==0
 page.locator('#opacity3d').fill('85')
 page.locator('#height3d').select_option('2');assert page.evaluate('terrain3d.terrain.geometry.attributes.position.getY(0) / terrain3d.terrain.geometry.userData.heights[0]')==2
 page.locator('#height3d').select_option('1')
 page.locator('#anchors3d').uncheck();assert not page.evaluate('terrain3d.labels.visible')
 page.locator('#top3d').click();page.wait_for_timeout(500);assert page.evaluate('terrain3d.camera.position.y')>10000
 page.locator('#home3d').click()
 before=page.evaluate('terrain3d.camera.position.toArray()')
 page.mouse.move(720,600);page.mouse.down();page.mouse.move(950,650,steps=12);page.mouse.up();page.wait_for_timeout(500)
 assert page.evaluate('terrain3d.camera.position.toArray()')!=before
 page.locator('#base3d').select_option('osm');page.wait_for_function("!document.getElementById('base3d').disabled",timeout=30000)
 print('OSM status:',page.locator('#error').inner_text() or 'loaded')
 page.locator('#opacity3d').fill('55');page.screenshot(path='/tmp/hanyang-terrain3d-osm.png')
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('Passed: image, DEM, anchors, opacity, height, labels, camera controls, mobile, no page errors')
 b.close()
