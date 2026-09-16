"""Verify first-person controls: no context menu, right drag looks without turning the walker (and eases back),
left drag still turns, Alt+W walks forward without holding W until S is pressed, and Space jumps."""
import argparse

from playwright.sync_api import sync_playwright

from account_login import login

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
args = parser.parse_args()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    login(page)
    page.evaluate('''()=>{const t=terrain3d,fp=t.firstPerson;fp.enter();t.renderer.setAnimationLoop(null);
      const r=t.sijeon.records.find(r=>r.displayed);fp.placeAt(r.x-Math.sin(r.yaw)*12+Math.cos(r.yaw)*20,r.z-Math.cos(r.yaw)*12-Math.sin(r.yaw)*20,0);t.pedestrians.group.visible=false}''')
    assert page.evaluate('terrain3d.firstPerson.active')
    canvas = page.locator('canvas').first
    box = canvas.bounding_box()
    cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2

    # The browser context menu is suppressed.
    prevented = page.evaluate("()=>{const e=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});terrain3d.renderer.domElement.dispatchEvent(e);return e.defaultPrevented}")
    assert prevented

    # Right drag: only the look offset changes; the walking direction stays.
    yaw0 = page.evaluate('terrain3d.firstPerson.yaw')
    page.mouse.move(cx, cy)
    page.mouse.down(button='right')
    page.mouse.move(cx + 150, cy, steps=5)
    during = page.evaluate('({yaw:terrain3d.firstPerson.yaw,look:terrain3d.firstPerson.lookYaw})')
    page.mouse.up(button='right')
    assert abs(during['yaw'] - yaw0) < 1e-9 and abs(during['look']) > .3, during
    page.evaluate('()=>{for(let i=0;i<60;i++)terrain3d.firstPerson.update(1/30)}')
    assert abs(page.evaluate('terrain3d.firstPerson.lookYaw')) < .01

    # Left drag still turns the walker.
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx + 100, cy, steps=5)
    page.mouse.up()
    yaw1 = page.evaluate('terrain3d.firstPerson.yaw')
    assert abs(yaw1 - yaw0) > .2, (yaw0, yaw1)

    # Alt+W walks forward without holding W; S stops it.
    page.evaluate('terrain3d.renderer.domElement.focus()')
    start = page.evaluate('({x:terrain3d.firstPerson.eye.x,z:terrain3d.firstPerson.eye.z})')
    page.keyboard.press('Alt+KeyW')
    assert page.evaluate('terrain3d.firstPerson.autoRun')
    page.evaluate('()=>{for(let i=0;i<45;i++)terrain3d.firstPerson.update(1/30)}')
    moved = page.evaluate("s=>{const e=terrain3d.firstPerson.eye;return Math.hypot(e.x-s.x,e.z-s.z)}", start)
    assert moved > 2, moved
    page.keyboard.down('KeyS')
    page.keyboard.up('KeyS')
    assert not page.evaluate('terrain3d.firstPerson.autoRun')
    # Space jumps: the feet rise about a metre and come back down to the ground.
    page.evaluate('terrain3d.renderer.domElement.focus()')
    page.keyboard.press('Space')
    jump = page.evaluate('()=>{const fp=terrain3d.firstPerson;let top=0,t=0;for(let i=0;i<60;i++){fp.update(1/30);top=Math.max(top,fp.air);if(i>2&&fp.air===0){t=i;break}}return {top,landedFrame:t,eye:fp.eye.y-fp.ground}}')
    assert .8 < jump['top'] < 1.2 and jump['landedFrame'] > 10 and abs(jump['eye'] - 1.65) < 1e-6, jump
    # A second jump while still walking downhill: landing must complete without stopping (a downhill stride used to
    # re-add a few millimetres of air each frame, so the walker never counted as landed).
    again = page.evaluate('''() => { const t = terrain3d, fp = t.firstPerson, down = c => document.dispatchEvent(new KeyboardEvent('keydown', {code: c, bubbles: true}));
      let spot = null, best = 0;
      for (const route of t.pedestrians.routes) { const pts = route.points;
        for (let i = 0; i + 8 < pts.length; i++) { const a = pts[i], b = pts[i + 8], ga = fp.groundAt(a.x, a.z), gb = fp.groundAt(b.x, b.z);
          if (ga !== null && gb !== null && ga - gb > best && !t.collision.hit(a.x, a.z, .5)) { best = ga - gb; spot = {a, b}; } } }
      if (!spot || best < .2) return {error: 'no downhill stretch found', best};
      fp.placeAt(spot.a.x, spot.a.z, Math.atan2(-(spot.b.x - spot.a.x), -(spot.b.z - spot.a.z)));
      window.dispatchEvent(new Event('blur'));
      down('KeyW'); down('Space'); let first = 0; for (let i = 0; i < 90; i++) { fp.update(1 / 30); first = Math.max(first, fp.air); }
      const settled = fp.air; down('Space'); let second = 0; for (let i = 0; i < 60; i++) { fp.update(1 / 30); second = Math.max(second, fp.air); }
      document.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW'})); return {first, settled, second}; }''')
    assert again['first'] > .8 and again['settled'] == 0 and again['second'] > .8, again
    assert not errors, errors
    print('PASS: first-person controls', {'look_offset': round(during['look'], 2), 'turned': round(yaw1 - yaw0, 2), 'auto_run_m': round(moved, 1), 'jump_m': round(jump['top'], 2)}, flush=True)
    b.close()
