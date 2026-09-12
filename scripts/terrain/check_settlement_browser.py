"""Verify speculative buildings, exclusion spacing and terrain/visibility updates."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 page.evaluate('terrain3d.renderer.setAnimationLoop(null)')
 result=page.evaluate('''()=>{const t=terrain3d,s=t.settlement;return {candidates:s.records.length,shown:s.visibleCount,shops:s.shopCount,meshes:s.group.children.length,thatch:s.records.filter(r=>r.displayed&&r.roofType==='thatch').length,tile:s.records.filter(r=>r.displayed&&r.roofType==='tile').length,valid:s.records.every(r=>Number.isFinite(r.support.max)&&r.support.max>=r.support.min),waterClear:s.records.every(r=>{const m=ChannelTerrain.nearest(r.x,r.z,t.channelState.path);return m.distance>=m.width+25+r.radius}),maxHeight:Math.max(...s.records.map(r=>r.h+1.5)),maxRoadGap:Math.max(...s.records.map(r=>r.roadDistance-(r.d+1)/2)),minFrontGap:Math.min(...s.records.map(r=>r.setback)),facesRoad:s.records.every(r=>(r.road.x-r.x)*Math.sin(r.yaw)+(r.road.z-r.z)*Math.cos(r.yaw)>0)}}''');print(result,flush=True)
 assert result['shown']>2000 and result['shops']>50 and result['meshes']==5 and result['thatch']>result['tile']>0 and result['valid'] and result['waterClear'] and result['maxHeight']<=5
 assert result['maxRoadGap']<=9.00001 and result['minFrontGap']>=1.99999 and result['facesRoad']
 page.screenshot(path='/tmp/hanyang-settlement-overview.png')
 page.locator('#settlement-density').select_option('.35');low=page.evaluate('terrain3d.settlement.visibleCount')
 page.locator('#settlement-density').select_option('1');high=page.evaluate('terrain3d.settlement.visibleCount');assert low<result['shown']<high
 page.locator('#settlement-density').select_option('.7')
 page.locator('#settlement3d').uncheck();assert page.evaluate('!terrain3d.settlement.group.visible');page.locator('#settlement3d').check()
 page.evaluate('terrain3d.controls.enableDamping=false');page.locator('#settlement-focus').click();page.evaluate('terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
 page.screenshot(path='/tmp/hanyang-settlement-street.png')
 for kind in ['thatch','tile']:
  page.evaluate("""kind=>{const t=terrain3d,r=t.settlement.records.find(r=>r.displayed&&r.roofType===kind),target=t.camera.position.clone().set(r.x,r.floor+2,r.z);t.camera.position.copy(target).add(target.clone().set(Math.sin(r.yaw)*14+Math.cos(r.yaw)*10,7,Math.cos(r.yaw)*14-Math.sin(r.yaw)*10));t.camera.near=.1;t.camera.fov=50;t.camera.updateProjectionMatrix();t.camera.lookAt(target);t.renderer.render(t.scene,t.camera)}""",kind)
  page.locator('#scene').screenshot(path=f'/tmp/hanyang-house-{kind}.png')
 assert page.evaluate("""()=>{const s=terrain3d.settlement,m=terrain3d.camera.matrix.clone();return s.records.every((r,i)=>{for(const name of ['house-roofs','thatched-roofs']){s.group.getObjectByName(name).getMatrixAt(i,m);const shown=m.elements[5]!==0,expected=r.displayed&&((name==='thatched-roofs')===(r.roofType==='thatch'));if(shown!==expected)return false}return true})}""")
 assert page.evaluate('terrain3d.settlement.records.every(r=>!r.displayed||Math.abs(r.floor-r.displaySurface.min-.08)<1e-6)')
 page.locator('#height3d').select_option('2')
 def check_support():
  return page.evaluate('''async()=>{const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,s=t.settlement,m=new T.Matrix4();return s.records.every((r,i)=>{s.group.children[0].getMatrixAt(i,m);if(m.elements[0]===0&&m.elements[5]===0)return true;const ground=r.displaySurface;return Math.abs(m.elements[13]-(ground.min*2+.08+r.h/2))<.001&&(ground.max-ground.min)*2<=1.20001})}''')
 assert check_support()
 page.locator('#opacity3d').fill('0');assert check_support();assert page.evaluate('terrain3d.settlement.records.every(r=>!r.displayed||r.displaySurface===r.support.terrain)')
 page.locator('#opacity3d').fill('90');assert check_support()
 page.locator('#carve3d').uncheck();assert check_support()
 page.locator('#carve3d').check();assert check_support()
 assert not errors,errors
 print(json.dumps({'density_counts':[low,result['shown'],high],'errors':errors}),flush=True)
 print('Passed: roadside buildings, small scale, water exclusion, density, visibility, actual terrain contact at 2x and carving toggles',flush=True)
 b.close()
