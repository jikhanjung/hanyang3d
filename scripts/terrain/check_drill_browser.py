"""Verify the Hullyeonwon drill: a spear block, an officer and archers stand on the field inside the walls, the spears
move over time, and the drill belongs to the building's near detail."""
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
    info = page.evaluate('''()=>{const t=terrain3d,bld=t.buildings.children.find(b=>b.userData.feature.id==='hullyeonwon'),m=bld.getObjectByName('training-drill');
      if(!m)return null;const [w,h,d]=bld.userData.feature.symbol_size_m,box=new m.position.constructor(),s=m.getObjectByName('drill-spears');
      const bounds=new (s.geometry.boundingBox?.constructor??Object)();
      const inside=[...m.children].filter(c=>c.isMesh&&c.name==='drill-figures').every(c=>{c.geometry.computeBoundingBox();const bb=c.geometry.boundingBox;return bb.min.x>-w/2&&bb.max.x<w/2&&bb.min.z>m.userData.field[0]-6&&bb.max.z<d/2&&bb.min.y>=-h/2+.19});
      m.userData.update(0);const a=new Float32Array(s.instanceMatrix.array);m.userData.update(250);const moved=s.instanceMatrix.array.some((v,i)=>Math.abs(v-a[i])>1e-4);
      return {...m.userData,update:undefined,inside,moved,count:s.count,inDetail:t.landmarkLods.find(l=>l.box===bld)?.detail.includes(m),inLoop:t.drills.includes(m)}}''')
    assert info and info['spearmen'] == 40 and info['archers'] == 4 and info['officer'] == 1 and info['count'] == 40, info
    assert info['inside'] and info['moved'] and info['inDetail'] and info['inLoop'], info
    if args.shots:
        Path(args.shots).mkdir(parents=True, exist_ok=True)
        page.evaluate('''()=>{const t=terrain3d,bld=t.buildings.children.find(b=>b.userData.feature.id==='hullyeonwon'),p=bld.position;
          t.controls.target.set(p.x+10,p.y-bld.userData.boxHeight/2,p.z);t.camera.position.set(p.x+55,p.y+30,p.z+60);t.controls.update();t.updateBuildingNames();t.renderer.render(t.scene,t.camera)}''')
        page.screenshot(path=f'{args.shots}/drill_hullyeonwon.png')
    assert not errors, errors
    print('PASS: drill', {k: info[k] for k in ('spearmen', 'archers', 'officer', 'moved')}, flush=True)
    b.close()
