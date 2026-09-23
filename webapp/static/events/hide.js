import * as THREE from 'three';
import {createWalker} from '../pedestrians.js';

// Stage module: slip into a walled compound and keep still in a dark corner while a timeline of events plays out,
// told in text (and optional sound cues) and in the movement of torches — never shown up close. Stepping out of the
// corner pauses the timeline; staying out draws a torch and the walker is pulled back into the dark. Ends at first
// light with smoke rising, then the walker leaves. One checkpoint. The compound is a conceptual model built here.
export function createHide(api){
 const {data,say,text,fp,scene,walking,surface}=api;
 const c=data.compound,yaw=THREE.MathUtils.degToRad(c.yaw_deg??0);
 // ---- the compound: plain walls with a south gate, a main hall and a side wing ------------------------------------
 const centre=surface(...c.pixel),frame={x:centre.x,z:centre.z,yaw};
 const floor=fp.groundAt(centre.x,centre.z)??centre.y;
 const compound=new THREE.Group();compound.name='hide-compound';compound.position.set(centre.x,floor,centre.z);compound.rotation.y=yaw;scene.add(compound);
 const mats={wall:new THREE.MeshStandardMaterial({color:0x8a8172,roughness:1}),roof:new THREE.MeshStandardMaterial({color:0x2f3436,roughness:1}),wood:new THREE.MeshStandardMaterial({color:0x5a3f2c,roughness:1}),paper:new THREE.MeshStandardMaterial({color:0xcfc6b0,roughness:1}),stone:new THREE.MeshStandardMaterial({color:0x8d887c,roughness:1})};
 const shown=()=>compound.visible;
 function box(x,y,z,w,h,d,mat,solid=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[mat]);m.position.set(x,y,z);compound.add(m);if(solid)walking.collision.addLocal(frame,x,z,w/2,d/2,shown);return m}
 function hall(x,z,w,d,h){box(x,.35,z,w+1,.7,d+1,'stone',true);box(x,.7+h/2,z,w,h,d,'paper');for(const sx of [-1,1])for(const sz of [-1,1])box(x+sx*(w/2-.2),.7+h/2,z+sz*(d/2-.2),.35,h,.35,'wood');
  const roof=new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w,d)/2+1.2,2.6,4),mats.roof);roof.rotation.y=Math.PI/4;roof.scale.set(w/Math.hypot(w,d)*1.45,1,d/Math.hypot(w,d)*1.45);roof.position.set(x,.7+h+1.2,z);compound.add(roof)}
 const W=c.w,D=c.d,H=c.wall_h??3,T=.9,gap=c.gate_w??5;
 box(0,H/2-1,-D/2,W,H+2,T,'wall',true);for(const sx of [-1,1])box(sx*W/2,H/2-1,0,T,H+2,D,'wall',true);
 for(const sx of [-1,1])box(sx*(gap/2+(W/2-gap/2)/2),H/2-1,D/2,W/2-gap/2,H+2,T,'wall',true);
 box(0,H+.3,D/2,gap+2,.5,T+1.4,'roof');
 for(const [x,z,w,d,h] of c.halls)hall(x,z,w,d,h);
 // ---- torchbearers and the smoke at first light ----------------------------------------------------------------
 const torchMat=new THREE.MeshBasicMaterial({color:0xff9d3c}),torches=[];
 const local=(x,z)=>{const v=new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),yaw);return new THREE.Vector3(centre.x+v.x,0,centre.z+v.z)};
 for(let i=0;i<data.torches;i++){
  const p=createWalker();p.group.name='torchbearer';p.group.getObjectByName('walker-body').material.color.set(i%2?'#2b2d2f':'#3a3530');
  const stick=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.9,5),mats.wood);stick.position.set(.35,1.2,.2);p.group.add(stick);
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.12,.35,7),torchMat);flame.position.set(.35,1.8,.2);p.group.add(flame);
  if(i<2){const light=new THREE.PointLight(0xff9a45,2.6,20,1.6);light.position.set(.35,1.9,.2);p.group.add(light)}
  p.group.visible=false;scene.add(p.group);torches.push({p,phase:i/data.torches});
 }
 const loop=data.torch_loop.map(([x,z])=>local(x,z)),exitPoint=local(...data.torch_exit);
 const smoke=new THREE.Group();smoke.name='dawn-smoke';smoke.visible=false;scene.add(smoke);
 const smokeAt=local(...data.smoke_local);
 for(let i=0;i<6;i++){const puff=new THREE.Mesh(new THREE.SphereGeometry(2.2+i*.7,10,8),new THREE.MeshStandardMaterial({color:0x6d6a66,transparent:true,opacity:.28,depthWrite:false}));puff.position.set(smokeAt.x+Math.sin(i)*1.5,(fp.groundAt(smokeAt.x,smokeAt.z)??floor)+4+i*3.2,smokeAt.z+Math.cos(i*1.3));smoke.add(puff)}
 // ---- the hiding place ------------------------------------------------------------------------------------------
 let spot=null,marker=new THREE.Object3D(),state='approach',clock=0,outFor=0,torchMode='scatter',ending=0,torchPath=0;
 scene.add(marker);
 function prepare(){if(spot)return;spot=api.nearestSafe(local(...data.spot_local));marker.position.set(spot.x,fp.groundAt(spot.x,spot.z)??floor,spot.z)}
 function placeTorches(dt){
  torchPath+=dt*(torchMode==='gather'?.02:.035);
  for(const [i,t] of torches.entries()){
   let target;
   if(torchMode==='gather')target=local(data.torch_gather[0]+(i-torches.length/2)*1.6,data.torch_gather[1]+(i%2)*1.4);
   else if(torchMode==='leave')target=exitPoint;
   else{const u=((torchPath+t.phase)%1)*loop.length,a=loop[Math.floor(u)],b=loop[(Math.floor(u)+1)%loop.length];target=a.clone().lerp(b,u%1)}
   const pos=t.p.group.position,dx=target.x-pos.x,dz=target.z-pos.z,dist=Math.hypot(dx,dz),step=Math.min(dist,dt*(torchMode==='leave'?2.2:1.6));
   if(dist>.05){pos.x+=dx/dist*step;pos.z+=dz/dist*step;t.p.group.rotation.y=Math.atan2(dx,dz)}
   pos.y=fp.groundAt(pos.x,pos.z)??floor;t.p.update(clock*1.4+i,dist>.3);
   if(torchMode==='leave'&&dist<1)t.p.group.visible=false;
  }
 }
 function enter(){
  prepare();state='approach';clock=0;outFor=0;ending=0;torchMode='scatter';smoke.visible=false;
  for(const [i,t] of torches.entries()){const s=loop[i%loop.length];t.p.group.position.set(s.x,fp.groundAt(s.x,s.z)??floor,s.z);t.p.group.visible=true}
  // Resuming from elsewhere puts the walker outside the gate; coming straight from the previous stage keeps them there.
  const gateFront=local(0,D/2+6);if(Math.hypot(fp.eye.x-gateFront.x,fp.eye.z-gateFront.z)>60){fp.placeAt(gateFront.x,gateFront.z,Math.atan2(-(centre.x-gateFront.x),-(centre.z-gateFront.z)));fp.clearInput()}
  api.quest.follow(marker);api.markMap(spot);api.panel.message(text(data,'intro'));
  for(const beat of data.timeline)beat.done=false;
 }
 function exit(){for(const t of torches)t.p.group.visible=false;smoke.visible=false;api.quest.follow(null);api.markMap(null)}
 function reset(){state='approach';clock=0;for(const beat of data.timeline)beat.done=false}
 function update(dt){
  api.quest.update(dt);placeTorches(dt);
  const left=Math.hypot(fp.eye.x-spot.x,fp.eye.z-spot.z);
  if(state==='approach'){
   api.panel.message(text(data,'approach').replace('{m}',Math.round(left)));
   if(left<data.radius_m){state='watch';api.quest.follow(null);api.markMap(null);api.panel.message(text(data,'settled'))}
   return;
  }
  if(state==='watch'){
   if(left>data.radius_m+1.5){
    outFor+=dt;api.panel.message(text(data,'stray'));
    if(outFor>4){fp.placeAt(spot.x,spot.z,Math.atan2(-(centre.x-spot.x),-(centre.z-spot.z)));fp.clearInput();outFor=0;api.panel.message(text(data,'pulled_back'))}
    return;
   }
   outFor=0;clock+=dt;
   for(const beat of data.timeline)if(!beat.done&&clock>=beat.t){beat.done=true;if(beat.text)api.panel.message(text(beat,'text'));if(beat.flash)api.flash(beat.flash);if(beat.cue)api.cue(beat.cue);if(beat.torches)torchMode=beat.torches;if(beat.light)api.light(beat.light,beat.light_s);if(beat.smoke)smoke.visible=true}
   if(clock>=data.duration_s){state='ending';ending=0}
   return;
  }
  if(state==='ending'){
   ending+=dt;for(const [i,p] of smoke.children.entries()){p.position.y+=dt*(.5+i*.08);p.material.opacity=Math.max(.08,.28-ending*.004)}
   if(ending>=data.leave_after_s&&!api.saving){state='done';api.finish()}
  }
 }
 return {prepare,enter,exit,reset,update,compound,torches,smoke,get spot(){return spot},get state(){return state},get clock(){return clock}};
}
