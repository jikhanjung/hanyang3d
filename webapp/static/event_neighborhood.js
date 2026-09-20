import * as THREE from 'three';
import {createSettlement} from './settlement.js';

// Anonymous late-Joseon concept houses, not retroactively dated 1907 landmarks.
export function createEventNeighborhood({path,surface,scene,walking,buildings,waterAt}){
 const records=[],segments=path.slice(1).map((b,i)=>({a:path[i],b,length:path[i].distanceTo(b)}));
 const distanceToRoute=(x,z)=>Math.min(...segments.map(({a,b,length})=>{const t=Math.max(0,Math.min(1,((x-a.x)*(b.x-a.x)+(z-a.z)*(b.z-a.z))/(length*length||1)));return Math.hypot(x-a.x-t*(b.x-a.x),z-a.z-t*(b.z-a.z))}));
 let seed=18960211;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 let travelled=0,next=90;
 for(const {a,b,length} of segments){
  for(;next<=travelled+length;next+=17){
   const t=(next-travelled)/length,px=a.x+(b.x-a.x)*t,pz=a.z+(b.z-a.z)*t,dx=(b.x-a.x)/length,dz=(b.z-a.z)/length;
   for(const side of [-1,1])for(const row of [0,1]){
    const w=6+random()*4,d=5+random()*3,h=2.5+random()*.8,radius=Math.hypot(w+2,d+2)/2,offset=13+row*18+random()*3;
    const x=px+side*dz*offset,z=pz-side*dx*offset,yaw=Math.atan2(px-x,pz-z),water=waterAt(x,z);
    if(distanceToRoute(x,z)<radius+6||water.distance<water.width+radius+4||walking.collision.hit(x,z,radius+2))continue;
    if(buildings.some(b=>b.visible&&Math.hypot(x-b.position.x,z-b.position.z)<radius+Math.hypot(b.userData.feature.symbol_size_m[0],b.userData.feature.symbol_size_m[2])/2+8))continue;
    if(records.some(r=>Math.hypot(x-r.x,z-r.z)<radius+r.radius+2))continue;
    const heights=[];for(const u of [-.5,0,.5])for(const v of [-.5,0,.5])heights.push(surface.ground(x+u*(w+2)*Math.cos(yaw)+v*(d+2)*Math.sin(yaw),z-u*(w+2)*Math.sin(yaw)+v*(d+2)*Math.cos(yaw)));
    if(heights.some(y=>y===null||!Number.isFinite(y)))continue;
    const min=Math.min(...heights),max=Math.max(...heights);if(max-min>1.15)continue;
    records.push({x,z,w,d,h,yaw,radius,rank:0,style:random(),shop:row===0&&random()<.18,support:{min,max,terrain:{min,max}},temporal:{reference_year:1896,status:'speculative_event_scenery'}});
   }
  }
  travelled+=length;
 }
 const houses=createSettlement({features:[]},surface,surface.ground,{children:[]},[],[],{records,density:1,lodDistance:180});houses.group.name='agwanpacheon-estimated-neighborhood';houses.updateHeights(1);scene.add(houses.group);
 for(const r of records)walking.collision.add({x:r.x,z:r.z,hw:r.w/2,hd:r.d/2,yaw:r.yaw,visible:()=>houses.group.visible&&r.displayed});
 // Short frontage walls leave a central doorway and the entire procession corridor open.
 const walls=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x9d9078,roughness:1}),records.length*2),dummy=new THREE.Object3D();let count=0;
 for(const r of records)for(const side of [-1,1]){
  const width=(r.w-2)/2,lx=side*(1+width/2),lz=r.d/2+1.5,x=r.x+lx*Math.cos(r.yaw)+lz*Math.sin(r.yaw),z=r.z-lx*Math.sin(r.yaw)+lz*Math.cos(r.yaw);
  dummy.position.set(x,surface.ground(x,z)+.55,z);dummy.rotation.set(0,r.yaw,0);dummy.scale.set(width,1.1,.35);dummy.updateMatrix();walls.setMatrixAt(count++,dummy.matrix);
  walking.collision.add({x,z,hw:width/2,hd:.175,yaw:r.yaw,visible:()=>houses.group.visible});
 }
 walls.count=count;walls.name='estimated-courtyard-walls';walls.computeBoundingSphere();scene.add(walls);
 // A narrow earthen lane makes the reconstructed route legible without painting over water.
 const positions=[],indices=[];
 for(const {a,b,length} of segments){
  const dx=(b.x-a.x)/length,dz=(b.z-a.z)/length,water=waterAt((a.x+b.x)/2,(a.z+b.z)/2);
  if(water.distance<water.width+5)continue;
  const k=positions.length/3;
  for(const p of [a,b])for(const side of [-1,1]){const x=p.x+side*dz*3.5,z=p.z-side*dx*3.5;positions.push(x,surface.ground(x,z)+.045,z)}
  indices.push(k,k+2,k+1,k+1,k+2,k+3);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const lane=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xc8b696,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));lane.name='estimated-escape-lane';scene.add(lane);
 return {...houses,walls,lane};
}
