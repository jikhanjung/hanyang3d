"""Two independent browser sessions: presence, movement, exit and rejoin."""
import argparse
import random
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18015')
args = parser.parse_args()
suffix = str(random.randint(1000, 9999))
NAME_A, NAME_B, PASSWORD = '한양 길동' + suffix, '서울 나그네' + suffix, 'walk-check-pass'
MESSAGE = "document.querySelector('#account-overlay .account-message').textContent"

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan',
        '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    errors = []
    contexts = [browser.new_context(viewport={'width': 1100, 'height': 800}) for _ in range(2)]
    contexts[0].add_init_script("""if(location.protocol.startsWith('http')){const key='hanyang3d-walk-position:'+encodeURIComponent('""" + NAME_A + """'.toLowerCase())+':mountains';if(localStorage.getItem(key)===null)localStorage.setItem(key,'{broken');}""")
    pages = [context.new_page() for context in contexts]
    for index, page in enumerate(pages):
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url, wait_until='domcontentloaded')
        page.wait_for_function('window.terrain3d?.ready', timeout=400000)
        print('Map ready', flush=True)
        # Keep simulation and networking active without rendering two large scenes
        # continuously on a software GPU.
        page.evaluate('terrain3d.renderer.render = () => {}')
        page.evaluate('''() => {
            const ped = terrain3d.pedestrians, apply = ped.applySnapshot;
            window.npcSamples = {};
            ped.applySnapshot = s => { npcSamples[s.tick] = s; const keys = Object.keys(npcSamples); if(keys.length>20)delete npcSamples[keys[0]]; apply(s); };
        }''')
        assert page.locator('#first-person3d').count() == 0
        assert page.locator('#walk-together').inner_text() == '1인칭'
        # Entering first person asks for the account (name and password); cancelling stays in the map view.
        if index == 0:
            page.dispatch_event('#walk-together', 'click')
            page.wait_for_selector('#account-overlay:not([hidden])')
            page.click('#account-overlay .account-cancel')
            page.wait_for_selector('#account-overlay', state='hidden')
            assert not page.evaluate('terrain3d.firstPerson.active')
        page.dispatch_event('#walk-together', 'click')
        page.wait_for_selector('#account-overlay:not([hidden])')
        page.fill('#account-dialog input[name=name]', '<script>')
        page.fill('#account-dialog input[name=password]', PASSWORD)
        page.click('#account-dialog button[value=register]')
        page.wait_for_function(MESSAGE + ".includes('이름은')")
        page.fill('#account-dialog input[name=name]', NAME_A)
        page.click('#account-dialog button[value=register]')
        if index == 1:
            page.wait_for_function(MESSAGE + ".includes('이미 쓰는')")
            assert not page.evaluate('terrain3d.firstPerson.active')
            page.fill('#account-dialog input[name=name]', NAME_B)
            page.click('#account-dialog button[value=register]')
        page.wait_for_function('terrain3d.firstPerson.active')
    for page in pages:
        page.wait_for_function("document.getElementById('walk-together-status').textContent.includes('2명')", timeout=20000)
        page.wait_for_function("terrain3d.scene.children.filter(o => o.name === 'remote-walker').length === 1")
    a, b = pages
    for page, expected in [(a, NAME_B), (b, NAME_A)]:
        assert page.evaluate("terrain3d.scene.children.find(o=>o.name==='remote-walker').userData.playerName") == expected
        page.wait_for_function('terrain3d.pedestrians.networkSnapshot?.npcs.length === 130')
        assert page.is_disabled('#walking3d')
    own_colors = [page.evaluate("terrain3d.firstPerson.walker.group.getObjectByName('walker-body').material.color.getHexString()") for page in pages]
    assert own_colors[0] != own_colors[1]
    for index, page in enumerate(pages):
        assert page.evaluate("terrain3d.scene.children.find(o=>o.name==='remote-walker').getObjectByName('walker-body').material.color.getHexString()") == own_colors[1-index]
    a.click('#walk-chat-toggle')
    position_before_chat = a.evaluate('terrain3d.firstPerson.eye.toArray()')
    a.locator('#walk-chat-input').press_sequentially('wasd')
    a.wait_for_timeout(250)
    assert a.evaluate('terrain3d.firstPerson.eye.toArray()') == position_before_chat
    a.fill('#walk-chat-input', '안녕하세요 <img src=x onerror=alert(1)>')
    a.locator('#walk-chat-input').press('Enter')
    b.wait_for_function("document.getElementById('walk-chat-messages').textContent.includes('안녕하세요')")
    assert b.locator('#walk-chat-messages img').count() == 0
    assert NAME_A + ':' in b.locator('#walk-chat-messages').text_content()
    a.locator('#walk-chat-input').press('Escape')
    assert not a.locator('#walk-chat').is_visible()
    assert a.evaluate('terrain3d.firstPerson.active')
    # The same authoritative tick contains exactly the same NPC coordinates,
    # headings and avoidance offsets in both browsers.
    b.wait_for_function('Object.keys(npcSamples).length >= 4')
    left, right = a.evaluate('npcSamples'), b.evaluate('npcSamples')
    common = set(left) & set(right)
    assert common, 'No shared NPC tick observed'
    tick = max(common, key=int)
    assert left[tick] == right[tick]
    assert a.evaluate('terrain3d.pedestrians.routeKey') == b.evaluate('terrain3d.pedestrians.routeKey')
    # Local pause/visibility does not stop or fork the authoritative simulation.
    before = b.evaluate('terrain3d.pedestrians.networkSnapshot.tick')
    a.evaluate("document.getElementById('walking3d').checked=false; terrain3d.pedestrians.group.visible=false")
    b.wait_for_function('tick => terrain3d.pedestrians.networkSnapshot.tick > tick + 3', arg=before)
    a.evaluate('terrain3d.pedestrians.group.visible=true')
    position = a.evaluate('''() => {
        const t = terrain3d, fp = t.firstPerson, p = fp.eye;
        const offset = [[5,0],[0,5],[-5,0],[0,-5]].find(([x,z]) =>
          Number.isFinite(fp.groundAt(p.x+x,p.z+z)) && !t.collision.hit(p.x+x,p.z+z,.35));
        if (!offset) throw Error('No walkable test destination');
        fp.placeAt(p.x + offset[0], p.z + offset[1], .7);
        return {x: fp.eye.x, z: fp.eye.z};
    }''')
    b.wait_for_function('''p => {
        const other = terrain3d.scene.children.find(o => o.name === 'remote-walker');
        return other?.visible && Math.hypot(other.position.x-p.x, other.position.z-p.z) < .15;
    }''', arg=position, timeout=20000)
    b.wait_for_function("Math.abs(terrain3d.scene.children.find(o => o.name === 'remote-walker').rotation.y - (.7 + Math.PI)) < .05")
    # Riding is shared: when A mounts (reins granted locally for display; trades stay on the server) B sees a horse.
    a.evaluate("terrain3d.shop.state.items.horse_reins = 1; terrain3d.firstPerson.setMounted(true)")
    b.wait_for_function("(() => { const w = terrain3d.scene.children.find(o => o.name === 'remote-walker'); return w?.getObjectByName('remote-horse')?.visible; })()", timeout=20000)
    a.evaluate("terrain3d.firstPerson.setMounted(false); delete terrain3d.shop.state.items.horse_reins")
    b.wait_for_function("!terrain3d.scene.children.find(o => o.name === 'remote-walker').getObjectByName('remote-horse').visible", timeout=20000)
    a.dispatch_event('#walk-together', 'click')
    assert not a.evaluate('terrain3d.firstPerson.active')
    assert a.locator('#walk-together').inner_text() == '1인칭'
    assert not a.locator('#walk-chat-toggle').is_visible()
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('1명')")
    assert b.evaluate("terrain3d.scene.children.filter(o => o.name === 'remote-walker').length") == 0
    assert a.evaluate("document.getElementById('walk-together-status').hidden")
    a.dispatch_event('#walk-together', 'click')
    assert a.evaluate("document.getElementById('account-overlay').hidden")
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('2명')")
    a.wait_for_function('p => Math.hypot(terrain3d.firstPerson.eye.x-p.x,terrain3d.firstPerson.eye.z-p.z)<1e-6 && Math.abs(terrain3d.firstPerson.yaw-.7)<1e-6', arg=position)
    a.wait_for_function("document.getElementById('walk-chat-messages').textContent.includes('안녕하세요')")
    # Navigating away immediately after a turn exercises pagehide saving; a fresh
    # page must restore from localStorage rather than the old camera in memory.
    a.evaluate('terrain3d.firstPerson.placeAt(terrain3d.firstPerson.eye.x,terrain3d.firstPerson.eye.z,-.4)')
    a.goto('about:blank')
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('1명')")
    a.goto(args.url, wait_until='domcontentloaded')
    a.wait_for_function('window.terrain3d?.ready', timeout=400000)
    a.evaluate('terrain3d.renderer.render = () => {}')
    a.dispatch_event('#walk-together', 'click')
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('2명')")
    a.wait_for_function('p => Math.hypot(terrain3d.firstPerson.eye.x-p.x,terrain3d.firstPerson.eye.z-p.z)<1e-6 && Math.abs(terrain3d.firstPerson.yaw+.4)<1e-6', arg=position)
    contexts[0].close()
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('1명')", timeout=20000)
    assert not errors, errors
    print('PASS: names, colors, chat, identical randomized NPCs, corrupt saved position fallback, position/direction after exit and page reload, closed tab')
    browser.close()
