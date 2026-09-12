"""Integrated wall, source-road bridges and foothill-only alignment checks."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--browser');parser.add_argument('--url',default='http://127.0.0.1:8000/gis/terrain/3d/');args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=180000)
 report=page.evaluate('''async()=>{
  const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,exp=JSON.parse(document.getElementById('experiment').textContent),R=6378137;
  const pts=[...exp.landmarks,...exp.suggested_anchors],project=p=>[R*p.lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+p.lat*Math.PI/360))],base=DoseongWarp.fitTPS(pts.map(p=>p.pixel),pts.map(project));
  const core=[[1155,1441],[1500,1550],[2000,1500],[1700,1700],[1200,1600]],drift=Math.max(...core.map(p=>{const a=base(...p),b=t.warp(...p);return Math.hypot(a[0]-b[0],a[1]-b[1])}));
  t.scene.updateMatrixWorld(true);
  const gates=t.buildings.children.filter(g=>['donuimun','sungnyemun','heunginjimun'].includes(g.userData.feature.id));
  const open=gates.every(g=>{const q=g.children[0].userData,origin=new T.Vector3(0,q.archTestY,15);g.localToWorld(origin);return !new T.Raycaster(origin,new T.Vector3(0,0,-1).transformDirection(g.matrixWorld),0,30).intersectObject(t.cityWall.group,true).length});
  const bridges=t.bridges.children.map(g=>{
   const data=g.userData,ramps=g.getObjectByName('bridge-connections').children.filter(c=>c.name==='bridge-approach');
   return ramps.map((m,i)=>{
    const pos=m.geometry.attributes.position,k=pos.count-4,v=new T.Vector3((pos.getX(k)+pos.getX(k+1))/2,pos.getY(k),pos.getZ(k));m.localToWorld(v);
    const target=t.warp(...data.feature.road_connections.pixel_points[i===0?0:3]);
    const ground=(g.position.x-t.buildings.children[0].position.x)/(data.x-t.buildings.children[0].userData.x);
    const expectedX=g.position.x+(target[0]-data.x)*ground,expectedZ=g.position.z-(target[1]-data.y)*ground;
    return Math.hypot(v.x-expectedX,v.z-expectedZ);
   });
  });
  return {wallSegments:t.cityWall.segments.length,wallRange:[Math.min(...t.cityWall.segments.map(s=>s.support.min)),Math.max(...t.cityWall.segments.map(s=>s.support.max))],open,drift,bridges,anchorError:t.anchorError,mountains:exp.terrain_alignment.anchors.map(p=>({name:p.name,error:Math.hypot(...t.warp(...p.pixel).map((v,i)=>v-project(p)[i]))}))};
 }''')
 print(report,flush=True)
 assert report['wallSegments']>1000 and report['wallRange'][1]-report['wallRange'][0]>100
 assert report['open'] and report['drift']<1e-8 and report['anchorError']<1e-4
 assert all(x<2 for pair in report['bridges'] for x in pair),report['bridges']
 assert all(p['error']<1e-4 for p in report['mountains'])
 page.screenshot(path='/tmp/hanyang-walls-mountain-overview.png')
 page.locator('#height3d').select_option('2')
 assert page.evaluate('''async()=>{const T=await import('/webapp/static/vendor/three/three.module.js'),w=terrain3d.cityWall,m=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();return w.segments.every((seg,i)=>{w.group.children[0].getMatrixAt(i,m);m.decompose(p,q,s);return p.y-s.y/2<=seg.support.min*2+.01&&p.y+s.y/2>=seg.support.max*2+4.99})}''')
 page.locator('#carve3d').uncheck();page.locator('#carve3d').check();page.locator('#height3d').select_option('1')
 page.locator('#walls3d').uncheck();assert not page.evaluate('terrain3d.cityWall.group.visible');page.locator('#walls3d').check()
 page.evaluate('''()=>{const t=terrain3d,g=t.buildings.children.find(g=>g.userData.feature.id==='donuimun');t.controls.enableDamping=false;t.controls.target.copy(g.position);t.camera.position.copy(g.position);t.camera.position.x+=130;t.camera.position.z+=90;t.camera.position.y+=90;t.controls.update();window.scrollTo(0,0)}''')
 page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-wall-gate.png')
 page.locator('#water-focus').click();page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-road-aligned-bridges.png')
 assert not errors,errors
 print('Passed: wall circuit and terrain, open gates, exact protected core, mountain targets, bridge road ends, terrain toggles and no JS errors',flush=True)
 b.close()
