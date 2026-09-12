"""Exercise real Chromium touch events, including hold-and-look multitouch."""
import argparse
import os
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
parser.add_argument('--chromium-path', default=os.environ.get('CHROMIUM_PATH'))
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.chromium_path, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready || !document.getElementById("loading-retry").hidden', timeout=300000)
    assert page.evaluate('!!window.terrain3d?.ready'), errors
    # Advance physics deterministically while driving actual browser touch input.
    page.evaluate('terrain3d.renderer.setAnimationLoop(null)')
    assert page.locator('#first-person-compass').is_visible()
    compass = page.evaluate("""()=>{const t=terrain3d,original=t.camera.quaternion.clone(),out=[];for(const yaw of [0,-Math.PI/2,-Math.PI,Math.PI/2]){t.camera.rotation.set(0,yaw,0,'YXZ');t.updateCompass();out.push(document.getElementById('compass-bearing').textContent)}t.camera.quaternion.copy(original);t.updateCompass();return out}""")
    assert compass==['북 0°','동 90°','남 180°','서 270°'],compass
    controls=page.locator('#map-controls').bounding_box();compass_box=page.locator('#first-person-compass').bounding_box()
    assert controls['x']+controls['width']<=compass_box['x']
    page.locator('#first-person3d').tap()
    assert page.evaluate('terrain3d.firstPerson.active')
    assert not page.locator('#anchors3d').is_visible()
    assert page.locator('#first-person-map').evaluate('(e)=>getComputedStyle(e).opacity')=='0.7'
    client = context.new_cdp_session(page)
    page.evaluate('''()=>{window.touchLog=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>touchLog.push([type,e.pointerId,e.target.id]),true)}''')
    def touch(kind, points):
        client.send('Input.dispatchTouchEvent', {'type':kind,'touchPoints':points})
    def point(key, identifier=1, strength=1):
        box = page.locator('#walk-joystick').bounding_box()
        assert box['width']>=110 and box['height']>=110, box
        x,y={'KeyW':(0,-1),'KeyS':(0,1),'KeyA':(-1,0),'KeyD':(1,0),'centre':(0,0),'diagonal':(1,-1)}[key]
        return {'x':box['x']+box['width']/2+x*box['width']*.32*strength,'y':box['y']+box['height']/2+y*box['width']*.32*strength,'id':identifier}
    def position():
        return page.evaluate('terrain3d.camera.position.toArray()')
    def advance():
        page.evaluate('()=>{for(let i=0;i<10;i++)terrain3d.firstPerson.update(.1)}')
    def distance(a,b):
        return ((a[0]-b[0])**2+(a[2]-b[2])**2)**.5
    results = {}
    for key in ['KeyW','KeyS','KeyA','KeyD']:
        before = position()
        touch('touchStart',[point(key)])
        advance()
        results[key] = distance(before,position())
        assert results[key]>1, results
        touch('touchEnd',[])
        stopped = position();advance()
        assert distance(stopped,position())<1e-6
    # Centre dead zone, analogue speed and diagonal speed limit.
    for key,strength,low,high in [('centre',1,0,0.001),('KeyW',.5,.5,.9),('diagonal',1,1.4,1.6)]:
        before=position();touch('touchStart',[point(key,strength=strength)]);advance()
        travelled=distance(before,position());assert low<=travelled<=high,(key,travelled)
        touch('touchEnd',[])
    # Two fingers: keep walking while dragging the scene to look around.
    forward = point('KeyW')
    touch('touchStart',[forward])
    look = {'x':270,'y':330,'id':2}
    touch('touchStart',[forward,look])
    rotation = page.evaluate('terrain3d.camera.quaternion.toArray()')
    look['x'] = 305
    touch('touchMove',[forward,look])
    assert rotation!=page.evaluate('terrain3d.camera.quaternion.toArray()')
    before=position();advance()
    assert distance(before,position())>1, (distance(before,position()),page.evaluate('touchLog'))
    # Losing canvas focus does not cancel the finger held on the pad.
    page.locator('#first-person-exit').focus()
    before=position();advance()
    assert distance(before,position())>1, (distance(before,position()),page.evaluate('touchLog'))
    touch('touchEnd',[look])
    before=position();advance()
    assert distance(before,position())>1, (distance(before,position()),page.evaluate('touchLog'))
    touch('touchCancel',[])
    stopped=position();advance()
    assert distance(stopped,position())<1e-6
    assert page.locator('#walk-joystick.pressed').count()==0
    # App backgrounding and re-entry must never leave a direction stuck.
    touch('touchStart',[forward]);page.evaluate('window.dispatchEvent(new Event("blur"))')
    stopped=position();advance();assert distance(stopped,position())<1e-6
    touch('touchEnd',[])
    page.locator('#first-person-exit').tap()
    page.locator('#first-person3d').tap()
    stopped=position();advance();assert distance(stopped,position())<1e-6
    # Keyboard input still works after the pointer input separation.
    page.locator('#scene > canvas').focus();page.keyboard.down('KeyW');before=position();advance();assert distance(before,position())>1, (distance(before,position()),page.evaluate('touchLog'))
    page.keyboard.up('KeyW')
    page.evaluate('terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
    page.screenshot(path='/tmp/hanyang3d-mobile-walk.png')
    assert not errors,errors
    print('Mobile walk passed:',results,'multitouch, focus, cancel, exit and keyboard',flush=True)
    browser.close()
