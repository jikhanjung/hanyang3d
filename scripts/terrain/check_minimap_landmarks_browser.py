"""Both eras: north-up minimap landmarks follow world position at desktop/mobile sizes."""
import os,subprocess,tempfile,time,sys,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from account_login import LOGIN_JS
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18101','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18101/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for era,path,key,landmark,span in [(1750,'/','terrain3d','donhwamun',1800),(1907,'/1907/','seoul1907','bosingak-1907',1200)]:
     page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18101'+path);page.wait_for_function(f'window.{key}?.ready',timeout=180000)
     page.evaluate(f'{key}.renderer.setAnimationLoop(null)')
     if era==1750:
      page.locator('#map-options-toggle').click()
      for width in [1280,390]:
       page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100)
       rows=page.locator('#map-options .layer-group label').evaluate_all('(els)=>els.map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,x:r.x}})')
       assert len(rows)==14 and all(rows[i]['bottom']<=rows[i+1]['top'] for i in range(len(rows)-1)),rows
      page.locator('#map-options-toggle').click();page.set_viewport_size({'width':1280,'height':900})
      print('PASS 1750 settings: 14 separate checkbox rows desktop/mobile',flush=True)
     page.evaluate(LOGIN_JS.replace('terrain3d.shop',key+('.walking.shop' if era==1907 else '.shop')),['미니맵검사'+str(era),'minimap-test-password'])
     page.evaluate(f'{key}.firstPerson.enter()');page.wait_for_function(f'{key}.firstPerson.active')
     courts=page.evaluate('''key=>{const s=window[key],bs=key==='terrain3d'?s.buildings.children:s.buildings,col=key==='terrain3d'?s.collision:s.walking.collision;return bs.filter(b=>['ijo','hojo','yejo','byeongjo','hyeongjo','gongjo','uijeongbu'].includes(b.userData.feature.id)||b.userData.feature.landmark_kind==='government_compound').map(b=>{
      const d=b.userData.feature.symbol_size_m[2],w=b.userData.feature.symbol_size_m[0],front=key==='terrain3d'?d/2-5:d/2-2.5,points=[];let previous=null;
      b.updateMatrixWorld(true);for(let z=front+5;z>=front-9;z-=.25){const p=b.localToWorld(b.position.clone().set(0,0,z)),ground=s.firstPerson.groundAt(p.x,p.z,previous);if(col.hit(p.x,p.z,.35)||ground===null)points.push({z,blocked:!!col.hit(p.x,p.z,.35),ground});previous=ground}
      const wall=b.localToWorld(b.position.clone().set(w/2-.3,0,0));return {id:b.userData.feature.id,blocked:points,wall:!!col.hit(wall.x,wall.z,.35)}
     })}''',key)
     assert courts and all(not c['blocked'] and c['wall'] for c in courts),courts
     print('PASS',era,len(courts),'office gates passable and walls solid',flush=True)
     point=page.evaluate(r"""([key,id,span])=>{const s=window[key],b=(key==='terrain3d'?s.buildings.children:s.buildings).find(b=>b.userData.feature.id===id);s.firstPerson.placeAt(b.position.x+span*.15,b.position.z+span*.1,0);return {name:b.userData.feature.name.replace(/^1907년\s*/, '').split(' · ')[0],x:b.position.x,z:b.position.z}}""",[key,landmark,span])
     for width,height in [(1280,900),(390,844)]:
      page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
      page.evaluate(f'()=>{{const f={key}.firstPerson,p=f.eye;f.placeAt(p.x,p.z,0)}}')
      marks=json.loads(page.locator('#walking-minimap').get_attribute('data-landmarks'));assert marks
      target=next(m for m in marks if m['name']==point['name']);assert abs(target['x']-84)<.001 and abs(target['y']-96)<.001,target
      labels=[m['label'] for m in marks if m.get('label')];assert labels,marks
      for i,a in enumerate(labels):
       assert a['x']>=3 and a['y']>=3 and a['x']+a['w']<=237 and a['y']+a['h']<=237,a
       for b in labels[i+1:]:assert a['x']>=b['x']+b['w'] or a['x']+a['w']<=b['x'] or a['y']>=b['y']+b['h'] or a['y']+a['h']<=b['y'],(a,b)
      page.locator('#first-person-map').screenshot(path=f'/tmp/minimap-{era}-{width}.png')
      page.evaluate(f'()=>{{const f={key}.firstPerson,p=f.eye;f.placeAt(p.x,p.z,Math.PI/2)}}')
      turned=json.loads(page.locator('#walking-minimap').get_attribute('data-landmarks'));assert turned==marks
      print('PASS',era,width,'visible',len(marks),'labels',len(labels),'position and north-up',flush=True)
     page.evaluate(f'()=>{{const f={key}.firstPerson,p=f.eye;f.placeAt(p.x+100,p.z,0)}}')
     moved=json.loads(page.locator('#walking-minimap').get_attribute('data-landmarks'));target=next(m for m in moved if m['name']==point['name']);assert abs(target['x']-(84-100*240/span))<.001,target
     for width in [1920,1280,1000,601]:
      page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(100)
      boxes=page.evaluate('''()=>{document.getElementById('walk-chat').hidden=false;return ['walk-chat','action-bar','first-person-map'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,right:r.right,bottom:r.bottom}})}''')
      assert max(b['bottom'] for b in boxes)-min(b['bottom'] for b in boxes)<1,boxes
      assert boxes[0]['right']+8<=boxes[1]['x'] and boxes[1]['right']+8<=boxes[2]['x'],boxes
     print('PASS',era,'chat/action bar/minimap bottom alignment and no overlap, 601–1920px',flush=True)
     page.evaluate(f'{key}.firstPerson.exit()');assert not page.locator('#first-person-map').is_visible()
     if era==1907:
      palace=page.evaluate('''()=>{const s=seoul1907,col=s.walking.collision,wall=s.infrastructure.palaceWalls[0],gate=s.buildings.find(b=>b.userData.feature.id==='gwanghwamun-1907'),keeper=s.walking.stationary.records.find(r=>r.id==='gyeongbok-caretaker-1907');
       const pond=s.buildings.find(b=>b.userData.feature.landmark_kind==='gyeonghoeru'),a=pond.userData.access,points=[];let ground=null;
       pond.updateMatrixWorld(true);for(let x=a.end+2;x>=pond.userData.anchorOffset[0];x-=.15){const p=pond.localToWorld(pond.position.clone().set(x,0,a.offset[1]));const y=s.firstPerson.groundAt(p.x,p.z,ground);if(y===null||col.hit(p.x,p.z,.35))points.push({x,y,blocked:!!col.hit(p.x,p.z,.35)});ground=y}
       const solid=wall.segments.filter(seg=>!!col.hit(seg.x,seg.z,.35)).length;
       s.walking.dialogue.start(s.walking.npcFor(keeper));s.walking.dialogue.finishTyping();const dialogue=s.walking.dialogue.current.name;s.walking.dialogue.end();
       return {wallCount:wall.segments.length,solid,gateOpen:!col.hit(gate.position.x,gate.position.z,.35),keeperClear:!col.hit(keeper.position.x,keeper.position.z,.35),dialogue,pondBlocked:points};}''')
      assert palace['wallCount']>100 and palace['solid']==palace['wallCount'] and palace['gateOpen'] and palace['keeperClear'],palace
      assert not palace['pondBlocked'] and palace['dialogue']=='경복궁 관리인',palace
      print('PASS palace walls/gate/caretaker and continuous pond stairs–bridge–pavilion route',flush=True)
      bubble=page.evaluate('''()=>{const s=seoul1907,w=s.walking.pedestrians.walkers[0],d=s.walking.dialogue;s.camera.position.copy(w.position).add({x:0,y:1.6,z:4});s.camera.near=.08;s.camera.updateProjectionMatrix();s.camera.lookAt(w.position.clone().add({x:0,y:1,z:0}));s.camera.updateMatrixWorld(true);const r=s.renderer.domElement.getBoundingClientRect(),p=w.position.clone().add({x:0,y:1,z:0}).project(s.camera);d.pick({clientX:r.left+(p.x+1)*r.width/2,clientY:r.top+(1-p.y)*r.height/2,pointerType:'mouse'});return {bubble:!d.bubble.hidden,mode:d.bubbleNpc?.mode,overlay:!d.overlay.hidden,text:d.bubble.textContent}}''')
      assert bubble['bubble'] and bubble['mode']=='bubble' and not bubble['overlay'] and bubble['text'],bubble
      print('PASS ordinary pedestrian click opens speech bubble only',flush=True)
      result=page.evaluate('''()=>{const s=seoul1907,records=s.walking.stationary.records.filter(r=>r.pose==='seated_prayer');
       const rows=records.map(r=>{const b=r.owner,g=r.person.group,seat=b.userData.seats.find(p=>p.id===r.seat_id);b.updateMatrixWorld(true);g.updateMatrixWorld(true);
        const local=b.worldToLocal(g.position.clone()),shoes=[];g.traverse(m=>{if(m.name==='prayer-shoe')shoes.push(m.getWorldPosition(g.position.clone()).y-.06)});
        const before=g.getObjectByName('prayer-knee').rotation.x;r.person.update(10,true);
        return {seat:r.seat_id,x:local.x,z:local.z,expectedX:seat.x,expectedZ:seat.z,height:g.position.y-b.userData.groundFloor,shoes:shoes.map(y=>y-b.userData.groundFloor),yaw:g.rotation.y-b.rotation.y,held:before===g.getObjectByName('prayer-knee').rotation.x,hands:g.children.filter(c=>c.name==='prayer-hand').length};
       });return rows}''')
      assert len(result)==3 and len({r['seat'] for r in result})==3,result
      for r in result:
       assert abs(r['x']-r['expectedX'])<.0001 and abs(r['z']-r['expectedZ'])<.0001 and abs(r['x'])>1.5,r
       assert abs(r['height']+.17)<.0001 and all(abs(y-.12)<.0001 for y in r['shoes']),r
       assert abs(r['yaw']-3.14159265)<.0001 and r['held'] and r['hands']==2,r
      print('PASS three seated worshippers: pew alignment, feet on floor, altar facing, held pose',flush=True)
      page.set_viewport_size({'width':1280,'height':900})
      page.evaluate('''async()=>{const {updateLandmarkLod}=await import('/webapp/static/lod1907.js');const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='myeongdong-cathedral-1907'),h=b.userData.feature.symbol_size_m[1];
       const world=(x,y,z)=>b.localToWorld(b.position.clone().set(x,y-h/2,z));s.camera.position.copy(world(0,1.8,15));s.camera.near=.08;s.camera.fov=70;s.camera.updateProjectionMatrix();s.camera.lookAt(world(-2.8,1,16.9));s.walking.stationary.update(s.camera);document.getElementById('walk-chat').hidden=true;
       for(const model of s.buildings)updateLandmarkLod(model,s.camera);document.getElementById('labels').hidden=true;s.renderer.setAnimationLoop(()=>s.renderer.render(s.scene,s.camera))}''')
      page.wait_for_timeout(500);page.screenshot(path='/tmp/cathedral-worshippers.png')
     assert not errors,errors;page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
