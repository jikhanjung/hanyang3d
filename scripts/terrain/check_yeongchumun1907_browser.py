"""Yeongchumun: open walking passage, solid abutments and palace-wall joins."""
import os,subprocess,tempfile,time,sys,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18110','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18110/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={'width':1280,'height':900});page.goto('http://127.0.0.1:18110/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    result=page.evaluate("""async()=>{const T=await import('three'),s=seoul1907,g=s.buildings.find(b=>b.userData.feature.id==='yeongchumun-1907');s.renderer.setAnimationLoop(null);const p=(x,z)=>new T.Vector3(x,0,z).applyAxisAngle(new T.Vector3(0,1,0),g.rotation.y).add(g.position),hit=(x,z)=>{const a=p(x,z);return !!s.walking.collision.hit(a.x,a.z,.35)};const ends=s.infrastructure.palaceWalls[0].segments.flatMap(v=>[v.a,v.b]).map(a=>new T.Vector3(a.x-g.position.x,0,a.z-g.position.z).applyAxisAngle(new T.Vector3(0,1,0),-g.rotation.y));s.camera.position.copy(p(22,35)).add(new T.Vector3(0,17,0));s.controls.target.copy(g.position);s.controls.update();s.camera.updateMatrixWorld(true);const {updateLandmarkLod}=await import('/webapp/static/lod1907.js');for(const b of s.buildings)updateLandmarkLod(b,s.camera);document.getElementById('labels').style.display='none';s.renderer.render(s.scene,s.camera);return {doors:g.userData.doors,tiers:g.userData.tiers,plaque:g.getObjectByName('gate-plaque').userData.inscription,passage:Array.from({length:21},(_,i)=>hit(0,i-10)),sides:[hit(-6,0),hit(6,0)],joins:[-1,1].map(sign=>Math.min(...ends.map(a=>Math.hypot(a.x-sign*9.1,a.z)))),yaw:g.rotation.y}}""")
    print(result,flush=True)
    assert result['doors']==1 and result['tiers']==1 and result['plaque']=='迎秋門',result
    assert not any(result['passage']) and all(result['sides']),result
    assert max(result['joins'])<1,result
    page.screenshot(path='/tmp/yeongchumun.png')
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
