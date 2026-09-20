import * as THREE from 'three';
import {createWalker} from './pedestrians.js';
// A small instanced plant silhouette, deliberately not an identification of a medicinal species.
export function createHerbs({scene,camera,canvas,firstPerson,shop,dialogue,data,source,groundAt,collision,market,era,visible=()=>true}){
 const positions=[];
 for(let i=0;i<8;i++){const a=i*Math.PI/4,y=.18+(i%3)*.17,x=Math.cos(a)*.55,z=Math.sin(a)*.55,dx=-Math.sin(a)*.16,dz=Math.cos(a)*.16;positions.push(0,y,0,x+dx,y+.22,z+dz,x,y+.38,z,0,y,0,x,y+.38,z,x-dx,y+.22,z-dz)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
 const rows=data.herbs.nodes.map(n=>{const p=source(...n.pixel);p.y=groundAt(p.x,p.z);return {...n,position:p}}).filter(r=>r.position.y!==null&&r.position.y>100&&!collision()?.hit(r.position.x,r.position.z,.7));
 const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color:0x76a843,roughness:1,side:THREE.DoubleSide}),rows.length);mesh.name='gatherable-herbs';scene.add(mesh);
 const dummy=new THREE.Object3D(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),cooldowns=new Map();let hover=null,press=null,busy=false,owner='',syncing=false,lastUpdate=0;
 const message=document.createElement('div');message.id='herb-status';message.hidden=true;message.setAttribute('role','status');document.getElementById('scene').append(message);let messageUntil=0;
 const say=text=>{message.hidden=false;message.textContent=text;messageUntil=performance.now()+5000};
 const post=async body=>{const token=document.cookie.split('; ').find(c=>c.startsWith('csrftoken='))?.slice(10)??'',r=await fetch('/api/herbs',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':token},body:JSON.stringify(body)}),answer=await r.json();if(!r.ok)throw Error(answer.error??'채집하지 못했소.');return answer};
 function refreshPlants(){const now=performance.now();rows.forEach((r,i)=>{const shown=(cooldowns.get(r.id)??0)<=now;dummy.position.copy(r.position);dummy.rotation.y=i*2.4;dummy.scale.setScalar(shown?1:0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix)});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}
 function pick(e){if(!firstPerson.active||!mesh.visible)return null;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);return ray.intersectObject(mesh).map(h=>rows[h.instanceId]).find(n=>Math.hypot(n.position.x-firstPerson.eye.x,n.position.z-firstPerson.eye.z)<5&&(cooldowns.get(n.id)??0)<=performance.now())??null}
 canvas.addEventListener('pointermove',e=>{hover=pick(e);if(hover)canvas.style.cursor=press?'grabbing':'grab';else if(['grab','grabbing'].includes(canvas.style.cursor))canvas.style.cursor=''},true);
 canvas.addEventListener('pointerdown',e=>{if(e.button!==2)return;const row=pick(e);if(!row)return;e.preventDefault();e.stopImmediatePropagation();press={row,x:e.clientX,y:e.clientY,id:e.pointerId};canvas.style.cursor='grabbing'},true);
 canvas.addEventListener('pointerup',async e=>{if(!press||e.pointerId!==press.id)return;const p=press;press=null;e.preventDefault();e.stopImmediatePropagation();canvas.style.cursor='grab';if(busy||Math.hypot(e.clientX-p.x,e.clientY-p.y)>7||pick(e)?.id!==p.row.id)return;busy=true;firstPerson.clearInput();firstPerson.fishing?.cancel();say('약초를 모으는 중…');try{const result=await post({action:'gather',node:p.row.id});cooldowns.set(p.row.id,performance.now()+result.cooldown_ms);refreshPlants();await shop.refresh();say(result.message)}catch(error){say(error.message)}finally{busy=false}},true);
 canvas.addEventListener('pointercancel',()=>{press=null;canvas.style.cursor=''},true);
 const seller=createWalker(),g=seller.group;g.name='herb-merchant';scene.add(g);let merchantAt=null;
 if(market){const [w,,d]=market.userData.feature.symbol_size_m;for(const x of [w/2+3,-w/2-3,0]){const p=new THREE.Vector3(x,0,d/2+5).applyAxisAngle(new THREE.Vector3(0,1,0),market.rotation.y).add(new THREE.Vector3(market.position.x,0,market.position.z));if(!collision()?.hit(p.x,p.z,.5)&&!merchantAt){p.y=groundAt(p.x,p.z)+.03;merchantAt=p}}}
 if(merchantAt){g.position.copy(merchantAt);g.rotation.y=market.rotation.y;g.userData.temporal={position_status:'fictional_medicine_vendor',valid_from:era,valid_to:era+1};
  const signCanvas=document.createElement('canvas');signCanvas.width=256;signCanvas.height=80;const ctx=signCanvas.getContext('2d');ctx.fillStyle='#e4d4a8';ctx.fillRect(0,0,256,80);ctx.fillStyle='#314124';ctx.font='bold 46px serif';ctx.textAlign='center';ctx.fillText('약전 藥廛',128,57);const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(signCanvas)}));sign.position.set(0,2.3,0);sign.scale.set(2,.625,1);g.add(sign);
  const info=data.herbs.merchant;dialogue.register({pick(event,hitTest){if(!g.visible)return null;const distance=hitTest(event,merchantAt,2.4,100);return distance===null?null:{distance,npc:{key:'herb-merchant',name:info.name,subtitle:info.subtitle,portrait:'merchant',nodes:info.nodes,merchant:{trade:'약재상',sells:'약재'},position:()=>merchantAt,maxDistance:100}}}});
 }
 refreshPlants();
 function update(){const now=performance.now();mesh.visible=true;g.visible=!!merchantAt&&visible()&&camera.position.distanceTo(merchantAt)<500;
  if(now-messageUntil>0)message.hidden=true;
  if(now-lastUpdate>1000){lastUpdate=now;refreshPlants()}
  if(owner!==(shop.state.loggedIn?shop.state.name:'')&&!syncing){owner=shop.state.loggedIn?shop.state.name:'';cooldowns.clear();refreshPlants();if(owner){syncing=true;const account=owner;post({action:'status'}).then(r=>{if(account!==owner)return;for(const [id,ms] of Object.entries(r.cooldowns))cooldowns.set(id,performance.now()+ms);refreshPlants()}).catch(()=>{owner=''}).finally(()=>syncing=false)}}
 }
 return {mesh,rows,update,merchant:g,merchantAt,cooldowns};
}
