import * as THREE from 'three';
import {createWalker} from './pedestrians.js';

// Plain travelling clothes and a simplified naval guard: staging, not attested costumes or dialogue.
export function createLegationGuard({scene,building,groundAt,infrastructure}){
 const group=new THREE.Group();group.name='legation-russian-guard';scene.add(group);
 building.updateWorldMatrix(true,false);
 const height=building.userData.feature.symbol_size_m[1],world=(x,z)=>building.localToWorld(new THREE.Vector3(x,-height/2,z));
 const front=building.userData.feature.symbol_size_m[2]*.275,positions=[];
 for(const z of [front,front+11])for(const x of [-3.5,3.5]){const p=world(x,z);if(z>front)p.y=groundAt(p.x,p.z)+.025;positions.push(p.x,p.y+.03,p.z)}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex([0,2,1,1,2,3]);geo.computeVertexNormals();
 const ramp=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0xaaa18e,roughness:1,side:THREE.DoubleSide}));ramp.name='legation-arrival-approach';scene.add(ramp);
 building.userData.walkSurfaces??=[];building.userData.walkSurfaces.push(ramp);infrastructure.walkableVersion=(infrastructure.walkableVersion??1)+1;
 const guards=[];
 for(const [x,z] of [[-4,12],[4,12],[-12,20],[12,20]]){
  const p=createWalker();p.group.name='russian-naval-guard';p.group.getObjectByName('walker-body').material.color.set('#28384c');
  const cap=new THREE.Mesh(new THREE.CylinderGeometry(.19,.18,.11,12),new THREE.MeshStandardMaterial({color:0x26354a}));cap.position.y=1.76;p.group.add(cap);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(.193,.193,.025,12),new THREE.MeshStandardMaterial({color:0x10151c}));band.position.y=1.73;p.group.add(band);
  const rifle=new THREE.Mesh(new THREE.BoxGeometry(.055,1.2,.065),new THREE.MeshStandardMaterial({color:0x584434}));rifle.position.set(.38,.83,.02);p.group.add(rifle);
  p.group.position.copy(world(x,z));p.group.position.y=groundAt(p.group.position.x,p.group.position.z);p.group.rotation.y=building.rotation.y;group.add(p.group);guards.push(p);
 }
 return {group,guards,world};
}
export function createRoyalArrival({scene,camera,container,chairs,building,fp,say,guard}){
 let time=0,done=false;const group=new THREE.Group();group.name='royal-disembarkation';scene.add(group);
 const {world}=guard,door=world(0,building.userData.feature.symbol_size_m[2]*.275),inside=world(0,building.userData.feature.symbol_size_m[2]*.275-3);
 const actors=chairs.map((c,i)=>{
  const p=createWalker();p.group.name=i?'crown-prince':'gojong';p.group.getObjectByName('walker-body').material.color.set(i?'#9daba3':'#c4baa4');
  const start=c.group.position.clone();start.y+=.85;const out=start.clone().add(new THREE.Vector3(-1.6,-.85,0).applyAxisAngle(new THREE.Vector3(0,1,0),c.group.rotation.y));
  const approach=world(i?-.5:.5,15),points=[start,out,approach,door.clone(),inside.clone()];
  p.group.visible=false;group.add(p.group);return {p,points,delay:i*2};
 });
 const host=createWalker();host.group.name='legation-interpreter';host.group.position.copy(world(-2.5,13));host.group.position.y=fp.groundAt(host.group.position.x,host.group.position.z);host.group.rotation.y=building.rotation.y;group.add(host.group);
 const bubble=document.createElement('div');bubble.id='royal-arrival-bubble';bubble.style.cssText='position:absolute;z-index:1040;transform:translate(-50%,-100%);padding:9px 12px;border-radius:12px;background:#fff9e8;color:#25231d;max-width:240px;text-align:center;pointer-events:none';container.append(bubble);bubble.hidden=true;
 const watch=world(-8,30),target=world(0,13);fp.placeAt(watch.x,watch.z,Math.atan2(-(target.x-watch.x),-(target.z-watch.z)));
 function update(dt){
  time+=dt;
  for(const [i,{p,points,delay}] of actors.entries()){
   const t=time-delay;p.group.visible=t>=1&&t<18;
   if(t<1)continue;
   let a,b,u;if(t<3){a=points[0];b=points[1];u=(t-1)/2}else if(t<12){a=points[1];b=points[2];u=(t-3)/9}else if(t<16){a=points[2];b=points[3];u=(t-12)/4}else{a=points[3];b=points[4];u=Math.min(1,(t-16)/2)}
   p.group.position.copy(a).lerp(b,u);if(t>=3&&t<16)p.group.position.y=fp.groundAt(p.group.position.x,p.group.position.z)??b.y;
   p.group.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);p.update(t*1.5,t<18);
   chairs[i].curtain.scale.z=1-.95*Math.min(1,Math.max(0,time-delay));
   chairs[i].cabin.position.y=-.2*Math.min(1,time);for(const bearer of chairs[i].bearers)bearer.update(0,false);
  }
  bubble.hidden=time<3||time>15;
  bubble.textContent=time<9?say('폐하, 이쪽으로 드시옵소서.','Your Majesty, this way, please.'):say('안으로 모시겠습니다.','We will escort you inside.');
  const p=host.group.position.clone();p.y+=2.3;p.project(camera);bubble.style.left=(p.x*.5+.5)*container.clientWidth+'px';bubble.style.top=(-p.y*.5+.5)*container.clientHeight+'px';if(p.z>1||p.z< -1)bubble.hidden=true;
  // Quiet bow by the interpreter; guards hold their posts.
  host.group.rotation.x=time>3&&time<7?.2:0;
  if(time>=21){done=true;bubble.hidden=true}return done;
 }
 function reset(){bubble.remove();scene.remove(group);for(const c of chairs){c.cabin.position.y=0;c.curtain.scale.z=1}}
 return {update,reset,actors,group,host,get time(){return time},get done(){return done}};
}
