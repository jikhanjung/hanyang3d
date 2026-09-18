import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

// Cheap, type-aware silhouettes. Metadata and pick targets stay on the original model.
const mats={stone:new THREE.MeshStandardMaterial({color:0xbdb6a5}),wall:new THREE.MeshStandardMaterial({color:0xc9bb9f}),roof:new THREE.MeshStandardMaterial({color:0x3e484c}),brick:new THREE.MeshStandardMaterial({color:0x965a44}),water:new THREE.MeshStandardMaterial({color:0x688d86})};
export function prepareLandmarkLod(model){
 const f=model.userData.feature,[w,h,d]=f.symbol_size_m,proxy=new THREE.Group(),detail=new THREE.Group();detail.name='landmark-detail';proxy.name='landmark-proxy';
 for(const child of [...model.children])if(child.name!=='terrain-foundation'){model.remove(child);detail.add(child)}
 const add=(g,x,y,z,mat)=>{const m=new THREE.Mesh(g,mats[mat]);m.position.set(x,y-h/2,z);proxy.add(m);return m};
 const box=(x,y,z,a,b,c,mat='wall')=>add(new THREE.BoxGeometry(a,b,c),x,y,z,mat);
 const roof=(x,y,z,a,b,rise=3)=>add(hipGableRoof(a,b,rise,.3,.55),x,y,z,'roof');
 const kind=f.landmark_kind;
 if(kind==='tram_depot'){
  box(0,.08,0,w,.16,d,'stone');
  for(let i=0;i<=5;i++)for(const side of [-1,1])box(-w*.15+(i/5-.5)*w*.64,2.7,-d*.12+side*d*.22,.5,5,.5);
  roof(-w*.15,5.3,-d*.12,w*.64+2,d*.48+2,2.3);box(w*.34,3.2,-d*.1,w*.25,6.4,d*.56,'brick');roof(w*.34,6.4,-d*.1,w*.28,d*.61,2.4);add(new THREE.CylinderGeometry(.8,1.35,20.5,8),w*.43,11.4,-d*.38,'brick');
 }else if(kind==='early_theatre'){
  box(0,3.8,0,w*.86,7.6,d*.84);roof(0,7.5,0,w*.98,d*.96,3.2);
 }else if(kind==='sontag_hotel'){
  box(0,5,-d*.05,w*.9,10,d*.73,'stone');roof(0,10,0,w,d*.88,2.8);box(0,5,d*.4,w*.24,.3,d*.17,'stone');
 }else if(kind==='octagonal_bandstand'){
  add(new THREE.CylinderGeometry(w*.39+.6,w*.39+.9,.9,8),0,.45,0,'stone');
  for(let i=0;i<8;i++){const a=i*Math.PI/4;box(Math.sin(a)*w*.32,3,Math.cos(a)*w*.32,.45,4.5,.45)}
  add(new THREE.CylinderGeometry(.45,w*.465,2.3,8),0,6.4,0,'roof');
 }else if(kind==='commemorative_pavilion'){
  box(0,.45,0,w*.86,.9,d*.72,'stone');box(0,2.8,0,1.5,3,.65,'stone');
  for(const x of [-1,1])for(const z of [-1,1])box(x*w*.325,3.2,z*d*.25,.5,4.7,.5);
  roof(0,5.75,0,w*.94,d*.8,2.1);
 }else if(kind==='jeonggwanheon'){
  box(0,.35,0,w,.7,d,'stone');box(0,2.6,-d*.1,w*.63,3.8,d*.56,'stone');
  for(let i=0;i<=7;i++)box((i/7-.5)*w*.88,2.95,d*.4,.4,4.5,.4);
  roof(0,5.3,0,w,d,2.5);
 }else if(kind==='dondeokjeon'){
  box(0,.35,0,w,.7,d,'stone');box(0,5.3,-d*.06,w*.84,9.6,d*.7,'brick');roof(0,10.4,-d*.06,w*.94,d*.86,3.4);
  for(let i=0;i<=7;i++)box((i/7-.5)*w*.86,5.3,d*.43,.5,9.2,.5,'stone');
 }else if(kind==='bukmyo'){
  box(0,.95,-d*.2,w*.4+3,1.9,d*.32+3,'stone');box(0,4.3,-d*.2,w*.4,4.8,d*.32);const r=roof(0,6.9,-d*.2,d*.32+3,w*.4+3,3.2);r.rotation.y=Math.PI/2;
  for(const side of [-1,1]){box(side*w*.36,1.9,d*.1,w*.16,3.8,d*.55);roof(side*w*.36,3.8,d*.1,w*.16+2,d*.55+2,2.5)}
 }else if(kind==='bookshop'){
  box(0,2.1,0,w*.95,4.2,d*.9);roof(0,4.1,0,w+1,d+1.5,1.8);
 }else if(kind==='shop_row'){
  const count=f.shop_units??10,bay=w/count;
  for(let i=0;i<count;i++){const x=-w/2+(i+.5)*bay,two=(i+f.variant)%7===3,top=two?6.7:3.3+(i%3)*.25,depth=d*(.82+(i%3)*.06);box(x,top/2,0,bay-.25,top,depth,two?'brick':'wall');roof(x,top,0,bay+.35,depth+1.2,two?1.4:1.1)}
 }else if(kind==='government_compound'){
  const wing=(w-8)/2;for(const sign of [-1,1]){const x=sign*(4+wing/2);box(x,1.8,d*.42,wing,3.6,d*.12);roof(x,3.6,d*.42,wing+.7,d*.12+1.4,1.2);box(sign*w*.36,1.7,-d*.02,w*.13,3.4,d*.42);roof(sign*w*.36,3.4,-d*.02,w*.13+2,d*.42+2,2.5)}
  roof(0,4.4,d*.42,9.5,d*.15+1.6,1.6);box(0,2.75,-d*.24,w*.46,5.5,d*.23);roof(0,5.5,-d*.24,w*.46+2,d*.23+2,2.5);
 }else if(kind==='electric_office'){
  box(0,4.5,0,w*.92,9,d*.88,'brick');roof(0,9.3,0,w,d,1.7);box(w*.25,11.7,0,4.5,4.8,4.5);add(new THREE.ConeGeometry(3,1.7,8),w*.25,14.7,0,'roof');
 }else if(kind==='sajik'){
  for(const x of [-w*.21,w*.21])box(x,.8,0,w*.27,1.6,d*.38,'stone');
 }else if(kind==='pagoda'){
  box(0,1.5,0,7,3,7,'stone');for(let i=0;i<7;i++)box(0,3.5+i*.7,0,5-i*.35,.65,5-i*.35,'stone');for(let i=0;i<3;i++)box(-3+i*3,.5,d*.37,2.5,1,2.5,'stone');
 }else if(kind==='munmyo'){
  for(const z of [d*.2,-d*.3]){box(0,3,z,w*.4,6,d*.18);roof(0,6,z,w*.44,d*.22)}
  for(const x of [-w*.35,w*.35]){box(x,1.8,0,w*.12,3.6,d*.75);roof(x,3.6,0,w*.15,d*.8,1)}
 }else if(kind==='city_gate'){
  // Open passage in the proxy too; no solid box across the gate.
  const gap=w*.25,base=h*(f.gate_tiers===0?.9:.43);box(-(w+gap)/4,base/2,0,(w-gap)/2,base,d,'stone');box((w+gap)/4,base/2,0,(w-gap)/2,base,d,'stone');box(0,base*.9,0,gap,base*.2,d,'stone');if(f.gate_tiers!==0){box(0,base+2,0,w*.65,4,d*.65);roof(0,base+4,0,w*.8,d*.85,h*.2);}
 }else if(kind==='hex_pavilion'){
  box(0,.2,0,w,.4,d,'water');add(new THREE.CylinderGeometry(8,9,1,12),0,.6,0,'stone');for(let i=0;i<2;i++){add(new THREE.CylinderGeometry(4.5,4.5,3.5,6),0,3+i*4.5,0,'wall');add(new THREE.CylinderGeometry(1,7-i*.6,2.4,6),0,5.5+i*4.5,0,'roof')}
 }else if(kind==='altar'||kind==='hwanggungu'){
  add(new THREE.CylinderGeometry(w*.45,w*.5,1,kind==='altar'?24:8),0,.5,0,'stone');
  if(kind==='hwanggungu')for(let i=0;i<3;i++){add(new THREE.CylinderGeometry(7-i,7-i,3.5,8),0,3+i*5,0,'wall');add(new THREE.CylinderGeometry(2,10-i,3,8),0,6+i*5,0,'roof')}
 }else if(kind==='cathedral'||kind==='church'){
  const e=kind==='cathedral'?17:8;box(0,e/2,0,w*.46,e,d*.85,'brick');roof(0,e,0,w*.5,d*.9,5);box(0,e*.4,-d*.12,w,e*.8,d*.22,'brick');roof(0,e*.8,-d*.12,w,d*.26,3);box(0,h*.32,d*.36,w*.27,h*.64,w*.27,'brick');add(new THREE.ConeGeometry(w*.2,h*.26,4),0,h*.77,d*.36,'roof');
 }else if(kind==='gyeonghoeru'){
  box(0,.15,0,w,.3,d,'water');const [x,z]=model.userData.anchorOffset;box(x,3,z,45,6,33,'stone');box(x,9,z,45,6,33);roof(x,12,z,52,40,5);
 }else if(kind==='shrine'){
  box(0,.5,0,w,1,d,'stone');const z=model.userData.anchorOffset[1];box(0,4,z,w-10,6,9);roof(0,7,z,w-8,14,2.5);
 }else if(f.display_model==='throne_hall'){
  box(0,.3,0,w,.6,d,'stone');const [hw,hd]=f.throne_hall.hall_m,z=model.userData.hallCenterZ??0;box(0,h*.28,z,hw,h*.5,hd);roof(0,h*.54,z,hw+5,hd+5,h*.2);if(f.throne_hall.roof_tiers===2)roof(0,h*.77,z,hw*.8,hd*.8,h*.18);
 }else{box(0,h*.3,0,w*.75,h*.6,d*.65);roof(0,h*.6,0,w*.85,d*.8,h*.25)}
 // Merge the proxy by material to keep far buildings to a few draw calls.
 proxy.updateMatrixWorld(true);const buckets=new Map(),v=new THREE.Vector3();
 proxy.traverse(m=>{if(!m.isMesh)return;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=g.attributes.position;if(!buckets.has(m.material))buckets.set(m.material,[]);const data=buckets.get(m.material);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);data.push(v.x,v.y,v.z)}if(g!==m.geometry)g.dispose();m.geometry.dispose()});
 proxy.clear();for(const [material,data] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();proxy.add(new THREE.Mesh(g,material))}
 model.add(detail,proxy);proxy.visible=false;
 const lod={detail,proxy,near:true,threshold:f.lod_distance_m??2400};model.userData.lod=lod;return lod;
}
export function updateLandmarkLod(model,camera){
 const lod=model.userData.lod;if(!lod)return;const distance=camera.position.distanceTo(model.position),near=distance<lod.threshold*(lod.near?1.1:.9);if(near!==lod.near){lod.near=near;lod.detail.visible=near;lod.proxy.visible=!near}
}
