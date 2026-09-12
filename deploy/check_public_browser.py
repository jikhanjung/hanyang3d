"""Check the public HTTPS deployment and its fully loaded Three.js scene."""
import argparse
import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'webapp.settings')
import django
django.setup()
from webapp.resources import public_resource_paths
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='https://hanyang3d.nopeoplestime.info')
parser.add_argument('--version', default=(ROOT / 'deploy/DOCKER_VERSION').read_text().strip())
parser.add_argument('--chromium-path', default=os.environ.get('CHROMIUM_PATH'))
args = parser.parse_args()
base = args.url.rstrip('/')
with urlopen(base + '/healthz', timeout=15) as response:
    health = json.load(response)
assert health['status'] == 'ok' and health['version'] == args.version, health
for path in sorted(public_resource_paths()):
    with urlopen(Request(base + '/' + path, method='HEAD'), timeout=15) as response:
        assert response.status == 200, path
print('Public HTTPS resources passed:', health, flush=True)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.chromium_path, headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1080})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base + '/', wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready || !document.getElementById("loading-retry").hidden', timeout=300000)
    assert page.evaluate('!!window.terrain3d?.ready'), page.locator('#error').inner_text()
    assert not page.locator('header').is_visible()
    assert not page.locator('#building-info').is_visible()
    assert not page.locator('footer').is_visible()
    assert page.locator('#map-controls').is_visible()
    assert not page.locator('#anchors3d').is_checked()
    assert page.locator('#opacity3d').input_value() == '50'
    assert page.locator('#first-person3d').is_visible()
    assert page.locator('#map-controls a').get_attribute('href') == '/gis/'
    bounds = page.locator('#scene > canvas').bounding_box()
    assert bounds['x']==0 and bounds['y']==0 and bounds['width']==1440 and bounds['height']==1080, bounds
    result = page.evaluate('''()=>{const t=terrain3d;t.renderer.setAnimationLoop(null);t.updateBuildingNames();t.renderer.render(t.scene,t.camera);return {people:t.pedestrians.walkers.length,trees:t.trees.records.length,names:t.mountainNames.children.map(n=>n.userData.name),granite:t.granite.enabled,minDistance:t.controls.minDistance}}''')
    assert result['people'] == 130 and result['trees'] == 2468 and result['minDistance'] == 1, result
    assert result['names'] == ['남산', '인왕산', '북악산'] and result['granite'], result
    assert page.evaluate('terrain3d.historical.material.opacity === 0.5 && !terrain3d.labels.visible')
    assert page.evaluate('terrain3d.channelState.northPath.length === 0 && !terrain3d.waterLayer.children.some(m=>m.name.includes("downstream") || m.name.includes("jungnang"))')
    page.locator('#scene').screenshot(path='/tmp/hanyang3d-production.png')
    before = page.evaluate('terrain3d.camera.position.toArray()')
    page.mouse.move(720,540)
    page.mouse.wheel(0, -600)
    page.wait_for_timeout(300)
    assert before != page.evaluate('terrain3d.camera.position.toArray()')
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(300)
    bounds = page.locator('#scene > canvas').bounding_box()
    assert bounds['x']==0 and bounds['y']==0 and bounds['width']==390 and bounds['height']==844, bounds
    assert page.evaluate('document.documentElement.scrollHeight <= innerHeight')
    assert page.locator('#first-person3d').is_visible()
    page.locator('#opacity3d').fill('30')
    assert page.evaluate('terrain3d.historical.material.opacity === 0.3')
    page.locator('#anchors3d').check()
    assert page.evaluate('terrain3d.labels.visible')
    page.locator('#first-person3d').click()
    assert page.locator('#first-person3d').get_attribute('aria-pressed') == 'true'
    assert page.locator('#first-person-help').is_visible()
    page.locator('#first-person-exit').click()
    assert page.locator('#first-person3d').get_attribute('aria-pressed') == 'false'
    assert not errors, errors
    print('Public 3D scene passed:', result, flush=True)
    browser.close()
