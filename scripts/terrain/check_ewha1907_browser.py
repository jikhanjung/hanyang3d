"""Ewha circa-1900 main hall: map placement, model, picking, LOD and temporal isolation."""
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
    result=page.evaluate("""async()=>{const T=await import('three'),{updateLandmarkLod}=await import('/webapp/static/lod1907.js'),s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='ewha-main-hall-1907'),church=s.buildings.find(b=>b.userData.feature.id==='jeongdong-church-1907');s.renderer.setAnimationLoop(null);window.school=b;const near=b.position.clone().add(new T.Vector3(24,13,38).applyAxisAngle(new T.Vector3(0,1,0),b.rotation.y));s.camera.position.copy(near);s.controls.target.copy(b.position);s.controls.update();s.camera.updateMatrixWorld(true);for(const m of s.buildings)updateLandmarkLod(m,s.camera);const detailed=b.userData.lod.detail.visible;s.camera.position.copy(b.position).add(new T.Vector3(0,3000,4000));updateLandmarkLod(b,s.camera);const far=b.userData.lod.proxy.visible;s.camera.position.copy(near);s.controls.update();updateLandmarkLod(b,s.camera);s.renderer.render(s.scene,s.camera);const target=b.position.clone().project(s.camera);return {plan:b.userData.plan,period:b.userData.feature.temporal.existence,detailed,far,distance:b.position.distanceTo(church.position),blocked:s.walking.collision.hit(b.position.x,b.position.z,.35),click:[(target.x+1)*640,(1-target.y)*450]}}""")
    assert result['plan']=='circa-1900-two-storey-main-hall' and result['detailed'] and result['far'] and result['blocked'],result
    assert result['period']['start_year']==1900 and result['period']['end_year'] is None,result
    assert 40<result['distance']<350,result
    page.screenshot(path='/tmp/ewha-model.png');page.mouse.click(*result['click']);page.wait_for_timeout(300)
    assert '이화학당' in page.locator('#building-info').inner_text()
    assert '1915' in page.locator('#building-info').inner_text()
    assert not page.evaluate("seoul1907.buildings.some(b=>b.userData.feature.id.includes('ewha-simpson'))")
    print('PASS EWHA',result,flush=True)
    checks=page.evaluate("""async()=>{const T=await import('three'),s=seoul1907,g=s.buildings.find(b=>b.userData.feature.id==='souimun-1907'),wall=s.infrastructure.wall,r=s.walking.stationary.records.find(r=>r.id==='jongno-alley-tipsy-1907');
     const ends=wall.segments.flatMap(seg=>[seg.a,seg.b]).map(p=>new T.Vector3(p.x-g.position.x,0,p.z-g.position.z).applyAxisAngle(new T.Vector3(0,1,0),-g.rotation.y));
     const joins=[-1,1].map(side=>Math.min(...ends.map(p=>Math.hypot(p.x-side*8.6,p.z))));
     s.camera.position.copy(r.position).add(new T.Vector3(0,2,-4));s.controls.target.copy(r.position).add(new T.Vector3(0,.6,0));s.controls.update();s.walking.stationary.update(s.camera);s.renderer.render(s.scene,s.camera);
     const npc=s.walking.npcFor(r),originalRandom=Math.random;let line1,line2,silent;try{Math.random=()=>0;s.walking.dialogue.start(npc);silent=s.walking.dialogue.bubble.hidden&&!r.talking;let rolls=[.9,.99];Math.random=()=>rolls.shift();s.walking.dialogue.start(npc);line1=s.walking.dialogue.bubble.textContent;rolls=[.9,.01];s.walking.dialogue.start(npc);line2=s.walking.dialogue.bubble.textContent;Math.random=()=>0;s.walking.dialogue.start(npc);silent=silent&&s.walking.dialogue.bubble.hidden&&!r.talking;rolls=[.9,.5];Math.random=()=>rolls.shift();s.walking.dialogue.start(npc)}finally{Math.random=originalRandom}return {pixel:g.userData.feature.source_position.pixel,joins,gateBlocked:!!s.walking.collision.hit(g.position.x,g.position.z,.35),pose:r.person.group.userData.pose,nose:r.person.group.getObjectByName('tipsy-red-nose').material.color.getHexString(),bottle:!!r.person.group.getObjectByName('tipsy-bottle-neck'),visible:r.person.group.visible,blocked:!!s.walking.collision.hit(r.position.x,r.position.z,.35),mode:npc.mode,line1,line2,silent}}
    """)
    assert checks['pixel']==[470,2620] and not checks['gateBlocked'],checks
    assert max(checks['joins'])<1,checks
    assert checks['pose']=='seated-tipsy' and checks['bottle'] and checks['nose']=='c95d4d' and checks['visible'] and not checks['blocked'],checks
    assert checks['mode']=='bubble' and checks['line1']!=checks['line2'] and checks['silent'],checks
    assert page.locator('#npc-bubble').is_visible()
    page.screenshot(path='/tmp/jongno-tipsy.png')
    page.evaluate("""async()=>{const T=await import('three'),s=seoul1907,g=s.buildings.find(b=>b.userData.feature.id==='souimun-1907');s.camera.position.copy(g.position).add(new T.Vector3(70,65,60));s.controls.target.copy(g.position);s.controls.update();s.renderer.render(s.scene,s.camera)}""")
    page.screenshot(path='/tmp/souimun-corrected.png')
    print('PASS SOUIMUN AND TIPSY',checks,flush=True);browser.close()
  finally:server.terminate();server.wait(timeout=10)
