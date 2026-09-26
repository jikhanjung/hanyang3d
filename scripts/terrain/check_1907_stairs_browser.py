"""Isolated PC/touch regression: stairs, terraces, solid walls and layer visibility."""
import os,subprocess,tempfile,time,json,sys
from pathlib import Path
from account_login import LOGIN_JS
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2])
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18094','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18094/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for width,height in [(1100,800),(390,844)]:
     page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600)
     errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18094/1907/');page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=120000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
     result=page.evaluate("""async()=>{
      const s=seoul1907,T=await import('/webapp/static/vendor/three/three.module.js');s.renderer.setAnimationLoop(null);s.scene.updateMatrixWorld(true);
      const results=[];
      // Pond pavilions (Gyeonghoeru, Hyangwonjeong) and Unhyeongung (gate in its west wall) have their own route checks.
      for(const b of s.buildings.filter(b=>b.userData.access&&!['gyeonghoeru','hex_pavilion','unhyeongung'].includes(b.userData.feature.landmark_kind))){
       const f=b.userData.feature,[w,h,d]=f.symbol_size_m,a=b.userData.access,hall=f.throne_hall;
       const end=hall?b.userData.hallCenterZ+hall.hall_m[1]/2+1.5:Math.max(d*.425,d*.425-3+(f.landmark_kind==='cathedral'?9:5)/2)+1;
       const world=z=>b.localToWorld(new T.Vector3(a.x,-h/2,z));
       const start=world(a.end+1);let ground=s.groundAt(start.x,start.z)+.025,highest=ground,fail=null;
       for(const dir of [1,-1]){
        const from=dir===1?a.end+1:end,to=dir===1?end:a.end+1,n=Math.ceil(Math.abs(to-from)/.1);
        for(let i=1;i<=n;i++){
         const z=from+(to-from)*i/n,p=world(z),hit=s.walking.collision.hit(p.x,p.z,.35),g=s.firstPerson.groundAt(p.x,p.z,ground);
         if(hit||g===null||g-ground>=.7){fail={z,ground,g,hit:!!hit};break}
         highest=Math.max(highest,g);ground=g;
        }
        if(fail)break;
       }
       const side=b.localToWorld(new T.Vector3(w/2-.2,-h/2,0)),sideGround=s.groundAt(side.x,side.z)+.025;
       const sideBlocked=b.userData.groundFloor-sideGround>.7?s.firstPerson.groundAt(side.x,side.z,sideGround)===null:true;
       const landing=world(end);b.visible=false;const hiddenGround=s.firstPerson.groundAt(landing.x,landing.z);b.visible=true;const hiddenStable=Math.abs(hiddenGround-(s.groundAt(landing.x,landing.z)+.025))<1e-5;const obstacle=b.userData.blockingRects?.[0],wall=obstacle&&b.localToWorld(new T.Vector3(obstacle.x,0,obstacle.z)),wallBlocked=!obstacle||!!s.walking.collision.hit(wall.x,wall.z,.35);
       results.push({id:f.id,fail,sideBlocked,hiddenStable,wallBlocked,rise:highest-s.groundAt(start.x,start.z),stairs:!!b.getObjectByName('access-stairs')});
      }
      return results;
     }""")
     print(width,json.dumps(result),flush=True)
     assert result and all(r['fail'] is None and r['sideBlocked'] and r['hiddenStable'] and r['wallBlocked'] for r in result),result
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['계단검사'+str(width),'stairs-test-1907'])
     page.evaluate('seoul1907.firstPerson.enter();seoul1907.pedestrians.group.visible=false')
     client=page.context.new_cdp_session(page)
     ids=page.evaluate("seoul1907.buildings.filter(b=>b.userData.access&&!['gyeonghoeru','hex_pavilion','unhyeongung'].includes(b.userData.feature.landmark_kind)).map(b=>b.userData.feature.id)")
     for id in ids:
      for reverse in [False,True]:
       page.evaluate("""async({id,reverse})=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id===id),T=await import('/webapp/static/vendor/three/three.module.js'),f=b.userData.feature,[w,h,d]=f.symbol_size_m,a=b.userData.access,hall=f.throne_hall;const end=hall?b.userData.hallCenterZ+hall.hall_m[1]/2+1.5:Math.max(d*.425,d*.425-3+(f.landmark_kind==='cathedral'?9:5)/2)+1;const world=z=>b.localToWorld(new T.Vector3(a.x,-h/2,z));const p=world(reverse?end:a.end+1),q=world(reverse?a.end+1:end);window.stairGoal=q;s.firstPerson.placeAt(p.x,p.z,Math.atan2(-(q.x-p.x),-(q.z-p.z)));s.firstPerson.clearInput()}""",{'id':id,'reverse':reverse})
       if width<600:
        box=page.locator('#walk-joystick').bounding_box()
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+box['width']/2,'y':box['y']+box['height']*.18,'id':1}]})
       else:page.keyboard.down('w')
       walk=page.evaluate("""()=>{const fp=seoul1907.firstPerson;let left;for(let i=0;i<2500;i++){fp.update(1/30);left=Math.hypot(fp.eye.x-stairGoal.x,fp.eye.z-stairGoal.z);if(left<.3)break}for(let i=0;i<30;i++){fp.clearInput();fp.update(1/30)}return {left,eyeHeight:fp.eye.y-fp.ground}}""")
       if width<600:client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
       else:page.keyboard.up('w')
       assert walk['left']<.35 and abs(walk['eyeHeight']-1.65)<.01,(id,reverse,walk)
      print('WALK',width,id,'up/down passed',flush=True)
     page.evaluate('seoul1907.firstPerson.exit()')
     for id in ['geunjeongjeon-1907','myeongdong-cathedral-1907']:
      page.evaluate("""async id=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id===id);s.showBuilding(b,{focus:true});document.getElementById('building-info').hidden=true;s.controls.target.copy(b.position);s.camera.position.copy(b.position).add(b.position.clone().set(70,70,100).applyAxisAngle(b.up,b.rotation.y));for(let i=0;i<100;i++)s.controls.update();const {updateLandmarkLod}=await import('/webapp/static/lod1907.js');s.buildings.forEach(o=>updateLandmarkLod(o,s.camera));document.getElementById('labels').hidden=true;s.renderer.render(s.scene,s.camera)}""",id)
      page.screenshot(path='/tmp/access-'+id+'-'+str(width)+'.png')
     assert not errors,errors
     page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=15)
