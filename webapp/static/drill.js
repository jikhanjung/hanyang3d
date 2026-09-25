import * as THREE from 'three';
import {figure,materials} from './guards.js';

// Soldiers training on the Hullyeonwon field. The office ran the military examination (with archery) and took part in
// the twice-monthly formation drill (습진); how many men drilled at once is not recorded, so the numbers here are a
// display estimate. A spear block faces the drill officer and his flag, and a line of archers shoots at the targets.
// Bodies are merged by material; only the spears are instanced so they can thrust together.
export function createDrill(feature,w,h,d){
 const model=new THREE.Group();model.name='training-drill';model.userData.cameraIgnore=true;
 const mats=materials(),figures=[],y=-h/2+.2,thick=1.2,office=d*.3;
 const fieldTop=-d/2+office+thick,fieldBottom=d/2-thick;
 // Spear block: 5 ranks of 8 in the middle of the field, facing north toward the officer.
 const ranks=5,files=8,gap=2.2,blockZ=fieldTop+(fieldBottom-fieldTop)*.42,blockX=w*.12;
 const spearmen=[];
 for(let r=0;r<ranks;r++)for(let f=0;f<files;f++){
  const x=blockX+(f-(files-1)/2)*gap,z=blockZ+(r-(ranks-1)/2)*gap;
  figure(figures,mats,x,z,y,{spear:false,yaw:Math.PI});spearmen.push({x,z});
 }
 // Drill officer with a command flag in front of the block.
 const officerZ=blockZ-(ranks/2)*gap-5;
 figure(figures,mats,blockX,officerZ,y,{officer:true});
 // Archers on a firing line near the offices, facing south to the targets at the far end of the field.
 const archers=[];
 for(let i=0;i<4;i++){const x=-w*.16+(i-1.5)*3;figure(figures,mats,x,fieldTop+8,y,{spear:false,archer:true});archers.push(x)}
 // Merge the static figure geometry by material.
 const buckets=new Map(),v=new THREE.Vector3(),tmp=new THREE.Group();
 for(const f of figures)tmp.add(f);tmp.updateMatrixWorld(true);
 tmp.traverse(mesh=>{
  if(!mesh.isMesh)return;const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const out=buckets.get(mesh.material);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);out.push(v.x,v.y,v.z)}
 });
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.name='drill-figures';model.add(m)}
 // Spears, held forward at a slant; they thrust in unison.
 const spearGeo=new THREE.CylinderGeometry(.025,.025,2.6,6);spearGeo.rotateX(Math.PI/2-.35);
 const spears=new THREE.InstancedMesh(spearGeo,mats.shaft,spearmen.length);spears.name='drill-spears';model.add(spears);
 const flag=new THREE.Mesh(new THREE.BoxGeometry(1.4,.9,.05),new THREE.MeshStandardMaterial({color:0xb23a2a,roughness:1}));flag.name='drill-flag';
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,3.4,6),mats.shaft);pole.position.set(blockX+.5,y+1.7,officerZ);model.add(pole);
 flag.position.set(blockX+1.2,y+3,officerZ);model.add(flag);
 const dummy=new THREE.Object3D();let phase=-1;
 function update(time){
  // A thrust every two seconds: spears slide 0.7 m toward the officer and back.
  const t=(time/2000)%1,push=t<.25?Math.sin(t/.25*Math.PI)*.7:0;if(push===phase)return;phase=push;
  spearmen.forEach((s,i)=>{dummy.position.set(s.x+.3,y+1.3,s.z-.5-push);dummy.updateMatrix();spears.setMatrixAt(i,dummy.matrix)});
  spears.instanceMatrix.needsUpdate=true;flag.rotation.y=Math.sin(time/700)*.25;
 }
 update(0);
 model.userData={soldiers:spearmen.length+archers.length+1,spearmen:spearmen.length,archers:archers.length,officer:1,field:[fieldTop,fieldBottom],estimate:true,update};
 return model;
}
