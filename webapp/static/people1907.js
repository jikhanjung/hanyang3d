import * as THREE from 'three';
import {createWalker} from './pedestrians.js';

// Small code-authored silhouettes, not uniform or population reconstructions.
export function createPerson1907({guard=false,merchant=false,storyteller=false,priest=false,praying=false}={}){
 const person=createWalker(),g=person.group;
 const add=(geo,color,x,y,z,name)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:1}));m.position.set(x,y,z);m.name=name;g.add(m);return m};
 const box=(w,h,d,color,x,y,z,name)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z,name);
 if(priest){
  g.traverse(m=>{if(m.isMesh&&m.geometry.type==='BoxGeometry'&&m.geometry.parameters.height>.1)m.material.color.set(0x272627);if(m.isMesh&&m.geometry.type==='SphereGeometry'&&m.geometry.parameters.radius===.07)m.visible=false});
  add(new THREE.CylinderGeometry(.24,.33,1.15,12),0x272627,0,.72,0,'priest-cassock');
  box(.47,.62,.34,0x272627,0,1.12,.015,'priest-jacket');
  box(.15,.055,.035,0xeee9df,0,1.445,.18,'priest-white-collar');
 }else if(guard){
  // Keep the animated limbs and face; cover traditional collar/ties with the tunic.
  g.getObjectByName('walker-body').material.color.set(0x293342);
  box(.47,.77,.34,0x293342,0,1.055,.015,'1907-tunic');
  box(.5,.085,.36,0x302a24,0,.87,.02,'1907-belt');
  for(let i=0;i<4;i++)add(new THREE.SphereGeometry(.021,6,4),0xb3a176,0,1.28-i*.12,.197,'1907-button');
  box(.22,.08,.31,0x713d3b,0,1.44,0,'1907-standing-collar');
  add(new THREE.CylinderGeometry(.19,.18,.16,10),0x293342,0,1.77,0,'1907-service-cap');
  box(.31,.027,.2,0x202324,0,1.7,.15,'1907-cap-visor');
  // No invented rank insignia or ceremonial plumes.
  g.traverse(m=>{if(m.isMesh&&m.geometry.type==='BoxGeometry'&&m.geometry.parameters.height===.7)m.material.color.set(0x343b47)});
  box(.065,1.25,.075,0x594631,.4,.8,0,'1907-rifle-stock');
  box(.035,.7,.035,0x44494a,.4,1.55,0,'1907-rifle-barrel');
 }else{
  g.getObjectByName('walker-body').material.color.set(merchant?0xd4d0bf:0xe5e1d4);
  if(!merchant)add(new THREE.CylinderGeometry(.25,.32,.82,8),0xe5e1d4,0,.77,0,'1907-durumagi');
  add(new THREE.CylinderGeometry(merchant?.2:.35,merchant?.2:.35,.025,12),0x292b2c,0,1.72,0,'1907-hat-brim');
  add(new THREE.CylinderGeometry(.13,.16,merchant?.1:.23,10),0x292b2c,0,merchant?1.77:1.845,0,'1907-hat-crown');
 }
 if(storyteller){
  g.getObjectByName('walker-body').material.color.set(0xaaa58d);
  const coat=g.getObjectByName('1907-durumagi');if(coat)coat.material.color.set(0xaaa58d);
  box(.28,.035,.2,0xd8c6a0,.32,.95,.22,'bookseller-book-pages');
  box(.3,.015,.22,0x4c645f,.32,.975,.22,'bookseller-book-cover');
 }
 if(praying){
  for(const name of ['1907-hat-brim','1907-hat-crown','1907-durumagi'])g.getObjectByName(name).visible=false;
  for(const limb of [...g.children].filter(c=>c.isGroup)){
   if(Math.abs(limb.position.y-1.35)<.001){limb.visible=false;continue}
   if(Math.abs(limb.position.y-1.1)>.001)continue;
   const old=limb.children[0],material=old.material;limb.remove(old);old.geometry.dispose();
   limb.position.y=.75;limb.rotation.set(-Math.PI/2,0,0);
   const thigh=new THREE.Mesh(new THREE.BoxGeometry(.19,.35,.22),material);thigh.position.y=-.175;limb.add(thigh);
   const knee=new THREE.Group();knee.name='prayer-knee';knee.position.y=-.35;knee.rotation.x=Math.PI/2;limb.add(knee);
   const shin=new THREE.Mesh(new THREE.BoxGeometry(.16,.4,.19),material);shin.position.y=-.2;knee.add(shin);
   const shoe=new THREE.Mesh(new THREE.BoxGeometry(.19,.12,.28),new THREE.MeshStandardMaterial({color:0x413a31,roughness:1}));shoe.name='prayer-shoe';shoe.position.set(0,-.4,.04);knee.add(shoe);
  }
  box(.49,.12,.4,0xe5e1d4,0,.77,.2,'prayer-lap');
  const segment=(a,b)=>{const delta=b.clone().sub(a),m=add(new THREE.CylinderGeometry(.085,.095,delta.length(),8),0xe5e1d4,0,0,0,'prayer-sleeve');m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize())};
  for(const side of [-1,1]){
   const shoulder=new THREE.Vector3(side*.285,1.35,0),elbow=new THREE.Vector3(side*.24,1.03,.22),hand=new THREE.Vector3(side*.04,1.2,.34);
   segment(shoulder,elbow);segment(elbow,hand);add(new THREE.SphereGeometry(.06,8,6),0xc5a17e,hand.x,hand.y,hand.z,'prayer-hand');
  }
  const head=new THREE.Group();head.name='prayer-bowed-head';head.position.y=1.48;
  for(const part of [...g.children].filter(c=>c.isMesh&&c.position.y>1.5)){part.position.y-=1.48;head.add(part)}
  head.rotation.x=.24;g.add(head);person.update=()=>{};
  g.userData.pose='seated-prayer';
 }
 g.userData.era=1907;g.userData.costume=praying?'indoor-hanbok-concept':priest?'cassock-concept':guard?'imperial-guard-concept':merchant?'merchant-hanbok':'durumagi-gat';return person;
}

