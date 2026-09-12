import * as THREE from 'three';

// 1726–1836: fifteen shrine chambers. Dimensions are modelling assumptions.
export function createJongmyo(w,h,d){
 const group=new THREE.Group();group.name='jongmyo-jeongjeon';
 const materials=Object.fromEntries(Object.entries({stone:0xb5afa0,wood:0x7c3429,door:0x55291f,roof:0x394044,trim:0x605d52}).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),materials[material]);mesh.name=name;mesh.position.set(x,y-h/2,z);group.add(mesh);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  // A gently bent gable roof, with substantial eaves and a continuous ridge.
  const profile=[[-depth/2,eave+.15],[-depth*.3,eave+.45],[0,eave+rise],[depth*.3,eave+.45],[depth/2,eave+.15]];
  const shape=new THREE.Shape();profile.forEach(([pz,py],i)=>i?shape.lineTo(pz,py):shape.moveTo(pz,py));
  [...profile].reverse().forEach(([pz,py])=>shape.lineTo(pz,py-.24));shape.closePath();
  const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false}),materials.roof);
  mesh.rotation.y=Math.PI/2;mesh.position.set(x-width/2,-h/2,z);mesh.name=name;group.add(mesh);
  box('roof-ridge',x,eave+rise+.12,z,width+.25,.25,.32,'trim');
  // Broad tile courses stay legible without thousands of individual roof tiles.
  for(const sign of [-1,1])box('eave-fascia',x,eave+.03,z+sign*(depth/2-.06),width,.25,.22,'roof');
 }
 const hallWidth=w-14,bay=hallWidth/15,hallZ=-d/2+10,base=1.1,eave=6.7;
 box('woldae',0,.35,0,w,.7,d,'stone');
 box('hall-stylobate',0,.9,hallZ,hallWidth+4,.4,13,'stone');
 box('rear-wall',0,3.7,hallZ-3.9,hallWidth,5.2,.55,'wood');
 box('front-beam',0,6.1,hallZ+4.2,hallWidth+.8,.5,.5,'wood');
 box('rear-beam',0,6.1,hallZ-4,hallWidth+.8,.5,.5,'wood');
 for(let i=0;i<15;i++){
  const x=(i-7)*bay;
  box('shrine-door',x,3.45,hallZ+1.9,bay-.3,4.7,.25,'door');
  box('door-mullion',x,3.45,hallZ+2.06,.1,4.7,.12,'wood');
  for(const side of [-1,1])box('door-handle',x+side*.18,3.3,hallZ+2.15,.07,.2,.06,'trim');
 }
 for(let i=0;i<=15;i++)for(const z of [hallZ+4.2,hallZ-4]){
  const x=-hallWidth/2+i*bay;
  box('column-base',x,base+.12,z,.72,.24,.72,'stone');
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.22,.29,5,8),materials.wood);post.position.set(x,base+2.5-h/2,z);post.name='timber-column';group.add(post);
  box('column-cap',x,6,z,.85,.25,.7,'wood');
 }
 roof('main-gable-roof',0,hallZ,hallWidth+4,14,eave,2.5);
 // Low wings frame the open forecourt, preserving the long horizontal silhouette.
 for(const side of [-1,1]){
  const x=side*(hallWidth/2+2.2),z=hallZ+9;
  box('wing-base',x,.92,z,4.2,.44,12,'stone');
  box('wing-wall',x,2.9,z,3.2,3.5,10,'wood');
  const wing=new THREE.Group();
  const before=group.children.length;roof('wing-roof',0,0,12,5,4.8,1.4);
  for(const child of [...group.children].slice(before)){group.remove(child);wing.add(child)}
  wing.rotation.y=Math.PI/2;wing.position.set(x,0,z);group.add(wing);
 }
 for(const x of [-hallWidth*.4,0,hallWidth*.4])for(let step=0;step<4;step++)
  box('woldae-step',x,.1+step*.09,d/2+.6-step*.4,3,.2+step*.18,.8,'stone');
 group.userData={chambers:15,period:'1726–1836',conceptual:true};return group;
}
