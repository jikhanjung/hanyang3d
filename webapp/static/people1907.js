import * as THREE from 'three';
import {createWalker} from './pedestrians.js';

// Small code-authored silhouettes, not uniform or population reconstructions.
export function createPerson1907({guard=false,merchant=false,storyteller=false}={}){
 const person=createWalker(),g=person.group;
 const add=(geo,color,x,y,z,name)=>{const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:1}));m.position.set(x,y,z);m.name=name;g.add(m);return m};
 const box=(w,h,d,color,x,y,z,name)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z,name);
 if(guard){
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
 g.userData.era=1907;g.userData.costume=guard?'imperial-guard-concept':merchant?'merchant-hanbok':'durumagi-gat';return person;
}

export function createStationaryPeople1907(buildings,data,groundAt){
 const group=new THREE.Group();group.name='stationary-people-1907';const records=[];
 function place(record,role,side,index){
  const owner=buildings.find(b=>b.userData.feature.id===record.building);if(!owner)return;
  const [w,,d]=owner.userData.feature.symbol_size_m;
  const local=new THREE.Vector3(record.appearance==='caretaker'?3:role==='guard'?side*(owner.userData.feature.landmark_kind==='government_compound'?6:w*.27):0,0,d/2+2.2);
  local.applyAxisAngle(new THREE.Vector3(0,1,0),owner.rotation.y).add(new THREE.Vector3(owner.position.x,0,owner.position.z));
  local.y=groundAt(local.x,local.z)+.04;
  const person=createPerson1907({guard:role==='guard',merchant:role==='merchant',storyteller:role==='storyteller'&&record.appearance!=='caretaker'});person.group.position.copy(local);person.group.rotation.y=owner.rotation.y;
  person.group.name=`${role}-${record.building}-${index}`;person.group.userData.temporal=record;group.add(person.group);
  records.push({...record,role,owner,person,position:person.group.position,key:person.group.name});
 }
 for(const r of data.merchants)place(r,'merchant',0,0);
 for(const r of data.storytellers??[])place(r,'storyteller',0,0);
 for(const r of data.guards)for(let i=0;i<r.count;i++)place(r,'guard',i%2?1:-1,i);
 function update(camera){for(const r of records){r.person.group.visible=r.owner.visible&&camera.position.distanceTo(r.position)<650;r.person.update(0,false)}}
 return {group,records,update};
}
