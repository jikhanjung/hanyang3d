import * as THREE from 'three';
import {createFirstPerson} from './first_person.js';
import {createPedestrians} from './pedestrians.js';
import {createCollision} from './collision.js';
import {createShop} from './shop.js';
import {createWalkProfile} from './walk_profile.js';
import {createWalkTogether} from './walk_together.js';
import {createNpcDialogue} from './npc_dialogue.js';
import {createPerson1907,createStationaryPeople1907} from './people1907.js';
import {createNavigation1907} from './navigation1907.js';
import {createHorseDealer} from './horse_dealer.js';
const el=id=>document.getElementById(id),json=id=>JSON.parse(el(id).textContent);

export function createWalk1907({scene,camera,controls,renderer,buildings,infrastructure,infraData,groundAt,surface,geometry,texture,settlement}){
 // Tiny local volumes avoid triangle tests and follow each building's rotation/height.
 const indoorBuildings=buildings.filter(b=>b.userData.interior?.volumes),local=new THREE.Vector3();
 function interiorAt(point){
  for(const b of indoorBuildings){
   if(!b.visible)continue;
   b.updateWorldMatrix(true,false);b.worldToLocal(local.copy(point));local.y+=b.userData.feature.symbol_size_m[1]/2;
   if(b.userData.interior.volumes.some(([x0,y0,z0,x1,y1,z1])=>local.x>x0&&local.x<x1&&local.y>=y0&&local.y<y1&&local.z>z0&&local.z<z1))return b;
  }
  return null;
 }
 const walking=json('walking-1907'),data=json('people-1907'),npcData=json('npcs');
 let firstPerson,together;
 const pedestrians=createPedestrians(walking,surface,{era:1907,footHeight:(x,z)=>firstPerson?.groundAt(x,z)??groundAt(x,z)+.025});scene.add(pedestrians.group);
 // Match triangle ground, even at a route's lane offset; no dependence on map alpha.
 pedestrians.updateGround((x,z)=>{const y=groundAt(x,z)+.025;return {max:y,terrain:{max:y},road:{max:y}}});
 const collision=createCollision();
 for(const b of buildings){
  const f=b.userData.feature,[w,,d]=f.symbol_size_m,frame={x:b.position.x,z:b.position.z,yaw:b.rotation.y},shown=()=>b.visible;
  const gate=b.userData.centres?b:b.getObjectByName('gate-model');
  if(b.userData.blockingRects){
   for(const r of b.userData.blockingRects)collision.addLocal(frame,r.x,r.z,r.hw,r.hd,shown);
  }else if(gate?.userData.centres||f.landmark_kind==='palace_gate'){
   let open,depth;
   if(gate?.userData.centres){const {centres,doorWidth}=gate.userData;open=centres.map(c=>[c-doorWidth/2,c+doorWidth/2]);depth=d/2}
   else{const bays=f.palace_gate_bays??3,half=Math.min(3,bays)*w*.8/bays/2;open=[[-half,half]];depth=d*.3}
   const edges=[-w/2,...open.flat(),w/2];for(let i=0;i<edges.length;i+=2){const a=edges[i],c=edges[i+1];if(c-a>.2)collision.addLocal(frame,(a+c)/2,0,(c-a)/2,depth,shown)}
   if(f.gate_identity==='heunginjimun'){
    const R=w*.6,a0=-Math.PI/2+.08,a1=Math.PI/2-.55,out=f.outer_side??1;
    for(let i=0;i<16;i++){const a=a0+(a1-a0)*i/16,b=a0+(a1-a0)*(i+1)/16,m=(a+b)/2,lx=R*Math.sin(m),lz=out*(d/2+R*Math.cos(m));collision.add({x:frame.x+lx*Math.cos(frame.yaw)+lz*Math.sin(frame.yaw),z:frame.z-lx*Math.sin(frame.yaw)+lz*Math.cos(frame.yaw),hw:R*(b-a)/2+.125,hd:.9,yaw:frame.yaw+out*m,visible:shown})}
   }
  }else collision.add({...frame,hw:w/2,hd:d/2,visible:shown});
 }
 for(const s of infrastructure.wall.segments)collision.add({x:s.x,z:s.z,hw:infraData.wall.width_m/2,hd:s.length/2,yaw:s.yaw,visible:()=>infrastructure.wall.group.visible});
 for(const r of settlement?.records??[])collision.add({x:r.x,z:r.z,hw:r.w/2,hd:r.d/2,yaw:r.yaw,visible:()=>settlement.group.visible&&r.displayed});
 const stationary=createStationaryPeople1907(buildings,data,groundAt);scene.add(stationary.group);
 const horseData=data.horse_dealer,horsePerson=createPerson1907({merchant:true});
 const horseDealer=createHorseDealer({position:surface(...horseData.placement.pixel),yaw:horseData.placement.yaw_deg*Math.PI/180,personModel:horsePerson.group});
 horseDealer.name='horse-dealer-1907';horseDealer.userData.temporal=horseData.placement.temporal;scene.add(horseDealer);
 horseDealer.userData.update(0,groundAt);
 // Keep the hitching rail and horses off the walking corridor.
 const horseFrame={x:horseDealer.position.x,z:horseDealer.position.z,yaw:horseDealer.rotation.y};
 collision.addLocal(horseFrame,3.5,.6,2.4,1.5,()=>horseDealer.visible);
 const shop=createShop({container:el('scene'),data:npcData,onLogout:()=>firstPerson?.exit(),onUse:id=>npcData.items[id]?.use==='mount'?firstPerson.setMounted(!firstPerson.mounted):null});shop.showHud(false);
 const profile=createWalkProfile({account:shop}),navigation=createNavigation1907(geometry,texture);
 firstPerson=createFirstPerson({scene,camera,controls,renderer,pedestrians,shop,npcData,walkProfile:profile,navigation,
  positionWorld:{alignment:'seoul1907',routeKey:pedestrians.routeKey},getCollision:()=>collision,walkerFactory:()=>createPerson1907(),
  terrainGround:(x,z)=>{const y=groundAt(x,z);return y===null?null:y+.025},
  getWalkables:()=>[...infrastructure.bridges.children.map(o=>[o,()=>infrastructure.bridges.visible]),...buildings.flatMap(b=>(b.userData.walkSurfaces??[]).map(o=>[o,()=>b.visible]))],
  getInterior:interiorAt,
  getCameraObstacles:()=>buildings.filter(b=>b.visible&&camera.position.distanceToSquared(b.position)<160*160).flatMap(b=>b.userData.cameraShell??[]),
  onBeforeEnter:()=>{el('building-info').hidden=true;el('options').classList.remove('open');el('menu').setAttribute('aria-expanded','false')},onExit:()=>together?.stop()});
 const status=document.createElement('div');status.id='walk-together-status';status.hidden=true;status.setAttribute('role','status');el('scene').append(status);
 together=createWalkTogether({scene,firstPerson,pedestrians,profile,alignment:'seoul1907',groundAt:firstPerson.groundAt,endpoint:new URL(json('multiplayer-url'),location.href).href,mapVersion:json('map-version'),button:el('walk-together'),status,walkerFactory:()=>createPerson1907()});
 const dialogue=createNpcDialogue({camera,canvas:renderer.domElement,container:el('scene'),note:data.note,onAction:(action,npc)=>{if(action==='shop')shop.open(npc.merchant)}});
 const nodes=(source,trade)=>Object.fromEntries(Object.entries(source).map(([key,n])=>[key,{...n,text:n.text.replaceAll('{shop}',trade??'')} ]));
 const npcFor=r=>{const info=r.dialogue??data[r.role];return {key:r.key,name:info.name,subtitle:info.subtitle,portrait:info.portrait??(r.role==='guard'?'guard1907':'merchant'),nodes:nodes(info.nodes,r.trade),position:()=>r.position,merchant:r.role==='merchant'?{trade:r.trade,sells:r.trade}:null,maxDistance:100,begin:()=>firstPerson.clearInput()}};
 const horseNpc=()=>({key:'horse-dealer-1907',name:horseData.name,subtitle:horseData.subtitle,portrait:'horseDealer',nodes:horseData.nodes,position:()=>horseDealer.position,merchant:{trade:'말 장수',sells:'말'},maxDistance:100,begin:()=>firstPerson.clearInput(),finish:()=>horseDealer.userData.stopTalk(),face:p=>horseDealer.userData.face(p)});
 dialogue.register({pick(event,hitTest){if(!horseDealer.visible)return null;const distance=hitTest(event,horseDealer.position,1.95,100);return distance===null?null:{distance,npc:horseNpc()}}});
 dialogue.register({pick(event,hitTest){let best=null;if(stationary.group.visible)for(const r of stationary.records){if(!r.person.group.visible)continue;const distance=hitTest(event,r.position,1.95,100);if(distance!==null&&(!best||distance<best.distance))best={distance,npc:npcFor(r)}}return best}});
 dialogue.register({pick(event,hitTest){let best=null;if(pedestrians.group.visible)for(const w of pedestrians.walkers){const distance=hitTest(event,w.position,1.95,80);if(distance!==null&&(!best||distance<best.distance))best={distance,npc:{key:w.id,name:data.pedestrian.name,portrait:'walker1907',nodes:data.pedestrian.nodes,position:()=>w.position,maxDistance:100,begin:()=>firstPerson.clearInput()}}}return best}});
 let press=null;const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)press={x:e.clientX,y:e.clientY,id:e.pointerId}});
 canvas.addEventListener('pointerup',e=>{if(!e.defaultPrevented&&press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<7)dialogue.pick(e);press=null});canvas.addEventListener('pointercancel',()=>press=null);
 el('people3d').addEventListener('change',()=>{stationary.group.visible=el('people3d').checked;horseDealer.visible=el('people3d').checked});
 function update(dt){firstPerson.update(dt);together.update(dt);pedestrians.setAvoidPoint(firstPerson.active?firstPerson.eye:null);pedestrians.update(dt);stationary.update(camera);if(horseDealer.visible)horseDealer.userData.update(performance.now(),groundAt);dialogue.update()}
 return {interiorAt,firstPerson,pedestrians,stationary,horseDealer,horseNpc,collision,shop,dialogue,together,update,npcFor};
}
