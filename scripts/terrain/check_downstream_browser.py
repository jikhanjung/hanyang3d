"""Exercise the river junction, all gate passages, roads and terrain toggles."""
from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=240000)
 result=page.evaluate('''async()=>{
 const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,c=t.channelState,join=c.mainPath[c.joinIndex],north=c.northPath.at(-1),gates=t.buildings.children.filter(b=>b.userData.feature.category==='성문');t.scene.updateMatrixWorld(true);
 const passages=gates.map(g=>{const origin=new T.Vector3(0,g.children[0].userData.archTestY,g.userData.feature.symbol_size_m[2]);g.localToWorld(origin);return {id:g.userData.feature.id,size:g.userData.feature.symbol_size_m,open:!new T.Raycaster(origin,new T.Vector3(0,0,-1).transformDirection(g.matrixWorld),0,g.userData.feature.symbol_size_m[2]*2).intersectObject(t.cityWall.group,true).length};});
 const monotone=path=>path.slice(1).every((p,i)=>p.level<=path[i].level+1e-8);
 return {passages,joinDelta:Math.hypot(join.x-north.x,join.z-north.z,join.level-north.level),downhill:monotone(c.mainPath)&&monotone(c.northPath),mainLength:c.mainPath.length,northLength:c.northPath.length,waterMeshes:t.waterLayer.children.length,roadPixels:t.roadRecord,vertices:t.terrain.geometry.attributes.position.count,maxCut:c.maxCut,anchorError:t.anchorError,levels:[c.mainPath[0].level,join.level,c.mainPath.at(-1).level],northAboveDEM:Math.max(...c.northPath.map(p=>p.level-p.height))};
 }''')
 print(json.dumps(result,ensure_ascii=False),flush=True)
 assert len(result['passages'])==9 and all(g['open'] for g in result['passages']),result['passages']
 assert result['joinDelta']<1e-8 and result['downhill'] and result['waterMeshes']==5
 assert result['anchorError']<1e-5 and result['northAboveDEM']<0
 page.locator('#downstream-focus').click();page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-downstream.png')
 page.locator('#opacity3d').fill('0');page.locator('#water-focus').click();page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-roads-terrain.png')
 assert page.evaluate('terrain3d.roadLayer.visible && terrain3d.historical.material.opacity===0')
 page.locator('#roads3d').uncheck();assert page.evaluate('!terrain3d.roadLayer.visible');page.locator('#roads3d').check()
 page.locator('#height3d').select_option('2');page.locator('#channel-depth').fill('5');page.locator('#channel-depth').dispatch_event('change')
 assert page.evaluate('terrain3d.waterLayer.children.every(m=>m.geometry.userData.heights.every(Number.isFinite))')
 page.locator('#channel-depth').blur();page.locator('#carve3d').uncheck();page.wait_for_function('!terrain3d.channelState.enabled',timeout=60000);print(page.evaluate('terrain3d.surfaceBaselines.map(b=>({name:b.mesh===terrain3d.terrain?"terrain":"image",bad:b.original.findIndex((h,i)=>h!==b.mesh.geometry.userData.heights[i])}))'),flush=True);assert page.evaluate('terrain3d.surfaceBaselines.every(b=>b.original.every((h,i)=>h===b.mesh.geometry.userData.heights[i]))')
 page.locator('#carve3d').check();page.locator('#height3d').select_option('1')
 assert not errors,errors
 print('Passed: 9 open gates, shared descending junction, roads independent of image, depth/height toggles and exact terrain restoration',flush=True)
 b.close()
