"""Verify neighbourhood name labels: loaded from the data, shown by zoom, clickable into a description card."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
args = parser.parse_args()
data = json.loads((ROOT / 'gis/placenames/doseong_placenames.json').read_text())
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    count = page.evaluate("terrain3d.scene.getObjectByName('place-name-labels')?.children.length ?? -1")
    assert count == len(data['features']), (count, len(data['features']))
    bang = next(f for f in data['features'] if f['kind'] == 'bang')
    # Look at the first 坊 label from close by, then click its text.
    point = page.evaluate('''id=>{const t=terrain3d;t.renderer.setAnimationLoop(null);
      const g=t.scene.getObjectByName('place-name-labels'),tag=g.children.find(c=>c.userData.feature.id===id);
      t.updateBuildingNames();t.controls.target.copy(tag.position);t.camera.position.set(tag.position.x+80,tag.position.y+260,tag.position.z+320);t.controls.update();
      t.updateBuildingNames();t.renderer.render(t.scene,t.camera);
      const v=tag.position.clone().project(t.camera),r=t.renderer.domElement.getBoundingClientRect();
      return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2-10,visible:tag.visible&&g.visible}}''', bang['id'])
    assert point['visible'], point
    page.mouse.move(point['x'], point['y'])
    page.mouse.down()
    page.mouse.up()
    card = page.evaluate("()=>{const p=document.getElementById('building-popup');return {hidden:p.hidden,text:p.innerText,links:p.querySelectorAll('a').length}}")
    assert not card['hidden'] and bang['name'] in card['text'] and '존재 시기' in card['text'] and card['links'] >= 1, card
    # The layer switch hides every label.
    hidden = page.evaluate('''()=>{const box=document.getElementById('placenames3d');box.checked=false;terrain3d.updateBuildingNames();
      const off=!terrain3d.scene.getObjectByName('place-name-labels').visible;box.checked=true;terrain3d.updateBuildingNames();return off}''')
    assert hidden
    assert not errors, errors
    print('PASS: place names', {'labels': count, 'clicked': bang['name']}, flush=True)
    b.close()
