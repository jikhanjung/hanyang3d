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
with urlopen(base + '/gis/georeferenced/terrain3d/dem.json', timeout=15) as response:
    dem = json.load(response)
assert dem['source'] == 'FABDEM V1.2' and dem['license'] == 'CC BY-NC-SA 4.0'
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
    assert result['people'] == 130 and result['trees'] > 2000 and result['minDistance'] == 1, result
    assert result['names'] == ['남산', '인왕산', '북악산'] and result['granite'], result
    assert page.evaluate('terrain3d.historical.material.opacity === 0.5 && !terrain3d.labels.visible')
    assert page.evaluate('terrain3d.channelState.northPath.length === 0 && !terrain3d.waterLayer.children.some(m=>m.name.includes("downstream") || m.name.includes("jungnang"))')
    bridge_result = page.evaluate("async()=>{\n   const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,ex=Number(document.getElementById('height3d').value);\n   t.scene.updateMatrixWorld(true);\n   return t.bridges.children.map(b=>{\n    const u=b.userData,[w,h,length]=u.feature.symbol_size_m,g=b.getObjectByName('bridge-connections');\n    const ramps=g.children.filter(m=>m.name==='bridge-approach'),feet=g.children.filter(m=>m.name==='bridge-abutment');\n    let seamError=0,outerGap=0,buried=true,clear=true;\n    ramps.forEach((r,i)=>{\n     const pos=r.geometry.attributes.position,rows=u.connections[i].rows;\n     seamError=Math.max(seamError,Math.abs(pos.getY(0)+b.position.y-(b.position.y+h/2)));\n     outerGap=Math.max(outerGap,Math.abs(pos.getY(pos.count-4)+b.position.y-(rows.at(-1).max*ex+.12)));\n     rows.forEach((row,j)=>{\n      buried&&=pos.getY(j*4+2)+b.position.y<row.min*ex;\n      clear&&=pos.getY(j*4)+b.position.y>=row.max*ex-.001;\n     });\n    });\n    const footContact=feet.every((f,i)=>f.position.y-f.geometry.parameters.height/2+b.position.y<=u.connections[i].footing.min*ex);\n    return {name:u.feature.name,width:w,length,seamError,outerGap,buried,clear,footContact,parts:g.children.length};\n   });}")
    assert len(bridge_result) == 4
    assert all(r['seamError']<.001 and r['outerGap']<.001 and r['buried'] and r['clear'] and r['footContact'] for r in bridge_result), bridge_result
    print('FABDEM bridge contacts passed:', bridge_result, flush=True)
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
    coincident = "()=>{const t=terrain3d,a=t.terrain.geometry.attributes.position,b=t.historical.geometry.attributes.position,c=t.roadLayer.geometry.attributes.position;let error=0;for(let i=0;i<a.count;i++)error=Math.max(error,Math.abs(a.getY(i)-b.getY(i)),Math.abs(a.getY(i)-c.getY(i)));return error}"
    assert page.evaluate("()=>{const n=terrain3d.terrain.geometry.attributes.normal;for(let i=0;i<n.count;i++)if(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.9)return false;return true}")
    assert page.evaluate(coincident) == 0
    snapshot = "()=>{const t=terrain3d;return JSON.stringify({buildings:t.settlement.records.map(r=>[r.floor,r.displayed]),trees:t.trees.records.map(r=>r.floor),people:t.pedestrians.group.children.filter(m=>m.instanceMatrix).map(m=>Array.from(m.instanceMatrix.array)),camera:t.camera.position.toArray()})}"
    stable = page.evaluate(snapshot)
    for opacity in ['0','1','50','100','0','50']:
        page.locator('#opacity3d').fill(opacity)
        assert page.evaluate(snapshot) == stable, opacity
    page.locator('#opacity3d').fill('30')
    assert page.evaluate('terrain3d.historical.material.opacity === 0.3')
    page.locator('#anchors3d').check()
    assert page.evaluate('terrain3d.labels.visible')
    page.locator('#first-person3d').click()
    assert page.locator('#first-person3d').get_attribute('aria-pressed') == 'true'
    assert page.locator('#first-person-help').is_visible()
    for scale, opacity, road in [('1','50',True),('1.5','50',True),('2','50',True),('2','0',True),('2','0',False),('1','50',True)]:
        page.locator('#height3d').select_option(scale, force=True)
        page.locator('#opacity3d').fill(opacity)
        page.evaluate("value=>{const e=document.getElementById('roads3d');e.checked=value;e.onchange();terrain3d.firstPerson.update(0)}", road)
        eye = page.evaluate("""async()=>{const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,o=t.camera.position.clone();o.y=10000;t.scene.updateMatrixWorld(true);const meshes=[t.terrain,t.mapGround];if(t.roadLayer.visible)meshes.push(t.roadLayer);const hits=new T.Raycaster(o,new T.Vector3(0,-1,0)).intersectObjects(meshes,false);return t.camera.position.y-hits[0].point.y}""")
        assert page.evaluate(coincident) == 0
        assert abs(eye-1.65)<.08, (scale, opacity, road, eye)
        print('Eye height above displayed surface:', scale, opacity, road, eye, flush=True)
    page.locator('#first-person-exit').click()
    assert page.locator('#first-person3d').get_attribute('aria-pressed') == 'false'
    assert page.locator('#credits-link').is_visible()
    page.locator('#credits-link').click()
    page.wait_for_url(base + '/credits/')
    assert page.locator('h1').inner_text() == '출처·저작권'
    assert 'CC BY-NC-SA 4.0' in page.locator('main').inner_text()
    assert 'Three.js' in page.locator('main').inner_text()
    assert not errors, errors
    print('Public 3D scene passed:', result, flush=True)
    browser.close()
