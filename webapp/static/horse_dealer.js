import * as THREE from 'three';

// A small horse (a display shape, not a recorded breed). Legs hang from hip pivots so they can gallop; standing still
// it lowers its head as if grazing and swishes its tail. Used by the horse dealer and as the player's mount.
export function createHorse({coat:coatColor=0x6b4a2e,mane:maneColor=0x2a1f18}={}){
 const group=new THREE.Group();group.name='horse';
 const material=color=>new THREE.MeshStandardMaterial({color,roughness:1});
 const coat=material(coatColor),mane=material(maneColor);
 const add=(parent,geometry,mat,x,y,z)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh};
 const body=new THREE.Group();body.name='horse-body';group.add(body);
 // Four separate beats: hind pair, then fore pair, then a gathered suspension.
 // The small left/right delay gives a lead leg instead of a diagonal trot.
 const legs=[[-.17,.6,.36],[.17,.6,.46],[-.17,-.6,0],[.17,-.6,.09]].map(([x,z,phase])=>{
  const hip=new THREE.Group(),knee=new THREE.Group();hip.name=`horse-${z>0?'front':'hind'}-${x<0?'left':'right'}`;knee.name='horse-knee';hip.position.set(x,.85,z);body.add(hip);
  add(hip,new THREE.CylinderGeometry(.06,.05,.425,6),coat,0,-.2125,0);
  knee.position.y=-.425;hip.add(knee);add(knee,new THREE.CylinderGeometry(.05,.045,.425,6),coat,0,-.2125,0);return {hip,knee,phase};
 });
 add(body,new THREE.BoxGeometry(.46,.55,1.5),coat,0,1.1,0);
 add(body,new THREE.BoxGeometry(.22,.7,.3),coat,0,1.45,.78).rotation.x=.6;
 add(body,new THREE.BoxGeometry(.06,.5,.35),mane,0,1.52,.7).rotation.x=.6;
 const head=new THREE.Group();head.position.set(0,1.72,1.02);body.add(head);
 add(head,new THREE.BoxGeometry(.2,.22,.5),coat,0,0,.14);
 // Forward is +Z; a hanging tail needs positive X rotation to trail toward -Z.
 const tail=new THREE.Group();tail.name='horse-tail';tail.position.set(0,1.25,-.79);body.add(tail);
 add(tail,new THREE.CylinderGeometry(.04,.08,.6,6),mane,0,-.3,0);
 const hoof=new THREE.Vector3(),pitchAxis=new THREE.Vector3(1,0,0);
 function strideLeg(leg,cycle,galloping){
  const {hip,knee}=leg;
  const phase=galloping?leg.phase:((hip.position.x<0)===(hip.position.z>0)?0:.5);
  const p=(cycle-phase+1)%1,stance=galloping?.24:.42;
  let reach,lift;
  if(p<stance){reach=.24-.48*p/stance;lift=0}
  else{
   const swing=(p-stance)/(1-stance);
   reach=-.24+.48*(swing*swing*(3-2*swing));
   lift=Math.sin(Math.PI*swing)*(galloping?(hip.position.z>0?.42:.34):.18);
  }
  // Solve two leg segments to a hoof path. During stance the hoof stays on the
  // ground while the body rises/pitches; during recovery the knee/hock folds.
  hoof.set(hip.position.x,lift-body.position.y,hip.position.z+reach).applyAxisAngle(pitchAxis,-body.rotation.x).sub(hip.position);
  const length=.425,distance=Math.hypot(hoof.y,hoof.z);
  const bend=Math.acos(THREE.MathUtils.clamp((distance*distance-2*length*length)/(2*length*length),-1,1))*(hip.position.z>0?1:-1);
  knee.rotation.x=bend;
  hip.rotation.x=Math.atan2(-hoof.z,-hoof.y)-Math.atan2(Math.sin(bend),1+Math.cos(bend));
 }
 function update(time,moving,airborne=false,galloping=false){
  if(airborne){
   // Hold a gathered jump pose; the running cycle resumes only after landing.
   for(const {hip,knee} of legs){hip.rotation.x=hip.position.z>0?-1.1:.65;knee.rotation.x=hip.position.z>0?1.5:-1.1}
   body.position.y=0;body.rotation.x=0;head.rotation.x=-.12;tail.rotation.x=1;tail.rotation.z=0;
  }else if(moving){
   const period=galloping?560:720,cycle=((time%period)+period)%period/period,t=cycle*Math.PI*2;
   body.position.y=galloping?-.09+(cycle>.70?Math.sin((cycle-.70)/.30*Math.PI)*.16:Math.sin(cycle/.70*Math.PI)*.02):-.09+Math.abs(Math.sin(t))*.025;
   body.rotation.x=galloping?Math.sin(t-.6)*.055:0;
   for(const leg of legs)strideLeg(leg,cycle,galloping);
   head.rotation.x=-.04+Math.sin(t+.5)*(galloping?.10:.035);tail.rotation.x=.85+Math.sin(t)*.08;tail.rotation.z=Math.sin(t)*.12;
  }else{
   for(const {hip,knee} of legs){hip.rotation.x*=.8;knee.rotation.x*=.8}body.position.y*=.8;body.rotation.x*=.8;
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
export function createHorseDealer({position,yaw=0,personModel=null}){
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
 if(personModel){
  for(const mesh of [...person.children]){person.remove(mesh);mesh.geometry.dispose()}
  person.add(personModel);
 }

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
