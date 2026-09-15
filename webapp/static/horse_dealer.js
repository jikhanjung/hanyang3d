import * as THREE from 'three';

// A small horse (a display shape, not a recorded breed). Legs hang from hip pivots so they can gallop; standing still
// it lowers its head as if grazing and swishes its tail. Used by the horse dealer and as the player's mount.
export function createHorse({coat:coatColor=0x6b4a2e,mane:maneColor=0x2a1f18}={}){
 const group=new THREE.Group();group.name='horse';
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 const coat=material(coatColor),mane=material(maneColor);
 const add=(parent,geometry,mat,x,y,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh};
 const body=new THREE.Group();group.add(body);
 const legs=[[-.17,.6,0],[.17,.6,Math.PI],[-.17,-.6,Math.PI],[.17,-.6,0]].map(([x,z,phase])=>{
  const hip=new THREE.Group();hip.position.set(x,.85,z);group.add(hip);add(hip,new THREE.CylinderGeometry(.06,.05,.85,6),coat,0,-.425,0);return {hip,phase};
 });
 add(body,new THREE.BoxGeometry(.46,.55,1.5),coat,0,1.1,0);
 add(body,new THREE.BoxGeometry(.22,.7,.3),coat,0,1.45,.78).rotation.x=.6;
 add(body,new THREE.BoxGeometry(.06,.5,.35),mane,0,1.52,.7).rotation.x=.6;
 const head=new THREE.Group();head.position.set(0,1.72,1.02);body.add(head);
 add(head,new THREE.BoxGeometry(.2,.22,.5),coat,0,0,.14);
 const tail=new THREE.Group();tail.position.set(0,1.25,-.75);body.add(tail);
 add(tail,new THREE.CylinderGeometry(.04,.08,.6,6),mane,0,-.3,0);
 function update(time,moving){
  if(moving){
   const t=time/95;for(const {hip,phase} of legs)hip.rotation.x=Math.sin(t+phase)*.55;
   body.position.y=Math.abs(Math.sin(t))*.08;head.rotation.x=Math.sin(t)*.08;tail.rotation.x=-.5;tail.rotation.z=0;
  }else{
   for(const {hip} of legs)hip.rotation.x*=.8;body.position.y*=.8;
   head.rotation.x=.35+Math.sin(time/1400)*.15;tail.rotation.x*=.9;tail.rotation.z=Math.sin(time/600)*.25;
  }
 }
 return {group,update};
}

// A horse dealer at the north end of 수표교. The bridge was also called 마전교; in 1744 officials cited that name as
// evidence of the state's cattle and horse market (우마전) there and reported that the market had been lost to army
// garrison encroachment, and the king allowed it to be set up again (영조실록 20년 8월 26일). Whether it reopened is not
// confirmed, so the dealer stands by the road with a few horses tied to a rail. His dress (패랭이, plain coat), the number
// of horses and their coats are display estimates, not a record.
export function createHorseDealer({position,yaw=0}){
 const group=new THREE.Group();group.name='horse-dealer';group.position.copy(position);group.rotation.y=yaw;
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 const m={coat:material(0x8a6f4e),trousers:material(0xd9d2c0),skin:material(0xc5a17e),hat:material(0xb99a62),boots:material(0x2a2522),rope:material(0x9c8660),wood:material(0x6e5539)};
 const add=(parent,geometry,mat,x,y,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh};

 const person=new THREE.Group();person.name='horse-dealer-person';person.userData.role='dealer';group.add(person);
 for(const side of [-1,1]){add(person,new THREE.BoxGeometry(.16,.72,.18),m.trousers,side*.11,.5,0);add(person,new THREE.BoxGeometry(.18,.16,.28),m.boots,side*.11,.08,.04)}
 add(person,new THREE.CylinderGeometry(.2,.32,.95,8),m.coat,0,1.15,0);
 for(const side of [-1,1])add(person,new THREE.BoxGeometry(.12,.6,.14),m.coat,side*.28,1.25,0);
 add(person,new THREE.SphereGeometry(.13,10,8),m.skin,0,1.73,0);
 add(person,new THREE.ConeGeometry(.34,.22,14),m.hat,0,1.9,0);

 // The horse on the dealer's lead, and more horses tied to a rail beside him (bay, chestnut, dark and grey coats).
 const horses=[];
 const lead=createHorse();lead.group.position.set(1.3,0,.2);group.add(lead.group);horses.push({horse:lead,phase:0});
 const tied=[[2.6,-.2,.12,0x8b5a2b],[3.8,.1,-.08,0x3a2a20],[5,-.15,.05,0x9a9187]];
 for(const [x,z,turn,coat] of tied){
  const horse=createHorse({coat});horse.group.position.set(x,0,z);horse.group.rotation.y=turn;group.add(horse.group);horses.push({horse,phase:x*1700});
 }
 // Hitching rail in front of the tied horses: two posts and a bar at chest height.
 for(const x of [2,5.6])add(group,new THREE.CylinderGeometry(.06,.07,1.3,6),m.wood,x,.65,1.9);
 const rail=add(group,new THREE.CylinderGeometry(.04,.04,3.6,6),m.wood,3.8,1.15,1.9);rail.rotation.z=Math.PI/2;

 // Lead rope from the dealer's hand to the halter.
 const hand=new THREE.Vector3(.3,1,.1),halter=new THREE.Vector3(1.3,1.72,1.3);
 const rope=add(group,new THREE.CylinderGeometry(.012,.012,1,4),m.rope,0,0,0);
 rope.position.copy(hand).add(halter).multiplyScalar(.5);rope.scale.y=hand.distanceTo(halter);
 rope.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),halter.clone().sub(hand).normalize());

 let facing=null;
 // `ground` gives the ground height in the parent frame.
 function update(time,ground){
  group.position.y=ground(group.position.x,group.position.z);
  for(const {horse,phase} of horses)horse.update(time+phase,false);
  const target=facing===null?0:facing;person.rotation.y+=(target-person.rotation.y)*.2;
 }
 // While talking the dealer turns toward the viewer; afterwards he faces the road again.
 function face(cameraPosition){const local=group.worldToLocal(cameraPosition.clone());facing=Math.atan2(local.x,local.z)}
 function stopTalk(){facing=null}
 group.userData={update,face,stopTalk,person};
 return group;
}
