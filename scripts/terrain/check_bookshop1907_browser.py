"""Bookshop entry, shelf collision, NPC route, corner-only offer and real purchase in a disposable DB."""
import os,subprocess,tempfile,time,sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from account_login import LOGIN_JS
os.chdir(Path(__file__).resolve().parents[2])
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 for args in [('migrate','--noinput'),('seed_books',)]:subprocess.run([sys.executable,'manage.py',*args],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18108','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18108/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for width in [1280,390]:
     page=browser.new_page(viewport={'width':width,'height':900},has_touch=width<600);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18108/1907/');page.wait_for_function('window.seoul1907?.ready||window.seoul1907?.error',timeout=180000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['책방검사'+str(width),'bookshop-test'])
     page.evaluate("seoul1907.renderer.setAnimationLoop(null);seoul1907.firstPerson.enter();window.book=seoul1907.buildings.find(b=>b.userData.feature.id==='hoedong-seogwan-1907');window.keeper=seoul1907.walking.stationary.records.find(r=>r.building==='hoedong-seogwan-1907')")
     result=page.evaluate("""async()=>{const T=await import('three'),s=seoul1907,b=book,h=b.userData.feature.symbol_size_m[1],fp=s.firstPerson;window.bookPoint=(x,z)=>b.localToWorld(new T.Vector3(x,-h/2,z));const start=bookPoint(0,b.userData.access.end+1),goal=bookPoint(0,0);fp.placeAt(start.x,start.z,Math.atan2(-(goal.x-start.x),-(goal.z-start.z)));fp.clearInput();return {books:b.userData.bookCount,route:b.userData.booksellerRoute.every(([x,z])=>{const p=bookPoint(x,z);return !s.walking.collision.hit(p.x,p.z,.35)}),goal:[goal.x,goal.z]}}""")
     assert result['books']>300 and result['route'],result
     if width<600:
      box=page.locator('#walk-joystick').bounding_box();cdp=page.context.new_cdp_session(page);cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']*.18,'id':1}]})
     else:page.keyboard.down('w')
     left=page.evaluate("""goal=>{const fp=seoul1907.firstPerson;let left;for(let i=0;i<1200;i++){fp.update(1/30);left=Math.hypot(fp.eye.x-goal[0],fp.eye.z-goal[1]);if(left<.3)break}return left}""",result['goal'])
     if width<600:cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
     else:page.keyboard.up('w')
     assert left<.35,left
     checked=page.evaluate("""()=>{const s=seoul1907,fp=s.firstPerson,r=keeper,b=book;const publicOffer=!!s.walking.npcFor(r).nodes.private_books;const start=r.position.clone();let steps=0;while((r.routeIndex!==4||r.pause<1)&&steps++<1600)s.walking.stationary.update(s.camera,.1);const wandered=start.distanceTo(r.position)>2;const q=bookPoint(-4.1,-3.1);fp.placeAt(q.x,q.z);const offered=s.walking.npcFor(r);s.walking.dialogue.start(offered);const pause=r.position.clone();for(let i=0;i<20;i++)s.walking.stationary.update(s.camera,.1);return {publicOffer,wandered,privateOffer:!!offered.nodes.private_books,paused:pause.distanceTo(r.position)===0,steps,inside:s.walking.interiorAt(fp.eye)===b}}""")
     assert not checked['publicOffer'] and all(checked[k] for k in ['wandered','privateOffer','paused','inside']),checked
     page.evaluate('seoul1907.walking.dialogue.finishTyping()');page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()');page.locator('.npc-options button').first.click()
     before=page.evaluate('seoul1907.walking.shop.state.money');page.locator('.shop-goods [data-item="book_chunhyang"]').click();page.wait_for_function("seoul1907.walking.shop.state.items.book_chunhyang===1")
     assert page.evaluate('seoul1907.walking.shop.state.money')==before-18
     page.evaluate("""async()=>{const s=seoul1907,{updateLandmarkLod}=await import('/webapp/static/lod1907.js');s.walking.shop.close();const a=bookPoint(0,2),b=bookPoint(0,-2);s.camera.position.set(a.x,a.y+1.7,a.z);s.camera.lookAt(b.x,b.y+1.4,b.z);s.camera.updateMatrixWorld(true);for(const model of s.buildings)updateLandmarkLod(model,s.camera);s.renderer.render(s.scene,s.camera)}""")
     page.screenshot(path=f'/tmp/bookshop-interior-{width}.png');assert not errors,errors
     print('PASS BOOKSHOP',width,result,checked,flush=True);page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
