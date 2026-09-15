"""Buy a horse from the horse dealer and ride it.

The reins are bought through the server (only one may be owned), appear in the pack window (I), and right-clicking
them mounts the horse: the rider sits on the horse's back (eye 2.0 m) and movement is three times the fast walk. Right-clicking
again dismounts; selling the reins while riding takes the horse away.
"""
import argparse

from playwright.sync_api import sync_playwright

from account_login import login

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
parser.add_argument('--shots', default='')
args = parser.parse_args()

HEIGHT = "()=>{const fp=terrain3d.firstPerson;return fp.eye.y-fp.ground}"
# Distance covered in 3 frames of 1/30 s holding W (short enough not to meet a wall).
STRIDE = """shift=>{const fp=terrain3d.firstPerson,a=fp.eye;
  window.dispatchEvent(new Event('blur'));
  const down=code=>document.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));
  down('KeyW');if(shift)down('ShiftLeft');
  for(let i=0;i<3;i++)fp.update(1/30);
  document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));document.dispatchEvent(new KeyboardEvent('keyup',{code:'ShiftLeft'}));
  const b=fp.eye;return Math.hypot(b.x-a.x,b.z-a.z)}"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    login(page)
    page.evaluate('''()=>{const t=terrain3d,fp=t.firstPerson;t.renderer.setAnimationLoop(null);fp.enter();
      const route=t.pedestrians.routes[0].points,i=Math.floor(route.length*.42),p=route[i],q=route[i+1];
      fp.placeAt(p.x,p.z,Math.atan2(-(q.x-p.x),-(q.z-p.z)));t.pedestrians.group.visible=false}''')
    assert page.evaluate('terrain3d.firstPerson.active')

    # Without reins the pack says so and nothing happens.
    assert page.evaluate("terrain3d.firstPerson.setMounted(true)") == '말고삐가 없소.'

    # Buy the reins from the horse dealer's shop; a second horse is refused by the server.
    page.evaluate("terrain3d.shop.open({trade:'말 장수',sells:'말'})")
    page.wait_for_function("!terrain3d.shop.busy && terrain3d.shop.state.ready && document.querySelectorAll('.shop-goods .shop-slot').length===1")
    money = page.evaluate('terrain3d.shop.state.money')
    page.locator('.shop-goods .shop-slot').first.click()
    page.wait_for_function("terrain3d.shop.state.items.horse_reins===1 && !terrain3d.shop.busy")
    assert page.evaluate('terrain3d.shop.state.money') == money - 900
    page.wait_for_timeout(1100)
    page.locator('.shop-goods .shop-slot').first.click()
    page.wait_for_function("document.querySelector('.shop-message').textContent.includes('족하오') && !terrain3d.shop.busy")
    assert page.evaluate('terrain3d.shop.state.items.horse_reins') == 1
    page.keyboard.press('Escape')
    assert page.evaluate("document.getElementById('shop-window').hidden && terrain3d.firstPerson.active")

    # Fast-walk stride for comparison.
    walk = page.evaluate(STRIDE, True)

    # I opens the pack; right-clicking the reins mounts the horse.
    page.evaluate('terrain3d.renderer.domElement.focus()')
    page.keyboard.press('KeyI')
    assert page.evaluate('terrain3d.shop.packOpen')
    page.click('#pack-window .shop-slot[data-item=horse_reins]', button='right')
    assert page.evaluate('terrain3d.firstPerson.mounted && terrain3d.firstPerson.horse.group.visible')
    assert '올랐소' in page.evaluate("document.querySelector('#pack-window .pack-message').textContent")
    height = page.evaluate(HEIGHT)
    assert abs(height - 2.0) < .05, height
    ride = page.evaluate(STRIDE, False)
    assert abs(walk - .8) < .05 and abs(ride - 2.4) < .1, (walk, ride)
    if args.shots:
        page.evaluate('()=>{const t=terrain3d;t.firstPerson.update(0);t.renderer.render(t.scene,t.camera)}')
        page.screenshot(path=f'{args.shots}/horse_riding.png')

    # Right-click again: dismount, back to walking height.
    page.click('#pack-window .shop-slot[data-item=horse_reins]', button='right')
    assert not page.evaluate('terrain3d.firstPerson.mounted')
    assert abs(page.evaluate(HEIGHT) - 1.65) < .05
    server = page.evaluate("async()=>(await (await fetch('/api/player/')).json()).items")
    assert server.get('horse_reins') == 1, server

    # Selling the reins while riding takes the horse away.
    page.click('#pack-window .shop-slot[data-item=horse_reins]', button='right')
    assert page.evaluate('terrain3d.firstPerson.mounted')
    page.keyboard.press('Escape')
    assert not page.evaluate('terrain3d.shop.packOpen') and page.evaluate('terrain3d.firstPerson.active')
    page.evaluate("terrain3d.shop.open({trade:'말 장수',sells:'말'})")
    page.wait_for_function("document.querySelectorAll('.shop-pack .shop-slot').length===1 && !terrain3d.shop.busy")
    page.locator('.shop-pack .shop-slot').first.click()
    page.wait_for_function("!terrain3d.shop.state.items.horse_reins && !terrain3d.shop.busy")
    page.evaluate('terrain3d.firstPerson.update(1/30)')
    assert not page.evaluate('terrain3d.firstPerson.mounted')
    page.keyboard.press('Escape')

    # Leaving first person also leaves the saddle and closes the pack.
    page.evaluate('terrain3d.firstPerson.exit()')
    assert not page.evaluate('terrain3d.shop.packOpen')
    assert not errors, errors
    print('PASS: horse', {'fast_walk_3_frames': round(walk, 2), 'ride_3_frames': round(ride, 2), 'eye_height_mounted': round(height, 2)}, flush=True)
    b.close()
