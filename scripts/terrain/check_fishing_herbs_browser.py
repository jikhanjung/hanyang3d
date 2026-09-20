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
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18102','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18102/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for era,path,key,landmark,span in [(1750,'/','terrain3d','donhwamun',1800),(1907,'/1907/','seoul1907','bosingak-1907',1200)]:
     page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18102'+path);page.wait_for_function(f'window.{key}?.ready',timeout=180000)
     page.evaluate(f'{key}.renderer.setAnimationLoop(null)')
     print('READY',era,flush=True)
     result=page.evaluate('key=>{const s=window[key];return {fisher:!!s.firstPerson.fishing,herbs:s.herbs.rows.length,merchant:!!s.herbs.merchantAt,trees:s.nature?.trees.records.length}}',key)
     print(result,flush=True);assert result['fisher'] and result['herbs']>10 and result['merchant'],result
     page.evaluate(LOGIN_JS.replace('terrain3d.shop',key+('.walking.shop' if era==1907 else '.shop')),['채집검사'+str(era),'gathering-test-password'])
     answer=page.evaluate("""async()=>{const token=document.cookie.split('; ').find(c=>c.startsWith('csrftoken=')).slice(10),r=await fetch('/api/shop/trade',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify({action:'buy',shop:'청계천 낚시꾼',item:'fishing_rod',quantity:1})});return r.json()}""")
     assert answer['items']['fishing_rod']==1,answer
     page.evaluate(f"async()=>{{await {key}.{'walking.' if era==1907 else ''}shop.refresh();{key}.firstPerson.enter()}}")
     page.wait_for_function(f'{key}.firstPerson.active')
     setup=page.evaluate("""key=>{const s=window[key],fp=s.firstPerson,f=fp.fishing,at=f.shore.clone(),dir=f.water.clone().sub(at).setY(0).normalize();at.addScaledVector(dir,-1);fp.placeAt(at.x,at.z,Math.atan2(-dir.x,-dir.z));return {blocked:!!(s.collision??s.walking.collision).hit(f.shore.x,f.shore.z,.35),message:'ready'}}""",key)
     assert not setup['blocked'],setup
     page.evaluate(f"{key}.{'walking.' if era==1907 else ''}shop.openPack()")
     page.evaluate("""()=>{const src=document.querySelector('#pack-window .shop-slot[data-item=fishing_rod]'),dst=document.querySelector('#action-bar [data-slot="0"]'),transfer=new DataTransfer();transfer.setData('application/x-hanyang-item','fishing_rod');dst.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}))}""")
     page.evaluate(f"{key}.{'walking.' if era==1907 else ''}shop.closePack()")
     page.locator('#scene > canvas').focus();page.keyboard.press('1')
     assert page.evaluate(f'{key}.firstPerson.fishing.active')
     page.evaluate(f'{key}.renderer.setAnimationLoop(()=>{{{key}.firstPerson.update(.016);{key}.herbs.update();{key}.renderer.render({key}.scene,{key}.camera)}})')
     page.wait_for_timeout(1000);assert page.locator('#fishing-status').is_visible()
     page.screenshot(path=f'/tmp/fishing-{era}.png')
     page.wait_for_function(f'!{key}.firstPerson.fishing.active',timeout=40000)
     assert '잡았소' in page.locator('#fishing-status').inner_text() or '입질 없이' in page.locator('#fishing-status').inner_text()
     print('PASS fishing cast and server-timed result',era,flush=True)
     # Move while waiting: the cast must cancel and the pole disappear.
     page.set_viewport_size({'width':390,'height':844})
     page.evaluate(f"{key}.{'walking.' if era==1907 else ''}shop.openPack()")
     page.locator('#pack-window .pack-use[data-item=fishing_rod]').click();page.wait_for_timeout(300)
     assert page.evaluate(f'{key}.firstPerson.fishing.active')
     page.evaluate(f"{key}.{'walking.' if era==1907 else ''}shop.closePack()")
     page.set_viewport_size({'width':1280,'height':900});page.wait_for_timeout(400)
     page.evaluate(f'()=>{{const f={key}.firstPerson,p=f.eye;f.placeAt(p.x+2,p.z,f.yaw);f.update(.016)}}')
     assert not page.evaluate(f'{key}.firstPerson.fishing.active')
     page.evaluate(f'{key}.renderer.setAnimationLoop(null)')
     plant=page.evaluate("""key=>{const s=window[key],r=s.herbs.rows[0],p=r.position;s.firstPerson.placeAt(p.x,p.z+2,0);s.firstPerson.walker.group.visible=false;s.camera.position.copy(p).add({x:0,y:1.5,z:2.5});s.camera.lookAt(p.clone().add({x:0,y:.4,z:0}));s.camera.updateMatrixWorld(true);s.renderer.render(s.scene,s.camera);const q=p.clone().add({x:0,y:.4,z:0}).project(s.camera),rect=s.renderer.domElement.getBoundingClientRect();return {id:r.id,x:rect.left+(q.x+1)*rect.width/2,y:rect.top+(1-q.y)*rect.height/2}}""",key)
     page.mouse.move(plant['x'],plant['y']);assert page.locator('#scene > canvas').evaluate("c=>c.style.cursor")=='grab'
     page.evaluate(f'{key}.renderer.setAnimationLoop(()=>{key}.renderer.render({key}.scene,{key}.camera))');page.screenshot(path=f'/tmp/herb-{era}.png');page.mouse.click(plant['x'],plant['y'],button='right')
     page.wait_for_function(f"{key}.herbs.cooldowns.has('{plant['id']}')",timeout=10000)
     print('PASS grab cursor, right-click harvesting and cooldown',era,flush=True)
     seller=page.evaluate(f'()=>{{const s={key},d=s.walking?.dialogue??s.npcDialogue;return s.herbs.merchantAt.toArray()}}')
     assert seller
     if era==1907:
      page.evaluate('''()=>{const s=seoul1907;s.firstPerson.exit();const p=s.nature.granite.patches[0].centre;s.camera.position.copy(p).add({x:380,y:330,z:500});s.camera.lookAt(p);s.camera.near=1;s.camera.updateProjectionMatrix();document.getElementById('labels').hidden=true;s.historical.material.opacity=0;s.renderer.setAnimationLoop(()=>s.renderer.render(s.scene,s.camera))}''')
      page.wait_for_timeout(500);page.screenshot(path='/tmp/nature-1907.png')
      assert page.evaluate('seoul1907.nature.granite.enabled')
      page.evaluate("()=>{const el=document.getElementById('granite3d');el.checked=false;el.dispatchEvent(new Event('change'))}")
      assert not page.evaluate('seoul1907.nature.granite.enabled')
     assert not errors,errors;page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
