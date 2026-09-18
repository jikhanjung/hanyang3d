import * as THREE from 'three';
import {buildWalkingRoutes,createWalkingSimulation,sampleWalkingRoute,walkingRouteKey} from './walking_simulation.js';

export function createPedestrians(data,sourceSurface,{era=1750,footHeight=null}={}){
 const group=new THREE.Group();group.name='walking-people';
 const routes=buildWalkingRoutes(data,sourceSurface),simulation=createWalkingSimulation(routes);
 // Alternating costume variants are illustrative, not a historical population estimate.
 const walkers=simulation.walkers;walkers.forEach(w=>{w.position=new THREE.Vector3(w.position.x,0,w.position.z)});
 const byId=new Map(walkers.map(w=>[w.id,w]));let network=null,receivedAt=0;
 const make=(geometry,color)=>{const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}),walkers.length);mesh.frustumCulled=false;group.add(mesh);return mesh};
 const body=make(new THREE.BoxGeometry(.43,.65,.28),0xffffff),head=make(new THREE.SphereGeometry(.145,8,6),0xc5a17e),legs=[make(new THREE.BoxGeometry(.19,.7,.22),0xffffff),make(new THREE.BoxGeometry(.19,.7,.22),0xffffff)],arms=[make(new THREE.BoxGeometry(.2,.55,.24),0xffffff),make(new THREE.BoxGeometry(.2,.55,.24),0xffffff)];
 // Small instanced details face local +Z, the same direction as each walker's stride.
 const hair=make(new THREE.SphereGeometry(.152,8,5,0,Math.PI*2,0,1.25),0x302b28);
 const eyes=[make(new THREE.SphereGeometry(.018,6,4),0x292522),make(new THREE.SphereGeometry(.018,6,4),0x292522)];
 const nose=make(new THREE.BoxGeometry(.035,.04,.04),0xbe9775);
 hair.name='pedestrian-hair';eyes.forEach((mesh,i)=>mesh.name='pedestrian-eye-'+i);nose.name='pedestrian-noses';
 body.name='pedestrian-bodies';
 const skirt=make(new THREE.CylinderGeometry(.24,.48,.95,12),0xffffff);skirt.name='pedestrian-chima';
 const knot=make(new THREE.SphereGeometry(.07,8,6),0x302b28);knot.name='pedestrian-topknot';
 const bun=make(new THREE.SphereGeometry(.09,8,6),0x302b28);bun.name='pedestrian-hair-bun';
 const collars=[make(new THREE.BoxGeometry(.04,.23,.018),0xf1e9d5),make(new THREE.BoxGeometry(.04,.23,.018),0xf1e9d5)];
 const ties=[make(new THREE.BoxGeometry(.027,.19,.02),0xffffff),make(new THREE.BoxGeometry(.027,.15,.02),0xffffff)];
 collars.forEach((m,i)=>m.name='pedestrian-collar-'+i);ties.forEach((m,i)=>m.name='pedestrian-goreum-'+i);
 const jackets=['#ded8c5','#c8c4b8','#b7c0bc','#d7c6aa','#b8b0a2'],skirts=['#707d87','#927269','#7f8873','#a28c6b','#777185'];
 walkers.forEach((w,i)=>{const variant=Math.floor(w.seed/2)%jackets.length,color=new THREE.Color(jackets[variant]);body.setColorAt(i,color);arms.forEach(m=>m.setColorAt(i,color));legs.forEach(m=>m.setColorAt(i,new THREE.Color('#c8c2b1')));skirt.setColorAt(i,new THREE.Color(skirts[variant]));ties.forEach(m=>m.setColorAt(i,new THREE.Color(w.costume==='female'?'#70564b':'#9b8c76')))});
 const late=era===1907;
 const coat=late?make(new THREE.CylinderGeometry(.25,.32,.82,8),0xe7e3d6):null;
 const brim=late?make(new THREE.CylinderGeometry(.35,.35,.025,12),0x282b2c):null;
 const crown=late?make(new THREE.CylinderGeometry(.13,.16,.23,10),0x282b2c):null;
 if(late){coat.name='1907-durumagi';brim.name='1907-gat-brim';crown.name='1907-gat-crown';walkers.forEach((w,i)=>{const c=new THREE.Color(['#e9e6db','#d9d7cb','#c5c8be'][i%3]);body.setColorAt(i,c);arms.forEach(m=>m.setColorAt(i,c));legs.forEach(m=>m.setColorAt(i,c));skirt.setColorAt(i,new THREE.Color(['#deddd3','#c0c2b7','#a5afb1'][i%3]))})}
 const dummy=new THREE.Object3D(),rotation=new THREE.Quaternion(),limbRotation=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0);let mapVisible=true,roadVisible=true,exaggeration=1;
 const visibleHeight=p=>Math.max(mapVisible?p.height:p.terrainHeight,roadVisible?p.roadHeight:-Infinity);
 const timeline=()=>network?network.elapsed+Math.min(.2,Math.max(0,(performance.now()-receivedAt)/1000)):simulation.elapsed;
 function applySnapshot(snapshot){
  if(network&&snapshot.tick<=network.tick)return;
  const first=!network;network=snapshot;receivedAt=performance.now();
  simulation.seek(snapshot.elapsed);
  for(const pose of snapshot.npcs){const w=byId.get(pose[0]);if(!w)continue;w.target=pose;w.dodge=pose[5];if(Number.isFinite(pose[6]))w.phase=pose[6];if(Number.isFinite(pose[7]))w.speed=pose[7];if(first){w.position.x=pose[1];w.position.z=pose[2];w.yaw=pose[3];w.distance=pose[4]}}
  if(first)vehicleOffsets.clear();
 }
 function disconnect(){if(network)simulation.seek(timeline());network=null;walkers.forEach(w=>{delete w.target})}
 let vehicleAvoider=null;const vehicleOffsets=new Map();
 function update(dt=0){
  for(const w of walkers){const o=vehicleOffsets.get(w.id);if(o){w.position.x-=o.x;w.position.z-=o.z}}
  if(network){
   const alpha=1-Math.exp(-15*Math.min(dt,.1));
   for(const w of walkers){const p=w.target;if(!p)continue;const a=Math.hypot(w.position.x-p[1],w.position.z-p[2])>10?1:alpha;w.position.x+=(p[1]-w.position.x)*a;w.position.z+=(p[2]-w.position.z)*a;w.yaw+=Math.atan2(Math.sin(p[3]-w.yaw),Math.cos(p[3]-w.yaw))*a;w.distance=p[4]}
  }else simulation.step(group.visible&&document.getElementById('walking3d').checked&&!document.hidden?dt:0,avoid?[avoid]:[]);
  const elapsed=timeline();
  walkers.forEach((w,i)=>{
   if(vehicleAvoider){const old=vehicleOffsets.get(w.id)??{x:0,z:0},o=vehicleAvoider(w.position,old,dt);vehicleOffsets.set(w.id,o);w.position.x+=o.x;w.position.z+=o.z}else vehicleOffsets.delete(w.id);
   const p=sampleWalkingRoute(w.route,w.distance);w.position.y=(footHeight?footHeight(w.position.x,w.position.z):Math.max(visibleHeight(p.a),visibleHeight(p.b))*exaggeration)+.04;
   rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),w.yaw);
   const swing=Math.sin(elapsed*w.speed*8+w.phase*8)*.45;
   function place(mesh,lx,ly,lz,angle=0,sx=1,sy=1,sz=1,roll=0){dummy.position.set(lx,ly,lz).applyQuaternion(rotation).add(w.position);limbRotation.setFromAxisAngle(axis,angle);dummy.quaternion.copy(rotation).multiply(limbRotation);if(roll)dummy.rotateZ(roll);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
   const female=w.costume==='female';
   if(late){const dressed=!female&&w.seed%3!==0?1:0;place(coat,0,.77,0,0,dressed,dressed,dressed);place(brim,0,1.72,0,0,dressed,dressed,dressed);place(crown,0,1.845,0,0,dressed,dressed,dressed)}
   place(body,0,female?1.24:1.075,0,0,1,female?.5:1,1);place(head,0,1.56,0);
   place(skirt,0,.68,0,0,female?1:0,female?1:0,female?1:0);
   place(knot,0,1.725,-.025,0,female?0:.8,female?0:1.1,female?0:.8);
   place(bun,0,1.52,-.14,0,female?1:0,female?.75:0,female?.8:0);
   place(collars[0],-.048,1.315,.151,0,1,1,1,.48);place(collars[1],.048,1.315,.153,0,1,1,1,-.48);
   place(ties[0],.055,1.13,.16,0,1,1,1,-.16);place(ties[1],.095,1.15,.162,0,1,1,1,.28);
   place(hair,0,1.56,0);place(eyes[0],-.05,1.585,.137);place(eyes[1],.05,1.585,.137);place(nose,0,1.55,.148);
   for(let k=0;k<2;k++){const side=k?1:-1,a=swing*side;place(legs[k],side*.115,.75-.35*Math.cos(a),-.35*Math.sin(a),a);place(arms[k],side*.285,1.35-.275*Math.cos(a),.275*Math.sin(a),-a)}
  });
  for(const mesh of group.children)mesh.instanceMatrix.needsUpdate=true;
 }
 let avoid=null;
 const setAvoidPoint=point=>{avoid=point};
 // True when any visible walker stands within `radius` of the point.
 const near=(x,z,radius)=>group.visible&&walkers.some(w=>Math.hypot(w.position.x-x,w.position.z-z)<radius);
 function updateGround(supportAt){
  for(const route of routes)for(const p of route.points){const s=supportAt(p.x,p.z,2.5,2.5,0,true);p.height=s.max;p.terrainHeight=s.terrain.max;p.roadHeight=s.road?.max??s.max}
  update();
 }
 // Expanded footprints cover the lane offset and swinging feet between 1 m samples.
 const setRoadVisible=value=>{roadVisible=value;update()};
 const setHeight=value=>{exaggeration=value;update()},setMapVisible=value=>{mapVisible=value;update()};
 document.getElementById('people3d').onchange=e=>{group.visible=e.target.checked};
 return {setVehicleAvoider:fn=>{vehicleAvoider=fn},group,routes,walkers,update,updateGround,setHeight,setMapVisible,setRoadVisible,setAvoidPoint,near,applySnapshot,disconnect,routeKey:walkingRouteKey(routes),get networkSnapshot(){return network},get elapsed(){return timeline()}};
}

