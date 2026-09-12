import * as THREE from 'three';

const PALETTE={stone:0xa9a496,wall:0xcfc3a6,wood:0x7d4a33,door:0x4a3a2b,roof:0x3d4a4e,yard:0xc0ab85,paper:0xe4dcc4};

// Walled house compound for a remembered site: tiled houses inside a plain wall.
export function createHouseSite(feature,w,h,d){
 const model=new THREE.Group();model.name='house-site';
 const mats=Object.fromEntries(Object.entries(PALETTE).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  const g=new THREE.BufferGeometry(),a=width/2,b=depth/2;
  g.setAttribute('position',new THREE.Float32BufferAttribute([-a,.1,-b,a,.1,-b,a,.1,b,-a,.1,b,-a*.78,.4,-b*.66,a*.78,.4,-b*.66,a*.78,.4,b*.66,-a*.78,.4,b*.66,-a*.5,rise,0,a*.5,rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4,0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);model.add(mesh);parts.push(name);
 }
 // A hanok is a stone footing, papered walls between timber posts and a tiled roof.
 // `vertical` turns the long side north-south, the way wing quarters line a side wall.
 function hanok(name,x,z,long,short,vertical){
  const footing=.55,postH=3.1,eave=footing+postH,sx=vertical?short:long,sz=vertical?long:short;
  box(name+'-footing',x,footing/2,z,sx+1,footing,sz+1,'stone');
  box(name+'-wall',x,footing+postH/2,z,sx*.94,postH,sz*.9,'paper');
  const posts=Math.max(3,Math.round(long/3.2));
  for(let i=0;i<posts;i++)for(const side of [-1,1]){
   const along=(i/(posts-1)-.5)*long*.94,across=side*short/2*.92;
   const post=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,postH,6),mats.wood);
   post.name=name+'-post';post.position.set(x+(vertical?across:along),footing+postH/2-h/2,z+(vertical?along:across));model.add(post);parts.push(post.name);
  }
  // Doors face the yard: south for the main halls, inward for the side wings.
  const face=vertical?Math.sign(-x)||1:1;
  box(name+'-door',x+(vertical?face*sx/2:0),footing+postH*.42,z+(vertical?0:sz/2),vertical?.14:sx*.3,postH*.7,vertical?sz*.3:.14,'door');
  // Fixed eaves overhang keeps the roof in proportion whatever the compound size.
  roof(name+'-roof',x,z,sx+2.4,sz+3.4,eave,Math.min(long,short)*.55);
 }
 const wallH=2.6,thick=1.1,gate=Math.min(7,w*.22);
 box('yard',0,.08,0,w*.99,.16,d*.99,'yard');
 for(const side of [-1,1]){
  box('side-wall',side*(w/2-thick/2),wallH/2,0,thick,wallH,d,'wall');
  box('side-wall-cap',side*(w/2-thick/2),wallH+.13,0,thick+.5,.26,d,'roof');
 }
 box('back-wall',0,wallH/2,-(d/2-thick/2),w-thick*2,wallH,thick,'wall');
 box('back-wall-cap',0,wallH+.13,-(d/2-thick/2),w-thick*2,.26,thick+.5,'roof');
 // The front wall opens for a gate house in the middle of the southern side.
 for(const side of [-1,1]){
  const run=(w-thick*2-gate)/2;
  box('front-wall',side*(gate/2+run/2),wallH/2,d/2-thick/2,run,wallH,thick,'wall');
  box('front-wall-cap',side*(gate/2+run/2),wallH+.13,d/2-thick/2,run,.26,thick+.5,'roof');
  box('gate-post',side*gate*.42,1.7,d/2-thick/2,.45,3.4,.45,'wood');
 }
 box('gate-door',0,1.45,d/2-thick/2,gate*.78,2.9,.2,'door');
 roof('gate-roof',0,d/2-thick/2,gate*1.5,thick+3,3.5,1.2);
 // House sizes stay at real hanok scale; only their spacing follows the compound.
 const bay=Math.min(20,w*.45),short=Math.min(8,w*.2),wing=Math.min(30,d*.3),inset=w/2-thick-short/2-1.5;
 hanok('anchae',0,-d*.28,bay,short,false);
 hanok('sarangchae',w*.2,-d*.02,bay*.7,short*.85,false);
 hanok('haengnang-west',-inset,d*.12,wing,short*.75,true);
 if(w>50){
  hanok('byeoldang',-w*.2,-d*.08,bay*.55,short*.8,false);
  hanok('haengnang-east',inset,d*.18,wing*.8,short*.75,true);
 }
 box('path',0,.2,d*.22,Math.max(1.8,w*.04),.1,d*.42,'stone');
 // A small marker stone by the gate says this is a remembered site, not a survey.
 box('marker-plinth',gate*.9,.3,d/2-thick-1.6,1.6,.6,1.6,'stone');
 box('marker-stone',gate*.9,1.6,d/2-thick-1.6,.7,2,.4,'stone');
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='house-site-surfaces';model.add(mesh)}
 model.userData={conceptual:true,commemorative:true,parts,footprint:[w,d],position_status:feature.position_status};
 return model;
}
