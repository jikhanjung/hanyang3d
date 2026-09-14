"""Verify place stories: every story is attached to its landmark, bridge or neighbourhood name, and a clicked
place with a story shows the 이야기 section with its title, legend tag and source links."""
import argparse
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
args = parser.parse_args()
stories = json.loads((ROOT / 'gis/stories/doseong_stories.json').read_text())['stories']
assert stories, 'no stories'
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    attached = page.evaluate('''()=>{const t=terrain3d,out=[];
      for(const o of [...t.buildings.children,...t.bridges.children])for(const s of o.userData.feature.info?.stories??[])out.push(s.id);
      for(const tag of t.scene.getObjectByName('place-name-labels')?.children??[])for(const s of tag.userData.feature.info?.stories??[])out.push(s.id);
      return out}''')
    missing = sorted({s['id'] for s in stories} - set(attached))
    assert not missing, missing
    # Open the card of the first landmark story the same way a click does and read the rendered section.
    story = next(s for s in stories if s['target']['type'] == 'landmark')
    card = page.evaluate('''id=>{const t=terrain3d,box=t.buildings.children.find(b=>b.userData.feature.id===id);t.renderer.setAnimationLoop(null);
      t.controls.target.copy(box.position);t.camera.position.copy(box.position).add(box.position.clone().set(60,120,160));t.controls.update();t.updateBuildingNames();t.renderer.render(t.scene,t.camera);
      const v=box.position.clone().project(t.camera),r=t.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}}''', story['target']['key'])
    page.mouse.move(card['x'], card['y'])
    page.mouse.down()
    page.mouse.up()
    popup = page.evaluate("()=>{const p=document.getElementById('building-popup');return {hidden:p.hidden,text:p.innerText,stories:p.querySelectorAll('.story').length,links:[...p.querySelectorAll('.story a')].map(a=>a.href)}}")
    expected = [s for s in stories if s['target'] == story['target']]
    assert not popup['hidden'] and '이야기' in popup['text'] and story['title'] in popup['text'], popup
    assert popup['stories'] == len(expected) and all(src['url'] in popup['links'] for s in expected for src in s['sources']), popup
    assert not errors, errors
    print('PASS: place stories', {'stories': len(stories), 'attached': len(attached), 'clicked': story['target']['label']}, flush=True)
    b.close()
