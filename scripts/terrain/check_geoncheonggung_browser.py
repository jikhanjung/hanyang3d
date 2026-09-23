"""Walk up the Geoncheonggung stairs and through its gate on the keyboard, in 1907 and in the Eulmi visit."""
import os,subprocess,tempfile,time,sys
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[2]);sys.path.insert(0,'scripts/terrain')
from account_login import LOGIN_JS
WALK="""async()=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id==='geoncheonggung-1907'),T=await import('/webapp/static/vendor/three/three.module.js'),[w,h,d]=b.userData.feature.symbol_size_m,gx=b.userData.feature.gate_x;
 const world=(x,z)=>b.localToWorld(new T.Vector3(x,-h/2,z)),start=world(gx,d/2+22),goal=world(gx,d/2-12);
 const stairs=b.getObjectByName('access-stairs'),box=new T.Box3().setFromObject(stairs),sc=b.worldToLocal(box.getCenter(new T.Vector3()));
 let left;for(let i=0;i<600;i++){fp.update(1/30);left=Math.hypot(fp.eye.x-goal.x,fp.eye.z-goal.z);if(left<.8)break}
 const local=b.worldToLocal(fp.eye.clone());return {left:+left.toFixed(2),inside:local.z<d/2-2&&Math.abs(local.x)<w/2,stairsToGate:+Math.abs(sc.x-gx).toFixed(1),onPlinth:+(fp.eye.y-1.65-b.userData.groundFloor).toFixed(2)}}"""
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18144','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18144/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for path in ['/1907/','/events/eulmi/']:
     page=b.new_page(viewport={'width':1100,'height':800});page.goto('http://127.0.0.1:18144'+path);page.wait_for_function('window.seoul1907?.ready',timeout=180000)
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['건청궁검사'+str(len(path)),'gcg-walk-1907'])
     page.evaluate('seoul1907.renderer.setAnimationLoop(null);seoul1907.firstPerson.enter();seoul1907.pedestrians.group.visible=false')
     page.evaluate("""async()=>{const s=seoul1907,fp=s.firstPerson,b=s.buildings.find(b=>b.userData.feature.id==='geoncheonggung-1907'),T=await import('/webapp/static/vendor/three/three.module.js'),[w,h,d]=b.userData.feature.symbol_size_m,gx=b.userData.feature.gate_x;const st=b.localToWorld(new T.Vector3(gx,-h/2,d/2+22)),go=b.localToWorld(new T.Vector3(gx,-h/2,d/2-12));fp.placeAt(st.x,st.z,Math.atan2(-(go.x-st.x),-(go.z-st.z)));fp.clearInput()}""")
     page.keyboard.down('w');r=page.evaluate(WALK);page.keyboard.up('w')
     print(path,r,flush=True);assert r['inside'] and r['left']<1 and r['stairsToGate']<6 and r['onPlinth']>-.2,r
    b.close();print('PASS')
  finally:server.terminate();server.wait(timeout=10)
