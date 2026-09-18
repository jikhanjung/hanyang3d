"""Measure per-frame CPU cost while walking inside Myeongdong Cathedral versus an outside street.

Breaks a frame into first-person update, label occlusion and render so a slowdown can be attributed.
"""
import os,subprocess,tempfile,time,json,sys
from pathlib import Path
from account_login import LOGIN_JS
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2])
MEASURE_JS="""async([inside,frames])=>{
 const s=seoul1907,b=s.buildings.find(b=>b.userData.interior),fp=s.firstPerson,T=await import('/webapp/static/vendor/three/three.module.js');
 const h=b.userData.feature.symbol_size_m[1];
 const p=b.localToWorld(new T.Vector3(0,-h/2,inside?0:b.userData.access.end+60));
 fp.placeAt(p.x,p.z,inside?b.rotation.y:b.rotation.y+Math.PI);fp.update(0);
 const t=()=>performance.now(),timing={};
 const time=(name,fn)=>{const a=t();for(let i=0;i<frames;i++)fn();timing[name]=(t()-a)/frames};
 time('firstPerson',()=>fp.update(1/30));
 const visible=s.labels.filter(({point,owner})=>{if(!owner.visible)return false;const q=point.clone().project(s.camera);return Math.abs(q.x)<=1&&Math.abs(q.y)<=1&&q.z>-1&&q.z<1});
 time('labelsVisible',()=>{for(const {point,owner} of visible)s.labelOccluded(point,owner)});
 time('render',()=>s.renderer.render(s.scene,s.camera));
 let triangles=0;b.traverse(o=>{if(o.isMesh&&o.visible&&o.parent.name!=="cathedral-camera-clip"){const p=o.geometry.attributes.position;triangles+=(o.geometry.index?.count??p.count)/3}});
 return {...timing,labelCount:visible.length,cathedralTriangles:triangles,drawCalls:s.renderer.info.render.calls,sceneTriangles:s.renderer.info.render.triangles};
}"""
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18096','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18096/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for width,height in [(1100,800),(390,844)]:
     page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600)
     page.goto('http://127.0.0.1:18096/1907/');page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=120000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['성능검사'+str(width),'cathedral-perf-1907'])
     page.evaluate('seoul1907.renderer.setAnimationLoop(null);seoul1907.firstPerson.enter()')
     page.evaluate('seoul1907.firstPerson.update(0)')
     for inside in [False,True]:
      result=page.evaluate(MEASURE_JS,[inside,60])
      print('PERF',width,'inside' if inside else 'outside',json.dumps({k:(round(v,2) if isinstance(v,float) else v) for k,v in result.items()}),flush=True)
     page.close()
    browser.close()
  finally:server.terminate();server.wait(timeout=15)
