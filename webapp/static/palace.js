import * as THREE from 'three';

const PALETTE={stone:0xb4ac99,wood:0x813b2c,door:0x493a2b,roof:0x374448,trim:0x597461,court:0xbca779};
function palaceMaterials(){
 return Object.fromEntries(Object.entries(PALETTE).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
}
// Merge static geometry by material to keep the palace models inexpensive on mobile.
function mergeByMaterial(model){
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='palace-surfaces';model.add(mesh)}
}

// Schematic royal hall + forecourt, scaled to the existing landmark footprint.
export function createPalace(feature,w,h,d){
 const model=new THREE.Group();model.name='palace-compound';
 const tiers=feature.palace_roof_tiers??1;
 const mats=palaceMaterials();
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise,yaw=0){
  const g=new THREE.BufferGeometry(),a=width/2,b=depth/2;
  g.setAttribute('position',new THREE.Float32BufferAttribute([-a,.12,-b,a,.12,-b,a,.12,b,-a,.12,b,-a*.77,.45,-b*.66,a*.77,.45,-b*.66,a*.77,.45,b*.66,-a*.77,.45,b*.66,-a*.52,rise,0,a*.52,rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4,0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);mesh.rotation.y=yaw;model.add(mesh);parts.push(name);
  const ridge=box('ridge',x,eave+rise+.08,z,width*.55,.16,.2,'stone');ridge.rotation.y=yaw;
 }
 const base=h*.075,hallZ=-d*.13,hallW=w*.72,hallD=d*.47,postH=h*(tiers===2?.37:.49),eave=base+postH;
 box('forecourt',0,h*.018,0,w*.96,h*.036,d*.96,'court');
 box('stone-platform',0,base/2,hallZ,hallW+1,base,hallD+1,'stone');
 box('hall-walls',0,base+postH*.44,hallZ-.05*d,hallW*.95,postH*.88,hallD*.7,'door');
 for(let i=0;i<=5;i++)for(const sign of [-1,1]){
  const x=(i/5-.5)*hallW,z=hallZ+sign*hallD/2;
  box('column-foot',x,base+.09,z,.48,.18,.48,'stone');
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.16,.21,postH,8),mats.wood);post.name='red-column';post.position.set(x,base+postH/2-h/2,z);model.add(post);parts.push(post.name);
  box('bracket',x,eave-.1,z,.65,.28,.65,'trim');
 }
 for(let i=0;i<5;i++){
  const x=(i-2)*hallW/5,z=hallZ+hallD*.36;
  box('door-panel',x,base+postH*.44,z,hallW/5-.18,postH*.77,.12,'trim');
  for(let j=-1;j<=1;j++)box('door-lattice',x+j*hallW/25,base+postH*.49,z+.08,.055,postH*.6,.06,'wood');
 }
 box('front-beam',0,eave-.05,hallZ+hallD/2,hallW+.5,.3,.35,'wood');
 roof('main-roof',0,hallZ,w*.92,d*.7,eave,h*(tiers===2?.16:.3));
 if(tiers===2){
  const upperBase=eave+h*.13;
  box('upper-hall',0,upperBase+h*.09,hallZ,hallW*.75,h*.18,hallD*.65,'wood');
  for(let i=0;i<5;i++)box('upper-window',(i-2)*hallW*.14,upperBase+h*.1,hallZ+hallD*.33,hallW*.1,h*.1,.1,'trim');
  roof('upper-roof',0,hallZ,w*.75,d*.54,upperBase+h*.18,h*.17);
 }
 for(const side of [-1,1]){
  const x=side*w*.435;
  box('side-gallery',x,h*.11,d*.08,w*.075,h*.18,d*.62,'wood');
  roof('gallery-roof',x,d*.08,d*.68,w*.16,h*.2,h*.09,Math.PI/2);
 }
 for(const side of [-1,1])box('gate-post',side*w*.095,h*.12,d*.385,.35,h*.22,.35,'wood');
 roof('court-gate',0,d*.385,w*.31,d*.19,h*.23,h*.1);
 for(let i=0;i<4;i++)box('front-stair',0,base*(i+1)/8,hallZ+hallD/2+1-i*.25,w*.17,base*(i+1)/4,.6,'stone');
 box('central-path',0,h*.038,d*.24,w*.12,.06,d*.24,'stone');
 mergeByMaterial(model);
 model.userData={conceptual:true,roofTiers:tiers,parts,footprint:[w,d],period:feature.temporal};return model;
}

// Schematic two-storey palace gate: stone base, three door bays, upper gate house.
export function createPalaceGate(feature,w,h,d){
 const model=new THREE.Group();model.name='palace-gate';
 const tiers=feature.palace_gate_tiers??2;
 const mats=palaceMaterials();
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  const g=new THREE.BufferGeometry(),a=width/2,b=depth/2;
  g.setAttribute('position',new THREE.Float32BufferAttribute([-a,.12,-b,a,.12,-b,a,.12,b,-a,.12,b,-a*.77,.45,-b*.66,a*.77,.45,-b*.66,a*.77,.45,b*.66,-a*.77,.45,b*.66,-a*.52,rise,0,a*.52,rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4,0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);model.add(mesh);parts.push(name);
  box('ridge',x,eave+rise+.08,z,width*.55,.16,.2,'stone');
 }
 const base=h*.08,postH=h*(tiers===2?.4:.62),eave=base+postH,bays=3,bayW=w*.78/bays;
 box('gate-platform',0,base/2,0,w,base,d,'stone');
 for(let i=0;i<bays;i++){
  const x=(i-(bays-1)/2)*bayW;
  box('gate-door',x,base+postH*.46,0,bayW*.72,postH*.9,d*.24,'door');
  for(let j=-1;j<=1;j++)box('door-stud',x+j*bayW*.2,base+postH*.5,d*.13,.09,postH*.62,.08,'trim');
 }
 for(let i=0;i<=bays;i++)for(const sign of [-1,1]){
  const x=(i/bays-.5)*w*.86,z=sign*d*.3;
  box('column-foot',x,base+.1,z,.5,.2,.5,'stone');
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.18,.23,postH,8),mats.wood);post.name='red-column';post.position.set(x,base+postH/2-h/2,z);model.add(post);parts.push(post.name);
 }
 box('lintel',0,eave-.2,0,w*.9,.4,d*.66,'wood');
 if(tiers===2){
  const upper=eave+h*.05;
  box('gate-railing',0,upper,0,w*.92,h*.05,d*.86,'trim');
  box('upper-house',0,upper+h*.14,0,w*.8,h*.22,d*.62,'wood');
  for(let i=0;i<bays+1;i++)box('upper-window',(i-bays/2+.5)*w*.19,upper+h*.15,d*.31,w*.12,h*.12,.1,'trim');
  roof('gate-roof',0,0,w*1.04,d*1.1,upper+h*.25,h*.2);
 }else roof('gate-roof',0,0,w*1.04,d*1.2,eave,h*.24);
 // Wall stubs stay inside the landmark footprint so they rest on the gate platform.
 for(const side of [-1,1])box('flanking-wall',side*w*.44,base+h*.11,0,w*.12,h*.22,d*.52,'stone');
 for(let i=0;i<3;i++)box('gate-stair',0,base*(i+1)/6,d*.5+.9-i*.3,w*.5,base*(i+1)/3,.7,'stone');
 mergeByMaterial(model);
 model.userData={conceptual:true,gateTiers:tiers,bays,parts,footprint:[w,d],period:feature.temporal};return model;
}
