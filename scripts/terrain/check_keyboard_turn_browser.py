"""Common keyboard turning/diagonal movement in both eras and the private event, using a temporary DB."""
import os, subprocess, tempfile, time, sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[2]
os.chdir(root)
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18112','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try: urlopen('http://127.0.0.1:18112/');break
    except OSError: time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    context=browser.new_context()
    for path in ['/','/1907/','/events/agwanpacheon/']:
     page=context.new_page();page.goto('http://127.0.0.1:18112'+path);page.wait_for_function('window.terrain3d?.ready || window.seoul1907?.ready',timeout=240000)
     page.evaluate('''async()=>{window.s=window.terrain3d??window.seoul1907;window.fp=s.firstPerson;const shop=s.shop??s.walking.shop;await shop.whenReady;
      if(!shop.state.loggedIn){const csrf=document.cookie.match(/csrftoken=([^;]+)/)[1];await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({name:'키보드검사',password:'test-password'})});await shop.refresh()}
      fp.enter();s.renderer.setAnimationLoop(null);s.pedestrians.group.visible=false;const origin=fp.eye,collision=s.collision??s.walking.collision;let spot=null;
      for(let x=-100;x<=100&&!spot;x+=5)for(let z=-100;z<=100&&!spot;z+=5){const px=origin.x+x,pz=origin.z+z,ys=[];for(const dx of [-3,0,3])for(const dz of [-3,0,3])ys.push(fp.groundAt(px+dx,pz+dz));if(ys.every(Number.isFinite)&&Math.max(...ys)-Math.min(...ys)<.3&&!collision.hit(px,pz,4))spot={x:px,z:pz}}
      if(!spot)throw Error('No clear control test area');window.spot=spot;window.reset=()=>{fp.clearInput();fp.placeAt(spot.x,spot.z,0);s.renderer.domElement.focus()};reset();}''')
     def move(keys):
      page.evaluate('reset()')
      for key in keys:page.keyboard.down(key)
      result=page.evaluate('()=>{for(let i=0;i<5;i++)fp.update(.1);return {x:fp.eye.x-spot.x,z:fp.eye.z-spot.z,yaw:fp.yaw}}')
      for key in reversed(keys):page.keyboard.up(key)
      return result
     a=move(['KeyA']);d=move(['KeyD']);both=move(['KeyA','KeyD']);q=move(['KeyQ']);e=move(['KeyE']);w=move(['KeyW']);we=move(['KeyW','KeyE']);wa=move(['KeyW','KeyA'])
     assert a['yaw']>0 and d['yaw']<0 and abs(a['yaw']+d['yaw'])<1e-8
     assert all(abs(r['x'])+abs(r['z'])<1e-8 for r in [a,d,both]) and abs(both['yaw'])<1e-8
     assert q['x']<0 and q['z']<0 and e['x']>0 and e['z']<0 and q['yaw']==e['yaw']==0
     assert wa['yaw']>0 and wa['x']<0 and wa['z']<0
     for r in [q,e,w,we]:assert abs((r['x']**2+r['z']**2)**.5-1.5)<.02,r
     page.evaluate('reset()');page.keyboard.press('KeyM');page.keyboard.down('KeyQ')
     assert page.evaluate('()=>{fp.update(.1);return fp.eye.x<spot.x&&fp.eye.z<spot.z}')
     page.keyboard.up('KeyQ');page.keyboard.press('KeyM')
     page.evaluate('reset()');page.keyboard.down('KeyD');page.evaluate("window.dispatchEvent(new Event('blur'));fp.update(.1)")
     assert page.evaluate('fp.yaw<0')
     page.keyboard.up('KeyD');page.evaluate('fp.clearInput()')
     print('PASS',path,{'left':a,'right':d,'diagonal_left':q,'diagonal_right':e},flush=True);page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
