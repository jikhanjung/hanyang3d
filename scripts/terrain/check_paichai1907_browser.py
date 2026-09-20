"""Paichai 1887 main hall: map placement, model, picking, LOD and temporal isolation."""
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
    result=page.evaluate("""async()=>{const T=await import('three'),{updateLandmarkLod}=await import('/webapp/static/lod1907.js'),s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='paichai-main-hall-1907'),church=s.buildings.find(b=>b.userData.feature.id==='jeongdong-church-1907');s.renderer.setAnimationLoop(null);window.school=b;const near=b.position.clone().add(new T.Vector3(24,13,38).applyAxisAngle(new T.Vector3(0,1,0),b.rotation.y));s.camera.position.copy(near);s.controls.target.copy(b.position);s.controls.update();s.camera.updateMatrixWorld(true);for(const m of s.buildings)updateLandmarkLod(m,s.camera);const detailed=b.userData.lod.detail.visible;s.camera.position.copy(b.position).add(new T.Vector3(0,3000,4000));updateLandmarkLod(b,s.camera);const far=b.userData.lod.proxy.visible;s.camera.position.copy(near);s.controls.update();updateLandmarkLod(b,s.camera);s.renderer.render(s.scene,s.camera);const target=b.position.clone().project(s.camera);return {plan:b.userData.plan,period:b.userData.feature.temporal.existence,detailed,far,distance:b.position.distanceTo(church.position),blocked:s.walking.collision.hit(b.position.x,b.position.z,.35),click:[(target.x+1)*640,(1-target.y)*450]}}""")
    assert result['plan']=='1887-single-storey-main-hall' and result['detailed'] and result['far'] and result['blocked'],result
    assert result['period']['start_year']==1887 and result['period']['end_year']==1929,result
    assert 40<result['distance']<350,result
    page.screenshot(path='/tmp/paichai-model.png');page.mouse.click(*result['click']);page.wait_for_timeout(300)
    assert '배재학당' in page.locator('#building-info').inner_text()
    assert '1916' in page.locator('#building-info').inner_text()
    assert not page.evaluate("seoul1907.buildings.some(b=>b.userData.feature.id.includes('paichai-east'))")
    print('PASS PAICHAI',result,flush=True);browser.close()
  finally:server.terminate();server.wait(timeout=10)
