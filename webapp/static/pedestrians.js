import * as THREE from 'three';

export function createPedestrians(data,sourceSurface){
 const group=new THREE.Group();group.name='walking-people';
 const routes=data.routes.map(route=>{
  const raw=route.pixel_points.map(p=>sourceSurface(...p)),points=[];
  for(let i=0;i<raw.length-1;i++){
   const a=raw[i],b=raw[i+1],length=Math.hypot(b.x-a.x,b.z-a.z),steps=Math.ceil(length);
   for(let j=0;j<steps;j++){const t=j/steps;points.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t})}
  }
  points.push({x:raw.at(-1).x,z:raw.at(-1).z});let length=0;
  points.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z);p.distance=length});
  return {...route,points,length};
 });
 // Alternating costume variants are illustrative, not a historical population estimate.
 const walkers=routes.flatMap(route=>Array.from({length:route.count},(_,i)=>({route,phase:(i+.35)/route.count*route.length*2,speed:.8+(i*17%50)/100,seed:i,costume:i%2?'female':'male',position:new THREE.Vector3()})));
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
 const dummy=new THREE.Object3D(),rotation=new THREE.Quaternion(),limbRotation=new THREE.Quaternion(),axis=new THREE.Vector3(1,0,0);let elapsed=0,mapVisible=true,roadVisible=true,exaggeration=1;
 const visibleHeight=p=>Math.max(mapVisible?p.height:p.terrainHeight,roadVisible?p.roadHeight:-Infinity);
 function sample(route,distance){
  const p=route.points;let lo=0,hi=p.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(p[mid].distance<=distance)lo=mid;else hi=mid}
  const a=p[lo],b=p[hi],t=(distance-a.distance)/(b.distance-a.distance||1);
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:Math.max(visibleHeight(a),visibleHeight(b)),dx:b.x-a.x,dz:b.z-a.z};
 }
 function update(dt=0){
  if(group.visible&&document.getElementById('walking3d').checked&&!document.hidden)elapsed+=Math.min(dt,.1);
  walkers.forEach((w,i)=>{
   const phase=(w.phase+elapsed*w.speed)%(2*w.route.length),forward=phase<=w.route.length,distance=forward?phase:2*w.route.length-phase,p=sample(w.route,distance),direction=forward?1:-1,len=Math.hypot(p.dx,p.dz)||1;
   const lane=.35*direction*Math.min(1,distance/3,(w.route.length-distance)/3),x=p.x-p.dz/len*lane,z=p.z+p.dx/len*lane,y=p.y*exaggeration+.04;
   w.position.set(x,y,z);w.distance=distance;w.yaw=Math.atan2(p.dx*direction,p.dz*direction);
   rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),w.yaw);
   const swing=Math.sin(elapsed*w.speed*8+w.phase*8)*.45;
   function place(mesh,lx,ly,lz,angle=0,sx=1,sy=1,sz=1,roll=0){dummy.position.set(lx,ly,lz).applyQuaternion(rotation).add(w.position);limbRotation.setFromAxisAngle(axis,angle);dummy.quaternion.copy(rotation).multiply(limbRotation);if(roll)dummy.rotateZ(roll);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)}
   const female=w.costume==='female';
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
 function updateGround(supportAt){
  for(const route of routes)for(const p of route.points){const s=supportAt(p.x,p.z,2.5,2.5,0,true);p.height=s.max;p.terrainHeight=s.terrain.max;p.roadHeight=s.road?.max??s.max}
  update();
 }
 // Expanded footprints cover the lane offset and swinging feet between 1 m samples.
 const setRoadVisible=value=>{roadVisible=value;update()};
 const setHeight=value=>{exaggeration=value;update()},setMapVisible=value=>{mapVisible=value;update()};
 document.getElementById('people3d').onchange=e=>{group.visible=e.target.checked};
 return {group,routes,walkers,update,updateGround,setHeight,setMapVisible,setRoadVisible,get elapsed(){return elapsed}};
}
