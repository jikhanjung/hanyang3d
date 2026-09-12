"""Bridge widening and contact with displayed terrain under channel/height changes."""
import argparse
from playwright.sync_api import sync_playwright, expect
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:8000/gis/terrain/3d/')
parser.add_argument('--browser')
args=parser.parse_args()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1080});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=120000)
 def check():
  result=page.evaluate('''async()=>{
   const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,ex=Number(document.getElementById('height3d').value);
   t.scene.updateMatrixWorld(true);
   return t.bridges.children.map(b=>{
    const u=b.userData,[w,h,length]=u.feature.symbol_size_m,g=b.getObjectByName('bridge-connections');
    const ramps=g.children.filter(m=>m.name==='bridge-approach'),feet=g.children.filter(m=>m.name==='bridge-abutment');
    let seamError=0,outerGap=0,buried=true,clear=true;
    ramps.forEach((r,i)=>{
     const pos=r.geometry.attributes.position,rows=u.connections[i].rows;
     seamError=Math.max(seamError,Math.abs(pos.getY(0)+b.position.y-(b.position.y+h/2)));
     outerGap=Math.max(outerGap,Math.abs(pos.getY(pos.count-4)+b.position.y-(rows.at(-1).max*ex+.12)));
     rows.forEach((row,j)=>{
      buried&&=pos.getY(j*4+2)+b.position.y<row.min*ex;
      clear&&=pos.getY(j*4)+b.position.y>=row.max*ex-.001;
     });
    });
    const footContact=feet.every((f,i)=>f.position.y-f.geometry.parameters.height/2+b.position.y<=u.connections[i].footing.min*ex);
    return {name:u.feature.name,width:w,length,seamError,outerGap,buried,clear,footContact,parts:g.children.length};
   });}''')
  assert len(result)==4
  assert all(r['width']==12 and r['length']>70 and r['parts']==4 and r['seamError']<.001 and r['outerGap']<.001 and r['buried'] and r['clear'] and r['footContact'] for r in result),result
  return result
 print(check(),flush=True)
 upstream=page.evaluate("""()=>{const w=JSON.parse(document.getElementById('water').textContent),p=terrain3d.channelState.path;return {points:p.length,start:p[0].level,end:p.at(-1).level,startWidth:p[0].width,endWidth:p.at(-1).width,downhill:p.every((n,i)=>!i||n.level<=p[i-1].level),grade:p.every((n,i)=>!i||p[i-1].level-n.level<=Math.hypot(n.x-p[i-1].x,n.z-p[i-1].z)*.08+1e-6),bridges:w.bridges.every(b=>JSON.stringify(w.centerline[b.line_index])===JSON.stringify(b.pixel))}}""")
 assert upstream['points']>70 and upstream['start']>upstream['end']+10 and upstream['startWidth']<upstream['endWidth'],upstream
 assert upstream['downhill'] and upstream['grade'] and upstream['bridges'],upstream
 print(upstream,flush=True)
 page.locator('#upstream-focus').click();page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-seochon-upstream.png')
 page.locator('#channel-depth').fill('5');page.locator('#channel-depth').dispatch_event('change');check()
 page.locator('#height3d').select_option('2');check()
 page.locator('#carve3d').uncheck();check()
 page.locator('#carve3d').check();check()
 page.locator('#height3d').select_option('1');page.locator('#channel-depth').fill('2');page.locator('#channel-depth').dispatch_event('change');check()
 page.evaluate('''()=>{window.scrollTo(0,0);const t=terrain3d,b=t.bridges.children[1];t.controls.enableDamping=false;t.controls.target.copy(b.position);t.camera.position.copy(b.position);t.camera.position.x+=80;t.camera.position.y+=100;t.camera.position.z+=120;t.controls.update()}''')
 page.wait_for_timeout(500);page.screenshot(path='/tmp/hanyang-bridge-ground-connection.png')
 # Hover the approach itself; the owning bridge must be selected.
 point=page.evaluate('''()=>{const t=terrain3d,b=t.bridges.children[1],a=b.getObjectByName('bridge-connections').children.find(m=>m.name==='bridge-approach'),p=a.geometry.attributes.position;const v=b.position.clone();v.set((p.getX(20)+p.getX(21))/2,p.getY(20),p.getZ(20));a.localToWorld(v);v.project(t.camera);const r=t.renderer.domElement.getBoundingClientRect();return [r.left+(v.x+1)*r.width/2,r.top+(1-v.y)*r.height/2]}''')
 page.mouse.move(*point);expect(page.locator('#building-name')).to_contain_text('광통교',timeout=10000)
 page.locator('#water3d').uncheck();assert not page.evaluate('terrain3d.bridges.visible')
 assert not errors,errors
 print('Passed: 4 wider bridges, approach seams and terrain contact, abutments, depth/height/toggle recomputation, approach hover, visibility, no JS errors',flush=True)
 browser.close()
