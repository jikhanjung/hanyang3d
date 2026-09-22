import {createFishing} from './fishing.js';
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
import {createSceneCurtain} from './scene_curtain.js';
import {createHorseDealer} from './horse_dealer.js';
const eventVisit=!!JSON.parse(document.getElementById('historical-event')?.textContent??'null');
// Visits that start from this scene: each brings a keepsake item, a giver's dialogue and its transition captions.
const visits=JSON.parse(document.getElementById('historical-events')?.textContent??'[]');
const visitByItem=id=>visits.find(v=>v.keepsake.item===id);
const el=id=>document.getElementById(id),json=id=>JSON.parse(el(id).textContent);

export function createWalk1907({scene,camera,controls,renderer,buildings,infrastructure,infraData,groundAt,surface,geometry,texture,settlement,flatMap}){
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
 for(const wall of infrastructure.palaceWalls)for(const s of wall.segments)collision.add({x:s.x,z:s.z,hw:wall.data.width_m/2,hd:s.length/2,yaw:s.yaw,visible:()=>wall.group.visible});
 for(const r of settlement?.records??[])collision.add({x:r.x,z:r.z,hw:r.w/2,hd:r.d/2,yaw:r.yaw,visible:()=>settlement.group.visible&&r.displayed});
 const stationary=createStationaryPeople1907(buildings,data,groundAt);scene.add(stationary.group);
 const horseData=data.horse_dealer,horsePerson=createPerson1907({merchant:true});
 const horseDealer=createHorseDealer({position:surface(...horseData.placement.pixel),yaw:horseData.placement.yaw_deg*Math.PI/180,personModel:horsePerson.group});
 horseDealer.name='horse-dealer-1907';horseDealer.userData.temporal=horseData.placement.temporal;scene.add(horseDealer);
 horseDealer.userData.update(0,groundAt);
 // Keep the hitching rail and horses off the walking corridor.
 const horseFrame={x:horseDealer.position.x,z:horseDealer.position.z,yaw:horseDealer.rotation.y};
 collision.addLocal(horseFrame,3.5,.6,2.4,1.5,()=>horseDealer.visible);
 const shop=createShop({container:el('scene'),data:npcData,onLogout:()=>firstPerson?.exit(),onMessage:text=>together?.chat?.system(text),onUse:id=>npcData.items[id]?.use==='flashback'?useKeepsake(id):eventVisit?null:npcData.items[id]?.use==='fish'?firstPerson.fishing?.use():npcData.items[id]?.use==='mount'?firstPerson.setMounted(!firstPerson.mounted):null});shop.showHud(false);
 // Using a keepsake in the base scene opens its visit; inside a visit the item is already whatever the story says.
 function useKeepsake(id){
  const en=document.documentElement.lang==='en';
  if(eventVisit){const k=JSON.parse(document.getElementById('historical-event').textContent).keepsake;return en?k.in_visit_en:k.in_visit}
  const v=visitByItem(id);if(!v)return '';startHistoricalVisit(v);return en?v.keepsake.on_use_en:v.keepsake.on_use;
 }
 const profile=createWalkProfile({account:shop}),navigation=createNavigation1907(geometry,texture,flatMap);
 firstPerson=createFirstPerson({scene,camera,controls,renderer,pedestrians,shop,npcData,walkProfile:profile,navigation,
  positionWorld:{alignment:eventVisit?'visit-'+JSON.parse(document.getElementById('historical-event').textContent).slug:'seoul1907',routeKey:pedestrians.routeKey},getCollision:()=>collision,walkerFactory:()=>createPerson1907(),
  terrainGround:(x,z)=>{const y=groundAt(x,z);return y===null?null:y+.025},
  getSurfaceVersion:()=>infrastructure.walkableVersion??1,
  getWalkables:()=>[...infrastructure.bridges.children.map(o=>[o,()=>infrastructure.bridges.visible]),...buildings.flatMap(b=>(b.userData.walkSurfaces??[]).map(o=>[o,()=>b.visible]))],
  getInterior:interiorAt,
  getCameraObstacles:()=>buildings.filter(b=>b.visible&&camera.position.distanceToSquared(b.position)<160*160).flatMap(b=>b.userData.cameraShell??[]),
  onBeforeEnter:()=>{el('building-info').hidden=true;el('options').classList.remove('open');el('menu').setAttribute('aria-expanded','false')},onExit:()=>together?.stop()});
 const status=document.createElement('div');status.id='walk-together-status';status.hidden=true;status.setAttribute('role','status');el('scene').append(status);
 together=eventVisit?{stop(){},update(){},connected:false,chat:null}:createWalkTogether({scene,firstPerson,pedestrians,profile,alignment:'seoul1907',groundAt:firstPerson.groundAt,endpoint:new URL(json('multiplayer-url'),location.href).href,mapVersion:json('map-version'),button:el('walk-together'),status,walkerFactory:()=>createPerson1907()});
 const dialogue=createNpcDialogue({camera,canvas:renderer.domElement,container:el('scene'),note:data.note,onAction:(action,npc)=>{if(action==='historical-visit')startHistoricalVisit();else if(action==='shop'&&!eventVisit)shop.open(npc.merchant);else if(action.startsWith('event:keepsake:'))receiveKeepsake(action.slice(15));else if(action.startsWith('event:'))eventAction?.(action.slice(6),npc)}});
 let eventAction=null;
 async function receiveKeepsake(slug){
  const v=visits.find(v=>v.slug===slug);if(!v)return;const k=v.keepsake,en=document.documentElement.lang==='en';
  try{
   if(!shop.state.loggedIn&&!await shop.requireLogin())return;
   const csrf=document.cookie.split('; ').find(v=>v.startsWith('csrftoken='))?.slice(10)??'';
   const r=await fetch(`/api/events/${slug}/`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({action:'keepsake'})});
   const result=await r.json();if(!r.ok)throw Error(result.error||'keepsake request failed');
   await shop.refresh();shop.notify(en?k.received_en:k.received);
  }catch(error){shop.notify(error.message)}
 }
 const nodes=(source,trade)=>Object.fromEntries(Object.entries(source).map(([key,n])=>[key,{...n,text:n.text.replaceAll('{shop}',trade??'')} ]));
 const npcFor=r=>{
  const info=r.dialogue??data[r.role],dialogueNodes=nodes(info.nodes,r.trade);
  // Choose only when the conversation actually starts, not during hit testing.
  const getBubbleText=r.mode==='bubble'&&info.lines?.length?()=>{
   if(Math.random()<(info.silence_chance??0))return null;
   return info.lines[Math.floor(Math.random()*info.lines.length)].text;
  }:undefined;
  let merchant=r.role==='merchant'?{trade:r.trade,sells:r.trade}:null;
  // A visit's giver hands over the keepsake that opens it; once owned, only a reminder remains.
  for(const v of eventVisit?[]:visits.filter(v=>v.keepsake.giver_building===r.owner.userData.feature.id)){
   const k=v.keepsake,en=document.documentElement.lang==='en',owned=shop.state.items[k.item]>0,node=k.nodes[owned?'hint':'rumour'],key='keepsake_'+v.slug;
   dialogueNodes.hello={...dialogueNodes.hello,options:[{label:en?k.offer_en:k.offer,next:key},...dialogueNodes.hello.options]};
   dialogueNodes[key]={text:en?node.text_en:node.text,options:node.options.map(o=>({...o,label:en?o.label_en:o.label,action:o.action==='event:keepsake'?'event:keepsake:'+v.slug:o.action}))};
  }
  const corner=r.owner.userData.privateCorner;
  if(r.wander&&corner&&firstPerson.active&&interiorAt(firstPerson.eye)===r.owner&&firstPerson.eye.distanceTo(r.position)<3){
   const p=r.owner.worldToLocal(r.position.clone());
   if(p.x>corner.x0&&p.x<corner.x1&&p.z>corner.z0&&p.z<corner.z1){
    dialogueNodes.hello={...dialogueNodes.hello,options:[{label:data.bookshop_private.offer,label_en:data.bookshop_private.offer_en,next:'private_books'},...dialogueNodes.hello.options]};
    dialogueNodes.private_books=data.bookshop_private.node;merchant={trade:data.bookshop_private.shop,sells:data.bookshop_private.shop};
   }
  }
  return {key:r.key,mode:r.mode,getBubbleText,name:info.name,subtitle:info.subtitle,portrait:info.portrait??(r.role==='guard'?'guard1907':'merchant'),nodes:dialogueNodes,position:()=>r.position,merchant,maxDistance:r.indoors?12:100,begin:()=>{firstPerson.clearInput();r.talking=true},finish:()=>{r.talking=false}};
 };
 const horseNpc=()=>({key:'horse-dealer-1907',name:horseData.name,subtitle:horseData.subtitle,portrait:'horseDealer',nodes:horseData.nodes,position:()=>horseDealer.position,merchant:{trade:'말 장수',sells:'말'},maxDistance:100,begin:()=>firstPerson.clearInput(),finish:()=>horseDealer.userData.stopTalk(),face:p=>horseDealer.userData.face(p)});
 dialogue.register({pick(event,hitTest){if(!horseDealer.visible)return null;const distance=hitTest(event,horseDealer.position,1.95,100);return distance===null?null:{distance,npc:horseNpc()}}});
 dialogue.register({pick(event,hitTest){let best=null;if(stationary.group.visible)for(const r of stationary.records){if(r.pose==='seated_prayer'||!r.person.group.visible||(r.indoors&&interiorAt(camera.position)!==r.owner))continue;const distance=hitTest(event,r.position,1.95,100);if(distance!==null&&(!best||distance<best.distance))best={distance,npc:npcFor(r)}}return best}});
 dialogue.register({pick(event,hitTest){let best=null;if(pedestrians.group.visible)for(const w of pedestrians.walkers){const distance=hitTest(event,w.position,1.95,80);if(distance!==null&&(!best||distance<best.distance))best={distance,npc:{key:w.id,mode:'bubble',name:data.pedestrian.name,portrait:'walker1907',nodes:data.pedestrian.nodes,position:()=>w.position,maxDistance:100}}}return best}});
 firstPerson.fishing=createFishing({scene,camera,firstPerson,shop,dialogue,waterSurface:infrastructure.water.children[0],bridge:infrastructure.bridges.children.find(b=>b.userData.feature.id===npcData.fishing.bridge_ids['1907']),groundAt,collision:()=>collision,data:npcData,era:1907,visible:()=>el('people3d').checked});
 const curtain=createSceneCurtain();
 async function startHistoricalVisit(visit=visits[0]){
  if(!visit)return;
  if(!shop.state.loggedIn&&!await shop.requireLogin())return;
  if(!firstPerson.active)firstPerson.enter();if(!firstPerson.active)return;
  try{sessionStorage.setItem('agwan-return',JSON.stringify({name:shop.state.name,mounted:firstPerson.mounted}))}catch{}
  // Dissolve out of 1907 and arrive in the visit still on foot: the next page opens behind the same curtain.
  const en=document.documentElement.lang==='en',t=visit.transition;
  firstPerson.clearInput();
  await curtain.show(en?t.out_en:t.out);curtain.remember(en?t.in_en:t.in);
  location.href=`/events/${visit.slug}/`+(en?'?lang=en':'');
 }
 let press=null;const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)press={x:e.clientX,y:e.clientY,id:e.pointerId}});
 canvas.addEventListener('pointerup',e=>{if(!eventVisit&&!e.defaultPrevented&&press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<7)dialogue.pick(e);press=null});canvas.addEventListener('pointercancel',()=>press=null);
 el('people3d').addEventListener('change',()=>{stationary.group.visible=el('people3d').checked;horseDealer.visible=el('people3d').checked});
 function update(dt){firstPerson.update(dt);if(!firstPerson.active)firstPerson.fishing?.update();together.update(dt);pedestrians.setAvoidPoint(firstPerson.active?firstPerson.eye:null);pedestrians.update(dt);stationary.update(camera);if(horseDealer.visible)horseDealer.userData.update(performance.now(),groundAt);dialogue.update()}
 return {interiorAt,firstPerson,pedestrians,stationary,horseDealer,horseNpc,collision,shop,dialogue,navigation,curtain,together,update,npcFor,startHistoricalVisit,setEventAction:handler=>{eventAction=handler}};
}
