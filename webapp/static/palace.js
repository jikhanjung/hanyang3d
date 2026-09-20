import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

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
 if(feature.pavilion)return createGardenPavilion(feature,w,h,d);
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

// Small standalone halls and open pavilions. Dimensions and garden patches are conceptual,
// while material/roof choices are recorded separately from historical existence in each feature.
export function createGardenPavilion(feature,w,h,d){
 const model=new THREE.Group();model.name='garden-pavilion';
 const cfg=feature.pavilion,thatched=cfg.roof==='thatch';
 const colors={stone:0xb4ac99,wood:0x76503a,wall:0xd8cbb0,roof:thatched?0xa99768:0x485150,
  floor:0x9e805c,water:0x648f87,soil:0x999077,rice:0x789354};
 const mats=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1,side:k==='roof'?THREE.DoubleSide:THREE.FrontSide})]));
 const parts=[];
 const add=(name,g,m,x,y,z)=>{const mesh=new THREE.Mesh(g,mats[m]);mesh.name=name;mesh.position.set(x,y-h/2,z);model.add(mesh);parts.push(name);return mesh};
 const box=(name,m,x,y,z,sx,sy,sz)=>add(name,new THREE.BoxGeometry(sx,sy,sz),m,x,y,z);
 const garden=cfg.pond||cfg.rice,hw=w*(garden ? .48 : .86),hd=d*(garden ? .42 : .8),hz=garden?-d*.17:0;
 const base=.45,eave=h*.63,rise=h*.30,bays=cfg.bays??1;
 box('stone-platform','stone',0,.14,hz,hw+.65,.28,hd+.65);
 box('timber-floor','floor',0,base-.08,hz,hw,.18,hd);
 for(let i=0;i<=bays;i++)for(const side of [-1,1]){
  const x=-hw*.44+hw*.88*i/bays,z=hz+side*hd*.43;
  add('column',new THREE.CylinderGeometry(.13,.17,eave-base,8),'wood',x,(base+eave)/2,z);
 }
 for(const side of [-1,1])box('eave-beam','wood',0,eave-.06,hz+side*hd*.43,hw+.15,.22,.25);
 if(cfg.enclosed){
  box('hall-walls','wall',0,(eave+base)/2,hz,hw*.85,eave-base,hd*.8);
  for(let i=0;i<bays;i++){
   const x=-hw*.42+hw*.84*(i+.5)/bays;
   box('wooden-door','wood',x,base+(eave-base)*.45,hz+hd*.405,hw*.72/bays,(eave-base)*.82,.1);
  }
 }else{
  for(const side of [-1,1])box('side-railing','wood',side*hw*.44,base+.65,hz,.12,.13,hd*.86);
  box('back-railing','wood',0,base+.65,hz-hd*.43,hw*.88,.13,.12);
 }
 if(thatched){
  const roof=add('thatched-roof',new THREE.ConeGeometry(1,rise,4,1,false,Math.PI/4),'roof',0,eave+rise/2,hz);
  roof.scale.set((hw+1.3)/Math.SQRT2,1,(hd+1.3)/Math.SQRT2);
 }else if(cfg.roof==='pyramid'){
  const roof=add('pavilion-roof',new THREE.ConeGeometry(1,rise,4,1,false,Math.PI/4),'roof',0,eave+rise/2,hz);
  roof.scale.set((hw+1.3)/Math.SQRT2,1,(hd+1.3)/Math.SQRT2);
 }else add('hip-gable-roof',hipGableRoof(hw+1.2,hd+1.2,rise,.3,.3),'roof',0,eave,hz);
 for(let i=0;i<3;i++)box('entrance-step','stone',0,.06+i*.12,hz+hd/2+.7-i*.2,Math.min(2.5,hw*.5),.12,.45);
 if(cfg.pond){
  box('pond-bank','stone',0,.03,d*.25,w*.9,.06,d*.35);
  box('pond-water','water',0,.07,d*.25,w*.82,.02,d*.29);
 }
 if(cfg.rice){
  box('rice-bed','soil',0,.03,d*.25,w*.85,.06,d*.33);
  for(let row=0;row<4;row++)box('rice-row','rice',0,.16,d*.13+row*d*.075,w*.76,.25,.22);
 }
 model.userData={conceptual:true,parts,roof:cfg.roof,bays,footprint:[w,d],position_status:feature.position_status};
 mergeByMaterial(model);return model;
}

