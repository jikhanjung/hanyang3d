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
 const lanternMat=new THREE.MeshBasicMaterial({color:0xffc56b}),muzzleMat=new THREE.MeshBasicMaterial({color:0xfff1b0,transparent:true,opacity:.9});
 const weaponMat={wood:new THREE.MeshStandardMaterial({color:0x4b3526,roughness:1}),steel:new THREE.MeshStandardMaterial({color:0x9aa1a6,roughness:.4,metalness:.6})};
 // The group is a mix of kinds (interpretive dress, not a documented roster): men in kimono and hakama with swords,
 // men in Western suits and bowlers, Japanese garrison soldiers and Korean Training Corps soldiers with rifles.
 // Built from a seeded random so the same group appears every time.
 let seed=g.seed??1895;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const mat=c=>new THREE.MeshStandardMaterial({color:c,roughness:1});
 const KINDS={
  ronin:{jacket:['#2b2a30','#3a3432','#2f3538','#43392f'],legs:'#3b3a40',hakama:['#4a4652','#3d3a33','#555049'],weapon:'sword'},
  suit:{jacket:['#1d1e22','#26241f'],legs:'#202024',hat:'bowler',weapon:'none'},
  garrison:{jacket:['#1f2b45'],legs:'#1f2b45',hat:'kepi',weapon:'rifle'},
  training:{jacket:['#2b2f36'],legs:'#2b2f36',hat:'kepi',weapon:'rifle'}};
 const roster=[];for(const [kind,n] of Object.entries(g.kinds??{ronin:g.count}))for(let k=0;k<n;k++)roster.push(kind);
 for(let k=roster.length-1;k>0;k--){const j=Math.floor(rand()*(k+1));[roster[k],roster[j]]=[roster[j],roster[k]]}
 const members=[];
 function dress(p,kindName){
  const kind=KINDS[kindName],body=p.group.getObjectByName('walker-body'),pick=a=>a[Math.floor(rand()*a.length)];
  body.material.color.set(pick(kind.jacket));
  p.group.children[3].visible=false;// no topknot
  for(const leg of p.group.children.filter(o=>o.isGroup&&Math.abs(o.position.y-1.1)<.01))leg.children[0].material=mat(kind.legs);
  if(kind.hakama){const h=new THREE.Mesh(new THREE.CylinderGeometry(.24,.36,.72,10),mat(pick(kind.hakama)));h.position.y=.66;p.group.add(h)}
  if(kind.hat==='bowler'){const crown=new THREE.Mesh(new THREE.SphereGeometry(.16,10,6,0,Math.PI*2,0,Math.PI/2),mat('#151515'));crown.position.y=1.66;p.group.add(crown);
   const brim=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.02,14),mat('#151515'));brim.position.y=1.67;p.group.add(brim)}
  if(kind.hat==='kepi'){const cap=new THREE.Mesh(new THREE.CylinderGeometry(.16,.17,.14,12),mat(kindName==='garrison'?'#1a2238':'#23272c'));cap.position.y=1.74;p.group.add(cap);
   const band=new THREE.Mesh(new THREE.CylinderGeometry(.172,.172,.035,12),mat(kindName==='garrison'?'#b33a2e':'#8a7a3a'));band.position.y=1.69;p.group.add(band);
   const visor=new THREE.Mesh(new THREE.BoxGeometry(.2,.02,.1),mat('#111'));visor.position.set(0,1.68,.17);p.group.add(visor)}
  return kind.weapon;
 }
 for(let i=0;i<roster.length;i++){
  const p=createWalker();p.group.name='shadowed-member';p.kind=roster[i];const weapon=dress(p,roster[i]);
  if(i%g.lantern_every===0){
   const lantern=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),lanternMat);lantern.position.set(.36,1.05,.25);p.group.add(lantern);
   // Two real lights are enough to read the group in the dark; the other lanterns only glow.
   if(members.filter(m=>m.light).length<2){const light=new THREE.PointLight(0xffb45a,2.4,24,1.6);light.position.copy(lantern.position);p.group.add(light);p.light=light}
  }
  if(weapon==='rifle'){
   const rifle=new THREE.Group();rifle.name='rifle';rifle.position.set(-.34,1.0,.05);
   const stock=new THREE.Mesh(new THREE.BoxGeometry(.06,1.25,.07),weaponMat.wood);stock.position.y=.1;rifle.add(stock);
   const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.55,6),weaponMat.steel);barrel.position.y=.9;rifle.add(barrel);
   const muzzle=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),muzzleMat);muzzle.name='muzzle-flash';muzzle.position.y=1.25;muzzle.visible=false;rifle.add(muzzle);
   p.group.add(rifle);p.rifle=rifle;p.muzzle=muzzle;
  }else if(weapon==='sword'){
   const sword=new THREE.Mesh(new THREE.BoxGeometry(.04,.95,.05),weaponMat.steel);sword.name='sword';sword.position.set(-.3,.8,.12);sword.rotation.z=.35;p.group.add(sword);p.sword=sword;
  }
  // A loose crowd, not ranks: each walks at its own distance behind the leader and its own side of the road, both
  // drifting slowly, with a small stride offset so feet do not move in step.
  p.back=i===0?0:members.at(-1).back+.8+rand()*1.6;p.side=(rand()*2-1)*(g.spread_m??2.4);
  p.phase=rand()*Math.PI*2;p.drift=.35+rand()*.5;p.step=rand()*3;
  root.add(p.group);members.push(p);
 }
 // Aiming: the rifle shouldered and pointed ahead, the arms (the walker's arm groups at shoulder height) raised with it.
 function aim(p,on){
  if(!p.rifle)return;p.aiming=on;
  p.rifle.rotation.x=on?-Math.PI/2:0;p.rifle.position.set(on?.05:-.34,on?1.45:1.0,on?.25:.05);
  for(const arm of p.group.children.filter(o=>o.isGroup&&o!==p.rifle&&Math.abs(o.position.y-1.35)<.01))arm.rotation.x=on?-1.45:0;
 }
 function fire(on){for(const p of members)if(p.muzzle)p.muzzle.visible=on&&!!p.aiming}
 // Stops along the way: the gate and any clashes. Each has defenders who bar the way, are fired on and fall — seen
 // from a distance only. `gate` (a single defender at a pixel) is kept as the first stop for older definitions.
 const stopDefs=[...(data.gate?[{...data.gate,defenders:[{pixel:data.gate.defender_pixel}]}]:[]),...(data.stops??[])].sort((a,b)=>a.at-b.at);
 const capMat=new THREE.MeshStandardMaterial({color:0x2c3a55});
 const stops=stopDefs.map(def=>({def,state:'pending',t:0,fall:0,flashUntil:0,defenders:def.defenders.map(()=>{
  const p=createWalker();p.group.name='defender';p.group.getObjectByName('walker-body').material.color.set('#3c4d6b');
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.19,.18,.12,10),capMat);cap.position.y=1.76;p.group.add(cap);
  const spear=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,2.2,5),weaponMat.wood);spear.position.set(.36,1.1,.1);p.group.add(spear);
  p.group.visible=false;scene.add(p.group);return p})}));
 const gateGuard=stops[0]?.defenders[0];
 const rejoin=api.panel.button('historical-event-rejoin',say('무리를 다시 찾기','Find the group again'),()=>{if(fp.active)regroup()});
 let route=null,distance=0,neighborhood=null,closeFor=0,notice=0,waiting=false,appearAt=null,finished=false;
 const tailOffset=()=>members.at(-1).back+1;let clock=0;

 function prepare(){
  if(route)return;
  route=buildRoute(api,data.route);
  // Estimated houses along the route only where the base scene has none; a visit keeping the 1907 streets turns it off.
  if(data.neighborhood!==false)neighborhood=createEventNeighborhood({path:route.path,surface,scene,walking,buildings,waterAt});
  if(data.appear)appearAt=api.atPixel(data.appear.pixel);
  for(const st of stops){
   const at=route.milestones[st.def.at],{yaw}=route.sample(at),ahead=st.def.ahead_m??10;
   st.def.defenders.forEach((dd,k)=>{let p;
    if(dd.pixel)p=api.atPixel(dd.pixel);
    else{const q=route.sample(at+ahead).p,side=(k-(st.def.defenders.length-1)/2)*1.6;p=api.nearestSafe(new THREE.Vector3(q.x+Math.cos(yaw)*side,0,q.z-Math.sin(yaw)*side))}
    const d=st.defenders[k];d.group.position.set(p.x,fp.groundAt(p.x,p.z),p.z);d.group.rotation.y=yaw+Math.PI;d.update(0,false)});
  }
 }
 const {safe}=api;
 // Remarks: the group mutters in Japanese. Close by, someone suspects they are followed; otherwise idle talk now and
 // then. The bubble shows the Japanese with a translation underneath; lines are invented, not quotations.
 const chat=data.chatter??null,bubble=document.createElement('div');bubble.id='shadow-remark';bubble.hidden=true;
 bubble.style.cssText='position:absolute;z-index:1040;transform:translate(-50%,-100%);padding:7px 11px;border-radius:10px;background:#fff9e8ee;color:#25231d;max-width:260px;text-align:center;pointer-events:none;font:14px/1.4 sans-serif';
 api.container.append(bubble);
 let speaker=null,bubbleUntil=0,nextIdle=8,suspectCooldown=0;
 function say_(member,line){speaker=member;bubbleUntil=clock+3.8;bubble.replaceChildren();const ja=document.createElement('div');ja.textContent=line.ja;ja.lang='ja';const tr=document.createElement('small');tr.style.cssText='display:block;color:#6b6456';tr.textContent=say(line.ko,line.en);bubble.append(ja,tr);bubble.hidden=false}
 function updateRemarks(dt,near,holding){
  if(!chat)return;suspectCooldown-=dt;
  if(speaker&&clock<bubbleUntil){const p=speaker.group.position.clone();p.y+=2.3;p.project(camera);const r=api.container.getBoundingClientRect();bubble.style.left=(p.x*.5+.5)*r.width+'px';bubble.style.top=(-p.y*.5+.5)*r.height+'px';bubble.hidden=p.z>1||p.z<-1}
  else if(speaker){speaker=null;bubble.hidden=true}
  if(holding||speaker)return;
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  if(near<chat.near_m&&suspectCooldown<=0){
   // Whoever is closest to the walker turns and speaks.
   let best=members[0],bd=Infinity;for(const m of members){const d=Math.hypot(fp.eye.x-m.group.position.x,fp.eye.z-m.group.position.z);if(d<bd){bd=d;best=m}}
   say_(best,pick(chat.suspicious));suspectCooldown=chat.cooldown_s;return;
  }
  nextIdle-=dt;if(nextIdle<=0){nextIdle=chat.idle_every_s[0]+Math.random()*(chat.idle_every_s[1]-chat.idle_every_s[0]);say_(pick(members),pick(chat.idle))}
 }
 function place(moving){
  for(const [i,m] of members.entries()){
   const along=distance-m.back+Math.sin(clock*m.drift+m.phase)*.7,{p,yaw}=route.sample(along);
   let side=m.side+Math.sin(clock*m.drift*.7+m.phase*1.7)*.45;
   let x=p.x+Math.cos(yaw)*side,z=p.z-Math.sin(yaw)*side;
   // Keep off walls and water: fall back towards the middle of the road where the side step is not passable.
   if(!safe(new THREE.Vector3(x,0,z))){x=p.x+Math.cos(yaw)*side*.3;z=p.z-Math.sin(yaw)*side*.3;if(!safe(new THREE.Vector3(x,0,z))){x=p.x;z=p.z}}
   m.group.position.set(x,fp.groundAt(x,z)??m.group.position.y,z);
   const want=yaw+Math.sin(clock*.9+m.phase)*.12;let dy=want-m.group.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));m.group.rotation.y+=dy*Math.min(1,moving?.12:.3);m.update(distance*1.3+m.step,moving);if(m.aiming)aim(m,true);
  }
 }
 function behind(extra=0){return route.sample(Math.max(0,distance-tailOffset()-(keep.start_behind_m??30)-extra))}
 function regroup(){const {p,yaw}=behind();fp.placeAt(p.x,p.z,yaw+Math.PI);fp.clearInput();closeFor=0}
 function enter(index){
  prepare();root.visible=true;finished=false;rejoin.hidden=false;
  distance=Math.max(tailOffset()+2,route.milestones[Math.max(0,Math.min(route.milestones.length-1,index))]);
  for(const st of stops){st.state=distance>=route.milestones[st.def.at]?'done':'pending';st.t=0;st.fall=0;for(const d of st.defenders){d.group.visible=st.state==='pending';d.group.rotation.x=0}}
  place(false);
  // Fresh start with an 'appear' point: the group waits unseen beyond it until the walker comes near, then walks in.
  waiting=!!appearAt&&index===0;
  // Waiting, the whole group stands beyond the gate: the leader at the first route point, the rest bunched behind it.
  if(waiting){distance=0;place(false)}
  for(const m of members)m.group.visible=!waiting;
  if(waiting){api.markMap(appearAt);api.reach(0);return}
  // A resume puts the walker behind the group; otherwise they stay where the previous stage left them.
  const tail=members.at(-1).group.position;if(index>0||Math.hypot(fp.eye.x-tail.x,fp.eye.z-tail.z)>keep.far_m*1.5)regroup();
  api.panel.message(text(data,'intro'));api.reach(0);
 }
 function exit(){bubble.hidden=true;speaker=null;root.visible=false;for(const st of stops)for(const d of st.defenders)d.group.visible=false;rejoin.hidden=true;api.markMap(null);fire(false)}
 function reset(){for(const st of stops){st.state='pending';st.t=0;st.fall=0;for(const d of st.defenders)d.group.rotation.x=0}for(const m of members)aim(m,false);fire(false);finished=false;closeFor=0}
 function idle(){neighborhood?.setLod(camera.position)}
 // A stop: the group halts, rifles come up, shots flash from the muzzles, the defenders fall, then the group moves on.
 function updateStop(st,dt){
  const sd=st.def;st.t+=dt;
  for(const beat of sd.beats){if(!beat.done&&st.t>=beat.t){beat.done=true;if(beat.aim)for(const m of members)aim(m,true);if(beat.flash){api.flash(beat.flash);fire(true);st.flashUntil=st.t+.2}if(beat.cue)api.cue(beat.cue);if(beat.text)api.panel.message(text(beat,'text'));if(beat.fall)st.fall=.001}}
  if(st.flashUntil&&st.t>st.flashUntil){fire(false);st.flashUntil=0}
  if(st.fall>0&&st.fall<1){st.fall=Math.min(1,st.fall+dt/.8);for(const [k,d] of st.defenders.entries())d.group.rotation.x=-Math.PI/2*Math.min(1,st.fall*(1+k*.35))}
  if(st.t>=sd.hold_s){st.state='done';for(const beat of sd.beats)beat.done=false;for(const m of members)aim(m,false);fire(false)}
  return st.state!=='done';
 }
 function update(dt){
  if(finished)return;
  if(waiting){
   const left=Math.hypot(fp.eye.x-appearAt.x,fp.eye.z-appearAt.z);
   if(left>data.appear.radius_m){api.panel.message(text(data,'wait_hint').replace('{m}',Math.round(left)));return}
   waiting=false;for(const m of members)m.group.visible=true;notice=5;api.panel.message(text(data,'appear_text'));
  }
  const eye=fp.eye,tail=members.at(-1).group.position,lead=members[0].group.position;
  let near=Infinity;for(const m of members)near=Math.min(near,Math.hypot(eye.x-m.group.position.x,eye.z-m.group.position.z));
  // 'Too far' is measured to the nearest member: behind the group that is the tail, while it comes towards the walker
  // (through the gate) it is whoever is closest.
  const far=near;
  api.markMap(lead);
  // Too close for too long: someone turns round, and the walker ducks back into the dark.
  if(near<keep.near_m){closeFor+=dt;if(closeFor>2.5){const {p,yaw}=behind(10);fp.placeAt(p.x,p.z,yaw+Math.PI);fp.clearInput();closeFor=0;notice=4;api.panel.message(text(data,'too_close_caught'));return}}
  else closeFor=0;
  const stop=stops.find(st=>st.state!=='done'&&distance>=route.milestones[st.def.at]);
  if(stop&&stop.state==='pending'){stop.state='running';stop.t=0}
  const holding=!!stop&&updateStop(stop,dt);
  // A lead-in (appear.free_until_at): the group comes along the road towards the walker on its own until it has
  // passed that route point; after that it only moves while the walker keeps up.
  const leadIn=data.appear?.free_until_at!=null&&distance<route.milestones[data.appear.free_until_at];
  const moving=!holding&&(far<=keep.far_m||leadIn)&&!api.saveError&&distance<route.total;
  if(moving)distance=Math.min(route.total,distance+dt*g.speed_mps);
  clock+=dt;
  place(moving);updateRemarks(dt,near,holding);
  let index=api.checkpointIndex;while(index<route.milestones.length-2&&distance>=route.milestones[index+1]&&far<keep.far_m){index++;api.reach(index)}
  // A notice (being seen) stays on the panel for a few seconds before the running hint returns.
  if(notice>0)notice-=dt;
  if(!holding&&notice<=0){
   const name=data.route[Math.min(index+1,data.route.length-1)];
   api.panel.message(closeFor>0?text(data,'too_close'):leadIn?text(data,'appear_text'):far>keep.far_m?text(data,'too_far'):say(`${name.name} — ${data.follow_hint}`,`${name.name_en} — ${data.follow_hint_en}`));
  }
  if(distance>=route.total&&far<keep.far_m*.6&&!api.saving){finished=true;api.finish()}
 }
 return {prepare,enter,exit,reset,idle,update,regroup,root,members,gateGuard,get waiting(){return waiting},get appearAt(){return appearAt},
  get route(){return route},get distance(){return distance},get gateState(){return stops[0]?.state},get stops(){return stops},get remark(){return bubble.hidden?null:bubble.textContent},get neighborhood(){return neighborhood}};
}
