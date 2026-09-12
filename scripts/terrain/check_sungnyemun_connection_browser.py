"""Check the wall meets Sungnyemun along the gate's transverse axis."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--browser');args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=180000)
 result=page.evaluate('''async()=>{
  const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,g=t.buildings.children.find(b=>b.userData.feature.id==='sungnyemun'),c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y);
  const local=p=>({x:c*(p.x-g.position.x)-s*(p.z-g.position.z),z:s*(p.x-g.position.x)+c*(p.z-g.position.z)});
  const close=t.cityWall.segments.map(seg=>({a:local(seg.a),b:local(seg.b)})).filter(seg=>Math.max(Math.abs(seg.a.x),Math.abs(seg.b.x))<21&&Math.max(Math.abs(seg.a.z),Math.abs(seg.b.z))<3);
  t.scene.updateMatrixWorld(true);const origin=new T.Vector3(0,g.children[0].userData.archTestY,15);g.localToWorld(origin);
  const conn=t.cityWall.connections[0],raw=t.cityWall.sourceNodes,nodes=t.cityWall.nodes;
  const outsideDrift=Math.max(0,...raw.map((p,i)=>Math.hypot(p.x-g.position.x,p.z-g.position.z)>=conn.outer?Math.hypot(p.x-nodes[i].x,p.z-nodes[i].z):0));
  return {close,outsideDrift,connection:conn,count:close.length,left:close.some(v=>v.a.x<0),right:close.some(v=>v.a.x>0),aligned:close.every(v=>Math.abs(v.a.z)<1e-7&&Math.abs(v.b.z)<1e-7),open:!new T.Raycaster(origin,new T.Vector3(0,0,-1).transformDirection(g.matrixWorld),0,30).intersectObject(t.cityWall.group,true).length};
 }''')
 print(result,flush=True);assert result['count']>=2 and result['left'] and result['right'] and result['aligned'] and result['open'] and result['outsideDrift']==0,result
 page.evaluate('''()=>{const t=terrain3d,g=t.buildings.children.find(b=>b.userData.feature.id==='sungnyemun');t.controls.enableDamping=false;t.controls.target.copy(g.position);t.camera.position.copy(g.position);t.camera.position.x+=110;t.camera.position.z+=130;t.camera.position.y+=100;t.controls.update()}''')
 page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-sungnyemun-wall-aligned.png')
 page.locator('#height3d').select_option('2');page.locator('#carve3d').uncheck();page.locator('#carve3d').check();page.locator('#height3d').select_option('1')
 assert page.evaluate('terrain3d.cityWall.segments.every(s=>Number.isFinite(s.support.min)&&s.support.max>=s.support.min)')
 assert not errors,errors
 print('Passed: both wall approaches on gate transverse axis, passage open, terrain recalculation, no JS errors',flush=True)
 b.close()
