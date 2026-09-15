import * as THREE from 'three';

// A horse dealer at the north end of 수표교. The bridge was also called 마전교; in 1744 officials cited that name as
// evidence of the state's cattle and horse market (우마전) there and reported that the market had been lost to army
// garrison encroachment, and the king allowed it to be set up again (영조실록 20년 8월 26일). Whether it reopened is not
// confirmed, so the dealer stands alone with one horse. His dress (패랭이, plain coat) and the small horse are display
// estimates, not a record.
export function createHorseDealer({position,yaw=0}){
 const group=new THREE.Group();group.name='horse-dealer';group.position.copy(position);group.rotation.y=yaw;
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 const m={coat:material(0x8a6f4e),trousers:material(0xd9d2c0),skin:material(0xc5a17e),hat:material(0xb99a62),boots:material(0x2a2522),horse:material(0x6b4a2e),mane:material(0x2a1f18),rope:material(0x9c8660)};
 const add=(parent,geometry,mat,x,y,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh};

 const person=new THREE.Group();person.name='horse-dealer-person';person.userData.role='dealer';group.add(person);
 for(const side of [-1,1]){add(person,new THREE.BoxGeometry(.16,.72,.18),m.trousers,side*.11,.5,0);add(person,new THREE.BoxGeometry(.18,.16,.28),m.boots,side*.11,.08,.04)}
 add(person,new THREE.CylinderGeometry(.2,.32,.95,8),m.coat,0,1.15,0);
 for(const side of [-1,1])add(person,new THREE.BoxGeometry(.12,.6,.14),m.coat,side*.28,1.25,0);
 add(person,new THREE.SphereGeometry(.13,10,8),m.skin,0,1.73,0);
 add(person,new THREE.ConeGeometry(.34,.22,14),m.hat,0,1.9,0);

 // A small horse to the dealer's right, facing the same way.
 const horse=new THREE.Group();horse.name='horse';horse.position.set(1.3,0,.2);group.add(horse);
 for(const [x,z] of [[-.17,.6],[.17,.6],[-.17,-.6],[.17,-.6]])add(horse,new THREE.CylinderGeometry(.06,.05,.85,6),m.horse,x,.43,z);
 add(horse,new THREE.BoxGeometry(.46,.55,1.5),m.horse,0,1.1,0);
 add(horse,new THREE.BoxGeometry(.22,.7,.3),m.horse,0,1.45,.78).rotation.x=.6;
 add(horse,new THREE.BoxGeometry(.06,.5,.35),m.mane,0,1.52,.7).rotation.x=.6;
 const head=new THREE.Group();head.position.set(0,1.72,1.02);horse.add(head);
 add(head,new THREE.BoxGeometry(.2,.22,.5),m.horse,0,0,.14);
 const tail=new THREE.Group();tail.position.set(0,1.25,-.75);horse.add(tail);
 add(tail,new THREE.CylinderGeometry(.04,.08,.6,6),m.mane,0,-.3,0);

 // Lead rope from the dealer's hand to the halter.
 const hand=new THREE.Vector3(.3,1,.1),halter=new THREE.Vector3(1.3,1.72,1.3);
 const rope=add(group,new THREE.CylinderGeometry(.012,.012,1,4),m.rope,0,0,0);
 rope.position.copy(hand).add(halter).multiplyScalar(.5);rope.scale.y=hand.distanceTo(halter);
 rope.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),halter.clone().sub(hand).normalize());

 let facing=null;
 // `ground` gives the ground height in the parent frame; the horse grazes and swishes its tail.
 function update(time,ground){
  group.position.y=ground(group.position.x,group.position.z);
  head.rotation.x=.35+Math.sin(time/1400)*.15;tail.rotation.z=Math.sin(time/600)*.25;
  const target=facing===null?0:facing;person.rotation.y+=(target-person.rotation.y)*.2;
 }
 // While talking the dealer turns toward the viewer; afterwards he faces the road again.
 function face(cameraPosition){const local=group.worldToLocal(cameraPosition.clone());facing=Math.atan2(local.x,local.z)}
 function stopTalk(){facing=null}
 group.userData={update,face,stopTalk,person};
 return group;
}