// Two-storey timber palace gate (돈화문·홍화문): a low stone platform, three to five door bays between red
// columns, a balustraded upper floor with lattice windows, and two hip-and-gable roofs. Wall stubs keep it
// joined to the palace wall. feature.palace_gate_bays gives the bay count (돈화문 5, 홍화문 3).
export function createPalaceGate(feature,w,h,d){
 const model=new THREE.Group();model.name='palace-gate';
 const tiers=feature.palace_gate_tiers??2,bays=feature.palace_gate_bays??3,doorBays=Math.min(3,bays);
 const mats=palaceMaterials();mats.plaster=new THREE.MeshStandardMaterial({color:0xe6dcc4,roughness:1});mats.bracket=new THREE.MeshStandardMaterial({color:0xb9432c,roughness:1});
 mats.roof.side=THREE.DoubleSide;
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  // feature.palace_gate_roof: 'hip-gable' (팔작, default), 'hip' (우진각) or 'gable' (맞배, a hip too short to see).
  const frac={hip:1,gable:.04}[feature.palace_gate_roof]??.5;
  const mesh=new THREE.Mesh(hipGableRoof(width,depth,rise,frac===.04?.25:.7,frac),mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);model.add(mesh);parts.push(name);
  box('ridge',x,eave+rise+.12,z,Math.max(.6,width-depth*frac+.6),.25,.4,'stone');
 }
 const base=h*.07,postH=h*(tiers===2?.36:.55),eave=base+postH,gw=w*.8,gd=d*.6,bayW=gw/bays;
 box('gate-platform',0,base/2,0,w,base,d,'stone');
 for(let i=0;i<=bays;i++)for(const sign of [-1,1]){
  const x=-gw/2+i*bayW,z=sign*gd/2;
  box('column-foot',x,base+.15,z,.6,.3,.6,'stone');
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,postH,10),mats.wood);post.name='red-column';post.position.set(x,base+postH/2-h/2,z);model.add(post);parts.push(post.name);
 }
 // Central bays are doors (studded wooden leaves under the middle beam); outer bays are plastered walls.
 for(let i=0;i<bays;i++){
  const x=-gw/2+(i+.5)*bayW,isDoor=Math.abs(i-(bays-1)/2)<=(doorBays-1)/2;
  if(isDoor){box('gate-door',x,base+postH*.46,0,bayW-.6,postH*.9,.3,'door');for(let j=-1;j<=1;j++)box('door-stud',x+j*bayW*.22,base+postH*.5,.2,.09,postH*.7,.08,'trim')}
  else{box('gate-wall',x,base+postH*.45,0,bayW-.5,postH*.88,gd-.3,'plaster');for(const sign of [-1,1])box('lattice-window',x,base+postH*.6,sign*(gd/2-.05),bayW-1,postH*.32,.1,'door')}
 }
 box('lintel',0,eave-.25,0,gw+.6,.45,gd+.6,'wood');box('bracket-band',0,eave+.15,0,gw+1.2,.4,gd+1.2,'bracket');
 if(tiers===2){
  roof('lower-roof',0,0,gw+6,gd+5,eave+.4,h*.13);
  const upper=eave+.4+h*.13+.2,uH=h*.2,uw=gw*.86,ud=gd*.8;
  box('gate-railing',0,upper+.3,0,uw+1.6,.6,ud+1.6,'trim');
  box('upper-house',0,upper+uH/2,0,uw,uH,ud,'plaster');
  for(let i=0;i<bays;i++)for(const sign of [-1,1])box('upper-window',-uw/2+(i+.5)*uw/bays,upper+uH*.5,sign*(ud/2+.05),uw/bays-.7,uH*.6,.1,'door');
  box('upper-beam',0,upper+uH-.25,0,uw+.6,.45,ud+.6,'wood');box('upper-bracket',0,upper+uH+.15,0,uw+1.2,.4,ud+1.2,'bracket');
  roof('gate-roof',0,0,uw+6,ud+5,upper+uH+.4,h*.18);
 }else roof('gate-roof',0,0,gw+6,gd+5,eave+.4,h*.26);
 // Wall stubs stay inside the landmark footprint so they rest on the gate platform.
 for(const side of [-1,1]){box('flanking-wall',side*w*.45,base+h*.1,0,w*.1,h*.2,d*.45,'stone');box('wall-roof',side*w*.45,base+h*.2+.15,0,w*.12,.3,d*.5,'roof')}
 for(let i=0;i<3;i++)box('gate-stair',0,base*(i+1)/6,d/2+.9-i*.3,gw*.6,base*(i+1)/3,.7,'stone');
 const walkSurfaces=model.children.filter(m=>['gate-platform','gate-stair'].includes(m.name));
 const blockingRects=model.children.filter(m=>['gate-door','gate-wall','flanking-wall','column-foot'].includes(m.name)).map(m=>({x:m.position.x,z:m.position.z,hw:m.geometry.parameters.width/2,hd:m.geometry.parameters.depth/2}));
 for(const m of walkSurfaces){m.userData.walkable=true;m.userData.solidSupport=true;model.remove(m)}
 mergeByMaterial(model);
 model.add(...walkSurfaces);
 model.userData={conceptual:true,roofTiers:tiers,bays,roof:feature.palace_gate_roof??'hip-gable',parts,footprint:[w,d],period:feature.temporal,walkSurfaces,blockingRects,accessHeight:base};return model;
}
