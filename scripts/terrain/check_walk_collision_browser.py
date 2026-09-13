"""Verify walking collision, pedestrian side-stepping, building popups and the 경복궁 label."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1100,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=400000)
 page.evaluate('terrain3d.renderer.setAnimationLoop(null)')
 assert page.get_attribute('#map-options-toggle','aria-label')=='설정'
 assert page.evaluate("terrain3d.districtNames.children.some(c=>c.userData.name==='경복궁')")
 # Clicking a building opens its information card.
 point=page.evaluate('''()=>{const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id==='jongru');
  t.controls.target.copy(b.position);t.camera.position.set(b.position.x+30,b.position.y+30,b.position.z+45);t.controls.update();t.renderer.render(t.scene,t.camera);
  const v=b.position.clone();v.y+=4;v.project(t.camera);const r=t.renderer.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2}}''')
 page.mouse.move(point['x'],point['y']);page.mouse.down();page.mouse.up()
 popup=page.evaluate("()=>{const p=document.getElementById('building-popup');return {hidden:p.hidden,text:p.innerText,links:p.querySelectorAll('a').length}}")
 assert not popup['hidden'] and '종루' in popup['text'] and '존재 시기' in popup['text'] and '1750년 무렵' in popup['text'] and popup['links']>=1,popup
 page.dispatch_event('#building-popup button','click')
 assert page.evaluate("document.getElementById('building-popup').hidden")
 # Walking straight at a shop stops at its front face instead of passing through.
 player=page.evaluate('''()=>{const t=terrain3d,fp=t.firstPerson,canvas=t.renderer.domElement;
  const r=t.sijeon.records.find(r=>r.displayed&&r.bays>=6&&!t.collision.hit(r.x-Math.sin(r.yaw)*9,r.z-Math.cos(r.yaw)*9,.6));
  fp.enter();const sx=Math.sin(r.yaw),sz=Math.cos(r.yaw);
  fp.placeAt(r.x-sx*9,r.z-sz*9,Math.atan2(-sx,-sz));t.pedestrians.group.visible=false;
  canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW',bubbles:true}));
  const before=fp.eye;for(let i=0;i<240;i++)fp.update(1/30);
  canvas.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW',bubbles:true}));
  t.pedestrians.group.visible=true;
  const e=fp.eye;fp.exit();
  return {moved:Math.hypot(e.x-before.x,e.z-before.z),localZ:(e.x-r.x)*sx+(e.z-r.z)*sz,inside:!!t.collision.hit(e.x,e.z,.3)}}''')
 print('player',player,flush=True)
 assert 4<player['moved']<7 and -3.8<player['localZ']<-3.3 and not player['inside'],player
 # Pedestrians step aside from the player and keep apart from each other.
 people=page.evaluate('''()=>{const ped=terrain3d.pedestrians,w=ped.walkers[10];
  ped.update(0);const start=w.position.clone();
  for(let i=0;i<40;i++){ped.setAvoidPoint({x:start.x,z:start.z});ped.update(1/30)}
  ped.setAvoidPoint(null);
  let close=0;for(let i=0;i<ped.walkers.length;i++)for(let j=i+1;j<ped.walkers.length;j++){const a=ped.walkers[i].position,c=ped.walkers[j].position;if(Math.hypot(a.x-c.x,a.z-c.z)<.45)close++}
  return {dodge:Math.abs(w.dodge),away:Math.hypot(w.position.x-start.x,w.position.z-start.z),close}}''')
 print('pedestrians',people,flush=True)
 assert people['dodge']>.5 and people['away']>1 and people['close']==0,people
 assert not errors,errors
 print('PASS: popup, walking collision, pedestrian side-stepping and 경복궁 label',flush=True);b.close()
