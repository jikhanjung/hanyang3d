"""Both eras: keep moving under M map and cast away from the fisherman."""
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
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18103','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18103/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for era,path,key,landmark,span in [(1750,'/','terrain3d','donhwamun',1800),(1907,'/1907/','seoul1907','bosingak-1907',1200)]:
     page=browser.new_page(viewport={'width':1280,'height':900});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18103'+path);page.wait_for_function(f'window.{key}?.ready',timeout=180000)
     page.evaluate(f'{key}.renderer.setAnimationLoop(null)')
     print('READY',era,flush=True)
     result=page.evaluate('key=>{const s=window[key];return {fisher:!!s.firstPerson.fishing,herbs:s.herbs.rows.length,merchant:!!s.herbs.merchantAt,trees:s.nature?.trees.records.length}}',key)
     print(result,flush=True);assert result['fisher'] and result['herbs']>10 and result['merchant'],result
     page.evaluate(LOGIN_JS.replace('terrain3d.shop',key+('.walking.shop' if era==1907 else '.shop')),['채집검사'+str(era),'gathering-test-password'])
     page.evaluate(f"{key}.{'walking.' if era==1907 else ''}shop.refresh()")
     page.evaluate(f'{key}.firstPerson.enter()');page.wait_for_function(f'{key}.firstPerson.active')
     page.locator('#scene > canvas').focus()
     step=lambda:page.evaluate(f'()=>{{const f={key}.firstPerson,p=f.eye;f.update(.2);return f.eye.distanceTo(p)}}')
     page.keyboard.down('w');before=step();assert before>.1,before
     page.keyboard.press('m');assert page.locator('#large-map').is_visible()
     during=step();assert during>.1,during
     page.keyboard.up('w');assert step()<.01
     page.keyboard.down('w');assert step()>.1;page.keyboard.up('w')
     page.keyboard.press('Escape');assert not page.locator('#large-map').is_visible()
     page.keyboard.press('Alt+w');assert page.evaluate(f'{key}.firstPerson.autoRun')
     page.keyboard.press('m');assert step()>.1
     page.keyboard.press('m');assert step()>.1
     page.keyboard.press('w');assert not page.evaluate(f'{key}.firstPerson.autoRun');assert step()<.01
     print('PASS map keeps held movement and autorun; release/stop works',era,flush=True)
     page.evaluate("""async()=>{const token=document.cookie.split('; ').find(c=>c.startsWith('csrftoken=')).slice(10);await fetch('/api/shop/trade',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify({action:'buy',shop:'청계천 낚시꾼',item:'fishing_rod',quantity:1})})}""")
     page.evaluate(f"{key}.{'walking.' if era==1907 else ''}shop.refresh()")
     remote=page.evaluate("""key=>{const s=window[key],fp=s.firstPerson,f=fp.fishing,sheet=(s.waterLayer??s.infrastructure.water).children[0],pos=sheet.geometry.attributes.position,col=s.collision??s.walking.collision;
      for(let i=0;i<pos.count;i+=2){const edge=f.shore.clone().fromBufferAttribute(pos,i),other=edge.clone().fromBufferAttribute(pos,i+1),normal=edge.clone().sub(other).setY(0).normalize();if(edge.distanceTo(f.shore)<150)continue;
       for(const gap of [1,2,3]){const p=edge.clone().addScaledVector(normal,gap),y=fp.groundAt(p.x,p.z);if(y===null||y<edge.y||col.hit(p.x,p.z,.4))continue;fp.placeAt(p.x,p.z,Math.atan2(normal.x,normal.z));const message=f.use();if(f.active)return {distance:p.distanceTo(f.shore),target:f.castTarget.toArray(),message};}
      }return null;}""",key)
     assert remote and remote['distance']>150,remote
     page.wait_for_timeout(500);assert page.evaluate(f'{key}.firstPerson.fishing.active')
     page.evaluate(f'{key}.firstPerson.fishing.cancel()')
     print('PASS fishing far from NPC',era,remote,flush=True)
     assert not errors,errors;page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
