"""Gyeonghoeru: walk over the east bridge, up the island stair to the upper floor, and be dismounted there.
Hyangwonjeong: walk over the Chwihyanggyo bridge from the north bank onto the pavilion floor. Keyboard walking."""
import os,subprocess,tempfile,time,sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2]);sys.path.insert(0,'scripts/terrain')
from account_login import LOGIN_JS
# Walk through local waypoints of a building (floor-relative), one leg at a time, with W held.
LEG="""async([id,pts,ride])=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id===id),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1];
 const W=([x,z])=>b.localToWorld(new T.Vector3(x,-h/2,z));const out=[];
 for(let k=1;k<pts.length;k++){const a=fp.eye.clone(),g=W(pts[k]);fp.face(Math.atan2(-(g.x-a.x),-(g.z-a.z)));
  let left;for(let i=0;i<900;i++){fp.update(1/30);left=Math.hypot(fp.eye.x-g.x,fp.eye.z-g.z);if(left<.6)break}
  out.push({leg:k,left:+left.toFixed(2),floor:+(fp.eye.y-(fp.mounted?2:1.65)-b.userData.groundFloor).toFixed(2),mounted:fp.mounted})}
 return out}"""
START="""async([id,p0,ride])=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id===id),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1];
 const p=b.localToWorld(new T.Vector3(p0[0],-h/2,p0[1]));fp.placeAt(p.x,p.z,0);fp.clearInput();if(ride)fp.setMounted(true);return fp.mounted}"""
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18145','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18145/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1100,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18145/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['누각검사','pavilion-walk-1907'])
    page.evaluate(f"""async()=>{{const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);await fetch('/api/shop/trade',{{method:'POST',headers:{{'Content-Type':'application/json','X-CSRFToken':csrf}},body:JSON.stringify({{action:'buy',shop:'말 장수',item:'horse_reins',quantity:1}})}});await seoul1907.walking.shop.refresh();seoul1907.renderer.setAnimationLoop(null);seoul1907.firstPerson.enter();seoul1907.pedestrians.group.visible=false}}""")
    g=page.evaluate("(()=>{const f=seoul1907.buildings.find(b=>b.userData.feature.id==='gyeonghoeru-1907').userData;return {w:f.feature.symbol_size_m[0],d:f.feature.symbol_size_m[2],px:f.anchorOffset[0],pz:f.anchorOffset[1]}})()")
    w,d,px,pz=g['w'],g['d'],g['px'],g['pz']
    # East of the access stairs → bridge → island → foot of the stair → up → onto the upper floor.
    # Pillars stand every 6 m (x = px-21+6i, z = pz-15+6j); walk the gaps between them: along z = pz to x = px,
    # north to the stair foot at x = px+3.4, z = pz+12, up the stair eastwards and out onto the upper floor.
    route=[[w/2+14,pz],[w/2-1,pz],[px+24,pz],[px,pz],[px,pz+12],[px+3.2,pz+12],[px+13.4,pz+12],[px+18,pz+12],[px+18,pz]]
    mounted=page.evaluate(START,['gyeonghoeru-1907',route[0],True])
    page.keyboard.down('w');legs=page.evaluate(LEG,['gyeonghoeru-1907',route,True]);page.keyboard.up('w')
    note=page.evaluate("document.getElementById('walk-chat-messages').textContent")
    print('GYEONGHOERU',mounted,legs,note,flush=True)
    assert mounted and all(l['left']<.7 for l in legs),legs
    assert legs[0]['mounted'] and not legs[2]['mounted'] and '실내' in note,(legs,note)
    assert legs[-1]['floor']>5.9 and legs[4]['floor']<1.6 and legs[6]['floor']>5.9,legs
    page.evaluate("(()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='gyeonghoeru-1907'),V=s.camera.position.constructor;s.renderer.render(s.scene,s.camera)})()")
    Path('/tmp/gyeonghoeru-upper.png').write_bytes(__import__('base64').b64decode(page.evaluate("(()=>{const s=seoul1907;s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL()})()").split(',')[1]))
    # Walking on the ground floor under the upper floor, the third-person camera stays below it (the walker in view).
    page.evaluate(START,['gyeonghoeru-1907',route[0],False]);page.keyboard.down('w');page.evaluate(LEG,['gyeonghoeru-1907',route[:5],False])
    cam=page.evaluate("""async([px,pz])=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id==='gyeonghoeru-1907'),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1],gf=b.userData.groundFloor;
     // On the ground floor under the upper floor (entered again over the bridge), walk west and look about.
     const W=([x,z])=>b.localToWorld(new T.Vector3(x,-h/2,z)),out=[];
     for(const pt of [[px-12,pz]]){const g=W(pt);fp.face(Math.atan2(-(g.x-fp.eye.x),-(g.z-fp.eye.z)));for(let i=0;i<600;i++){fp.update(1/30);if(Math.hypot(fp.eye.x-g.x,fp.eye.z-g.z)<.6)break}}
     for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){fp.face(yaw);fp.update(1/30);const eye=fp.eye,c=s.camera.position,ray=new T.Raycaster(eye,c.clone().sub(eye).normalize(),0,c.distanceTo(eye));
      out.push({floor:+(eye.y-1.65-gf).toFixed(2),camera:+(c.y-gf).toFixed(2),boom:+c.distanceTo(eye).toFixed(2),blocked:ray.intersectObject(b,true).filter(x=>x.object.material?.visible!==false).length})}
     s.renderer.render(s.scene,s.camera);window.underShot=s.renderer.domElement.toDataURL();return out}""",[px,pz]);page.keyboard.up('w')
    print('CAMERA',cam,flush=True);assert all(c['floor']<1.6 and c['camera']<5.9 and c['blocked']==0 for c in cam),cam
    Path('/tmp/gyeonghoeru-under.png').write_bytes(__import__('base64').b64decode(page.evaluate('underShot').split(',')[1]))
    # Hyangwonjeong: from the north bank along the bridge onto the pavilion floor.
    h=page.evaluate("(()=>{const f=seoul1907.buildings.find(b=>b.userData.feature.id==='hyangwonjeong-1907').userData.feature;return f.symbol_size_m})()")
    route=[[0,-h[2]/2-10],[0,-h[2]/2+1],[0,-12],[0,-5],[0,0]]
    page.evaluate(START,['hyangwonjeong-1907',route[0],False])
    page.keyboard.down('w');legs=page.evaluate(LEG,['hyangwonjeong-1907',route,False]);page.keyboard.up('w')
    print('HYANGWONJEONG',legs,flush=True)
    assert all(l['left']<.7 for l in legs) and legs[-1]['floor']>.9,legs
    Path('/tmp/hyangwonjeong-floor.png').write_bytes(__import__('base64').b64decode(page.evaluate("(()=>{const s=seoul1907;s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL()})()").split(',')[1]))
    # The water itself still blocks: walking off the island (between two posts) stops at the edge.
    page.keyboard.down('w');wet=page.evaluate("""async()=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id==='hyangwonjeong-1907'),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1];const g=b.localToWorld(new T.Vector3(25,-h/2,-6));fp.face(Math.atan2(-(g.x-fp.eye.x),-(g.z-fp.eye.z)));for(let i=0;i<300;i++)fp.update(1/30);return +b.worldToLocal(fp.eye.clone()).x.toFixed(1)}""")
    page.keyboard.up('w');print('WATER',wet,flush=True);assert 7<wet<10.5,wet
    assert not errors,errors
    b.close();print('PASS')
  finally:server.terminate();server.wait(timeout=10)
