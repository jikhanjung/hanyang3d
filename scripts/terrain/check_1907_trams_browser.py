"""PC/mobile tram motion, reversal, collision clearance and terrain invariance."""
import os,subprocess,tempfile,time,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory(prefix='tram-check-') as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 log=open(tmp+'/server.log','w');server=subprocess.Popen([str(root/'.venv/bin/python'),'manage.py','runserver','127.0.0.1:18089','--noreload'],env=env,stdout=log,stderr=log)
 try:
  for _ in range(100):
   try:urlopen('http://127.0.0.1:18089/1907/');break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
   for mobile in [False,True]:
    ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18089/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=120000)
    page.evaluate('window.renderScene=seoul1907.renderer.render.bind(seoul1907.renderer);seoul1907.renderer.render=()=>{}')
    page.locator('#menu').click();page.locator('#tram-focus').click()
    result=page.evaluate("""()=>{const s=seoul1907,t=s.trams;s.renderer.setAnimationLoop(null);const before=t.state.distance;t.update(.1,s.camera);const moved=t.state.distance-before;t.group.visible=false;const paused=t.state.distance;t.update(.1,s.camera);const hiddenPause=t.state.distance===paused;t.group.visible=true;const y=t.car.position.y;document.getElementById('opacity').value=0;document.getElementById('opacity').dispatchEvent(new Event('input'));const stable=y===t.car.position.y;t.state.distance=t.length-5.01;t.state.direction=1;t.update(.1,s.camera);const reversed=t.state.direction===-1&&t.state.pause>0&&t.driver.position.z<0&&t.driver.rotation.y===Math.PI;const hits=[];for(let d=10;d<t.length-10;d+=5){const p=t.sample(d);if(s.walking.collision.hit(p.x,p.z,1.15))hits.push(d)}t.state.distance=t.length*.34;t.state.pause=0;t.update(0,s.camera);s.controls.target.copy(t.car.position);s.camera.position.copy(t.car.position).add({x:15,y:9,z:18});s.controls.update();renderScene(s.scene,s.camera);return {moved,hiddenPause,stable,reversed,hits,length:t.length,rails:t.rails.geometry.attributes.position.count}}""")
    assert abs(result['moved']-.36)<.00001,result
    assert all(result[k] for k in ['hiddenPause','stable','reversed']),result
    assert not result['hits'],result
    avoidance=page.evaluate("""()=>{const s=seoul1907,t=s.trams;t.state.pause=0;t.state.direction=1;const f=t.frame(),base=t.car.position.clone().addScaledVector(f.t,6),start=t.state.distance;t.update(.1,s.camera,[base]);const stopped=t.state.blocked&&start===t.state.distance;let offset={x:0,z:0};for(let i=0;i<20;i++)offset=t.avoid(base,offset,.1);const side=Math.abs(offset.x*f.n.x+offset.z*f.n.z);const cleared=base.clone().add({x:offset.x,y:0,z:offset.z});t.update(.1,s.camera,[cleared]);const resumed=!t.state.blocked&&t.state.distance>start;const immovable=t.avoid(base,{x:0,z:0},.1,()=>true);return {stopped,side,resumed,immovable}}""")
    assert avoidance['stopped'] and avoidance['resumed'] and avoidance['side']>=2.49,avoidance
    assert avoidance['immovable']=={'x':0,'z':0},avoidance

    occupants=page.evaluate("""()=>{const t=seoul1907.trams;return {passengers:t.passengers.length,driver:t.driver.name,attached:t.occupants.parent.parent===t.car,seated:t.passengers.every(p=>p.position.y===.895)}}""")
    assert occupants=={'passengers':4,'driver':'tram-driver','attached':True,'seated':True},occupants
    page.locator('#building-info button').click()
    if 'open' in (page.locator('#options').get_attribute('class') or ''):page.locator('#menu').click()
    page.evaluate("document.getElementById('labels').hidden=true;renderScene(seoul1907.scene,seoul1907.camera)")
    point=page.evaluate("""()=>{const s=seoul1907,p=s.trams.car.position.clone();p.y+=3.12;p.project(s.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}}""")
    if mobile:page.touchscreen.tap(point['x'],point['y'])
    else:page.mouse.click(point['x'],point['y'])
    assert page.locator('#building-info').is_visible()
    assert page.locator('#building-info a').count()==6
    assert '13km/h' in page.locator('#building-info').inner_text()
    page.locator('#building-info button').click()
    page.screenshot(path=f'/tmp/tram-occupants-{mobile}.png')
    buildingPoint=page.evaluate("""()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='geunjeongjeon-1907');s.showBuilding(b);document.getElementById('building-info').hidden=true;document.getElementById('labels').hidden=true;s.controls.target.copy(b.userData.hallPosition);s.camera.position.copy(b.userData.hallPosition).add({x:0,y:130,z:50});s.controls.update();renderScene(s.scene,s.camera);const p=b.userData.hallPosition.clone().project(s.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}}""")
    page.mouse.move(buildingPoint['x'],buildingPoint['y']);page.mouse.down();page.mouse.move(buildingPoint['x']+35,buildingPoint['y']);page.mouse.up()
    assert page.locator('#building-info').is_hidden()
    # Restore the view after the deliberate pan.
    page.evaluate("""()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='geunjeongjeon-1907');s.controls.target.copy(b.userData.hallPosition);s.camera.position.copy(b.userData.hallPosition).add({x:0,y:130,z:50});s.controls.update();renderScene(s.scene,s.camera)}""")
    page.evaluate('for(let i=0;i<100;i++)seoul1907.controls.update()')
    view_before=page.evaluate('JSON.stringify([seoul1907.camera.position.toArray(),seoul1907.camera.quaternion.toArray(),seoul1907.firstPerson.active])')
    if mobile:page.touchscreen.tap(buildingPoint['x'],buildingPoint['y'])
    else:page.mouse.click(buildingPoint['x'],buildingPoint['y'])
    assert page.locator('#building-info').is_visible()
    assert page.locator('#building-info').get_attribute('data-kind')=='building'
    assert '근정전' in page.locator('#building-info').inner_text()
    assert view_before==page.evaluate('JSON.stringify([seoul1907.camera.position.toArray(),seoul1907.camera.quaternion.toArray(),seoul1907.firstPerson.active])'), (view_before,page.evaluate('JSON.stringify([seoul1907.camera.position.toArray(),seoul1907.camera.quaternion.toArray(),seoul1907.firstPerson.active])'))
    page.evaluate("seoul1907.labels.find(l=>l.owner.userData.feature.id==='geunjeongjeon-1907').label.click()")
    assert view_before==page.evaluate('JSON.stringify([seoul1907.camera.position.toArray(),seoul1907.camera.quaternion.toArray(),seoul1907.firstPerson.active])'), (view_before,page.evaluate('JSON.stringify([seoul1907.camera.position.toArray(),seoul1907.camera.quaternion.toArray(),seoul1907.firstPerson.active])'))
    page.evaluate("const e=document.getElementById('landmark');e.value='myeongdong-cathedral-1907';e.dispatchEvent(new Event('change'))")
    assert view_before!=page.evaluate('JSON.stringify([seoul1907.camera.position.toArray(),seoul1907.camera.quaternion.toArray(),seoul1907.firstPerson.active])')
    occlusion=page.evaluate("""async()=>{const s=seoul1907,THREE=await import('/webapp/static/vendor/three/three.module.js'),b=s.buildings.find(b=>b.userData.feature.id==='myeongdong-cathedral-1907'),visibility=s.buildings.map(o=>o.visible);s.buildings.forEach(o=>o.visible=o===b);const mesh=b.getObjectByName('landmark-detail').children.find(o=>o.isMesh),g=mesh.geometry,p=g.attributes.position,idx=g.index;const points=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld)),center=points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3),normal=points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize(),target=center.clone().addScaledVector(normal,-100);s.camera.position.copy(center).addScaledVector(normal,80);const blocked=s.labelOccluded(target,null);b.visible=false;const clear=!s.labelOccluded(target,null);b.visible=true;const ownLabel=!s.labelOccluded(target,b);s.buildings.forEach((o,i)=>o.visible=visibility[i]);return {blocked,clear,ownLabel}}""")
    assert occlusion=={'blocked':True,'clear':True,'ownLabel':True},occlusion
    assert not errors,errors
    page.screenshot(path=f'/tmp/tram-model-{mobile}.png')
    print('PASS','mobile' if mobile else 'desktop',result,flush=True);ctx.close()
   browser.close()
 finally:server.terminate();server.wait();log.close()
