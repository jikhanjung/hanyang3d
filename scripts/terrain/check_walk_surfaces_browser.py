"""Walk onto raised surfaces in first person.

- From the end of the 수표교 ramp to the middle of the deck: the eye ends 1.65 m above the deck top.
- Up the south stairs of 근정전 터 to the upper terrace: the eye ends 1.65 m above the hall floor.
- Walking straight at the side of the terrace (1.3 m high) is stopped at the edge; a jump (Space) lands on it.
"""
import argparse

from playwright.sync_api import sync_playwright

from account_login import login

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
args = parser.parse_args()

# Walk from local point `start` toward local point `goal` of object `find` for up to `frames` frames; report where
# the walker ended in the object's local frame and the eye height above the goal surface.
WALK = """async ({find, start, goal, frames, top}) => {
  const T = await import('/webapp/static/vendor/three/three.module.js');
  const t = terrain3d, fp = t.firstPerson, o = eval(find);
  const s = o.localToWorld(new T.Vector3(...start)), g = o.localToWorld(new T.Vector3(...goal));
  fp.placeAt(s.x, s.z, Math.atan2(-(g.x - s.x), -(g.z - s.z)));
  window.dispatchEvent(new Event('blur'));
  document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW', bubbles: true}));
  for (let i = 0; i < frames; i++) {
    fp.update(1 / 30);
    const e = fp.eye; if (Math.hypot(e.x - g.x, e.z - g.z) < .6) break;
  }
  document.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW'}));
  const e = fp.eye, local = o.worldToLocal(e.clone());
  return {local: [local.x, local.z], left: Math.hypot(e.x - g.x, e.z - g.z), eyeAboveTop: e.y - eval(top), eyeAboveGround: e.y - fp.ground};
}"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    login(page)
    page.evaluate("()=>{const t=terrain3d;t.renderer.setAnimationLoop(null);t.firstPerson.enter();t.pedestrians.group.visible=false}")
    assert page.evaluate('terrain3d.firstPerson.active')

    bridge = "t.bridges.children.find(b => b.userData.feature.id === 'supyo')"
    end = page.evaluate(f"()=>{{const t=terrain3d,b={bridge};const e=b.userData.roadEnds[0];return [e.x,0,e.z]}}")
    deck = page.evaluate(WALK, {'find': bridge, 'start': end, 'goal': [0, 0, 0], 'frames': 900,
                                'top': f"{bridge}.position.y + {bridge}.userData.boxHeight / 2"})
    assert deck['left'] < 1.5 and abs(deck['eyeAboveTop'] - 1.65) < .1, deck

    hall = "t.buildings.children.find(b => b.userData.feature.id === 'geunjeongjeon_site')"
    size = page.evaluate(f"()=>{{const t=terrain3d;return {hall}.userData.feature.symbol_size_m}}")
    w, h, d = size
    floor = f"{hall}.position.y - {h}/2 + 1.3 + 1.42 + .12"
    up = page.evaluate(WALK, {'find': hall, 'start': [0, 0, d / 2 + 6], 'goal': [0, 0, -2], 'frames': 900, 'top': floor})
    assert up['left'] < 1.5 and abs(up['eyeAboveTop'] - 1.65) < .15, up

    side = page.evaluate(WALK, {'find': hall, 'start': [w / 2 + 4, 0, 0], 'goal': [0, 0, 0], 'frames': 300, 'top': floor})
    assert side['local'][0] > w / 2 - .6 and abs(side['eyeAboveGround'] - 1.65) < .05, side

    # A jump from beside a terrace lands on it where walking could not climb: the north side of 교태전 터 stands about
    # 1.5 m above the ground there (a jump reaches about 1 m, plus one step).
    ledge = page.evaluate('''async () => {
      const T = await import('/webapp/static/vendor/three/three.module.js');
      const t = terrain3d, fp = t.firstPerson, o = t.buildings.children.find(b => b.userData.feature.id === 'gyotaejeon_site');
      const [w, h, d] = o.userData.feature.symbol_size_m, lowTop = o.position.y - h / 2 + (h - .6);
      const s = o.localToWorld(new T.Vector3(-12, 0, -d / 2 - .7)), g = o.localToWorld(new T.Vector3(-12, 0, 0));
      fp.placeAt(s.x, s.z, Math.atan2(-(g.x - s.x), -(g.z - s.z)));
      const edge = lowTop - fp.ground;
      // Walking alone stops at the edge.
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW', bubbles: true}));
      for (let i = 0; i < 30; i++) fp.update(1 / 30);
      document.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW'}));
      const walkedZ = o.worldToLocal(fp.eye.clone()).z;
      // Jump, then run a couple of metres onto the terrace (short of the hall floor and footings).
      fp.placeAt(s.x, s.z, Math.atan2(-(g.x - s.x), -(g.z - s.z)));
      document.dispatchEvent(new KeyboardEvent('keydown', {code: 'Space', bubbles: true}));
      for (let i = 0; i < 6; i++) fp.update(1 / 30);
      document.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyW', bubbles: true}));
      for (let i = 0; i < 20; i++) fp.update(1 / 30);
      document.dispatchEvent(new KeyboardEvent('keyup', {code: 'KeyW'}));
      for (let i = 0; i < 30; i++) fp.update(1 / 30);
      const e = fp.eye, local = o.worldToLocal(e.clone());
      return {edge, walkedZ, localZ: local.z, halfDepth: d / 2, feetAboveLowerTop: e.y - 1.65 - lowTop, air: fp.air};
    }''')
    assert ledge['edge'] > .9 and ledge['walkedZ'] < -ledge['halfDepth'], ledge
    assert ledge['localZ'] > -ledge['halfDepth'] + .2 and ledge['air'] == 0 and abs(ledge['feetAboveLowerTop']) < .1, ledge

    assert not errors, errors
    print('PASS: walk surfaces', {'bridge_eye_above_deck': round(deck['eyeAboveTop'], 2), 'terrace_eye_above_floor': round(up['eyeAboveTop'], 2),
                                  'stopped_at_side_x': round(side['local'][0], 2), 'half_width': w / 2, 'jump_edge_m': round(ledge['edge'], 2), 'landed_local_z': round(ledge['localZ'], 1)}, flush=True)
    b.close()
