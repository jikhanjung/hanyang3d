"""Scene regressions: closed gates, altar stair ascent, indoor attendant, mounted jump and chat layout."""
import os,subprocess,tempfile,time,sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from account_login import LOGIN_JS
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18099','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18099/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18099/1907/');page.wait_for_function('window.seoul1907?.ready||window.seoul1907?.error',timeout=180000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
    page.evaluate('seoul1907.renderer.setAnimationLoop(null)')
    result=page.evaluate('''()=>{const s=seoul1907,fp=s.firstPerson;
     const gate=s.buildings.find(b=>b.userData.feature.id==='daehanmun-1907');
     const world=(b,x,z)=>{const p=b.position.clone().set(x,0,z);return b.localToWorld(p)};
     const door=world(gate,0,0),platform=world(gate,0,3);
     const closed=!!s.walking.collision.hit(door.x,door.z,.35),top=fp.groundAt(platform.x,platform.z);
     const side=world(gate,gate.userData.feature.symbol_size_m[0]/2-.2,3);
     const solid=fp.surfaceAt(side.x,side.z,gate.userData.groundFloor-1)==='blocked';
     const priest=s.walking.stationary.records.find(r=>r.appearance==='priest');
     const eye=priest.position.clone();eye.y+=1.65;
     return {closed,solid,platformHeight:top-gate.userData.groundFloor,priestInside:s.walking.interiorAt(eye)===priest.owner,priestBlocked:!!s.walking.collision.hit(eye.x,eye.z,.35),priestHeight:priest.position.y-priest.owner.userData.groundFloor,keys:new Set(s.walking.stationary.records.map(r=>r.key)).size===s.walking.stationary.records.length};}''')
    print(result,flush=True);assert result['closed'] and result['solid'] and result['platformHeight']>.5 and result['priestInside'] and not result['priestBlocked'] and abs(result['priestHeight']-.16)<.01 and result['keys']
    page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['보행검사','access-test-1907'])
    page.evaluate("seoul1907.walking.shop.state.items.horse_reins=1;seoul1907.firstPerson.enter()")
    page.wait_for_function('seoul1907.firstPerson.active');page.locator('#scene > canvas').focus()
    # Walk from the ground through the approach steps and all three terrace flights.
    setup=page.evaluate('''()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.landmark_kind==='altar'),a=b.userData.access;const p=b.position.clone().set(0,0,a.end+2);b.localToWorld(p);s.firstPerson.placeAt(p.x,p.z,b.rotation.y);return {id:b.userData.feature.id,steps:a.end+2,base:b.userData.groundFloor}}''')
    page.keyboard.down('w')
    page.evaluate('(n)=>{for(let i=0;i<n;i++)seoul1907.firstPerson.update(1/60)}',int(setup['steps']/3*60)+25)
    page.keyboard.up('w')
    result=page.evaluate('''()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.landmark_kind==='altar');const p=s.firstPerson.eye;b.worldToLocal(p);return {z:p.z,height:s.firstPerson.ground-b.userData.groundFloor}}''')
    print('altar ascent',setup,result,flush=True);assert abs(result['z'])<2 and abs(result['height']-3.3)<.01,result
    # Real mouse chording: either order starts walking, releasing either button stops.
    for first,second in [('left','right'),('right','left')]:
     page.mouse.move(640,450);page.mouse.down(button=first)
     before=page.evaluate('seoul1907.firstPerson.eye.toArray()')
     page.evaluate('()=>{for(let i=0;i<10;i++)seoul1907.firstPerson.update(1/60)}')
     assert page.evaluate('seoul1907.firstPerson.eye.toArray()')==before
     page.mouse.down(button=second)
     page.evaluate('()=>{for(let i=0;i<10;i++)seoul1907.firstPerson.update(1/60)}')
     after=page.evaluate('seoul1907.firstPerson.eye.toArray()');assert sum((x-y)**2 for x,y in zip(before,after))>.2
     page.mouse.up(button=first)
     page.evaluate('()=>{for(let i=0;i<10;i++)seoul1907.firstPerson.update(1/60)}')
     assert page.evaluate('seoul1907.firstPerson.eye.toArray()')==after
     page.mouse.up(button=second)
     assert not page.locator('#building-info').is_visible() and not page.locator('#npc-overlay').is_visible()
    print('PASS two mouse buttons in both orders and release without click',flush=True)
    # A stationary jump on the flat top measures height independently of terrain changes.
    peaks=[]
    for mounted in [False,True]:
     page.evaluate('(on)=>seoul1907.firstPerson.setMounted(on)',mounted)
     assert page.evaluate('seoul1907.firstPerson.jump()')
     assert not page.evaluate('seoul1907.firstPerson.jump()')
     heights=[];poses=[]
     for i in range(100):
      sample=page.evaluate('''()=>{const f=seoul1907.firstPerson;f.update(1/60);return {air:f.air,legs:f.horse?.group.children.filter(c=>c.isGroup&&c.position.y===.85).map(c=>[c.rotation.x,c.children.find(k=>k.isGroup).rotation.x])}}''');heights.append(sample['air'])
      if mounted and i in [8,20,35]:poses.append(sample['legs'])
     peaks.append(max(heights));assert heights[-1]==0
     if mounted:assert poses[0]==poses[1]==poses[2] and any(abs(x[1])>1 for x in poses[0]),poses
    print('jump peaks',peaks,flush=True);assert peaks[1]>peaks[0]*1.8
    # Exercise the real chat component without depending on an external multiplayer process.
    page.evaluate('''async()=>{document.getElementById('walk-chat')?.remove();document.getElementById('walk-chat-toggle')?.remove();const {createWalkChat}=await import('/webapp/static/walk_chat.js');window.testChat=createWalkChat({scene:document.getElementById('scene'),firstPerson:seoul1907.firstPerson,send:()=>{}});testChat.connect();seoul1907.showBuilding(seoul1907.buildings.find(b=>b.userData.feature.id==='daehanmun-1907'));}''')
    for size in [(1280,900),(800,600),(390,844)]:
     page.set_viewport_size({'width':size[0],'height':size[1]});page.wait_for_timeout(150)
     if size[0]<600:page.locator('#walk-chat-toggle').click()
     else:page.locator('#scene > canvas').focus();page.keyboard.press('Enter')
     page.wait_for_timeout(100)
     boxes=[page.locator(sel).bounding_box() for sel in ['#building-info','#walk-chat']]
     assert boxes[0]['y']+boxes[0]['height']+8<=boxes[1]['y'],boxes
     page.screenshot(path=f'/tmp/access-chat-{size[0]}.png')
     page.keyboard.press('Escape')
    page.set_viewport_size({'width':1280,'height':900})
    page.wait_for_timeout(150)
    page.evaluate('''async()=>{const {updateLandmarkLod}=await import('/webapp/static/lod1907.js');const s=seoul1907,r=s.walking.stationary.records.find(r=>r.appearance==='priest');s.firstPerson.exit();s.camera.near=.08;s.camera.fov=70;s.camera.updateProjectionMatrix();document.getElementById('building-info').hidden=true;document.getElementById('walk-chat').hidden=true;s.camera.position.copy(r.position).set(5.5,1.77-r.owner.userData.feature.symbol_size_m[1]/2,25.5);r.owner.localToWorld(s.camera.position);s.camera.lookAt(r.position.clone().add({x:0,y:1,z:0}));for(const b of s.buildings)updateLandmarkLod(b,s.camera);s.walking.stationary.update(s.camera);document.getElementById('labels').hidden=true;s.renderer.setAnimationLoop(()=>s.renderer.render(s.scene,s.camera))}''')
    page.wait_for_timeout(150)
    page.screenshot(path='/tmp/cathedral-priest.png')
    page.goto('http://127.0.0.1:18099/');page.wait_for_function('window.terrain3d?.ready',timeout=180000)
    page.set_viewport_size({'width':1280,'height':900})
    page.evaluate('''async()=>{document.getElementById('walk-chat')?.remove();document.getElementById('walk-chat-toggle')?.remove();const {createWalkChat}=await import('/webapp/static/walk_chat.js');const c=createWalkChat({scene:document.getElementById('scene'),firstPerson:terrain3d.firstPerson,send:()=>{}});c.connect();const p=document.getElementById('building-popup');p.hidden=false;p.textContent='1750 건물 정보';}''')
    page.wait_for_timeout(150)
    boxes=[page.locator(sel).bounding_box() for sel in ['#building-popup','#walk-chat']]
    assert boxes[0]['y']+boxes[0]['height']+8<=boxes[1]['y'],boxes
    page.evaluate(LOGIN_JS,['공통이동검사','shared-movement-test'])
    page.evaluate('terrain3d.renderer.setAnimationLoop(null);terrain3d.shop.state.items.horse_reins=1;terrain3d.firstPerson.enter()')
    page.wait_for_function('terrain3d.firstPerson.active')
    page.evaluate('''()=>{const s=terrain3d,f=s.firstPerson,p=f.eye;document.getElementById('building-popup').hidden=true;document.getElementById('walk-chat').hidden=true;for(let i=0;i<100;i++){const x=p.x+(i%10)*3,z=p.z+Math.floor(i/10)*3;if(!s.collision.hit(x,z,2)&&!s.pedestrians.near(x,z,2)&&f.placeAt(x,z,0))break;}f.clearInput();}''')
    # Real mouse chording: either order starts walking, releasing either button stops.
    for first,second in [('left','right'),('right','left')]:
     page.mouse.move(640,450);page.mouse.down(button=first)
     before=page.evaluate('terrain3d.firstPerson.eye.toArray()')
     page.evaluate('()=>{for(let i=0;i<10;i++)terrain3d.firstPerson.update(1/60)}')
     assert page.evaluate('terrain3d.firstPerson.eye.toArray()')==before
     page.mouse.down(button=second)
     page.evaluate('()=>{for(let i=0;i<10;i++)terrain3d.firstPerson.update(1/60)}')
     after=page.evaluate('terrain3d.firstPerson.eye.toArray()');assert sum((x-y)**2 for x,y in zip(before,after))>.2
     page.mouse.up(button=first)
     page.evaluate('()=>{for(let i=0;i<10;i++)terrain3d.firstPerson.update(1/60)}')
     assert page.evaluate('terrain3d.firstPerson.eye.toArray()')==after
     page.mouse.up(button=second)
     assert not page.locator('#building-popup').is_visible() and not page.locator('#npc-overlay').is_visible()
    print('PASS two mouse buttons in both orders and release without click',flush=True)
    peaks1750=page.evaluate('''()=>{const f=terrain3d.firstPerson,result=[];for(const on of [false,true]){f.setMounted(on);f.jump();let peak=0;for(let i=0;i<110;i++){f.update(1/60);peak=Math.max(peak,f.air)}result.push(peak)}return result}''')
    assert peaks1750[1]>peaks1750[0]*1.8,peaks1750
    assert not errors,errors;print('PASS access, attendants, jump and mouse controls both eras, chat both eras',flush=True);browser.close()
  finally:server.terminate();server.wait(timeout=10)
