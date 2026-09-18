"""Isolated server: 1907 horse placement, touch dialogue, purchase and pack use."""
import json, os, subprocess, sys, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from account_login import LOGIN_JS

ROOT=Path(__file__).resolve().parents[2]
os.chdir(ROOT)
with tempfile.TemporaryDirectory(prefix='horse1907-') as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/test.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18092','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18092/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for mobile in [False,True]:
     context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile)
     page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18092/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=120000)
     click=lambda locator: locator.tap() if mobile else locator.click()
     click(page.locator('#menu'));click(page.locator('#horse-focus'))
     page.evaluate('seoul1907.renderer.setAnimationLoop(null);for(let i=0;i<100;i++)seoul1907.controls.update();seoul1907.scene.updateMatrixWorld(true);seoul1907.renderer.render(seoul1907.scene,seoul1907.camera)')
     result=page.evaluate('''async()=>{const s=seoul1907,h=s.walking.horseDealer,T=await import('/webapp/static/vendor/three/three.module.js');const box=new T.Box3().setFromObject(h),overlap=s.buildings.filter(b=>box.intersectsBox(new T.Box3().setFromObject(b))).map(b=>b.userData.feature.id);const pos=h.position.toArray();document.getElementById('opacity').value=0;document.getElementById('opacity').dispatchEvent(new Event('input'));document.getElementById('water3d').checked=false;document.getElementById('water3d').dispatchEvent(new Event('change'));s.walking.update(0);const visibleWithoutWater=h.visible,stable=JSON.stringify(pos)===JSON.stringify(h.position.toArray());document.getElementById('people3d').checked=false;document.getElementById('people3d').dispatchEvent(new Event('change'));const hidden=!h.visible;document.getElementById('people3d').checked=true;document.getElementById('people3d').dispatchEvent(new Event('change'));const tram=s.trams;let clearance=Infinity;for(let d=0;d<tram.length;d+=5){const p=tram.sample(d);clearance=Math.min(clearance,Math.hypot(p.x-h.position.x,p.z-h.position.z))}return {overlap,visibleWithoutWater,stable,hidden,clearance,horses:h.children.filter(c=>c.name==='horse').length,costume:h.userData.person.children[0].userData.costume}}''')
     assert result['overlap']==[] and result['clearance']>15,result
     assert result['stable'] and result['visibleWithoutWater'] and result['hidden'],result
     assert result['horses']==4 and result['costume']=='merchant-hanbok',result
     page.evaluate('document.getElementById("labels").hidden=true;seoul1907.renderer.render(seoul1907.scene,seoul1907.camera)')
     page.screenshot(path=f'/tmp/horse1907-{mobile}.png')
     point=page.evaluate('''()=>{const s=seoul1907,p=s.walking.horseDealer.position.clone();p.y+=1;p.project(s.camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}}''')
     before=page.evaluate('seoul1907.camera.position.toArray()')
     if mobile:page.touchscreen.tap(point['x'],point['y'])
     else:page.mouse.click(point['x'],point['y'])
     assert page.locator('#npc-overlay').is_visible()
     page.evaluate('seoul1907.walking.dialogue.finishTyping()')
     assert '1744' not in page.locator('#npc-overlay').inner_text()
     assert before==page.evaluate('seoul1907.camera.position.toArray()')
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['말검사'+str(mobile),'test-horse-1907'])
     click(page.locator('.npc-options button').first)
     assert page.locator('#shop-window').is_visible()
     money=page.evaluate('seoul1907.walking.shop.state.money')
     click(page.locator('.shop-goods .shop-slot[data-item=horse_reins]'))
     page.wait_for_function('seoul1907.walking.shop.state.items.horse_reins===1&&!seoul1907.walking.shop.busy')
     assert page.evaluate('seoul1907.walking.shop.state.money')==money-900
     page.evaluate('seoul1907.walking.shop.close();seoul1907.walking.dialogue.end();seoul1907.firstPerson.enter();seoul1907.walking.shop.openPack()')
     assert page.evaluate('seoul1907.firstPerson.active')
     click(page.locator('.pack-use[data-item=horse_reins]'))
     assert page.evaluate('seoul1907.firstPerson.mounted')
     click(page.locator('.pack-use[data-item=horse_reins]'))
     assert not page.evaluate('seoul1907.firstPerson.mounted')
     stored=page.evaluate("async()=>await (await fetch('/api/player/')).json()")
     assert stored['items']['horse_reins']==1
     assert not errors,errors
     print('PASS',mobile,json.dumps(result),flush=True);context.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=15)
