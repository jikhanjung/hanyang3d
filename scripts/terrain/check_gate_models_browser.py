"""Verify the gate models: every 성문 carries a gate-model with its stone arch and passage data, the pavilion
tiers follow gate_tiers (광화문 has none in 1750), 흥인지문 has its barbican, and palace gates keep their bays."""
import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
parser.add_argument('--shots', default='')
args = parser.parse_args()
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    info = page.evaluate('''()=>{const out={};for(const bld of terrain3d.buildings.children){const f=bld.userData.feature;if(!f)continue;
      const g=bld.getObjectByName('gate-model'),pg=bld.getObjectByName('palace-gate');
      if(g){const arch=g.getObjectByName('stone-arch');out[f.id]={kind:'city',tiers:g.userData.tiers,doors:g.userData.doors,arch:!!arch,archTestY:g.userData.archTestY,
        first:bld.children[0]===g,parts:[...new Set(g.userData.parts)],meshes:g.children.length}}
      if(pg)out[f.id]={kind:'palace',bays:pg.userData.bays,tiers:pg.userData.roofTiers,parts:[...new Set(pg.userData.parts)]}}
      return out}''')
    city = {k: v for k, v in info.items() if v['kind'] == 'city'}
    assert len(city) == 9, sorted(city)
    for k, v in city.items():
        assert v['arch'] and v['first'] and isinstance(v['archTestY'], (int, float)), (k, v)
        assert v['meshes'] <= 12, (k, v['meshes'])
    assert city['gwanghwamun']['tiers'] == 0 and city['gwanghwamun']['doors'] == 3 and 'gate-roof' not in city['gwanghwamun']['parts']
    assert city['sungnyemun']['tiers'] == 2 and city['donuimun']['tiers'] == 1 and city['changuimun']['tiers'] == 1
    assert 'barbican-wall' in city['heunginjimun']['parts'] and not any('barbican-wall' in v['parts'] for k, v in city.items() if k != 'heunginjimun')
    assert all('merlon' in v['parts'] and 'stone-course' in v['parts'] for v in city.values())
    assert info['donhwamun'] == {**info['donhwamun'], 'kind': 'palace', 'bays': 5, 'tiers': 2} and info['honghwamun']['bays'] == 3
    if args.shots:
        Path(args.shots).mkdir(parents=True, exist_ok=True)
        for fid, dist in [('sungnyemun', 90), ('heunginjimun', 110), ('gwanghwamun', 90), ('donhwamun', 70), ('changuimun', 50)]:
            page.evaluate('''([id,dist])=>{const t=terrain3d,bld=t.buildings.children.find(b=>b.userData.feature?.id===id);const c=bld.position.clone();
              t.controls.target.copy(c);t.camera.position.set(c.x+dist*.5,c.y+dist*.55,c.z+dist);t.controls.update();t.updateBuildingNames();t.renderer.render(t.scene,t.camera)}''', [fid, dist])
            page.screenshot(path=f'{args.shots}/gate_{fid}.png')
    assert not errors, errors
    print('PASS: gate models', {k: (v.get('tiers'), v.get('doors', v.get('bays'))) for k, v in info.items()}, flush=True)
    b.close()
