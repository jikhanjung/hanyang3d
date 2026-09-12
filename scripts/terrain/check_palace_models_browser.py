"""Verify palace models, their source-map placement and the two palace gates."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':750});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 result=page.evaluate('''()=>{const t=terrain3d;t.renderer.setAnimationLoop(null);const out=[];for(const id of ['gyeongdeok','changdeok','changgyeong']){const b=t.buildings.children.find(b=>b.userData.feature.id===id),m=b.getObjectByName('palace-compound');if(!m||b.material.visible||m.children.length!==6)throw Error('palace replacement failed');if(m.userData.roofTiers!==(id==='changdeok'?2:1))throw Error('roof tiers');if(!m.userData.parts.includes('red-column')||!m.userData.parts.includes('forecourt'))throw Error('palace details missing');out.push({id,parts:m.userData.parts.length,meshes:m.children.length,tiers:m.userData.roofTiers});}const before=t.buildings.children.map(b=>b.position.toArray());for(const value of ['2','1']){const e=document.getElementById('height3d');e.value=value;e.onchange()}if(before.some((p,i)=>p.some((v,j)=>Math.abs(v-t.buildings.children[i].position.toArray()[j])>1e-6)))throw Error('height reset changed positions');return out}''')
 print(result,flush=True)
 gates=page.evaluate('''()=>{const t=terrain3d,out=[];for(const id of ['donhwamun','honghwamun']){const b=t.buildings.children.find(b=>b.userData.feature.id===id);if(!b)throw Error('gate feature missing: '+id);const m=b.getObjectByName('palace-gate');if(!m||b.material.visible||m.children.length!==5)throw Error('gate model failed: '+id);for(const part of ['gate-door','red-column','gate-roof','upper-house'])if(!m.userData.parts.includes(part))throw Error('gate part missing: '+part);out.push({id,x:b.position.x,z:b.position.z,yaw:b.rotation.y,meshes:m.children.length,parts:m.userData.parts.length});}const at=id=>t.buildings.children.find(b=>b.userData.feature.id===id).position;const cd=at('changdeok'),cg=at('changgyeong'),dh=at('donhwamun'),hh=at('honghwamun');return{gates:out,changdeokEastOfGate:dh.x-cd.x,gateSouthOfChangdeok:dh.z-cd.z,changgyeongEastOfChangdeok:cg.x-cd.x,honghwaEastOfChanggyeong:hh.x-cg.x,gapNorthSouth:Math.abs(hh.z-cg.z)}}''')
 print(gates,flush=True)
 assert gates['changgyeongEastOfChangdeok']>0,'changgyeong must stay east of changdeok'
 assert gates['gateSouthOfChangdeok']>40,'donhwamun must sit south of changdeok'
 assert 30<gates['honghwaEastOfChanggyeong']<70,'honghwamun must front changgyeong'
 assert gates['gapNorthSouth']<12,'honghwamun must stay on the changgyeong axis'
 for id in ['gyeongdeok','changdeok','changgyeong','donhwamun','honghwamun']:
  page.evaluate('''id=>{const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id===id);t.controls.target.copy(b.position);t.camera.position.copy(b.position);t.camera.position.x+=50;t.camera.position.y+=32;t.camera.position.z+=60;t.controls.update();t.updateBuildingNames();t.renderer.render(t.scene,t.camera)}''',id)
  page.screenshot(path='/tmp/'+id+'-model.png',timeout=120000)
 assert not errors,errors
 print('PASS: palace models batched, tiers and details present, height reset stable, both palace gates placed in front of their palaces',flush=True);b.close()
