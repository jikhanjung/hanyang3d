import * as THREE from 'three';
import {createWalker} from './pedestrians.js';

const axis=new THREE.Vector3(0,1,0);
function tackle(maxLength=4){
 const group=new THREE.Group(),rod=new THREE.Mesh(new THREE.CylinderGeometry(.018,.035,1,8),new THREE.MeshStandardMaterial({color:0xb39b60,roughness:1})),line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xe8dfc5})),float=new THREE.Mesh(new THREE.SphereGeometry(.10,8,6),new THREE.MeshStandardMaterial({color:0xc94728}));
 group.add(rod,line,float);group.name='fishing-tackle';
 return {group,update(hand,water,phase=1){const tip=hand.clone().lerp(water,.62);tip.y=hand.y+1.3+Math.sin(Math.min(1,phase)*Math.PI)*2;const reach=tip.clone().sub(hand);if(reach.length()>maxLength)tip.copy(hand).add(reach.setLength(maxLength));const delta=tip.clone().sub(hand);rod.position.copy(hand).add(tip).multiplyScalar(.5);rod.scale.y=delta.length();rod.quaternion.setFromUnitVectors(axis,delta.normalize());const p=line.geometry.attributes.position;p.setXYZ(0,tip.x,tip.y,tip.z);p.setXYZ(1,water.x,water.y,water.z);p.needsUpdate=true;line.geometry.computeBoundingSphere();float.position.copy(water)}};
}
export function createFishing({scene,camera,firstPerson,shop,dialogue,bridge,waterSurface,groundAt,collision,data,era,visible=()=>true}){
 if(!bridge||!waterSurface)return null;
 const config=data.fishing,person=createWalker(),group=person.group;group.name='stream-fisherman';
 const size=bridge.userData.feature.symbol_size_m,length=size?.[2]??bridge.children[0].geometry.parameters.depth,width=size?.[0]??bridge.userData.feature.width_m;
 const local=(x,z)=>new THREE.Vector3(x,0,z).applyAxisAngle(axis,bridge.rotation.y).add(new THREE.Vector3(bridge.position.x,0,bridge.position.z));
 const north=local(0,-length/2).z<local(0,length/2).z?-1:1;
 // Use the rendered water edge, not the bridge length: the two can differ greatly.
 waterSurface.updateWorldMatrix(true,false);
 const probe=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 function waterAt(x,z){probe.set(new THREE.Vector3(x,10000,z),down);return probe.intersectObject(waterSurface,false)[0]?.point??null}
 const positions=waterSurface.geometry.attributes.position,candidates=[],preferred=local(width/2+6,north*length/2);
 for(let i=0;i<positions.count-2;i+=2)for(const side of [0,1]){
  const edge=new THREE.Vector3().fromBufferAttribute(positions,i+side).applyMatrix4(waterSurface.matrixWorld),other=new THREE.Vector3().fromBufferAttribute(positions,i+1-side).applyMatrix4(waterSurface.matrixWorld);
  const next=new THREE.Vector3().fromBufferAttribute(positions,i+2+side).applyMatrix4(waterSurface.matrixWorld);
  const segment=next.clone().sub(edge);if(segment.lengthSq()<1e-8)continue;const t=THREE.MathUtils.clamp(preferred.clone().sub(edge).dot(segment)/segment.lengthSq(),0,1);edge.addScaledVector(segment,t);other.lerp(new THREE.Vector3().fromBufferAttribute(positions,i+3-side).applyMatrix4(waterSurface.matrixWorld),t);
  const outward=edge.clone().sub(other).setY(0).normalize();
  if(outward.z>=0||edge.distanceTo(preferred)>60)continue;
  for(const gap of [.8,1.2,2,3]){
   const p=edge.clone().addScaledVector(outward,gap),y=groundAt(p.x,p.z),wet=waterAt(p.x,p.z);
   if(y===null||y<edge.y-.1||wet||collision()?.hit(p.x,p.z,.4))continue;
   const target=edge.clone().addScaledVector(outward,-3),hit=waterAt(target.x,target.z);
   if(!hit)continue;p.y=y+.03;candidates.push({shore:p,water:hit,score:p.distanceTo(preferred)+gap});break;
  }
 }
 candidates.sort((a,b)=>a.score-b.score);
 if(!candidates.length)return null;
 const {shore,water}=candidates[0];
 let castTarget=null;
 group.position.copy(shore);group.rotation.y=Math.atan2(water.x-shore.x,water.z-shore.z);
 group.userData.temporal={valid_from:era,valid_to:era+1,position_status:'fictional_fisherman_near_bridge'};
 const hat=new THREE.Mesh(new THREE.ConeGeometry(.43,.2,12),new THREE.MeshStandardMaterial({color:0xa58a59}));hat.position.y=1.76;group.add(hat);
 const arms=person.group.children.filter(c=>c.isGroup&&Math.abs(c.position.y-1.35)<.001);arms.forEach(a=>a.rotation.x=-1.05);
 const npcRod=tackle(2.4),playerRod=tackle();scene.add(group,npcRod.group,playerRod.group);playerRod.group.visible=false;
 const status=document.createElement('div');status.id='fishing-status';status.setAttribute('role','status');status.hidden=true;document.getElementById('scene').append(status);
 const statusText=document.createElement('div'),progress=document.createElement('progress'),remaining=document.createElement('small');progress.max=100;progress.value=0;progress.setAttribute('aria-label','낚시 대기 진행');progress.hidden=remaining.hidden=true;status.append(statusText,progress,remaining);
 let active=null,pending=false,settling=false,generation=0,started=0,origin=null,endAt=0,resultUntil=0;
 const say=text=>{statusText.textContent=text;status.hidden=false};
 const post=async body=>{const token=document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)??'',r=await fetch('/api/fishing',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify(body)}),answer=await r.json();if(!r.ok)throw Error(answer.error??'낚시 요청을 마치지 못했소.');return answer};
 function stopPose(){progress.hidden=remaining.hidden=true;playerRod.group.visible=false;firstPerson.walker?.update(0,false)}
 function cancel(){if(!active&&!pending)return;generation++;const cast=active,wasPending=pending;active=null;pending=false;stopPose();settling=true;if(cast)post({action:'cancel',token:cast.token}).catch(()=>{}).finally(()=>{settling=false});else if(!wasPending)settling=false;say('낚싯줄을 거두었소.');resultUntil=performance.now()+3000}
 function use(){
  if(settling)return '이전 낚싯줄을 거두는 중이오.';
  if(active||pending){cancel();return ''}
  if(!firstPerson.active)return '1인칭에서 낚싯대를 쓰시오.';
  if(firstPerson.mounted||firstPerson.air>.05)return '말에서 내려 물가에 서시오.';
  const at=firstPerson.eye;
  const forward=camera.getWorldDirection(new THREE.Vector3()).setY(0);
  if(forward.lengthSq()<1e-6)return '물 쪽을 바라보시오.';
  forward.normalize();castTarget=null;
  for(const distance of [8,7,6,5,4,3,9,10,11,12,13,14]){
   const p=at.clone().addScaledVector(forward,distance),hit=waterAt(p.x,p.z);
   if(hit&&groundAt(p.x,p.z)<hit.y+.1&&!collision()?.hit(p.x,p.z,.1)){castTarget=hit;break}
  }
  if(!castTarget)return '물을 향해 낚싯대를 던지시오.';
  firstPerson.clearInput();pending=true;origin=at;started=performance.now();progress.value=0;progress.hidden=remaining.hidden=false;remaining.textContent='10초';const run=++generation;say('낚싯줄을 드리우는 중…');
  post({action:'start',era}).then(answer=>{if(run!==generation){post({action:'cancel',token:answer.token}).catch(()=>{}).finally(()=>{settling=false});return}pending=false;active=answer;endAt=performance.now()+answer.wait_ms;say(answer.message)}).catch(e=>{if(run!==generation){settling=false;return}pending=false;stopPose();say(e.message);resultUntil=performance.now()+4000});return '';
 }
 function update(){
  const now=performance.now();group.visible=npcRod.group.visible=visible()&&camera.position.distanceTo(shore)<650;
  npcRod.update(shore.clone().add(new THREE.Vector3(.1,1.15,0)),water.clone().add(new THREE.Vector3(0,Math.sin(now*.002)*.03,0)));
  if((active||pending)&&(!firstPerson.active||firstPerson.mounted||firstPerson.air>.05||firstPerson.eye.distanceTo(origin)>.6)){cancel();return}
  if(active||pending){
   if(active){const left=Math.max(0,endAt-now);progress.value=Math.min(100,100*(1-left/(active.duration_ms??10000)));remaining.textContent=left>0?`${Math.ceil(left/1000)}초`:'결과 확인 중…'}
   const at=firstPerson.eye,hand=at.clone().add(new THREE.Vector3(.22,-.45,0).applyAxisAngle(axis,firstPerson.yaw));playerRod.group.visible=true;playerRod.update(hand,castTarget,(now-started)/800);
   firstPerson.walker?.group.children.filter(c=>c.isGroup&&Math.abs(c.position.y-1.35)<.001).forEach(a=>a.rotation.x=-1.05);
   if(active&&!pending&&now>=endAt){pending=true;const run=generation,cast=active;post({action:'finish',token:cast.token}).then(async answer=>{await shop.refresh();if(run!==generation)return;active=null;pending=false;stopPose();say(answer.message);resultUntil=performance.now()+6000}).catch(e=>{if(run!==generation)return;pending=false;endAt=performance.now()+3000;say(e.message)})}
  }else if(now>resultUntil)status.hidden=true;
 }
 const npc=()=>({key:'stream-fisherman',name:config.name,subtitle:config.subtitle,portrait:'merchant',nodes:config.nodes,merchant:{trade:'청계천 낚시꾼',sells:'낚싯대'},position:()=>shore,maxDistance:100,begin:()=>firstPerson.clearInput()});
 dialogue.register({pick(event,hitTest){if(!group.visible)return null;const distance=hitTest(event,shore,1.95,100);return distance===null?null:{distance,npc:npc()}}});
 return {use,cancel,update,group,shore,water,npc,get castTarget(){return castTarget?.clone()},get active(){return !!active||pending}};
}
