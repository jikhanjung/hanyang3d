"""Unhyeongung (1907): the compound stands, walk in through the west gate on the keyboard, across the yard and
through the inner wall opening towards Noandang; the walls and halls block. Aerial and first-person captures."""
import os,subprocess,tempfile,time,sys,base64
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[2]);sys.path.insert(0,'scripts/terrain')
from account_login import LOGIN_JS
LEG="""async(pts)=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id==='unhyeongung-1907'),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1];
 const W=([x,z])=>b.localToWorld(new T.Vector3(x,-h/2,z)),out=[];
 for(let k=1;k<pts.length;k++){const g=W(pts[k]);fp.face(Math.atan2(-(g.x-fp.eye.x),-(g.z-fp.eye.z)));let left;for(let i=0;i<900;i++){fp.update(1/30);left=Math.hypot(fp.eye.x-g.x,fp.eye.z-g.z);if(left<.6)break}
  const l=b.worldToLocal(fp.eye.clone());out.push({leg:k,left:+left.toFixed(2),x:+l.x.toFixed(1),z:+l.z.toFixed(1)})}
 return out}"""
SHOT="(()=>{const s=seoul1907;s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL()})()"
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18148','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18148/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=b.new_page(viewport={'width':1100,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18148/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    info=page.evaluate("""async()=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id==='unhyeongung-1907');if(!b)return null;s.renderer.setAnimationLoop(null);
     s.showBuilding(b,{focus:true});document.getElementById('building-info').hidden=true;s.controls.target.copy(b.position);s.camera.position.copy(b.position).add(new b.position.constructor(40,120,90));for(let i=0;i<60;i++)s.controls.update();
     const {updateLandmarkLod}=await import('/webapp/static/lod1907.js');s.buildings.forEach(o=>updateLandmarkLod(o,s.camera));
     return {visible:b.visible,parts:b.children.length,rects:b.userData.blockingRects.length,stairs:!!b.getObjectByName('access-stairs'),halls:['noandang-wall','norakdang-wall','irodang-wall','sujiksa-wall','wollang'].filter(n=>(b.userData.parts??[]).includes(n)||b.getObjectByName(n))}}""")
    print('MODEL',info,flush=True);assert info and info['visible'] and len(info['halls'])==5,info
    Path('/tmp/unhyeongung-aerial.png').write_bytes(base64.b64decode(page.evaluate(SHOT).split(',')[1]))
    page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['운현궁검사','unhyeon-walk-1907'])
    page.evaluate('seoul1907.firstPerson.enter();seoul1907.pedestrians.group.visible=false')
    w,d=76,92
    # From the street west of the gate, in through it, across the yard, through the opening at z 24–28 to Noandang's end.
    start=[-w/2-14,10]
    page.evaluate("""async(p0)=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id==='unhyeongung-1907'),T=await import('/webapp/static/vendor/three/three.module.js'),h=b.userData.feature.symbol_size_m[1];const p=b.localToWorld(new T.Vector3(p0[0],-h/2,p0[1]));fp.placeAt(p.x,p.z,0);fp.clearInput()}""",start)
    page.keyboard.down('w');legs=page.evaluate(LEG,[start,[-w/2+4,10],[-8,26],[-2,26],[-1.2,26]]);page.keyboard.up('w')
    print('WALK',legs,flush=True);assert all(l['left']<.7 for l in legs[:3]),legs
    Path('/tmp/unhyeongung-yard.png').write_bytes(base64.b64decode(page.evaluate(SHOT).split(',')[1]))
    # The wall blocks: from the yard straight east at z = -20 stops at the inner wall (x ≈ 0).
    page.keyboard.down('w');blocked=page.evaluate(LEG,[[0,0],[-10,-20],[10,-20]]);page.keyboard.up('w')
    print('WALL',blocked,flush=True);assert blocked[-1]['x']<0 and blocked[-1]['left']>5,blocked
    assert not errors,errors
    b.close();print('PASS')
  finally:server.terminate();server.wait(timeout=10)
