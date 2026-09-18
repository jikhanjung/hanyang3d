"""Isolated DB and multiplayer: both-era controller, 1907 NPCs, trades and touch movement."""
import os, subprocess, tempfile, time, sys, json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2]
os.chdir(ROOT)
with tempfile.TemporaryDirectory(prefix='hanyang-walk1907-') as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/content.sqlite3','HANYANG_CONTENT_SOURCE':'files','HANYANG_MULTIPLAYER_URL':'http://127.0.0.1:25687','HANYANG_WALK_TICKET_SECRET':'local-browser-check-not-a-production-secret','WALK_TICKET_SECRET':'local-browser-check-not-a-production-secret','WALK_ORIGINS':'http://127.0.0.1:18087','WALK_PORT':'25687'}
 for command in [['migrate','--noinput'],['import_content']]:subprocess.run([sys.executable,'manage.py',*command],env=env,check=True,stdout=subprocess.DEVNULL)
 log=open(tmp+'/server.log','w')
 servers=[subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18087','--noreload'],env=env,stdout=log,stderr=log),subprocess.Popen(['node','multiplayer/server.js'],env=env,stdout=log,stderr=log)]
 try:
  for port,path in [(18087,'/1907/'),(25687,'/healthz')]:
   for _ in range(100):
    try:urlopen(f'http://127.0.0.1:{port}{path}',timeout=1);break
    except OSError:time.sleep(.1)
   else:raise RuntimeError(Path(tmp+'/server.log').read_text())
  subprocess.run(['node','multiplayer/check_connections.js'],env={**env,'WALK_URL':'http://127.0.0.1:25687'},check=True,stdout=subprocess.DEVNULL)
  print('PASS: multiplayer era separation, NPC synchronization and chat',flush=True)
  with sync_playwright() as p:
   browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
   errors=[]
   def load(mobile=False):
    ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18087/1907/',wait_until='domcontentloaded');page.wait_for_function('window.seoul1907?.ready',timeout=120000)
    page.evaluate('window.draw1907=seoul1907.renderer.render.bind(seoul1907.renderer);seoul1907.renderer.render=()=>{}')
    return ctx,page
   ctx,page=load();print('1907 scene ready',flush=True)
   print(page.evaluate("seoul1907.pedestrians.routes.map(r=>({id:r.id,blocked:r.points.flatMap((p,i)=>{if(i%10||!seoul1907.walking.collision.hit(p.x,p.z,.4))return [];const b=seoul1907.buildings.reduce((a,b)=>Math.hypot(b.position.x-p.x,b.position.z-p.z)<Math.hypot(a.position.x-p.x,a.position.z-p.z)?b:a);return [{i,total:r.points.length,x:p.x,z:p.z,near:b.userData.feature.id}]})}))"),flush=True)
   if '--audit-only' in sys.argv:
    browser.close();sys.exit(0)
   page.locator('#menu').click();page.locator('#walk-together').click();page.wait_for_selector('#account-overlay:not([hidden])')
   page.fill('[name=name]','경성검사');page.fill('[name=password]','check-password-1907');page.locator('button[value=register]').click()
   page.wait_for_function('seoul1907.firstPerson.active && seoul1907.walking.together.connected',timeout=30000)
   assert page.evaluate('seoul1907.pedestrians.walkers.length')==128
   assert page.evaluate('seoul1907.walking.stationary.records.length')==18
   assert page.evaluate('seoul1907.walking.stationary.records.filter(r=>r.role==="guard").length')==6
   assert page.evaluate('seoul1907.firstPerson.walker.group.userData.era')==1907
   page.evaluate('seoul1907.walking.together.stop();seoul1907.renderer.setAnimationLoop(null);seoul1907.pedestrians.group.visible=false')
   pose=page.evaluate('''()=>{const s=seoul1907,fp=s.firstPerson,r=s.pedestrians.routes[0];const i=r.points.findIndex((p,i)=>i>100&&i<r.points.length-20&&!s.walking.collision.hit(p.x,p.z,.5)&&!s.walking.collision.hit(r.points[i+15].x,r.points[i+15].z,.5));const a=r.points[i],b=r.points[i+15];fp.placeAt(a.x,a.z,Math.atan2(-(b.x-a.x),-(b.z-a.z)));return fp.eye.toArray()}''')
   page.evaluate('seoul1907.renderer.domElement.focus()');page.keyboard.down('KeyW');page.evaluate('for(let i=0;i<30;i++)seoul1907.firstPerson.update(1/30)');page.keyboard.up('KeyW')
   moved=page.evaluate('p=>seoul1907.firstPerson.eye.distanceTo({x:p[0],y:p[1],z:p[2]})',pose);assert moved>2.5,moved
   jump=page.evaluate('''()=>{const fp=seoul1907.firstPerson;fp.jump();let top=0;for(let i=0;i<60;i++){fp.update(1/30);top=Math.max(top,fp.air)}return {top,air:fp.air,eye:fp.eye.y-fp.ground}}''');assert jump['top']>.8 and jump['air']==0 and abs(jump['eye']-1.65)<.001,jump
   # Gate opening is clear; piers and city-wall segments block walking.
   assert page.evaluate('''()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='souimun-1907'),c=s.walking.collision;return !c.hit(b.position.x,b.position.z,.35)&&c.obstacles.some(o=>o.hw>.5&&c.hit(o.x,o.z,.35))}''')
   # Talk by actual screen-space click, then trade using server-authoritative inventory.
   page.evaluate('''()=>{const s=seoul1907,r=s.walking.stationary.records.find(r=>r.role==='merchant'),v=r.position.clone();s.firstPerson.exit();s.camera.position.copy(v).add({x:0,y:2.5,z:6});s.camera.lookAt(v.x,v.y+1,v.z);s.walking.stationary.update(s.camera);s.scene.updateMatrixWorld(true);s.camera.updateMatrixWorld(true);window.merchant=r;draw1907(s.scene,s.camera)}''')
   point=page.evaluate('''()=>{const s=seoul1907,p=merchant.position.clone();p.y+=1;p.project(s.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}}''');page.mouse.click(point['x'],point['y']);assert page.locator('#npc-overlay').is_visible()
   page.evaluate('seoul1907.walking.dialogue.finishTyping()');page.locator('.npc-options button').first.click();assert page.locator('#shop-window').is_visible()
   before=page.evaluate('seoul1907.walking.shop.state.money');page.locator('#shop-buy .shop-slot').first.click() if page.locator('#shop-buy .shop-slot').count() else page.locator('.shop-panes .shop-slot').first.click()
   page.wait_for_function('v=>seoul1907.walking.shop.state.money<v',arg=before)
   page.screenshot(path='/tmp/1907-merchant-dialog.png');page.evaluate('seoul1907.walking.shop.close();seoul1907.walking.dialogue.end()')
   guard=page.evaluate('''()=>{const s=seoul1907,r=s.walking.stationary.records.find(r=>r.role==='guard');s.camera.position.copy(r.position).add({x:0,y:2,z:6});s.walking.dialogue.start(s.walking.npcFor(r));s.walking.dialogue.finishTyping();return r.key}''');assert page.locator('.npc-line').inner_text()
   page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()');assert page.locator('.npc-sources a').count()==2
   print('PASS: 1907 keyboard, jump, ground, gate collision, merchant trade, guard dialogue',flush=True)
   ctx.close()
   ctx,page=load(True);page.locator('#menu').tap();page.locator('#walk-together').tap();page.wait_for_selector('#account-overlay:not([hidden])');page.fill('[name=name]','모바일경성');page.fill('[name=password]','check-password-1907');page.locator('button[value=register]').tap();page.wait_for_function('seoul1907.firstPerson.active&&seoul1907.walking.together.connected',timeout=30000)
   page.evaluate('seoul1907.walking.together.stop();seoul1907.renderer.setAnimationLoop(null);seoul1907.pedestrians.group.visible=false')
   assert page.locator('#walk-joystick').is_visible();assert page.locator('#first-person-map').is_visible()
   box=page.locator('#walk-joystick').bounding_box();cdp=ctx.new_cdp_session(page);point={'x':box['x']+box['width']/2,'y':box['y']+15,'id':1}
   before=page.evaluate('seoul1907.firstPerson.eye.toArray()');cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});page.evaluate('for(let i=0;i<30;i++)seoul1907.firstPerson.update(1/30)');after=page.evaluate('seoul1907.firstPerson.eye.toArray()');assert sum((a-b)**2 for a,b in zip(before,after))>1
   look={'x':270,'y':330,'id':2};cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point,look]});yaw=page.evaluate('seoul1907.firstPerson.yaw');look['x']=305;cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[point,look]});assert abs(page.evaluate('seoul1907.firstPerson.yaw')-yaw)>.05;cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
   assert page.locator('#first-person-map').bounding_box()['y']+page.locator('#first-person-map').bounding_box()['height']<page.locator('#walk-jump').bounding_box()['y']
   # Touch-only item use: buy reins, then mount/dismount from explicit buttons.
   page.evaluate("seoul1907.walking.shop.open({trade:'말 장수'})")
   page.locator('.shop-goods .shop-slot').first.tap()
   page.wait_for_timeout(1500)
   print('Mobile purchase:',page.evaluate("({state:seoul1907.walking.shop.state,message:document.querySelector('.shop-message').textContent})"),flush=True)
   page.screenshot(path='/tmp/1907-mobile-purchase.png')
   page.wait_for_function("Object.values(seoul1907.walking.shop.state.items).some(n=>n>0)")
   page.evaluate('seoul1907.walking.shop.close();seoul1907.walking.shop.openPack()')
   use=page.locator('#pack-window .pack-use').first
   assert use.is_visible() and use.bounding_box()['height']>=44
   use.tap();assert page.evaluate('seoul1907.firstPerson.mounted')
   page.locator('#pack-window .pack-use').first.tap();assert not page.evaluate('seoul1907.firstPerson.mounted')
   page.screenshot(path='/tmp/1907-mobile-pack.png')
   page.evaluate('seoul1907.walking.shop.closePack()')
   page.evaluate('draw1907(seoul1907.scene,seoul1907.camera)');page.screenshot(path='/tmp/1907-mobile-walk.png')
   assert not errors,errors
   ctx.close();browser.close();print('PASS: mobile joystick + simultaneous look, HUD layout; no JS errors',flush=True)
  subprocess.run([sys.executable,'scripts/terrain/check_first_person_controls_browser.py','--url','http://127.0.0.1:18087/'],env=env,check=True)
 finally:
  for server in servers:server.terminate()
  for server in servers:server.wait(timeout=15)
  log.close()
