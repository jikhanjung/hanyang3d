import * as THREE from 'three';
import {createWalker} from './pedestrians.js';

const axis=new THREE.Vector3(0,1,0);
function tackle(){
 const group=new THREE.Group(),rod=new THREE.Mesh(new THREE.CylinderGeometry(.018,.035,1,8),new THREE.MeshStandardMaterial({color:0xb39b60,roughness:1})),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xe8dfc5})),float=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshStandardMaterial({color:0xc94728}));
 group.add(rod,line,float);group.name='fishing-tackle';
 return {group,update(hand,water,phase=1){const tip=hand.clone().lerp(water,.62);tip.y=hand.y+1.3+Math.sin(Math.min(1,phase)*Math.PI)*2;const delta=tip.clone().sub(hand);rod.position.copy(hand).add(tip).multiplyScalar(.5);rod.scale.y=delta.length();rod.quaternion.setFromUnitVectors(axis,delta.normalize());const p=line.geometry.attributes.position;p.setXYZ(0,tip.x,tip.y,tip.z);p.setXYZ(1,water.x,water.y,water.z);p.needsUpdate=true;line.geometry.computeBoundingSphere();float.position.copy(water)}};
}
export function createFishing({scene,camera,firstPerson,shop,dialogue,bridge,groundAt,collision,data,era,visible=()=>true}){
 if(!bridge)return null;
 const config=data.fishing,person=createWalker(),group=person.group;group.name='stream-fisherman';
 const size=bridge.userData.feature.symbol_size_m,length=size?.[2]??bridge.children[0].geometry.parameters.depth,width=size?.[0]??bridge.userData.feature.width_m;
 const local=(x,z)=>new THREE.Vector3(x,0,z).applyAxisAngle(axis,bridge.rotation.y).add(new THREE.Vector3(bridge.position.x,0,bridge.position.z));
 const north=local(0,-length/2).z<local(0,length/2).z?-1:1;
 let shore=null;
 for(const offset of [width/2+6,width/2+10,-width/2-6])for(const back of [2,4,7]){const p=local(offset,north*(length/2+back)),y=groundAt(p.x,p.z);if(y!==null&&!collision()?.hit(p.x,p.z,.4)&&!shore){p.y=y+.03;shore=p}}
 if(!shore)return null;
 const water=local(width/2+6,0);water.y=groundAt(water.x,water.z)+.5;
 group.position.copy(shore);group.rotation.y=Math.atan2(water.x-shore.x,water.z-shore.z);
 group.userData.temporal={valid_from:era,valid_to:era+1,position_status:'fictional_fisherman_near_bridge'};
 const hat=new THREE.Mesh(new THREE.ConeGeometry(.43,.2,12),new THREE.MeshStandardMaterial({color:0xa58a59}));hat.position.y=1.76;group.add(hat);
 const arms=person.group.children.filter(c=>c.isGroup&&Math.abs(c.position.y-1.35)<.001);arms.forEach(a=>a.rotation.x=-1.05);
 const npcRod=tackle(),playerRod=tackle();scene.add(group,npcRod.group,playerRod.group);playerRod.group.visible=false;
 const status=document.createElement('div');status.id='fishing-status';status.setAttribute('role','status');status.hidden=true;document.getElementById('scene').append(status);
 let active=null,pending=false,settling=false,generation=0,started=0,origin=null,endAt=0,resultUntil=0;
 const say=text=>{status.textContent=text;status.hidden=false};
 const post=async body=>{const token=document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)??'',r=await fetch('/api/fishing',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify(body)}),answer=await r.json();if(!r.ok)throw Error(answer.error??'낚시 요청을 마치지 못했소.');return answer};
 function stopPose(){playerRod.group.visible=false;firstPerson.walker?.update(0,false)}
 function cancel(){if(!active&&!pending)return;generation++;const cast=active,wasPending=pending;active=null;pending=false;stopPose();settling=true;if(cast)post({action:'cancel',token:cast.token}).catch(()=>{}).finally(()=>{settling=false});else if(!wasPending)settling=false;say('낚싯줄을 거두었소.');resultUntil=performance.now()+3000}
 function use(){
  if(settling)return '이전 낚싯줄을 거두는 중이오.';
  if(active||pending){cancel();return ''}
  if(!firstPerson.active)return '1인칭에서 낚싯대를 쓰시오.';
  if(firstPerson.mounted||firstPerson.air>.05)return '말에서 내려 물가에 서시오.';
  const at=firstPerson.eye,dx=at.x-shore.x,dz=at.z-shore.z;
  if(Math.hypot(dx,dz)>12)return '청계천 낚시꾼 곁 물가로 오시오.';
  const toward=water.clone().sub(at).setY(0).normalize(),forward=new THREE.Vector3(-Math.sin(firstPerson.yaw),0,-Math.cos(firstPerson.yaw));
  if(toward.dot(forward)<.3)return '물 쪽으로 몸을 돌리시오.';
  firstPerson.clearInput();pending=true;origin=at;started=performance.now();const run=++generation;say('낚싯줄을 드리우는 중…');
  post({action:'start',era}).then(answer=>{if(run!==generation){post({action:'cancel',token:answer.token}).catch(()=>{}).finally(()=>{settling=false});return}pending=false;active=answer;endAt=performance.now()+answer.wait_ms;say(answer.message)}).catch(e=>{if(run!==generation){settling=false;return}pending=false;say(e.message);resultUntil=performance.now()+4000});return '';
 }
 function update(){
  const now=performance.now();group.visible=npcRod.group.visible=visible()&&camera.position.distanceTo(shore)<650;
  npcRod.update(shore.clone().add(new THREE.Vector3(.1,1.15,0)),water.clone().add(new THREE.Vector3(0,Math.sin(now*.002)*.03,0)));
  if((active||pending)&&(!firstPerson.active||firstPerson.mounted||firstPerson.air>.05||firstPerson.eye.distanceTo(origin)>.6)){cancel();return}
  if(active||pending){
   const at=firstPerson.eye,hand=at.clone().add(new THREE.Vector3(.22,-.45,0).applyAxisAngle(axis,firstPerson.yaw));playerRod.group.visible=true;playerRod.update(hand,water,(now-started)/800);
   firstPerson.walker?.group.children.filter(c=>c.isGroup&&Math.abs(c.position.y-1.35)<.001).forEach(a=>a.rotation.x=-1.05);
   if(active&&!pending&&now>=endAt){pending=true;const run=generation,cast=active;post({action:'finish',token:cast.token}).then(async answer=>{await shop.refresh();if(run!==generation)return;active=null;pending=false;stopPose();say(answer.message);resultUntil=performance.now()+6000}).catch(e=>{if(run!==generation)return;pending=false;endAt=performance.now()+3000;say(e.message)})}
  }else if(now>resultUntil)status.hidden=true;
 }
 const npc=()=>({key:'stream-fisherman',name:config.name,subtitle:config.subtitle,portrait:'merchant',nodes:config.nodes,merchant:{trade:'청계천 낚시꾼',sells:'낚싯대'},position:()=>shore,maxDistance:100,begin:()=>firstPerson.clearInput()});
 dialogue.register({pick(event,hitTest){if(!group.visible)return null;const distance=hitTest(event,shore,1.95,100);return distance===null?null:{distance,npc:npc()}}});
 return {use,cancel,update,group,shore,water,npc,get active(){return !!active||pending}};
}
