import * as THREE from 'three';

// Gwansanggam: a small walled office yard with the stone observation platform (관천대).
// The platform follows the surviving one — a square stone terrace with a stone table on top
// for the small armillary instrument; the office hall is a simplified concept.
export function createObservatory(feature,w,h,d){
 const model=new THREE.Group();model.name='observatory';
 const mats={
  stone:new THREE.MeshStandardMaterial({color:0xb3ab98,roughness:1}),
  darkStone:new THREE.MeshStandardMaterial({color:0x958d7b,roughness:1}),
  wall:new THREE.MeshStandardMaterial({color:0xcfc3a6,roughness:1}),
  wood:new THREE.MeshStandardMaterial({color:0x7a4a33,roughness:1}),
  roof:new THREE.MeshStandardMaterial({color:0x444e50,roughness:1}),
  yard:new THREE.MeshStandardMaterial({color:0xc2ad86,roughness:1}),
 };
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  const g=new THREE.BufferGeometry(),a=width/2,b=depth/2;
  g.setAttribute('position',new THREE.Float32BufferAttribute([-a,.1,-b,a,.1,-b,a,.1,b,-a,.1,b,-a*.72,.4,-b*.66,a*.72,.4,-b*.66,a*.72,.4,b*.66,-a*.72,.4,b*.66,-a*.46,rise,0,a*.46,rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4,0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);model.add(mesh);parts.push(name);
 }
 const wallH=2.4,thick=1,gate=5;
 box('yard',0,.08,0,w-thick*2,.16,d-thick*2,'yard');
 for(const side of [-1,1])box('side-wall',side*(w/2-thick/2),wallH/2,0,thick,wallH,d,'wall');
 box('back-wall',0,wallH/2,-(d/2-thick/2),w-thick*2,wallH,thick,'wall');
 for(const side of [-1,1]){
  const run=(w-thick*2-gate)/2;
  box('front-wall',side*(gate/2+run/2),wallH/2,d/2-thick/2,run,wallH,thick,'wall');
 }
 roof('gate-roof',0,d/2-thick/2,gate*1.5,thick+2.6,3.2,1.1);
 // Office hall along the north wall.
 const hallW=Math.min(18,w*.45),hallD=7,hallZ=-d/2+thick+hallD/2+2,postH=3.2;
 box('hall-footing',0,.3,hallZ,hallW+1,.6,hallD+1,'stone');
 box('hall-wall',0,.6+postH/2,hallZ,hallW*.94,postH,hallD*.88,'wall');
 for(let i=0;i<=5;i++)for(const side of [-1,1]){
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.15,.18,postH,6),mats.wood);
  post.name='hall-post';post.position.set((i/5-.5)*hallW*.94,.6+postH/2-h/2,hallZ+side*hallD*.46);model.add(post);parts.push(post.name);
 }
 roof('hall-roof',0,hallZ,hallW+2.4,hallD+3.2,.6+postH,hallD*.5);
 // Observation platform: stepped stone terrace about 3.5 m high with a stone table on top.
 const px=w*.18,pz=d*.12,platH=3.5;
 box('observation-platform',px,platH/2,pz,4.6,platH,4.2,'stone');
 box('platform-cornice',px,platH+.12,pz,5,.24,4.6,'darkStone');
 box('instrument-table',px,platH+.24+.45,pz,1.6,.9,1.6,'darkStone');
 box('instrument-table-top',px,platH+.24+.9+.08,pz,2,.16,2,'stone');
 for(let i=0;i<6;i++)box('platform-stair',px-2.3-.4-i*.38,platH*(i+1)/12,pz,.5,platH*(i+1)/6,1.4,'stone');
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='observatory-surfaces';model.add(mesh)}
 model.userData={conceptual:true,platformHeightM:platH,parts,footprint:[w,d],period:feature.temporal};
 return model;
}
