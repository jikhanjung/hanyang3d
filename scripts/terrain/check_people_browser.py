from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 page.evaluate('terrain3d.renderer.setAnimationLoop(null)')
 result=page.evaluate('''()=>{const t=terrain3d,p=t.pedestrians,before=p.walkers.map(w=>w.position.clone());for(let i=0;i<100;i++)p.update(.1);return {count:p.walkers.length,routes:p.routes.length,moved:p.walkers.every((w,i)=>w.position.distanceTo(before[i])>1),finite:p.walkers.every(w=>w.position.toArray().every(Number.isFinite)),lengths:p.routes.map(r=>r.length),waterClear:p.routes.every(r=>r.points.every(q=>{const m=ChannelTerrain.nearest(q.x,q.z,t.channelState.path);return m.distance>m.width+1}))}}''');print(result,flush=True)
 assert result['count']==130 and result['routes']==3 and result['moved'] and result['finite'] and result['waterClear']
 def check_feet():
  result=page.evaluate("""()=>{const t=terrain3d,feet=t.pedestrians.group.children.slice(2,4),matrix=t.camera.matrix.clone(),v=t.camera.position.clone();let clearance=Infinity;
   for(let frame=0;frame<4;frame++){t.pedestrians.update(.1);for(let i=0;i<t.pedestrians.walkers.length;i++)for(const mesh of feet){mesh.getMatrixAt(i,matrix);const verts=mesh.geometry.attributes.position;for(let k=0;k<verts.count;k++){v.fromBufferAttribute(verts,k).applyMatrix4(matrix);const s=t.cityWall.supportAt(v.x,v.z,.002,.002,0,true),h=Math.max(t.historical.material.opacity>0?s.max:s.terrain.max,t.roadLayer.visible?s.road.max*Number(document.getElementById('height3d').value):-Infinity);clearance=Math.min(clearance,v.y-h)}}}
   return clearance}""")
  assert result>=-.002,result
  print({'minimum_foot_clearance_m':result},flush=True)
 check_feet()
 page.evaluate('terrain3d.controls.enableDamping=false');page.locator('#people-focus').click();page.evaluate('terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)');page.screenshot(path='/tmp/hanyang-walking-people.png')
 page.locator('#walking3d').uncheck();assert page.evaluate('''()=>{const p=terrain3d.pedestrians,t=p.elapsed;p.update(.1);return p.elapsed===t}''');page.locator('#walking3d').check()
 page.locator('#people3d').uncheck();assert page.evaluate('!terrain3d.pedestrians.group.visible');page.locator('#people3d').check()
 page.locator('#height3d').select_option('2');page.locator('#opacity3d').fill('0');page.locator('#carve3d').uncheck()
 assert page.evaluate('terrain3d.pedestrians.routes.every(r=>r.points.every(p=>Number.isFinite(p.terrainHeight)&&Number.isFinite(p.height)))')
 check_feet()
 page.locator('#roads3d').uncheck();check_feet()
 page.locator('#carve3d').check();check_feet();assert not errors,errors
 print('Passed: moving along 3 roads, water exclusion, pause/hide, height/map/carving switches, no JS errors',flush=True);b.close()
