"""Real scene checks for a submerged channel bed, bridge support and sourced attendants."""
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
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18098','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18098/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18098/1907/');page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=180000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
    page.evaluate('seoul1907.renderer.setAnimationLoop(null)')
    page.locator('#scene > canvas').focus();page.keyboard.press('m');assert page.locator('#large-map').is_visible()
    box=page.locator('#large-map').bounding_box();assert box['width']>1000 and box['height']>700
    page.screenshot(path='/tmp/large-map-1907.png')
    page.keyboard.press('Tab');assert page.locator('#large-map button').evaluate('(e)=>e===document.activeElement')
    page.keyboard.press('Escape');assert not page.locator('#large-map').is_visible()
    page.evaluate("()=>{const input=document.createElement('input');input.id='map-typing-test';document.body.append(input);input.focus()}")
    page.keyboard.press('m');assert not page.locator('#large-map').is_visible()
    page.evaluate("document.getElementById('map-typing-test').remove()")
    result=page.evaluate('''async()=>{const T=await import('/webapp/static/vendor/three/three.module.js'),s=seoul1907,ray=new T.Raycaster(),samples=[];s.scene.updateMatrixWorld(true);for(let i=10;i<s.channel.path.length-10;i+=13){const p=s.channel.path[i];if(s.infrastructure.bridges.children.some(b=>b.position.distanceTo(new T.Vector3(p.x,b.position.y,p.z))<40))continue;ray.set(new T.Vector3(p.x,1000,p.z),new T.Vector3(0,-1,0));const water=ray.intersectObject(s.infrastructure.water.getObjectByName('water-surface'))[0]?.point.y,terrain=ray.intersectObject(s.terrain)[0]?.point.y,feet=s.firstPerson.groundAt(p.x,p.z);if(water!==undefined)samples.push({water,terrain,feet,depth:water-feet,error:Math.abs(terrain+.025-feet)});}return samples}''')
    assert len(result)>10 and all(r['depth']>1 and r['error']<.03 for r in result),result
    bridges=page.evaluate('''()=>{const s=seoul1907;return s.infrastructure.bridges.children.map(b=>({deck:s.firstPerson.groundAt(b.position.x,b.position.z),bed:s.groundAt(b.position.x,b.position.z),under:s.firstPerson.groundAt(b.position.x,b.position.z,s.groundAt(b.position.x,b.position.z))}))}''')
    assert all(r['deck']>r['bed']+1 and abs(r['under']-r['bed']-.025)<.03 for r in bridges),bridges
    print('PASS channel samples',len(result),'bridges',len(bridges),flush=True)
    attendants=page.evaluate("seoul1907.walking.stationary.records.filter(r=>r.appearance==='caretaker').map(r=>({id:r.building,position:r.position.toArray()}))");assert len(attendants)==13,attendants
    blocked=page.evaluate("seoul1907.walking.stationary.records.filter(r=>r.appearance==='caretaker'&&seoul1907.walking.collision.hit(r.position.x,r.position.z,.35)).map(r=>r.building)");assert not blocked,blocked
    page.evaluate("()=>{const s=seoul1907,r=s.walking.stationary.records.find(r=>r.building==='dansungsa-1907');window.keeper=r;s.walking.dialogue.start(s.walking.npcFor(r));s.walking.dialogue.finishTyping()}")
    assert page.locator('.npc-plate strong').inner_text()=='단성사 문지기'
    page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
    for i in range(1,5):
     assert page.locator('.npc-chapter').inner_text().endswith(f'{i} / 4')
     assert page.locator('.npc-sources a').count()==2
     if i<4:page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
    print('PASS attendants and four-part doorkeeper dialogue',flush=True)
    page.evaluate('seoul1907.walking.dialogue.end()')
    page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['물길검사','channel-test-1907'])
    page.evaluate("()=>{const s=seoul1907.walking.shop,n=JSON.parse(document.getElementById('npcs').textContent);s.state.items[Object.keys(n.items).find(k=>n.items[k].use==='mount')]=1;s.openPack()}")
    assert not page.locator('.pack-use').first.is_visible()
    page.evaluate('seoul1907.walking.shop.closePack?.()')
    page.evaluate('seoul1907.firstPerson.enter()');page.wait_for_function('seoul1907.firstPerson.active')
    page.locator('#scene > canvas').focus();page.keyboard.press('m');assert page.locator('#large-map').is_visible()
    marker=page.locator('#large-map canvas');assert abs(float(marker.get_attribute('data-world-x'))-page.evaluate('seoul1907.firstPerson.eye.x'))<.001
    page.keyboard.press('m');assert not page.locator('#large-map').is_visible() and page.evaluate('seoul1907.firstPerson.active')
    page.evaluate('seoul1907.walking.shop.openPack()')
    print('PASS M map overview and walking marker',flush=True)
    page.set_viewport_size({'width':390,'height':844});assert page.locator('.pack-use').first.is_visible()
    print('PASS mobile-only bag use button',flush=True)
    assert not errors,errors
    page.goto('http://127.0.0.1:18098/');page.wait_for_function('window.terrain3d?.ready',timeout=180000)
    page.keyboard.press('m');assert page.locator('#large-map').is_visible();page.keyboard.press('Escape');assert not page.locator('#large-map').is_visible()
    print('PASS 1750 M map',flush=True);b.close()
  finally:server.terminate();server.wait(timeout=15)
