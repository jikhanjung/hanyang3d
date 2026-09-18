import * as THREE from 'three';

// A single schematic early open car. Dimensions/colour are not surveyed evidence.
export function createTrams1907(data,surface){
 const group=new THREE.Group();group.name='jongno-tram';
 const points=data.route.pixels.map(p=>surface(...p)),lengths=[0];
 for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
 const length=lengths.at(-1);
 function sample(distance){
  const d=Math.max(0,Math.min(length,distance));let i=1;while(i<lengths.length-1&&lengths[i]<d)i++;
  const p=points[i-1].clone().lerp(points[i],(d-lengths[i-1])/(lengths[i]-lengths[i-1]));p.y=surface.ground(p.x,p.z);return p;
 }
 const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.85});
 const wood=mat(0x76513a),cream=mat(0xd9caae),metal=mat(0x343a38),glass=mat(0x526b71);
 const car=new THREE.Group(),detail=new THREE.Group();group.add(car);car.add(detail);
 function box(parent,w,h,d,x,y,z,m){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);parent.add(o);return o}
 box(car,2.1,.23,8,0,.78,0,wood);box(car,2.35,.2,8.3,0,3.12,0,cream);
 box(car,2,.85,3,0,1.32,0,wood);box(car,1.95,1.05,2.95,0,2.23,0,glass);
 for(const x of [-1,1])for(const z of [-3.65,-2.75,-1.5,0,1.5,2.75,3.65])box(detail,.09,2.15,.09,x,1.96,z,wood);
 for(const z of [-2.7,2.7]){box(detail,1.85,.12,.48,0,1.28,z,wood);box(detail,1.85,.5,.08,0,1.58,z,wood)}
 for(const z of [-3.8,3.8]){box(detail,2,.08,.08,0,1.75,z,metal);box(detail,.35,.75,.25,0,1.23,z,metal);box(detail,2.3,.12,.6,0,.4,z,metal)}
 const wheels=[];for(const x of [-.56,.56])for(const z of [-1.7,1.7]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.14,12),metal);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.39,z);detail.add(wheel);wheels.push(wheel)}
 // Occupants share the car transform, including slopes and reversals. Clothing is schematic.
 const occupants=new THREE.Group();occupants.name='tram-occupants';detail.add(occupants);
 const skin=mat(0xc6a383),dark=mat(0x303437),ivory=mat(0xe3dfd0),blue=mat(0x45596a),rose=mat(0x94776e);
 const headGeometry=new THREE.SphereGeometry(.14,8,6);
 function person(name,{seated=false,female=false,driver=false,tone=ivory}={}){
  const g=new THREE.Group();g.name=name;occupants.add(g);
  const hip=seated?.6:.85,shoulder=hip+.43;
  box(g,.42,.54,.27,0,hip+.25,0,tone);
  const head=new THREE.Mesh(headGeometry,skin);head.position.set(0,hip+.73,0);g.add(head);
  box(g,.055,.065,.045,0,hip+.71,.14,skin);
  if(female){
   const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.21,.34,.5,8),rose);skirt.position.set(0,hip-.18,.15);g.add(skirt);
   const hair=new THREE.Mesh(new THREE.SphereGeometry(.148,8,6,0,Math.PI*2,0,1.35),dark);hair.position.copy(head.position);g.add(hair);
   const bun=new THREE.Mesh(new THREE.SphereGeometry(.08,6,4),dark);bun.position.set(0,hip+.72,-.14);g.add(bun);
  }else{
   const brim=new THREE.Mesh(new THREE.CylinderGeometry(driver?.2:.29,driver?.2:.29,.025,10),dark);brim.position.set(0,hip+.87,.02);g.add(brim);
   const crown=new THREE.Mesh(new THREE.CylinderGeometry(.13,.16,driver?.12:.19,10),driver?blue:dark);crown.position.set(0,hip+.95,0);g.add(crown);
  }
  for(const side of [-1,1]){
   if(seated){box(g,.17,.17,.45,side*.12,hip-.07,.15,ivory);box(g,.16,.42,.17,side*.12,hip-.32,.34,ivory);box(g,.18,.09,.28,side*.12,hip-.56,.4,dark)}
   else{box(g,.17,.7,.2,side*.12,.45,0,blue);box(g,.2,.12,.32,side*.12,.06,.07,dark)}
   const arm=box(g,.14,.4,.15,side*.28,shoulder-.16,driver?.12:.06,tone);arm.rotation.x=driver?-.9:seated?-.5:0;
   box(g,.12,.12,.12,side*.28,shoulder-.3,driver?.29:seated?.17:.06,skin);
  }
  return g;
 }
 const driver=person('tram-driver',{driver:true,tone:blue});driver.position.y=.895;
 const passengers=[];
 for(const end of [-1,1])for(const side of [-1,1]){
  const passenger=person(`tram-passenger-${passengers.length+1}`,{seated:true,female:side===1,tone:side===1?ivory:cream});
  passenger.position.set(side*.48,.895,end*2.48);passenger.rotation.y=end===1?Math.PI:0;passengers.push(passenger);
 }
 const pole=new THREE.Line(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,3.22,0,0,5.4,-2.5],3)),new THREE.LineBasicMaterial({color:0x303632}));car.add(pole);
 const railVertices=[],wireVertices=[],supports=[];
 const half=data.model.gauge_m/2;
 for(let d=0;d<length;d+=2){
  const a=sample(d),b=sample(Math.min(length,d+2)),t=b.clone().sub(a);t.y=0;t.normalize();const n=new THREE.Vector3(t.z,0,-t.x);
  for(const side of [-1,1]){const corners=[];for(const p of [a,b])for(const width of [-.04,.04]){const v=p.clone().addScaledVector(n,side*half+width);v.y=surface.ground(v.x,v.z)+.055;corners.push(v)}for(const idx of [0,1,2,1,3,2])railVertices.push(...corners[idx].toArray())}
 }
 for(let d=0;d<=length;d+=35){const p=sample(d),ahead=sample(Math.min(length,d+1)),behind=sample(Math.max(0,d-1)),t=ahead.sub(behind).normalize(),side=new THREE.Vector3(t.z,0,-t.x);const base=p.clone().addScaledVector(side,3.7);base.y=surface.ground(base.x,base.z);supports.push({base,top:p.clone().add(new THREE.Vector3(0,5.4,0))})}
 supports.push({base:null,top:sample(length).add(new THREE.Vector3(0,5.4,0))});
 const overhead=new THREE.Group();group.add(overhead);
 const matrices=[],dummy=new THREE.Object3D();
 for(let i=0;i<supports.length;i++){const {base,top}=supports[i];if(base){const h=top.y-base.y+.3;dummy.position.copy(base).add(new THREE.Vector3(0,h/2,0));dummy.scale.set(.13,h,.13);dummy.updateMatrix();matrices.push(dummy.matrix.clone());wireVertices.push(base.x,top.y,base.z,...top.toArray())}if(i)wireVertices.push(...supports[i-1].top.toArray(),...top.toArray())}
 const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),wood,matrices.length);matrices.forEach((m,i)=>posts.setMatrixAt(i,m));overhead.add(posts);
 const wires=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(wireVertices,3)),new THREE.LineBasicMaterial({color:0x454a43}));overhead.add(wires);
 const rails=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(railVertices,3)),new THREE.MeshBasicMaterial({color:0x424944,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-5,polygonOffsetUnits:-5}));rails.renderOrder=2;group.add(rails);
 const state={distance:length*.34,direction:1,pause:0,blocked:false};
 function pose(){
  const a=sample(state.distance-1.7),b=sample(state.distance+1.7),forward=b.clone().sub(a).normalize();
  car.position.copy(sample(state.distance));car.position.y=(a.y+b.y)/2+.055;
  // The body retains its orientation when the direction reverses.
  const right=new THREE.Vector3(forward.z,0,-forward.x).normalize(),up=new THREE.Vector3().crossVectors(forward,right);
  car.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward));
  driver.position.z=state.direction*3.43;driver.rotation.y=state.direction===1?0:Math.PI;
  pole.geometry.attributes.position.setZ(1,-state.direction*2.5);pole.geometry.attributes.position.needsUpdate=true;pole.geometry.computeBoundingSphere();
 }
 pose();
 function frame(){const a=sample(state.distance-1),b=sample(state.distance+1),t=b.sub(a);t.y=0;t.normalize();return {t,n:new THREE.Vector3(t.z,0,-t.x)}}
 function avoid(position,old,dt,blocked=()=>false){
  const {t,n}=frame(),dx=position.x-car.position.x,dz=position.z-car.position.z,along=(dx*t.x+dz*t.z)*state.direction,side=dx*n.x+dz*n.z;
  let target={x:0,z:0};
  if(group.visible&&along>-10&&along<22&&Math.abs(side)<2.5){
   let sign=Math.sign(side)||Math.sign(old.x*n.x+old.z*n.z)||1;
   for(const candidate of [sign,-sign]){const shift=candidate*2.5-side,x=n.x*shift,z=n.z*shift;if(!blocked(position.x+x,position.z+z,.4)){target={x,z};break}}
  }
  const dxo=target.x-old.x,dzo=target.z-old.z,dist=Math.hypot(dxo,dzo),ratio=Math.min(1,Math.max(0,dt)*1.8/(dist||1));
  const result={x:old.x+dxo*ratio,z:old.z+dzo*ratio};
  return blocked(position.x+result.x,position.z+result.z,.4)?old:result;
 }
 function update(dt,camera,obstacles=[]){
  if(!group.visible)return false;
  dt=Math.max(0,Math.min(.1,dt));
  const {t,n}=frame();state.blocked=obstacles.some(p=>{const dx=p.x-car.position.x,dz=p.z-car.position.z,along=(dx*t.x+dz*t.z)*state.direction;return along>-4.8&&along<7&&Math.abs(dx*n.x+dz*n.z)<1.65});
  if(state.pause>0)state.pause=Math.max(0,state.pause-dt);
  else if(!state.blocked){state.distance+=state.direction*data.simulation.speed_mps*dt;if(state.distance>=length-5||state.distance<=5){state.distance=Math.max(5,Math.min(length-5,state.distance));state.direction*=-1;state.pause=data.simulation.end_pause_seconds}pose()}
  const distance=camera.position.distanceTo(car.position);detail.visible=distance<450;pole.visible=distance<1000;overhead.visible=camera.position.y<700;car.visible=distance<6500;
  return car.visible;
 }
 return {group,car,occupants,driver,passengers,rails,overhead,state,length,sample,update,avoid,frame,data};
}
