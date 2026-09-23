import * as THREE from 'three';
import {createEventNeighborhood} from '../event_neighborhood.js';
import {createWalker} from '../pedestrians.js';
import {buildRoute} from './route.js';

// Stage module: shadow a lantern-lit group along a route without being seen. The walker keeps a distance: too close
// for a few seconds and they slip back into a lane (never caught); too far and the group is lost from sight, so it
// pauses. A 'gate' moment can stop the group, flash as if shots were fired and let a figure at the gate fall — seen
// from afar only. One checkpoint per route point. The group's make-up, route and the gate staging are interpretive.
export function createShadow(api){
 const {data,say,text,fp,scene,camera,walking,buildings,surface,waterAt}=api;
 const root=new THREE.Group();root.name='shadowed-group';root.visible=false;scene.add(root);
 const g=data.group,keep=data.keep;
 const lanternMat=new THREE.MeshBasicMaterial({color:0xffc56b});
 const members=[];
 for(let i=0;i<g.count;i++){
  const p=createWalker();p.group.name='shadowed-member';p.group.getObjectByName('walker-body').material.color.set(g.colors[i%g.colors.length]);
  if(i%g.lantern_every===0){
   const lantern=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),lanternMat);lantern.position.set(.36,1.05,.25);p.group.add(lantern);
   // Two real lights are enough to read the group in the dark; the other lanterns only glow.
   if(members.filter(m=>m.light).length<2){const light=new THREE.PointLight(0xffb45a,2.4,24,1.6);light.position.copy(lantern.position);p.group.add(light);p.light=light}
  }
  root.add(p.group);members.push(p);
 }
 // The figure who bars the gate: seen from the far end of the square, never close up.
 const gateGuard=createWalker();gateGuard.group.name='gate-defender';gateGuard.group.getObjectByName('walker-body').material.color.set('#3c4d6b');gateGuard.group.visible=false;scene.add(gateGuard.group);
 const rejoin=api.panel.button('historical-event-rejoin',say('무리를 다시 찾기','Find the group again'),()=>{if(fp.active)regroup()});
 let route=null,distance=0,neighborhood=null,closeFor=0,notice=0,gate={state:'pending',t:0,fall:0},finished=false;
 const spacing=g.spacing_m??2.4,tailOffset=()=>spacing*(g.count-1);

 function prepare(){
  if(route)return;
  route=buildRoute(api,data.route);
  neighborhood=createEventNeighborhood({path:route.path,surface,scene,walking,buildings,waterAt});
  if(data.gate){const p=api.atPixel(data.gate.defender_pixel);gateGuard.group.position.set(p.x,fp.groundAt(p.x,p.z),p.z);gateGuard.group.rotation.y=route.sample(route.milestones[data.gate.at]).yaw+Math.PI}
 }
 function place(moving){
  for(const [i,m] of members.entries()){
   const {p,yaw}=route.sample(distance-i*spacing),side=((i%3)-1)*.9;
   m.group.position.set(p.x+Math.cos(yaw)*side,0,p.z-Math.sin(yaw)*side);m.group.position.y=fp.groundAt(m.group.position.x,m.group.position.z);
   m.group.rotation.y=yaw;m.update(distance*1.3+i,moving);
  }
 }
 function behind(extra=0){return route.sample(Math.max(0,distance-tailOffset()-(keep.start_behind_m??30)-extra))}
 function regroup(){const {p,yaw}=behind();fp.placeAt(p.x,p.z,yaw+Math.PI);fp.clearInput();closeFor=0}
 function enter(index){
  prepare();root.visible=true;finished=false;rejoin.hidden=false;
  distance=Math.max(tailOffset()+2,route.milestones[Math.max(0,Math.min(route.milestones.length-1,index))]);
  gate.state=data.gate&&distance>=route.milestones[data.gate.at]?'done':'pending';
  gateGuard.group.visible=!!data.gate&&gate.state==='pending';gateGuard.group.rotation.x=0;
  place(false);
  // Starting fresh the walker stays where the previous stage left them; a resume puts them behind the group.
  const tail=members.at(-1).group.position;if(index>0||Math.hypot(fp.eye.x-tail.x,fp.eye.z-tail.z)>keep.far_m*1.5)regroup();
  api.panel.message(text(data,'intro'));api.reach(0);
 }
 function exit(){root.visible=false;gateGuard.group.visible=false;rejoin.hidden=true;api.markMap(null)}
 function reset(){gate={state:'pending',t:0,fall:0};gateGuard.group.rotation.x=0;finished=false;closeFor=0}
 function idle(){neighborhood?.setLod(camera.position)}
 // The gate moment: the group halts, shots flash, the defender falls, then the group goes in.
 function updateGate(dt){
  const gd=data.gate;gate.t+=dt;
  for(const beat of gd.beats){if(!beat.done&&gate.t>=beat.t){beat.done=true;if(beat.flash)api.flash(beat.flash);if(beat.cue)api.cue(beat.cue);if(beat.text)api.panel.message(text(beat,'text'));if(beat.fall)gate.fall=.001}}
  if(gate.fall>0&&gate.fall<1){gate.fall=Math.min(1,gate.fall+dt/.7);gateGuard.group.rotation.x=-Math.PI/2*gate.fall}
  if(gate.t>=gd.hold_s){gate.state='done';for(const beat of gd.beats)beat.done=false}
  return gate.state!=='done';
 }
 function update(dt){
  if(finished)return;
  const eye=fp.eye,tail=members.at(-1).group.position,lead=members[0].group.position;
  let near=Infinity;for(const m of members)near=Math.min(near,Math.hypot(eye.x-m.group.position.x,eye.z-m.group.position.z));
  const far=Math.hypot(eye.x-tail.x,eye.z-tail.z);
  api.markMap(lead);
  // Too close for too long: someone turns round, and the walker ducks back into the dark.
  if(near<keep.near_m){closeFor+=dt;if(closeFor>2.5){const {p,yaw}=behind(10);fp.placeAt(p.x,p.z,yaw+Math.PI);fp.clearInput();closeFor=0;notice=4;api.panel.message(text(data,'too_close_caught'));return}}
  else closeFor=0;
  const atGate=data.gate&&gate.state!=='done'&&distance>=route.milestones[data.gate.at];
  if(atGate&&gate.state==='pending'){gate.state='running';gate.t=0}
  const holding=atGate&&updateGate(dt);
  const moving=!holding&&far<=keep.far_m&&!api.saveError&&distance<route.total;
  if(moving)distance=Math.min(route.total,distance+dt*g.speed_mps);
  place(moving);
  let index=api.checkpointIndex;while(index<route.milestones.length-2&&distance>=route.milestones[index+1]&&far<keep.far_m){index++;api.reach(index)}
  // A notice (being seen) stays on the panel for a few seconds before the running hint returns.
  if(notice>0)notice-=dt;
  if(!holding&&notice<=0){
   const name=data.route[Math.min(index+1,data.route.length-1)];
   api.panel.message(closeFor>0?text(data,'too_close'):far>keep.far_m?text(data,'too_far'):say(`${name.name} — ${data.follow_hint}`,`${name.name_en} — ${data.follow_hint_en}`));
  }
  if(distance>=route.total&&far<keep.far_m*.6&&!api.saving){finished=true;api.finish()}
 }
 return {prepare,enter,exit,reset,idle,update,regroup,root,members,gateGuard,
  get route(){return route},get distance(){return distance},get gateState(){return gate.state},get neighborhood(){return neighborhood}};
}
