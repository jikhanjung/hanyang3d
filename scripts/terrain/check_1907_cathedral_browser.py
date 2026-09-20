"""Isolated cathedral checks: interior access, PC/touch walking, camera walls and LOD."""
import os,subprocess,tempfile,time,json,sys
from pathlib import Path
from account_login import LOGIN_JS
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2])
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18095','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18095/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for width,height in [(1100,800),(390,844)]:
     page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600)
     errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18095/1907/');page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=120000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
     page.on('console',lambda m:errors.append(m.text) if m.type=='error' and ('WebGL' in m.text or 'Shader' in m.text) else None)
     page.evaluate("""()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='myeongdong-cathedral-1907');s.showBuilding(b,{focus:true});s.camera.position.copy(b.position).add(b.position.clone().set(55,25,75).applyAxisAngle(b.up,b.rotation.y));s.controls.target.copy(b.position).add({x:0,y:-7,z:0});s.controls.update()}""")
     page.wait_for_timeout(1000)
     page.screenshot(path='/tmp/cathedral-outside-'+str(width)+'.png')
     assert page.locator('#cathedral-interior-view').count()==0
     assert page.locator('#bookshop-talk').count()==0
     # Camera fixture for indoor checks; users now walk in through the entrance.
     page.evaluate("""async()=>{const T=await import('three'),s=seoul1907,b=s.buildings.find(b=>b.userData.interior),h=b.userData.feature.symbol_size_m[1],point=c=>b.localToWorld(new T.Vector3(c[0],c[1]-h/2,c[2]));s.camera.position.copy(point(b.userData.interior.view));s.controls.target.copy(point(b.userData.interior.target));s.controls.update();document.getElementById('building-info').hidden=true;}""")
     page.wait_for_timeout(800)
     page.screenshot(path='/tmp/cathedral-inside-'+str(width)+'.png')
     preview=page.evaluate("()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.interior);return b.worldToLocal(s.camera.position.clone()).y+b.userData.feature.symbol_size_m[1]/2}")
     assert abs(preview-2)<.1,preview
     assert page.evaluate('seoul1907.labels.every(l=>l.label.hidden)'), 'Outdoor labels visible indoors'
     volumes=page.evaluate("""()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.interior),h=b.userData.feature.symbol_size_m[1],p=s.camera.position.clone();const test=(x,y,z)=>s.walking.interiorAt(b.localToWorld(p.set(x,y-h/2,z)))===b;const inside=b.userData.interior.volumes.map(v=>test((v[0]+v[3])/2,2,(v[2]+v[5])/2));const outside=[test(0,2,b.userData.access.end+2),test(0,70,0),test(25,2,0)];b.visible=false;const hidden=test(0,2,0);b.visible=true;return {inside,outside,hidden}}""")
     assert all(volumes['inside']) and not any(volumes['outside']) and not volumes['hidden'],volumes
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['성당검사'+str(width),'cathedral-test-1907'])
     page.evaluate('seoul1907.renderer.setAnimationLoop(null);seoul1907.firstPerson.enter();seoul1907.pedestrians.group.visible=false')
     # A temporary client-side inventory fixture; no production account or purchase changes.
     page.evaluate("()=>{const s=seoul1907,n=JSON.parse(document.getElementById('npcs').textContent);window.testReins=Object.keys(n.items).find(k=>n.items[k].use==='mount');s.walking.shop.state.items[testReins]=1}")
     client=page.context.new_cdp_session(page)
     for reverse in [False,True]:
      page.evaluate("""async reverse=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.interior),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1];const world=z=>b.localToWorld(new T.Vector3(0,-h/2,z));const outside=world(b.userData.access.end+1),inside=world(-20);const p=reverse?inside:outside,q=reverse?outside:inside;window.cathedralGoal=q;s.firstPerson.placeAt(p.x,p.z,Math.atan2(-(q.x-p.x),-(q.z-p.z)));s.firstPerson.clearInput()}""",reverse)
      if not reverse:
       assert page.evaluate('seoul1907.firstPerson.setMounted(true);seoul1907.firstPerson.mounted')
      if width<600:
       box=page.locator('#walk-joystick').bounding_box();client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']*.18,'id':1}]})
      else:page.keyboard.down('w')
      result=page.evaluate("""()=>{const fp=seoul1907.firstPerson;let left;for(let i=0;i<1800;i++){fp.update(1/30);left=Math.hypot(fp.eye.x-cathedralGoal.x,fp.eye.z-cathedralGoal.z);if(left<.3)break}return {left,eyeHeight:fp.eye.y-fp.ground}}""")
      if width<600:client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
      else:page.keyboard.up('w')
      assert result['left']<.35 and abs(result['eyeHeight']-1.65)<.01,result
      print('WALK',width,reverse,result,flush=True)
      if not reverse:
       assert page.evaluate("()=>{const f=seoul1907.firstPerson;return !f.mounted&&!f.horse.group.visible&&f.setMounted(true)==='실내에서는 말을 탈 수 없소.'&&!f.mounted}")
      else:
       assert page.evaluate('!seoul1907.firstPerson.mounted')
     teleport=page.evaluate("()=>{const s=seoul1907,f=s.firstPerson,b=s.buildings.find(b=>b.userData.interior);f.setMounted(true);const wasMounted=f.mounted,p=b.localToWorld(f.eye.set(0,2-b.userData.feature.symbol_size_m[1]/2,0));f.placeAt(p.x,p.z);return wasMounted&&!f.mounted}")
     assert teleport,'Indoor teleport should dismount'
     geometry=page.evaluate("""async()=>{
      const s=seoul1907,b=s.buildings.find(b=>b.userData.interior),fp=s.firstPerson,T=await import('/webapp/static/vendor/three/three.module.js'),{updateLandmarkLod}=await import('/webapp/static/lod1907.js');
      const p=b.localToWorld(new T.Vector3(8.1,-b.userData.feature.symbol_size_m[1]/2,11));fp.placeAt(p.x,p.z,b.rotation.y+Math.PI/2);fp.update(0);
      const clipped=fp.eye.distanceTo(s.camera.position)<fp.view-.3;
      fp.exit();const levels=[];for(const distance of [100,600,4000,100]){s.camera.position.copy(b.position).add(new T.Vector3(0,0,distance));updateLandmarkLod(b,s.camera);levels.push([b.userData.lod.detail.visible,b.userData.lod.proxy.visible,b.userData.closeDetail.visible])}
      let meshes=0,triangles=0,finite=true;b.traverse(o=>{if(!o.isMesh||!o.visible||o.parent.name==="cathedral-camera-clip")return;meshes++;const p=o.geometry.attributes.position;triangles+=(o.geometry.index?.count??p.count)/3;for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))finite=false});
      return {clipped,levels,meshes,triangles,finite};
     }""")
     assert geometry['clipped'] and geometry['finite'],geometry
     assert geometry['levels']==[[True,False,True],[True,False,False],[False,True,False],[True,False,True]],geometry
     assert geometry['meshes']<45 and geometry['triangles']<180000,geometry
     print('GEOMETRY',width,geometry,flush=True)
     print('SCREEN',width,flush=True)
     assert not errors,errors
     page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=15)
