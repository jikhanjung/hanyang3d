"""Verify gate guards: the recorded posts carry guard figures standing in front of the gate on the ground, outside the
passage, the gate officer only at palace gates, none at the closed or ruined gates, and they switch off with detail."""
import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
parser.add_argument('--shots', default='')
args = parser.parse_args()
EXPECTED = {'donhwamun': (True, 4), 'honghwamun': (True, 2), 'geumhomun': (True, 2), 'heunghwamun': (True, 2), 'sungnyemun': (False, 2), 'heunginjimun': (False, 2), 'donuimun': (False, 2)}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    info = page.evaluate('''()=>{const out={};for(const bld of terrain3d.buildings.children){const f=bld.userData.feature,g=bld.getObjectByName('gate-guards');
      if(!g){if(f.category==='성문'||f.display_model==='palace_gate')out[f.id]=null;continue}
      const [w,h,d]=f.symbol_size_m,gate=bld.getObjectByName('gate-model');const half=(gate?.userData.doorWidth??0)/2;
      out[f.id]={officer:g.userData.officer,soldiers:g.userData.soldiers,figures:g.children.length,
        onGround:g.children.every(c=>Math.abs(c.position.y+h/2)<1e-6),inFront:g.children.every(c=>c.position.z*(f.outer_side??1)>d/2),
        outsideCity:f.category!=='성문'||g.children.every(c=>{const p=c.getWorldPosition(bld.position.clone()),cc=terrain3d.cityCentre;return Math.hypot(p.x-cc.x,p.z-cc.z)>Math.hypot(bld.position.x-cc.x,bld.position.z-cc.z)}),
        clearOfPassage:!gate||g.children.every(c=>Math.abs(c.position.x)>half),inDetail:terrain3d.landmarkLods.find(l=>l.box===bld)?.detail.includes(g)}}
      return out}''')
    for fid, (officer, soldiers) in EXPECTED.items():
        g = info[fid]
        assert g and g['officer'] == officer and g['soldiers'] == soldiers and g['figures'] == soldiers + officer, (fid, g)
        assert g['onGround'] and g['inFront'] and g['outsideCity'] and g['clearOfPassage'] and g['inDetail'], (fid, g)
    for fid in ('gwanghwamun', 'sukjeongmun'):
        assert info[fid] is None, (fid, info[fid])
    if args.shots:
        Path(args.shots).mkdir(parents=True, exist_ok=True)
        for fid, dist in [('donhwamun', 30), ('sungnyemun', 40), ('heunginjimun', 60)]:
            page.evaluate('''([id,dist])=>{const t=terrain3d,bld=t.buildings.children.find(b=>b.userData.feature?.id===id);const o=bld.userData.feature.outer_side??1,s=o*Math.sin(bld.rotation.y),c=o*Math.cos(bld.rotation.y),p=bld.position;
              t.controls.target.set(p.x+s*6,p.y-bld.userData.boxHeight/2+2,p.z+c*6);t.camera.position.set(p.x+s*dist+c*dist*.4,p.y+dist*.2,p.z+c*dist-s*dist*.4);t.controls.update();t.updateBuildingNames();t.renderer.render(t.scene,t.camera)}''', [fid, dist])
            page.screenshot(path=f'{args.shots}/guards_{fid}.png')
    assert not errors, errors
    print('PASS: gate guards', {k: (v['officer'], v['soldiers']) if v else None for k, v in info.items()}, flush=True)
    b.close()