// Single non-instanced walker for the player's own character in walk mode.
export function createWalker(){
 const group=new THREE.Group();group.name='player-walker';
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 const jacket=mat('#d8cdb2'),skin=mat(0xc5a17e),hair=mat(0x302b28),trouser=mat('#c8c2b1'),trim=mat('#f1e9d5'),sash=mat('#9b8c76'),pupil=mat(0x292522);
 const add=(parent,geometry,material,x,y,z,roll=0)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);if(roll)mesh.rotation.z=roll;parent.add(mesh);return mesh};
 add(group,new THREE.BoxGeometry(.43,.65,.28),jacket,0,1.075,0).name='walker-body';
 add(group,new THREE.SphereGeometry(.145,10,8),skin,0,1.56,0).name='walker-head';
 add(group,new THREE.SphereGeometry(.152,10,6,0,Math.PI*2,0,1.25),hair,0,1.56,0);
 add(group,new THREE.SphereGeometry(.07,8,6),hair,0,1.725,-.025);
 for(const side of [-1,1])add(group,new THREE.SphereGeometry(.018,6,4),pupil,side*.05,1.585,.137);
 add(group,new THREE.BoxGeometry(.035,.04,.04),skin,0,1.55,.148);
 for(const side of [-1,1])add(group,new THREE.BoxGeometry(.04,.23,.018),trim,side*.048,1.315,.152,-side*.48);
 add(group,new THREE.BoxGeometry(.027,.19,.02),sash,.055,1.13,.16,-.16);
 add(group,new THREE.BoxGeometry(.027,.15,.02),sash,.095,1.15,.162,.28);
 // Limbs hang from hip and shoulder pivots so the walk cycle is a single rotation each.
 const limbs=[-1,1].map(side=>{
  const leg=new THREE.Group();leg.position.set(side*.115,1.1,0);add(leg,new THREE.BoxGeometry(.19,.7,.22),trouser,0,-.35,0);
  const arm=new THREE.Group();arm.position.set(side*.285,1.35,0);add(arm,new THREE.BoxGeometry(.2,.55,.24),jacket,0,-.275,0);
  group.add(leg);group.add(arm);return {side,leg,arm};
 });
 let swing=0;
 function update(distance,moving,seated=false){
  // Ease the stride out when the walker stops so the pose settles upright.
  swing=moving?Math.sin(distance*1.9)*.45:swing*.82;
  // On horseback the legs straddle forward and the arms hold the reins.
  for(const {side,leg,arm} of limbs){
   if(seated){leg.rotation.set(-1.25,0,side*.3);arm.rotation.set(-.7,0,0)}
   else{leg.rotation.set(swing*side,0,0);arm.rotation.set(-swing*side,0,0)}
  }
 }
 update(0,false);
 return {group,update};
}
