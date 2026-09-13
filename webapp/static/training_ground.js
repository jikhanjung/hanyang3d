import * as THREE from 'three';

// Drill ground: offices along the north wall, an open field south of them for
// archery and the military examination, as recorded for the Hullyeonwon site.
export function createTrainingGround(feature,w,h,d){
 const model=new THREE.Group();model.name='training-ground';
 const palette={wall:0xcebea0,timber:0x7a4a33,roof:0x47514f,stone:0xa89e88,door:0x4f3b2c,field:0xc3ae86,target:0xbe6a4a};
 const mats=Object.fromEntries(Object.entries(palette).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  const g=new THREE.BufferGeometry(),a=width/2,b=depth/2;
  g.setAttribute('position',new THREE.Float32BufferAttribute([-a,.1,-b,a,.1,-b,a,.1,b,-a,.1,b,-a*.72,.4,-b*.66,a*.72,.4,-b*.66,a*.72,.4,b*.66,-a*.72,.4,b*.66,-a*.46,rise,0,a*.46,rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4,0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);model.add(mesh);parts.push(name);
  box('ridge',x,eave+rise+.1,z,width*.5,.2,.26,'stone');
 }
 function hall(name,x,z,long,short){
  const footing=.6,postH=3.4,eave=footing+postH;
  box(name+'-footing',x,footing/2,z,long+1.2,footing,short+1.2,'stone');
  box(name+'-wall',x,footing+postH/2,z,long*.95,postH,short*.9,'wall');
  const posts=Math.max(4,Math.round(long/3.4));
  for(let i=0;i<posts;i++)for(const side of [-1,1]){
   const post=new THREE.Mesh(new THREE.CylinderGeometry(.17,.2,postH,6),mats.timber);
   post.name=name+'-post';post.position.set(x+(i/(posts-1)-.5)*long*.95,footing+postH/2-h/2,z+side*short/2*.94);model.add(post);parts.push(post.name);
  }
  box(name+'-door',x,footing+postH*.42,z+short/2,long*.22,postH*.68,.16,'door');
  roof(name+'-roof',x,z,long+2.6,short+3.6,eave,Math.min(long,short)*.5);
 }
 const wallH=2.7,thick=1.2,gate=Math.min(9,w*.12),office=d*.3;
 box('field',0,.1,office/2,w-thick*2,.2,d-office-thick*2,'field');
 for(const side of [-1,1]){
  box('side-wall',side*(w/2-thick/2),wallH/2,0,thick,wallH,d,'wall');
  box('side-wall-cap',side*(w/2-thick/2),wallH+.14,0,thick+.6,.28,d,'roof');
 }
 box('back-wall',0,wallH/2,-(d/2-thick/2),w-thick*2,wallH,thick,'wall');
 box('back-wall-cap',0,wallH+.14,-(d/2-thick/2),w-thick*2,.28,thick+.6,'roof');
 for(const side of [-1,1]){
  const run=(w-thick*2-gate)/2;
  box('front-wall',side*(gate/2+run/2),wallH/2,d/2-thick/2,run,wallH,thick,'wall');
  box('front-wall-cap',side*(gate/2+run/2),wallH+.14,d/2-thick/2,run,.28,thick+.6,'roof');
  box('gate-post',side*gate*.42,1.8,d/2-thick/2,.5,3.6,.5,'timber');
 }
 roof('gate-roof',0,d/2-thick/2,gate*1.4,thick+4,3.8,1.4);
 // Offices stand along the north wall; the hall facing the field is the sacheong.
 const officeZ=-d/2+office*.45;
 hall('daecheong',0,officeZ,Math.min(34,w*.34),9);
 for(const side of [-1,1])hall('office',side*Math.min(w*.3,44),officeZ+3,Math.min(20,w*.2),8);
 hall('sacheong',0,-d/2+office+6,Math.min(22,w*.2),7.5);
 // Archery targets at the far end of the field, with a flag post beside the range.
 for(const side of [-1,1]){
  box('target-mound',side*w*.16,.7,d/2-thick-14,4.6,1.4,1.6,'stone');
  box('target',side*w*.16,3,d/2-thick-14,3.4,3.2,.5,'target');
 }
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.18,.24,9,6),mats.timber);
 pole.name='flag-post';pole.position.set(-w*.34,4.5-h/2,office);model.add(pole);parts.push(pole.name);
 box('flag',-w*.34+1.6,8.2,office,3,1.6,.08,'target');
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='training-ground-surfaces';model.add(mesh)}
 model.userData={conceptual:true,fieldDepthM:d-office,parts,footprint:[w,d],period:feature.temporal};
 return model;
}
