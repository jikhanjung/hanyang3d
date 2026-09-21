import * as THREE from 'three';

const PALETTE={stone:0xa9a496,wall:0xcfc3a6,roof:0x3d4a4e,ground:0xa9a06f,trunk:0x6b4a31,leaf:0x4e6b3d,leafDark:0x3b5530};

// Walled royal garden (a wonyu) for a site that held a garden rather than buildings at the scene's date:
// a plain wall with a south gate, grass and a stand of pines. Conceptual, not a surveyed planting plan.
export function createWalledGarden(feature,w,h,d){
 const model=new THREE.Group();model.name='walled-garden';
 const mats=Object.fromEntries(Object.entries(PALETTE).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 const parts=[];
 const add=(name,geometry,x,y,z,material)=>{const mesh=new THREE.Mesh(geometry,mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh};
 const box=(name,x,y,z,sx,sy,sz,material)=>add(name,new THREE.BoxGeometry(sx,sy,sz),x,y,z,material);
 const wallH=2.4,thick=1.1,gate=Math.min(6,w*.2);
 box('ground',0,.06,0,w*.99,.12,d*.99,'ground');
 for(const side of [-1,1]){
  box('side-wall',side*(w/2-thick/2),wallH/2,0,thick,wallH,d,'wall');
  box('side-wall-cap',side*(w/2-thick/2),wallH+.13,0,thick+.5,.26,d,'roof');
 }
 box('back-wall',0,wallH/2,-(d/2-thick/2),w-thick*2,wallH,thick,'wall');
 box('back-wall-cap',0,wallH+.13,-(d/2-thick/2),w-thick*2,.26,thick+.5,'roof');
 for(const side of [-1,1]){
  const run=(w-thick*2-gate)/2;
  box('front-wall',side*(gate/2+run/2),wallH/2,d/2-thick/2,run,wallH,thick,'wall');
  box('front-wall-cap',side*(gate/2+run/2),wallH+.13,d/2-thick/2,run,.26,thick+.5,'roof');
  box('gate-post',side*gate*.45,1.5,d/2-thick/2,.4,3,.4,'stone');
 }
 // Pines placed by a fixed hash of the plot so the stand never changes between visits.
 let seed=(w*31+d*17)|0;const rand=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
 const count=Math.max(6,Math.round(w*d/180));
 for(let i=0;i<count;i++){
  const x=(rand()-.5)*(w-8),z=(rand()-.5)*(d-8)-d*.05,height=4.5+rand()*3,dark=rand()>.5;
  if(Math.abs(x)<gate&&z>d/2-10)continue;
  add('pine-trunk',new THREE.CylinderGeometry(.16,.24,height*.55,6),x,height*.27,z,'trunk');
  add('pine-crown',new THREE.ConeGeometry(height*.28,height*.55,7),x,height*.72,z,dark?'leafDark':'leaf');
  add('pine-crown-top',new THREE.ConeGeometry(height*.18,height*.35,7),x,height*.97,z,dark?'leaf':'leafDark');
 }
 box('path',0,.14,d*.3,Math.max(1.6,w*.04),.08,d*.35,'stone');
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='walled-garden-surfaces';model.add(mesh)}
 model.userData={conceptual:true,parts,footprint:[w,d],position_status:feature.position_status};
 return model;
}
