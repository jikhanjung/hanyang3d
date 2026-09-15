"""Two independent browser sessions: presence, movement, exit and rejoin."""
import argparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18015')
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan',
        '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    errors = []
    contexts = [browser.new_context(viewport={'width': 1100, 'height': 800}) for _ in range(2)]
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
        if index == 0:
            page.dispatch_event('#first-person3d', 'click')
            page.wait_for_selector('#walk-name-dialog[open]')
            # Native dialog.close() queues its close event; wait for cancellation
            # to settle before dispatching a synthetic second click.
            page.evaluate("document.getElementById('walk-name-dialog').addEventListener('close', () => window.nameDialogClosed = true, {once:true})")
            page.click('#walk-name-cancel')
            page.wait_for_function('window.nameDialogClosed === true')
            assert not page.evaluate('terrain3d.firstPerson.active')
            page.dispatch_event('#first-person3d', 'click')
        else:
            page.dispatch_event('#walk-together', 'click')
        page.wait_for_selector('#walk-name-dialog[open]')
        page.fill('#walk-name-input', '<script>')
        page.click('#walk-name-form button[type=submit]')
        assert page.locator('#walk-name-dialog').evaluate('(d) => d.open')
        page.fill('#walk-name-input', ['한양 길동', '서울 나그네'][index])
        page.click('#walk-name-form button[type=submit]')
        page.wait_for_function('terrain3d.firstPerson.active')
        if index == 0:
            page.dispatch_event('#walk-together', 'click')
    for page in pages:
        page.wait_for_function("document.getElementById('walk-together-status').textContent.includes('2명')", timeout=20000)
        page.wait_for_function("terrain3d.scene.children.filter(o => o.name === 'remote-walker').length === 1")
    a, b = pages
    for page, expected in [(a, '서울 나그네'), (b, '한양 길동')]:
        assert page.evaluate("terrain3d.scene.children.find(o=>o.name==='remote-walker').userData.playerName") == expected
        page.wait_for_function('terrain3d.pedestrians.networkSnapshot?.npcs.length === 130')
        assert page.is_disabled('#walking3d')
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
        const fp = terrain3d.firstPerson, p = fp.eye;
        fp.placeAt(p.x + 5, p.z, .7);
        return {x: fp.eye.x, z: fp.eye.z};
    }''')
    b.wait_for_function('''p => {
        const other = terrain3d.scene.children.find(o => o.name === 'remote-walker');
        return other?.visible && Math.hypot(other.position.x-p.x, other.position.z-p.z) < .15;
    }''', arg=position, timeout=20000)
    b.wait_for_function("Math.abs(terrain3d.scene.children.find(o => o.name === 'remote-walker').rotation.y - (.7 + Math.PI)) < .05")
    a.dispatch_event('#first-person-exit', 'click')
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('1명')")
    assert b.evaluate("terrain3d.scene.children.filter(o => o.name === 'remote-walker').length") == 0
    assert a.evaluate("document.getElementById('walk-together-status').hidden")
    a.dispatch_event('#walk-together', 'click')
    assert not a.locator('#walk-name-dialog').evaluate('(d) => d.open')
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('2명')")
    contexts[0].close()
    b.wait_for_function("document.getElementById('walk-together-status').textContent.includes('1명')", timeout=20000)
    assert not errors, errors
    print('PASS: name entry/cancel/validation, named characters, identical NPC snapshots, shared clock, movement, exit/rejoin, closed tab')
    browser.close()
