"""Standing 1907 NPC floor support and the shared horse tail direction."""
import os,subprocess,tempfile,time,sys,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18104','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18104/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={'width':1280,'height':900});page.goto('http://127.0.0.1:18104/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    result=page.evaluate("""()=>{const s=seoul1907;return s.walking.stationary.records.map(r=>({id:r.id,building:r.building,indoors:r.indoors,pose:r.pose,y:r.position.y,terrain:s.groundAt(r.position.x,r.position.z),blocked:!!s.walking.collision.hit(r.position.x,r.position.z,.35),access:r.owner.userData.access}))}""")
    print('Raised exterior NPCs:',[(r['building'],round(r['y']-r['terrain'],2)) for r in result if not r.get('indoors') and r['y']-r['terrain']>.2],flush=True)
    assert not [r for r in result if r['blocked'] and r.get('pose')!='seated_prayer'],result
    page.evaluate("seoul1907.showBuilding(seoul1907.buildings.find(b=>b.userData.feature.id==='myeongjeongjeon-1907'))")
    assert page.locator('#bookshop-talk').count()==0
    point=page.evaluate("""async()=>{const T=await import('three'),s=seoul1907,r=s.walking.stationary.records.find(r=>r.building==='myeongjeongjeon-1907');document.getElementById('building-info').hidden=true;document.getElementById('people3d').checked=true;s.walking.stationary.group.visible=true;s.camera.position.copy(r.position).add(new T.Vector3(0,2.5,6).applyAxisAngle(new T.Vector3(0,1,0),r.owner.rotation.y));s.controls.target.copy(r.position).add(new T.Vector3(0,1,0));s.controls.update();s.camera.updateMatrixWorld(true);s.walking.stationary.update(s.camera);const p=r.position.clone().add(new T.Vector3(0,1,0)).project(s.camera),rect=s.renderer.domElement.getBoundingClientRect();return [rect.left+(p.x+1)*rect.width/2,rect.top+(1-p.y)*rect.height/2]}""")
    page.wait_for_timeout(300);page.mouse.click(*point);page.wait_for_timeout(700)
    assert page.locator('.npc-plate strong').inner_text()=='명정전 관리인',page.locator('.npc-plate strong').inner_text()
    page.screenshot(path='/tmp/myeongjeong-caretaker.png')
    checked=page.evaluate("""async()=>{const THREE=await import('three'),s=seoul1907,results=[];for(const r of s.walking.stationary.records){if(r.pose==='seated_prayer')continue;
     const ray=new THREE.Raycaster(new THREE.Vector3(r.position.x,r.owner.position.y+100,r.position.z),new THREE.Vector3(0,-1,0)),hits=ray.intersectObjects(r.owner.userData.walkSurfaces??[],true),floor=Math.max(s.groundAt(r.position.x,r.position.z),hits[0]?.point.y??-Infinity);
     results.push({name:r.dialogue?.name??r.key,error:r.position.y-floor-.04,raised:r.position.y-s.groundAt(r.position.x,r.position.z)});
    }return results;}""")
    assert all(abs(r['error'])<.001 for r in checked),checked
    print('PASS all standing NPCs supported above terrain/stairs/plinth',len(checked),flush=True)
    horse=page.evaluate("""async()=>{const THREE=await import('three'),{createHorse}=await import('/webapp/static/horse_dealer.js'),h=createHorse(),tail=h.group.getObjectByName('horse-tail'),rows=[];
     for(const air of [false,true])for(const t of [0,100,250,500,900]){h.update(t,true,air,true);h.group.updateMatrixWorld(true);const root=tail.getWorldPosition(new THREE.Vector3()),tip=tail.children[0].localToWorld(new THREE.Vector3(0,-.3,0));rows.push({air,time:t,behind:root.z-tip.z});}return rows;}""")
    assert all(r['behind']>.35 for r in horse),horse
    print('PASS shared horse tail trails behind during gallop and jump',flush=True)
    # Both roles must be reachable by clicking their actual figure, without panel shortcuts.
    for building,appearance,name,parts in [('myeongdong-cathedral-1907','caretaker','명동성당 관리인',3),('myeongdong-cathedral-1907','priest','명동성당 신부',6),('jeongdong-church-1907','caretaker','정동교회 관리인',4)]:
     point=page.evaluate("""async ([building,appearance])=>{const T=await import('three'),s=seoul1907,r=s.walking.stationary.records.find(r=>r.building===building&&r.appearance===appearance);s.walking.dialogue.end();s.camera.near=.08;s.camera.updateProjectionMatrix();s.camera.position.copy(r.position).add(new T.Vector3(0,1.6,appearance==='priest'?-3:3).applyAxisAngle(new T.Vector3(0,1,0),r.owner.rotation.y));s.controls.target.copy(r.position).add(new T.Vector3(0,1,0));s.controls.update();s.camera.updateMatrixWorld(true);s.walking.stationary.update(s.camera);const p=r.position.clone().add(new T.Vector3(0,1,0)).project(s.camera),rect=s.renderer.domElement.getBoundingClientRect();return [rect.left+(p.x+1)*rect.width/2,rect.top+(1-p.y)*rect.height/2]}""",[building,appearance])
     page.wait_for_timeout(300);page.mouse.click(*point);page.wait_for_timeout(200)
     assert page.locator('.npc-plate strong').inner_text()==name,page.locator('.npc-plate strong').inner_text()
     page.evaluate('seoul1907.walking.dialogue.finishTyping()');page.locator('.npc-options button').first.click()
     for i in range(1,parts+1):
      page.evaluate('seoul1907.walking.dialogue.finishTyping()')
      assert f'{i} / {parts}' in page.locator('.npc-chapter').inner_text()
      assert page.locator('.npc-sources a').count()>0
      if i<parts:page.locator('.npc-options button').first.click()
     print('PASS on-scene dialogue',name,parts,flush=True)
    page.goto('http://127.0.0.1:18104/');page.wait_for_function('window.terrain3d?.ready',timeout=180000)
    print('PASS 1750 shared-controller scene',flush=True)
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
