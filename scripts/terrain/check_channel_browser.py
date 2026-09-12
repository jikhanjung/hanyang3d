"""Live browser checks for reversible conceptual channel carving."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument("--url",default="http://127.0.0.1:8000/gis/terrain/3d/")
parser.add_argument("--browser")
args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=120000)
 print(page.evaluate('({maxCut:terrain3d.channelState.maxCut,depth:terrain3d.channelState.depth,terrainVertices:terrain3d.terrain.geometry.attributes.position.count})'))
 assert page.evaluate('terrain3d.channelState.maxCut>0')
 assert page.evaluate('terrain3d.channelState.path.every((p,i,a)=>!i||p.level<=a[i-1].level)')
 assert page.evaluate('terrain3d.surfaceBaselines.every(b=>b.mesh.geometry.userData.heights.every((h,i)=>h<=b.original[i]+1e-6))')
 page.locator('#water-focus').click();page.wait_for_timeout(800);page.screenshot(path='/tmp/hanyang-channel-carved.png')
 page.locator('#carve3d').uncheck()
 assert page.evaluate('terrain3d.surfaceBaselines.every(b=>b.mesh.geometry.userData.heights.every((h,i)=>h===b.original[i]))')
 page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-channel-original.png')
 page.locator('#carve3d').check()
 page.locator('#channel-depth').fill('4');page.locator('#channel-depth').dispatch_event('change')
 assert page.evaluate('terrain3d.channelState.depth')==4
 page.locator('#height3d').select_option('2')
 assert page.evaluate('terrain3d.buildings.children.every(b=>Math.abs(b.position.y-(b.userData.z*2+b.userData.boxHeight/2))<1e-6)')
 assert page.evaluate('terrain3d.bridges.children.every(b=>Math.abs(b.position.y-(b.userData.z*2+b.userData.lift+b.userData.boxHeight/2))<1e-6)')
 page.locator('#height3d').select_option('1');page.locator('#channel-depth').fill('2');page.locator('#channel-depth').dispatch_event('change')
 assert page.evaluate('terrain3d.buildings.children.every(b=>b.userData.z>b.userData.support.max)')
 assert not errors,errors
 print('Passed: descending profile, cut only, exact baseline restore, depth 2/4m, height scaling, building support, no JS errors')
 b.close()