export function createStationaryPeople1907(buildings,data,groundAt){
 const group=new THREE.Group();group.name='stationary-people-1907';const records=[];
 function place(record,role,side,index){
  const owner=buildings.find(b=>b.userData.feature.id===record.building);if(!owner)return;
  const [w,,d]=owner.userData.feature.symbol_size_m;
  const praying=record.pose==='seated_prayer',seat=praying?owner.userData.seats?.find(s=>s.id===record.seat_id):null;
  if(praying&&!seat)return;
  const local=new THREE.Vector3(record.appearance==='caretaker'?3:role==='guard'?side*(owner.userData.feature.landmark_kind==='government_compound'?6:w*.27):0,0,d/2+2.2);
  if(record.local_position_m?.length===2&&record.local_position_m.every(Number.isFinite))local.set(record.local_position_m[0],0,record.local_position_m[1]);
  if(seat)local.set(seat.x,0,seat.z);
  local.applyAxisAngle(new THREE.Vector3(0,1,0),owner.rotation.y).add(new THREE.Vector3(owner.position.x,0,owner.position.z));
  local.y=groundAt(local.x,local.z)+.04;
  if(seat)local.y=owner.userData.groundFloor+seat.y-.75;
  else if(record.indoors&&owner.userData.interior){
   owner.updateMatrixWorld(true);
   const ray=new THREE.Raycaster(new THREE.Vector3(local.x,owner.position.y+100,local.z),new THREE.Vector3(0,-1,0));
   const hits=ray.intersectObjects(owner.userData.walkSurfaces??[],true);
   if(hits.length)local.y=hits[0].point.y+.04;
  }
  const person=createPerson1907({praying,guard:role==='guard',merchant:role==='merchant',priest:record.appearance==='priest',storyteller:role==='storyteller'&&!['caretaker','priest','worshipper'].includes(record.appearance)});person.group.position.copy(local);person.group.rotation.y=owner.rotation.y+(Number.isFinite(record.yaw_offset_deg)?record.yaw_offset_deg*Math.PI/180:0);
  person.group.name=record.id??`${role}-${record.building}-${index}`;person.group.userData.temporal=record;group.add(person.group);
  records.push({...record,role,owner,person,position:person.group.position,key:person.group.name});
 }
 for(const r of data.merchants)place(r,'merchant',0,0);
 for(const r of data.storytellers??[])place(r,'storyteller',0,0);
 for(const r of data.guards)for(let i=0;i<r.count;i++)place(r,'guard',i%2?1:-1,i);
 function update(camera){for(const r of records){r.person.group.visible=r.owner.visible&&camera.position.distanceTo(r.position)<650;r.person.update(0,false)}}
 return {group,records,update};
}
