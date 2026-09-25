import * as THREE from 'three';
import {createWalker} from '../pedestrians.js';

// Stage module: slip into a walled compound and keep still in a dark corner while a timeline of events plays out,
// told in text (and optional sound cues) and in the movement of a crowd of torch-lit men — never shown up close.
// Stepping out of the corner pauses the timeline; staying out draws a torch and the walker is pulled back into the
// dark. At first light smoke rises; the walker goes to it and finds something among the embers (`discovery`), and
// the stage ends. One checkpoint. The compound is an existing landmark of the base scene or a conceptual model.
//
// The crowd (`crowd.count` men) moves on a grid of passable points inside the compound (walls and halls block; the
// hiding corner is kept clear). Timeline beats set its mode with `crowd`: 'wander' (to and fro between the halls),
// 'storm' (all run to `door`, which gives way when the first arrives; each man vanishes inside as he reaches it; the
// leader first shouts `shout`), 'emerge' (they come back out one by one and wander), 'gather' (crowd before
// `gather_local`) and 'leave' (out through the gate to `exit_local`, gone once there).
export function createHide(api){
 const {data,say,text,fp,scene,camera,container,walking,surface,buildings}=api;
 const c=data.compound;
 const building=c.building?buildings.find(b=>b.userData.feature.id===c.building):null;
 if(c.building&&!building)throw Error('hide: missing building '+c.building);
 const yaw=building?building.rotation.y:THREE.MathUtils.degToRad(c.yaw_deg??0);
 const centre=building?building.position.clone():surface(...c.pixel),frame={x:centre.x,z:centre.z,yaw};
 const floor=building?building.userData.groundFloor:(fp.groundAt(centre.x,centre.z)??centre.y);
 const compound=building??new THREE.Group();
 if(!building){compound.name='hide-compound';compound.position.set(centre.x,floor,centre.z);compound.rotation.y=yaw;scene.add(compound)}
 const mats={wall:new THREE.MeshStandardMaterial({color:0x8a8172,roughness:1}),roof:new THREE.MeshStandardMaterial({color:0x2f3436,roughness:1}),wood:new THREE.MeshStandardMaterial({color:0x5a3f2c,roughness:1}),paper:new THREE.MeshStandardMaterial({color:0xcfc6b0,roughness:1}),stone:new THREE.MeshStandardMaterial({color:0x8d887c,roughness:1}),ash:new THREE.MeshStandardMaterial({color:0x2a2724,roughness:1}),jade:new THREE.MeshStandardMaterial({color:0x7fae8e,roughness:.4,emissive:0x1b2a20})};
 const shown=()=>compound.visible;
 function box(x,y,z,w,h,d,mat,solid=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[mat]);m.position.set(x,y,z);compound.add(m);if(solid)walking.collision.addLocal(frame,x,z,w/2,d/2,shown);return m}
 function hall(x,z,w,d,h){box(x,.35,z,w+1,.7,d+1,'stone',true);box(x,.7+h/2,z,w,h,d,'paper');for(const sx of [-1,1])for(const sz of [-1,1])box(x+sx*(w/2-.2),.7+h/2,z+sz*(d/2-.2),.35,h,.35,'wood');
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w,d)/2+1.2,2.6,4),mats.roof);roof.rotation.y=Math.PI/4;roof.scale.set(w/Math.hypot(w,d)*1.45,1,d/Math.hypot(w,d)*1.45);roof.position.set(x,.7+h+1.2,z);compound.add(roof)}
 const [W,,D]=building?building.userData.feature.symbol_size_m:[c.w,0,c.d],H=c.wall_h??3,T=.9,gap=c.gate_w??5;
 const gateX=building?(building.userData.feature.gate_x??0):0;
 if(!building){
  box(0,H/2-1,-D/2,W,H+2,T,'wall',true);for(const sx of [-1,1])box(sx*W/2,H/2-1,0,T,H+2,D,'wall',true);
  for(const sx of [-1,1])box(sx*(gap/2+(W/2-gap/2)/2),H/2-1,D/2,W/2-gap/2,H+2,T,'wall',true);
  box(0,H+.3,D/2,gap+2,.5,T+1.4,'roof');
  for(const [x,z,w,d,h] of c.halls??[])hall(x,z,w,d,h);
 }
 const up=new THREE.Vector3(0,1,0);
 const local=(x,z)=>{const v=new THREE.Vector3(x,0,z).applyAxisAngle(up,yaw);return new THREE.Vector3(centre.x+v.x,0,centre.z+v.z)};
 const {safe}=api;
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(a.distanceTo(b)/.5));for(let k=0;k<=n;k++)if(!safe(a.clone().lerp(b,k/n)))return false;return true};

 // ---- the hiding place ------------------------------------------------------------------------------------------
 let spot=null;const marker=new THREE.Object3D();scene.add(marker);

 // ---- the walking grid ------------------------------------------------------------------------------------------
 const cr=data.crowd??{count:data.torches??5};
 let nodes=null;
 function buildGrid(){
  const step=cr.grid_m??3,avoid=cr.avoid_spot_m??10,sp=spot;nodes=[];const index=new Map();
  for(let x=-W/2+1.5;x<=W/2-1.5;x+=step)for(let z=-D/2+1.5;z<=D/2-1.5;z+=step){
   const p=local(x,z);if(!safe(p)||Math.hypot(p.x-sp.x,p.z-sp.z)<avoid)continue;
   const n={p,i:nodes.length,links:[]};nodes.push(n);index.set(Math.round(x/step)+','+Math.round(z/step),n)}
  for(const n of nodes){const lp=n.p.clone().sub(centre).applyAxisAngle(up,-yaw),gx=Math.round(lp.x/step),gz=Math.round(lp.z/step);
   for(const [dx,dz] of [[1,0],[0,1],[1,1],[1,-1]]){const m=index.get((gx+dx)+','+(gz+dz));if(m&&clear(n.p,m.p)){n.links.push(m);m.links.push(n)}}}
  // Keep the largest connected part (the yard the gate opens on); isolated pockets behind halls are dropped.
  const seen=new Set();let best=[];for(const n of nodes){if(seen.has(n))continue;const part=[],q=[n];seen.add(n);while(q.length){const a=q.pop();part.push(a);for(const b of a.links)if(!seen.has(b)){seen.add(b);q.push(b)}}if(part.length>best.length)best=part}
  const keep=new Set(best);nodes=best;for(const n of nodes)n.links=n.links.filter(m=>keep.has(m));
 }
 const nearestNode=p=>{let best=null,bd=Infinity;for(const n of nodes){const d=n.p.distanceTo(p);if(d<bd&&(d<4||clear(n.p,p))){bd=d;best=n}}return best??nodes[0]};
 // A* over the grid; the path starts at the member's position and ends at the target itself.
 function pathTo(from,to){
  const a=nearestNode(from),b=nearestNode(to);const open=[a],g=new Map([[a,0]]),prev=new Map(),closed=new Set();
  while(open.length){let bi=0;for(let i=1;i<open.length;i++)if(g.get(open[i])+open[i].p.distanceTo(b.p)<g.get(open[bi])+open[bi].p.distanceTo(b.p))bi=i;const n=open.splice(bi,1)[0];
   if(n===b)break;if(closed.has(n))continue;closed.add(n);
   for(const m of n.links){const cost=g.get(n)+n.p.distanceTo(m.p);if(cost<(g.get(m)??Infinity)){g.set(m,cost);prev.set(m,n);open.push(m)}}}
  const out=[to.clone()];for(let n=b;n;n=prev.get(n))out.push(n.p.clone());return out.reverse();
 }

 // ---- the crowd -------------------------------------------------------------------------------------------------
 const torchMat=new THREE.MeshBasicMaterial({color:0xff9d3c}),men=[];
 let seed=cr.seed??1895;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const dress=['#2b2a30','#3a3432','#2f3538','#43392f','#1f2b45','#2b2f36','#1d1e22'];
 for(let i=0;i<cr.count;i++){
  const p=createWalker();p.group.name='compound-man';p.group.getObjectByName('walker-body').material.color.set(dress[i%dress.length]);
  if(i%(cr.torch_every??3)===0){
   const stick=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.9,5),mats.wood);stick.position.set(.35,1.2,.2);p.group.add(stick);
   const flame=new THREE.Mesh(new THREE.ConeGeometry(.12,.35,7),torchMat);flame.position.set(.35,1.8,.2);p.group.add(flame);
   if(men.filter(m=>m.light).length<3){const light=new THREE.PointLight(0xff9a45,2.4,20,1.6);light.position.set(.35,1.9,.2);p.group.add(light);p.light=light}
  }else{const sword=new THREE.Mesh(new THREE.BoxGeometry(.04,.9,.05),mats.stone);sword.position.set(-.3,.8,.12);sword.rotation.z=.35;p.group.add(sword)}
  p.group.visible=false;scene.add(p.group);
  men.push({p,path:[],speed:1.3+rand()*.5,phase:rand()*6,wait:0,state:'out',side:(rand()*2-1)*.9});
 }
 const doorAt=data.door?local(...data.door.local):null,doorFront=data.door?local(...data.door.front):null;
 const gatherAt=data.gather_local?local(...data.gather_local):null,gateInside=local(gateX,D/2-4),exitAt=local(...(data.exit_local??[gateX,D/2+12]));
 // The door that gives way: two leaves on a pivot at the sill, falling inwards.
 const door=new THREE.Group();door.name='hide-door';
 if(data.door){const dl=data.door,pivot=local(...dl.local);door.position.set(pivot.x,(fp.groundAt(pivot.x,pivot.z)??floor)+(dl.sill??.7),pivot.z);door.rotation.y=yaw+THREE.MathUtils.degToRad(dl.facing_deg??0);
  for(const s of [-1,1]){const leaf=new THREE.Mesh(new THREE.BoxGeometry((dl.width??2.4)/2-.04,2.5,.1),mats.wood);leaf.position.set(s*(dl.width??2.4)/4,1.25,0);door.add(leaf)}
  scene.add(door)}
 let doorFall=0;
 let mode='wander',modeTime=0,emergeNext=0;
 function goWander(m){const n=nodes[Math.floor(rand()*nodes.length)];m.path=pathTo(m.p.group.position,n.p);m.wait=rand()*2.5}
 function setMode(next){
  mode=next;modeTime=0;
  for(const [i,m] of men.entries()){
   if(next==='wander'&&m.state==='out')goWander(m);
   if(next==='storm'&&m.state==='out'){m.path=pathTo(m.p.group.position,doorFront);m.wait=i*.05}
   if(next==='gather'&&m.state==='out'){const a=i/men.length*Math.PI*2,r=1.5+(i%3)*1.1,t=gatherAt.clone().add(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));m.path=pathTo(m.p.group.position,safe(t)?t:gatherAt);m.wait=0}
   if(next==='leave'){if(m.state==='inside'){m.state='out';const q=doorFront.clone();m.p.group.position.set(q.x,fp.groundAt(q.x,q.z)??floor,q.z);m.p.group.visible=true}
    if(m.state==='out'){m.path=[...pathTo(m.p.group.position,gateInside),exitAt.clone()];m.wait=i*.12}}
  }
  if(next==='emerge')emergeNext=0;
 }
 function stepMan(m,dt,i){
  const pos=m.p.group.position;
  if(m.wait>0){m.wait-=dt;m.p.update(clock*.4+m.phase,false);return}
  const target=m.path[0];
  if(!target){
   if((mode==='wander'||mode==='emerge')&&m.state==='out')goWander(m);
   if(mode==='storm'&&m.state==='out'){m.state='entering';m.path=[doorAt.clone()]}
   else if(m.state==='entering'){m.state='inside';m.p.group.visible=false}
   if(mode==='leave'&&m.state==='out'&&Math.hypot(pos.x-exitAt.x,pos.z-exitAt.z)<2){m.state='gone';m.p.group.visible=false}
   m.p.update(clock*.4+m.phase,false);return;
  }
  const run=mode==='storm'?4.2:mode==='leave'?2.6:m.speed;
  // A small sideways offset per man so the crowd does not walk in single file (kept only where passable).
  let tx=target.x,tz=target.z;if(m.path.length>1){const dx0=target.x-pos.x,dz0=target.z-pos.z,l=Math.hypot(dx0,dz0)||1,sx=target.x-dz0/l*m.side,sz=target.z+dx0/l*m.side;if(safe(new THREE.Vector3(sx,0,sz))){tx=sx;tz=sz}}
  // Arrival is judged at the waypoint itself (the sideways offset would otherwise keep a man circling it).
  if(Math.hypot(target.x-pos.x,target.z-pos.z)<.4+(tx!==target.x?Math.abs(m.side):0)){m.path.shift();return}
  const dx=tx-pos.x,dz=tz-pos.z,dist=Math.hypot(dx,dz)||1e-6;
  const step=Math.min(dist,dt*run);pos.x+=dx/dist*step;pos.z+=dz/dist*step;pos.y=fp.groundAt(pos.x,pos.z)??floor;
  let dy=Math.atan2(dx,dz)-m.p.group.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));m.p.group.rotation.y+=dy*Math.min(1,dt*8);
  m.p.update(clock*run*.9+m.phase,true);
  if(mode==='storm'&&!doorFall&&Math.hypot(pos.x-doorFront.x,pos.z-doorFront.z)<2.5){doorFall=.001;if(data.door.cue)api.cue(data.door.cue);if(data.door.break_text)api.panel.message(text(data.door,'break_text'));api.flash?.(.15)}
 }
 function updateCrowd(dt){
  modeTime+=dt;
  if(mode==='emerge'){emergeNext-=dt;if(emergeNext<=0){const m=men.find(x=>x.state==='inside');if(m){m.state='out';const q=doorFront.clone().add(new THREE.Vector3((rand()-.5)*2,0,(rand()-.5)*2));m.p.group.position.set(q.x,fp.groundAt(q.x,q.z)??floor,q.z);m.p.group.visible=true;goWander(m);m.wait=0}emergeNext=.35}}
  for(const [i,m] of men.entries())if(m.state!=='gone'&&(m.p.group.visible||m.state==='entering'))stepMan(m,dt,i);
  if(doorFall>0&&doorFall<1){doorFall=Math.min(1,doorFall+dt/.6);door.children.forEach((leaf,k)=>{leaf.rotation.x=-Math.PI/2*doorFall*(k?1:.85);leaf.position.z=-1.25*Math.sin(Math.PI/2*doorFall)*(k?1:.85);leaf.position.y=1.25*Math.cos(Math.PI/2*doorFall*(k?1:.85))+.05})}
 }

 // ---- shouts over the crowd ---------------------------------------------------------------------------------------
 const bubble=document.createElement('div');bubble.id='hide-shout';bubble.hidden=true;
 bubble.style.cssText='position:absolute;z-index:1040;transform:translate(-50%,-100%);padding:7px 11px;border-radius:10px;background:#fff9e8ee;color:#25231d;max-width:280px;text-align:center;pointer-events:none;font:14px/1.4 sans-serif';
 container.append(bubble);
 let shouter=null,shoutUntil=0,nextCall=6;
 function shout(m,line,seconds=4){shouter=m;shoutUntil=clock+seconds;bubble.replaceChildren();const ja=document.createElement('div');ja.lang='ja';ja.textContent=line.ja;ja.style.fontWeight=line.loud?'700':'400';const tr=document.createElement('small');tr.style.cssText='display:block;color:#6b6456';tr.textContent=say(line.ko,line.en);bubble.append(ja,tr);bubble.hidden=false}
 function placeBubble(){
  if(shouter&&clock<shoutUntil&&shouter.p.group.visible){const p=shouter.p.group.position.clone();p.y+=2.4;camera.updateMatrixWorld();p.project(camera);const r=container.getBoundingClientRect();bubble.style.left=(p.x*.5+.5)*r.width+'px';bubble.style.top=(-p.y*.5+.5)*r.height+'px';bubble.hidden=p.z>1||p.z<-1}
  else{shouter=null;bubble.hidden=true}
 }
 function calls(dt){
  const pool=data.calls??[];if(!pool.length||!['wander','storm','emerge'].includes(mode))return;
  nextCall-=dt;if(nextCall>0||(shouter&&clock<shoutUntil))return;nextCall=5+rand()*6;
  const out=men.filter(m=>m.state==='out'&&m.p.group.visible);if(out.length)shout(out[Math.floor(rand()*out.length)],pool[Math.floor(rand()*pool.length)],3.2);
 }

 // ---- smoke and what is found there -------------------------------------------------------------------------------
 const smoke=new THREE.Group();smoke.name='dawn-smoke';smoke.visible=false;scene.add(smoke);
 const smokeAt=local(...data.smoke_local);
 const smokeGround=()=>fp.groundAt(smokeAt.x,smokeAt.z)??floor;
 for(let i=0;i<6;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2.2+i*.7,10,8),new THREE.MeshStandardMaterial({color:0x6d6a66,transparent:true,opacity:.28,depthWrite:false}));puff.position.set(smokeAt.x+Math.sin(i)*1.5,smokeGround()+4+i*3.2,smokeAt.z+Math.cos(i*1.3));smoke.add(puff)}
 const embers=new THREE.Group();embers.name='embers';embers.visible=false;scene.add(embers);
 {const g=smokeGround(),mound=new THREE.Mesh(new THREE.ConeGeometry(2.2,.6,12),mats.ash);mound.position.set(smokeAt.x,g+.3,smokeAt.z);embers.add(mound);
  for(let k=0;k<5;k++){const brand=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,1.6),mats.ash);brand.position.set(smokeAt.x+Math.cos(k*1.3)*1.2,g+.35,smokeAt.z+Math.sin(k*1.3)*1.2);brand.rotation.y=k*1.1;embers.add(brand)}
  const glow=new THREE.PointLight(0xff6a2a,1.4,8,2);glow.position.set(smokeAt.x,g+.6,smokeAt.z);embers.add(glow);
  const piece=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),mats.jade);piece.name='found-piece';const f=smokeAt.clone().add(new THREE.Vector3(1.9,0,.6));piece.position.set(f.x,(fp.groundAt(f.x,f.z)??g)+.1,f.z);embers.add(piece)}
 const findMark=new THREE.Object3D();scene.add(findMark);

 // ---- stage flow --------------------------------------------------------------------------------------------------
 let state='approach',clock=0,outFor=0,ending=0,found=-1,foundUntil=0;
 function prepare(){if(spot)return;spot=api.nearestSafe(local(...data.spot_local));marker.position.set(spot.x,fp.groundAt(spot.x,spot.z)??floor,spot.z);buildGrid()}
 function resetCrowd(){
  doorFall=0;door.children.forEach((leaf,k)=>{leaf.rotation.x=0;leaf.position.set((k?1:-1)*((data.door?.width??2.4)/4),1.25,0)});
  for(const m of men){const n=nodes[Math.floor(rand()*nodes.length)];m.p.group.position.set(n.p.x,fp.groundAt(n.p.x,n.p.z)??floor,n.p.z);m.p.group.visible=true;m.state='out';m.path=[];m.wait=rand()*2}
  mode='wander';for(const m of men)goWander(m);
 }
 function enter(){
  prepare();state='approach';clock=0;outFor=0;ending=0;found=-1;smoke.visible=false;embers.visible=false;resetCrowd();
  // Resuming from elsewhere puts the walker outside the gate; coming straight from the previous stage keeps them there.
  const gateFront=local(gateX,D/2+6);if(Math.hypot(fp.eye.x-gateFront.x,fp.eye.z-gateFront.z)>60){fp.placeAt(gateFront.x,gateFront.z,Math.atan2(-(centre.x-gateFront.x),-(centre.z-gateFront.z)));fp.clearInput()}
  api.quest.follow(marker);api.markMap(spot);api.panel.message(text(data,'intro'));
  for(const beat of data.timeline)beat.done=false;
 }
 function exit(){for(const m of men)m.p.group.visible=false;smoke.visible=false;embers.visible=false;bubble.hidden=true;api.quest.follow(null);api.markMap(null)}
 function reset(){state='approach';clock=0;found=-1;for(const beat of data.timeline)beat.done=false}
 function update(dt){
  api.quest.update(dt);
  const left=Math.hypot(fp.eye.x-spot.x,fp.eye.z-spot.z);
  if(state==='approach'){
   updateCrowd(dt);placeBubble();
   api.panel.message(text(data,'approach').replace('{m}',Math.round(left)));
   // Settling in, the walker turns towards where the crowd will gather, so the scene plays out in front of them.
   if(left<data.radius_m){state='watch';const look=doorFront??gatherAt;fp.placeAt(fp.eye.x,fp.eye.z,Math.atan2(-(look.x-fp.eye.x),-(look.z-fp.eye.z)));fp.clearInput();api.quest.follow(null);api.markMap(null);api.panel.message(text(data,'settled'))}
   return;
  }
  if(state==='watch'){
   if(left>data.radius_m+1.5){
    outFor+=dt;api.panel.message(text(data,'stray'));
    if(outFor>4){const look=doorFront??gatherAt;fp.placeAt(spot.x,spot.z,Math.atan2(-(look.x-spot.x),-(look.z-spot.z)));fp.clearInput();outFor=0;api.panel.message(text(data,'pulled_back'))}
    placeBubble();return;
   }
   outFor=0;clock+=dt;updateCrowd(dt);calls(dt);placeBubble();
   for(const beat of data.timeline)if(!beat.done&&clock>=beat.t){beat.done=true;
    if(beat.crowd)setMode(beat.crowd);
    if(beat.shout){const lead=men.find(m=>m.state==='out'&&m.p.group.visible);if(lead)shout(lead,{...beat.shout,loud:true},4.5)}
    if(beat.text)api.panel.message(text(beat,'text'));if(beat.flash)api.flash(beat.flash);if(beat.cue)api.cue(beat.cue);if(beat.light)api.light(beat.light,beat.light_s);if(beat.smoke){smoke.visible=true;embers.visible=true}}
   if(clock>=data.duration_s){state='ending';ending=0;const d=data.discovery;if(d){findMark.position.copy(smokeAt).setY(smokeGround()+1);api.quest.follow(findMark);api.markMap(smokeAt)}}
   return;
  }
  if(state==='ending'){
   ending+=dt;updateCrowd(dt);placeBubble();
   for(const [i,p] of smoke.children.entries()){p.position.y+=dt*(.5+i*.08);p.material.opacity=Math.max(.08,.28-ending*.004)}
   const d=data.discovery;
   if(!d){if(ending>=(data.leave_after_s??10)&&!api.saving){state='done';api.finish()}return}
   const far=Math.hypot(fp.eye.x-smokeAt.x,fp.eye.z-smokeAt.z);
   if(found<0){api.panel.message(text(d,'hint').replace('{m}',Math.round(far)));if(far<=d.radius_m){found=0;foundUntil=ending+(d.line_s??6);api.quest.follow(null);api.markMap(null);api.panel.message(text(d.lines[0],'text'))}return}
   if(ending>=foundUntil){found++;if(found<d.lines.length){foundUntil=ending+(d.line_s??6);api.panel.message(text(d.lines[found],'text'))}else if(!api.saving){state='done';api.finish()}}
  }
 }
 return {prepare,enter,exit,reset,update,compound,men,smoke,embers,door,smokeAt,
  get spot(){return spot},get state(){return state},get clock(){return clock},get mode(){return mode},get doorBroken(){return doorFall>=1},get found(){return found},get shout(){return bubble.hidden?null:bubble.textContent},get nodes(){return nodes}};
}
