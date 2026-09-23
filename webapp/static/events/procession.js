import * as THREE from 'three';
import {createRoyalArrival,createLegationGuard} from '../royal_arrival.js';
import {createEventNeighborhood} from '../event_neighborhood.js';
import {createWalker} from '../pedestrians.js';
import {buildRoute} from './route.js';

// Stage module: follow two sedan chairs along a route of checkpoints, with an invented patrol near miss on the way
// and an arrival scene at the end. One checkpoint per route point; the module claims the first when it starts and
// reports the last when the arrival scene has played. Interpretive scenery and motion throughout.
export function createProcession(api){
 const {data,say,text,fp,scene,camera,container,walking,buildings,infrastructure,surface,safe,waterAt}=api;
 const root=new THREE.Group();root.name='procession';root.visible=false;scene.add(root);
 function chair(index){
  const group=new THREE.Group(),cabin=new THREE.Group();group.add(cabin);root.add(group);
  const mats={wood:new THREE.MeshStandardMaterial({color:0x66442f}),cloth:new THREE.MeshStandardMaterial({color:index?0x736d61:0x5b6870}),roof:new THREE.MeshStandardMaterial({color:0x363934})};
  const box=(x,y,z,w,h,d,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[mat]);m.position.set(x,y,z);cabin.add(m);return m};
  box(0,.85,0,1.15,.12,1.5,'wood');box(.55,1.48,0,.04,1.2,1.4,'cloth');for(const z of [-.7,.7])box(0,1.48,z,1.1,1.2,.04,'cloth');const curtain=box(-.55,1.48,0,.04,1.2,1.4,'cloth');box(0,2.12,0,1.4,.16,1.7,'roof');
  for(const x of [-.56,.56]){box(x,1.48,-.7,.08,1.25,.08,'wood');box(x,1.48,.7,.08,1.25,.08,'wood');box(x,1.31,0,.1,.1,4.7,'wood')}
  const bearers=[];for(const x of [-.92,.92])for(const z of [-1.75,1.75]){const p=createWalker();p.group.position.set(x,0,z);group.add(p.group);bearers.push(p)}
  return {group,cabin,bearers,curtain};
 }
 const chairs=[chair(0),chair(1)];
 const arrivalBuilding=buildings.find(b=>b.userData.feature.id===data.arrival_building);
 const guard=createLegationGuard({scene,groundAt:surface.ground,infrastructure,building:arrivalBuilding});
 // Invented near miss: a patrol comes down the road before the pass. The walker who scouts ahead can send the bearers
 // into a side lane; if nobody warns them they duck in by themselves, so nothing ever ends in capture.
 const patrol={state:'pending',soldiers:[],group:new THREE.Group(),along:0,hideAt:0,spot:null,anim:0,from:[],warned:false,seen:false};patrol.group.name='patrol';patrol.group.visible=false;root.add(patrol.group);
 for(let i=0;i<(data.patrol?.soldiers??0);i++){
  const p=createWalker();p.group.name='patrol-soldier';p.group.getObjectByName('walker-body').material.color.set('#3b3f3a');
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.19,.18,.11,12),new THREE.MeshStandardMaterial({color:0x2c2f2a}));cap.position.y=1.76;p.group.add(cap);
  const rifle=new THREE.Mesh(new THREE.BoxGeometry(.055,1.2,.065),new THREE.MeshStandardMaterial({color:0x584434}));rifle.position.set(.38,.83,.02);p.group.add(rifle);
  patrol.group.add(p.group);patrol.soldiers.push(p);
 }
 const rejoin=api.panel.button('historical-event-rejoin',say('가마 뒤로 돌아가기','Rejoin the chairs'),()=>{if(fp.active)regroup()});
 const warn=api.panel.button('historical-event-warn',say('가마꾼에게 숨으라고 이르기','Tell the bearers to hide'),()=>{if(patrol.state==='approaching'&&!warn.hidden)startHiding(true)});
 let path=[],lengths=[],milestones=[],sampleRoute=null,distance=0,neighborhood=null,arrival=null,patrolMessage='',entered=false;

 // ---- route (shared helper in route.js) ----
 function prepare(){
  if(lengths.length)return;
  const route=buildRoute(api,data.route);path=route.path;lengths=route.lengths;milestones=route.milestones;sampleRoute=route.sample;
  neighborhood=createEventNeighborhood({path,surface,scene,walking,buildings,waterAt});
  if(data.patrol){
   // The hiding place: a passable pocket beside the road a little before the patrol's route point.
   patrol.hideAt=Math.max(data.spacing_m+20,milestones[data.patrol.before_route_index]-data.patrol.lead_m);
   const {p:h,yaw}=sample(patrol.hideAt),side=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));patrol.spot=null;
   for(const r of [9,12,15,7]){for(const sign of [1,-1]){const q=h.clone().addScaledVector(side,sign*r);if(safe(q)&&safe(h.clone().addScaledVector(side,sign*r/2))){patrol.spot=q;break}}if(patrol.spot)break}
   if(!patrol.spot)patrol.spot=h.clone();
  }
 }
 const sample=s=>sampleRoute(s);

 function place(){for(const [i,c] of chairs.entries()){const {p,yaw}=sample(distance-i*data.spacing_m);c.group.position.set(p.x,fp.groundAt(p.x,p.z),p.z);c.group.rotation.y=yaw}}
 function regroup(){const {p,yaw}=sample(Math.max(0,distance-data.spacing_m-7));fp.placeAt(p.x,p.z,yaw+Math.PI);fp.clearInput()}
 const startArrival=()=>{arrival=createRoyalArrival({scene,camera,container,chairs,building:arrivalBuilding,fp,say,guard});return arrival};

 // ---- patrol ------------------------------------------------------------------------------------------------------
 const patrolPos=()=>patrol.soldiers[0].group.position;
 function placePatrol(){for(const [i,p] of patrol.soldiers.entries()){const {p:q,yaw}=sample(patrol.along+i*1.6);p.group.position.set(q.x,fp.groundAt(q.x,q.z),q.z);p.group.rotation.y=yaw+Math.PI;p.update(patrol.along*1.4,true)}}
 function startHiding(byPlayer){
  patrol.state='hiding';patrol.anim=0;patrol.warned=byPlayer;warn.hidden=true;patrol.from=chairs.map(c=>c.group.position.clone());
  patrolMessage=byPlayer?say('가마꾼들이 골목으로 들어갑니다. 당신도 눈에 띄지 않게 물러서세요.','The bearers slip into the lane. Keep out of sight yourself.'):say('가마꾼들이 스스로 골목에 숨었습니다. 다음에는 먼저 알려 주세요.','The bearers hid on their own. Warn them sooner next time.');
 }
 function updatePatrol(dt){
  const pd=data.patrol;if(!pd||!patrol.soldiers.length)return false;
  if(patrol.state==='done'||(patrol.state==='pending'&&distance<patrol.hideAt-pd.start_before_m)){patrolMessage='';return false}
  if(patrol.state==='pending'){patrol.state='approaching';patrol.along=patrol.hideAt+pd.approach_from_m;patrol.group.visible=true;placePatrol()}
  const leader=chairs[0].group.position,eye=fp.eye;
  if(patrol.state==='approaching'){
   patrol.along-=dt*pd.speed_mps;placePatrol();
   // Once spotted, the patrol stays known while the walker runs back to the chairs.
   if(Math.hypot(eye.x-patrolPos().x,eye.z-patrolPos().z)<pd.notice_distance_m)patrol.seen=true;
   const seen=patrol.seen,close=Math.hypot(eye.x-leader.x,eye.z-leader.z)<pd.warn_distance_m;
   warn.hidden=!(seen&&close);
   patrolMessage=seen?close?say('앞에서 순찰이 옵니다. 지금 가마꾼에게 이르세요.','A patrol is coming. Tell the bearers now.'):say('앞에서 순찰이 옵니다! 가마로 돌아가 가마꾼에게 숨으라고 이르세요.','A patrol ahead! Get back to the chairs and tell the bearers to hide.'):'';
   // Left unwarned, the bearers see the patrol themselves at the last moment.
   if(distance>=patrol.hideAt||Math.hypot(patrolPos().x-leader.x,patrolPos().z-leader.z)<40)startHiding(false);
   return false;
  }
  if(patrol.state==='hiding'||patrol.state==='returning'){
   patrol.along-=dt*pd.speed_mps;placePatrol();patrol.anim=Math.min(1,patrol.anim+dt/4);
   const back=patrol.state==='returning';
   for(const [i,c] of chairs.entries()){
    const road=sample(patrol.hideAt-i*data.spacing_m).p,target=patrol.spot.clone().add(new THREE.Vector3(0,0,i*3.2)),a=back?target:patrol.from[i],b=back?road:target;
    c.group.position.copy(a).lerp(b,patrol.anim);c.group.position.y=fp.groundAt(c.group.position.x,c.group.position.z);c.group.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);
    for(const p of c.bearers)p.update(patrol.anim*12,patrol.anim<1);
   }
   if(patrol.anim>=1){if(back){patrol.state='done';distance=patrol.hideAt;patrol.group.visible=false;patrolMessage='';place();return false}patrol.state='hidden'}
   return true;
  }
  if(patrol.state==='hidden'){
   patrol.along-=dt*pd.speed_mps;placePatrol();for(const c of chairs)for(const p of c.bearers)p.update(0,false);
   const brush=Math.hypot(eye.x-patrolPos().x,eye.z-patrolPos().z)<5;
   patrolMessage=brush?say('순찰이 당신을 힐끗 보고 지나갑니다. 가만히 있으세요.','The patrol glances at you and moves on. Stay still.'):say('가마가 골목에 숨어 있습니다. 순찰이 지나갈 때까지 기다리세요.','The chairs are hidden. Wait for the patrol to pass.');
   if(patrol.along<patrol.hideAt-pd.leave_m){patrol.state='returning';patrol.anim=0;patrolMessage=say('순찰이 지나갔습니다. 가마가 길로 돌아옵니다.','The patrol has gone. The chairs return to the road.')}
   return true;
  }
  return false;
 }

 // ---- module interface --------------------------------------------------------------------------------------------
 function reset(){root.visible=false;arrival?.reset();arrival=null;patrol.state='pending';patrol.group.visible=false;patrol.warned=false;patrol.seen=false;warn.hidden=true;rejoin.hidden=true;patrolMessage='';entered=false}
 // `index` is the route point to resume from; `silent` restores a finished procession (chairs at the gate, passengers
 // inside) without playing it, so later stages can use the interpreter as an anchor.
 function enter(index,silent=false){
  prepare();root.visible=true;
  distance=Math.min(lengths.at(-1),Math.max(data.spacing_m+7,milestones[Math.max(0,Math.min(data.route.length-1,index))]));
  patrol.state=distance>=patrol.hideAt?'done':'pending';patrol.group.visible=false;patrolMessage='';
  place();
  if(silent||index>=data.route.length-1){
   distance=lengths.at(-1);place();arrival?.reset();startArrival();
   if(silent){while(!arrival.done)arrival.update(.5);return}
   api.panel.message(text(data,'arrival_message'));rejoin.hidden=true;entered=true;return;
  }
  if(!entered){entered=true;const p=fp.eye;fp.placeAt(p.x,p.z,Math.atan2(-(path[0].x-p.x),-(path[0].z-p.z)));fp.clearInput()}
  else regroup();
  rejoin.hidden=false;api.reach(0);
 }
 function exit(){rejoin.hidden=true;warn.hidden=true}
 function idle(){neighborhood?.setLod(camera.position)}
 function update(dt){
  if(arrival){if(arrival.update(dt))api.finish();return}
  const leader=chairs[0].group.position,tail=chairs[1].group.position,eye=fp.eye,near=Math.min(Math.hypot(eye.x-leader.x,eye.z-leader.z),Math.hypot(eye.x-tail.x,eye.z-tail.z)),far=Math.hypot(eye.x-tail.x,eye.z-tail.z);
  const hidden=updatePatrol(dt);
  const moving=far<=45&&near>=3&&!api.saveError&&!hidden;
  if(moving)distance=Math.min(lengths.at(-1),distance+dt*data.speed_mps);
  if(!hidden)place();for(const c of chairs){c.cabin.position.y=moving?Math.sin(distance*2)*.025:0;for(const p of c.bearers){p.update(distance,moving);for(const arm of p.group.children.filter(o=>o.isGroup&&Math.abs(o.position.y-1.35)<.01))arm.rotation.x=-1.25}}
  // Route points count off one by one; the last is reported only when the arrival scene has played.
  let index=api.checkpointIndex;while(index<milestones.length-2&&distance>=milestones[index+1]&&far<45){index++;api.reach(index)}
  const percent=Math.round(distance/lengths.at(-1)*100),name=data.route[Math.min(index+1,data.route.length-1)];
  if(patrolMessage){api.panel.message(patrolMessage)}
  else api.panel.message(near<3?say('가마에 너무 가깝습니다. 조금 물러서 주세요.','Step back from the chairs.'):far>45?say('가마가 기다립니다. 가까이 오거나 가마 뒤로 돌아가세요.','The chairs are waiting. Catch up or rejoin.'):say(`${name.name} · ${percent}% — 가마와 거리를 두고 따라가세요.`,`${name.name_en} · ${percent}% — Follow at a distance.`));
  if(distance>=lengths.at(-1)&&far<30&&!api.saving){fp.clearInput();rejoin.hidden=true;startArrival();api.panel.message(text(data,'arrival_message'))}
 }
 const anchors=()=>({host:arrival?.host??null});
 return {prepare,enter,exit,reset,idle,update,regroup,anchors,root,chairs,patrol,guard,warnButton:warn,
  get arrival(){return arrival},get neighborhood(){return neighborhood},get path(){return path},get milestones(){return milestones},get distance(){return distance},get spot(){return patrol.spot}};
}
