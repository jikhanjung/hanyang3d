import * as THREE from 'three';
import {createRoyalArrival,createLegationGuard} from './royal_arrival.js';
import {createEventNeighborhood} from './event_neighborhood.js';
import {createWalker} from './pedestrians.js';

// Interpretive scenery and motion; checkpoints are account-scoped and grant no economic rewards.
export function createAgwanpacheon({data,scene,camera,walking,buildings,infrastructure,settlement,trams,material,surface,channel}){
 const english=document.documentElement.lang==='en',say=(ko,en)=>english?en:ko;
 const fp=walking.firstPerson,container=document.getElementById('scene');
 const panel=document.createElement('section');panel.id='historical-event-panel';panel.style.cssText='position:absolute;top:12px;left:12px;z-index:1050;max-width:min(430px,calc(100vw - 24px));padding:12px;border-radius:8px;background:#152b30df;color:#fff;font:14px/1.5 sans-serif';
 const title=document.createElement('strong');title.textContent=say('1896년 2월 11일 · 두 대의 가마','11 February 1896 · Two Sedan Chairs');
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent=say('영추문 밖에서 가마를 따라 정동으로 향합니다.','Follow the chairs from Yeongchumun to Jeongdong.');
 const note=document.createElement('details'),summary=document.createElement('summary');summary.textContent=say('역사와 창작·출처','History, interpretation and sources');note.append(summary,document.createTextNode(english?data.note_en:data.note));
 for(const source of data.sources){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.style.cssText='display:block;color:#e9d7a2';a.textContent=source.title;note.append(a)}
 const task=document.createElement('p');task.id='historical-event-task';task.hidden=true;task.style.cssText='margin:4px 0;color:#e9d7a2';
 const start=document.createElement('button'),rejoin=document.createElement('button'),face=document.createElement('button'),leave=document.createElement('button');start.textContent=say('회상 시작 / 이어하기','Start / resume');rejoin.textContent=say('가마 뒤로 돌아가기','Rejoin the chairs');rejoin.hidden=true;face.textContent=say('목적지 방향 보기','Face the destination');face.hidden=true;leave.textContent=say('1907년으로 돌아가기','Return to 1907');
 panel.append(title,message,task,start,rejoin,face,leave,note);container.append(panel);
 document.querySelector('.toolbar').hidden=true;
 const css=document.createElement('style');css.textContent='body.historical-visit .toolbar,body.historical-visit #action-bar,body.historical-visit #money-hud,body.historical-visit #player-hud,body.historical-visit #walk-together-status{display:none!important}#historical-event-panel button{margin:3px;padding:7px}';document.head.append(css);document.body.classList.add('historical-visit');
 for(const id of ['people3d','names3d','trams3d'])document.getElementById(id).checked=false;
 document.getElementById('labels').hidden=true;material.opacity=0;
 const keep=new Set(data.retained_buildings);for(const b of buildings)b.visible=keep.has(b.userData.feature.id);
 settlement.group.visible=false;trams.group.visible=false;walking.pedestrians.group.visible=false;walking.stationary.group.visible=false;walking.horseDealer.visible=false;
 // Roads are 1907 reference geometry, not a claim of a surveyed 1896 escape route.
 const root=new THREE.Group();root.name='agwanpacheon-procession';root.visible=false;scene.add(root);
 document.title=say('아관파천 회상 · 한양3D','Agwanpacheon · Hanyang3D');scene.background=new THREE.Color('#101827');
 // Before dawn: cool, subdued illumination keeps the procession and lane readable.
 const lights=[];scene.traverse(o=>{if(o.isHemisphereLight||o.isDirectionalLight)lights.push(o)});
 // Dawn breaks during the aftermath: the same lights warm and brighten while the neighbour brings the news.
 let dawn=0;const night={sky:new THREE.Color('#101827'),hemi:new THREE.Color('#859bbd'),ground:new THREE.Color('#383e48'),sun:new THREE.Color('#b9cef1')},morning={sky:new THREE.Color('#9fb3cc'),hemi:new THREE.Color('#d9dfe6'),ground:new THREE.Color('#6a6457'),sun:new THREE.Color('#f1e3c4')};
 function setDawn(t){dawn=t;scene.background.copy(night.sky).lerp(morning.sky,t);for(const o of lights){if(o.isHemisphereLight){o.color.copy(night.hemi).lerp(morning.hemi,t);o.groundColor.copy(night.ground).lerp(morning.ground,t);o.intensity=.95+.45*t}else{o.color.copy(night.sun).lerp(morning.sun,t);o.intensity=.65+.55*t}}}
 setDawn(0);
 function chair(index){
  const group=new THREE.Group(),cabin=new THREE.Group();group.add(cabin);root.add(group);
  const mats={wood:new THREE.MeshStandardMaterial({color:0x66442f}),cloth:new THREE.MeshStandardMaterial({color:index?0x736d61:0x5b6870}),roof:new THREE.MeshStandardMaterial({color:0x363934})};
  const box=(x,y,z,w,h,d,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[mat]);m.position.set(x,y,z);cabin.add(m);return m};
  box(0,.85,0,1.15,.12,1.5,'wood');box(.55,1.48,0,.04,1.2,1.4,'cloth');for(const z of [-.7,.7])box(0,1.48,z,1.1,1.2,.04,'cloth');const curtain=box(-.55,1.48,0,.04,1.2,1.4,'cloth');box(0,2.12,0,1.4,.16,1.7,'roof');
  for(const x of [-.56,.56]){box(x,1.48,-.7,.08,1.25,.08,'wood');box(x,1.48,.7,.08,1.25,.08,'wood');box(x,1.31,0,.1,.1,4.7,'wood')}
  const bearers=[];for(const x of [-.92,.92])for(const z of [-1.75,1.75]){const p=createWalker();p.group.position.set(x,0,z);group.add(p.group);bearers.push(p)}
  return {group,cabin,bearers,curtain};
 }
 const chairs=[chair(0),chair(1)];
 const guard=createLegationGuard({scene,groundAt:surface.ground,infrastructure,building:buildings.find(b=>b.userData.feature.id==='russian-legation-1907')});
 let path=[],lengths=[],milestones=[],distance=0,active=false,busy=false,saved=null,finished=false,checkpoint=0,saveQueue=Promise.resolve(),saveError=false,writeCount=0;
 // Checkpoints run through the stages before the route (letter, gate), the route points, then the aftermath.
 const routeOffset=data.stages_before.length+1,routeEnd=routeOffset+data.route.length-1,lastCheckpoint=routeEnd+data.stages_after.length;
 const phaseOf=c=>c<1?'letter':c<2?'gate':c<routeEnd?'procession':c<lastCheckpoint?'aftermath':'done';
 const dialogue=walking.dialogue;let talking=null,pendingDone=null,retryAt=0,aftermathStep=0;
 const localize=nodes=>Object.fromEntries(Object.entries(nodes).map(([k,n])=>[k,{...n,text:say(n.text,n.text_en),options:n.options?.map(o=>({...o,label:say(o.label,o.label_en)}))}]));
 const person=(spec,color)=>{const p=createWalker();p.group.name='event-'+spec.portrait;p.group.getObjectByName('walker-body').material.color.set(color);p.group.visible=false;scene.add(p.group);return {p,spec,nodes:null}};
 const contacts={letter:person(data.letter.contact,'#8a8378'),gate:person(data.gate.contact,'#6f6a5e'),neighbour:person(data.aftermath.neighbour,'#b9ad93')};
 function standAt(actor,p,facing){actor.p.group.position.set(p.x,fp.groundAt(p.x,p.z),p.z);actor.p.group.rotation.y=facing;actor.p.group.visible=true;actor.p.update(0,false)}
 function talk(actor,nodes,onDone){
  if(dialogue.current)return;
  actor.nodes=localize(nodes);const spec=actor.spec,position=actor.p.group.position;
  talking=actor;pendingDone=onDone;fp.clearInput();
  // Closing the window early leaves the contact waiting; a short pause stops it reopening on the same spot.
  dialogue.start({key:'event-'+spec.portrait,name:say(spec.name,spec.name_en),subtitle:say(spec.subtitle,spec.subtitle_en),portrait:spec.portrait,nodes:actor.nodes,position:()=>position,maxDistance:200,finish:()=>{talking=null;retryAt=performance.now()+3000}});
 }
 walking.setEventAction(action=>{
  const done=pendingDone;pendingDone=null;
  if(action==='letter_done'||action==='gate_done'||action==='reveal_done'||action==='aftermath_done')done?.(action);
 });
 const csrf=()=>document.cookie.split('; ').find(v=>v.startsWith('csrftoken='))?.slice(10)??'';
 async function api(action,point){const r=await fetch('/api/events/agwanpacheon/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf()},body:JSON.stringify({action,checkpoint:point,version:data.version})});const result=await r.json();if(!r.ok)throw Error(result.error||'Event request failed');return result}
 // Short A* detours respect current walls and retained buildings. Never fall back to moving through solids.
 const waterAt=(x,z)=>globalThis.ChannelTerrain.nearest(x,z,channel.path);
 const safe=p=>{const y=fp.groundAt(p.x,p.z),water=waterAt(p.x,p.z);return Number.isFinite(y)&&!(water.distance<water.width+1.4&&y<water.level+.15)&&!walking.collision.hit(p.x,p.z,1.35)};
 let neighborhood=null,arrival=null;
 function connect(a,b){
  const span=a.distanceTo(b),steps=Math.ceil(span/2),direct=Array.from({length:steps+1},(_,i)=>a.clone().lerp(b,i/steps));if(direct.every(safe))return direct;
  const step=3,margin=60,minX=Math.min(a.x,b.x)-margin,minZ=Math.min(a.z,b.z)-margin,maxX=Math.max(a.x,b.x)+margin,maxZ=Math.max(a.z,b.z)+margin;
  const point=(x,z)=>new THREE.Vector3(minX+x*step,0,minZ+z*step),cell=p=>[Math.round((p.x-minX)/step),Math.round((p.z-minZ)/step)],startCell=cell(a),goalCell=cell(b),key=(x,z)=>x+','+z;
  const nodes=new Map(),open=[];const seed={x:startCell[0],z:startCell[1],g:0,f:0,parent:null};open.push(seed);nodes.set(key(seed.x,seed.z),seed);
  for(let count=0;open.length&&count<18000;count++){
   let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const n=open.splice(bi,1)[0];if(n.closed)continue;n.closed=true;
   if(n.x===goalCell[0]&&n.z===goalCell[1]){const result=[b];for(let c=n;c;c=c.parent)result.push(point(c.x,c.z));result.push(a);return result.reverse()}
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const x=n.x+dx,z=n.z+dz,p=point(x,z);if(p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ||!safe(p))continue;
    if(dx&&dz&&(!safe(point(n.x+dx,n.z))||!safe(point(n.x,n.z+dz))))continue;
    const k=key(x,z),prev=nodes.get(k),g=n.g+Math.hypot(dx,dz);if(prev&&g>=prev.g)continue;
    const v={x,z,g,f:g+Math.hypot(x-goalCell[0],z-goalCell[1]),parent:n};nodes.set(k,v);open.push(v);
   }
  }
  throw Error(say('가마가 통과할 길을 찾지 못했습니다. 회상 경로 점검이 필요합니다.','No passable route. This reconstruction needs a route check.'));
 }
 function prepare(){
  path=[];lengths=[];milestones=[];
  const nodes=data.route.map(r=>{let p;if(r.bridge_id){const bridge=infrastructure.bridges.getObjectByName(r.bridge_id);bridge.updateWorldMatrix(true,false);p=bridge.localToWorld(new THREE.Vector3(0,0,r.bridge_side*bridge.userData.approachDistance))}else if(r.building_front){const b=buildings.find(b=>b.userData.feature.id===r.building_front);b.updateWorldMatrix(true,false);p=b.localToWorld(new THREE.Vector3(0,0,25))}else p=surface(...r.pixel);p.y=0;return p});
  for(let i=0;i<nodes.length;i++){
   if(!safe(nodes[i]))throw Error(say('확인 지점이 건물과 겹칩니다. 경로 점검이 필요합니다.','A checkpoint overlaps an obstacle.'));
   if(i)path.push(...connect(nodes[i-1],nodes[i]).slice(1));else path.push(nodes[i]);
   milestones.push(path.length-1);
  }
  lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i].distanceTo(path[i-1]));milestones=milestones.map(i=>lengths[i]);
  if(!neighborhood)neighborhood=createEventNeighborhood({path,surface,scene,walking,buildings,waterAt});
 }
 // The contacts stand a few steps off the lane; if a data point overlaps a wall, take the nearest passable spot.
 function nearestSafe(p){
  if(safe(p))return p;
  for(let r=1.5;r<=15;r+=1.5)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,q=p.clone().add(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));if(safe(q))return q}
  throw Error(say('연락책이 설 자리를 찾지 못했습니다. 회상 경로 점검이 필요합니다.','No passable spot for a contact. This reconstruction needs a route check.'));
 }
 const spots={};
 function prepareStages(){
  if(spots.letter)return;
  const at=pixel=>{const p=surface(...pixel);p.y=0;return nearestSafe(p)};
  spots.start=at(data.letter.start_pixel);spots.letter=at(data.letter.contact_pixel);spots.gate=at(data.gate.contact_pixel);
  standAt(contacts.letter,spots.letter,Math.atan2(spots.start.x-spots.letter.x,spots.start.z-spots.letter.z));
  standAt(contacts.gate,spots.gate,Math.atan2(path[0].x-spots.gate.x,path[0].z-spots.gate.z));
  contacts.letter.p.group.visible=contacts.gate.p.group.visible=false;
 }
 const faceTowards=(from,to)=>Math.atan2(-(to.x-from.x),-(to.z-from.z));
 function stagePlacement(){
  // Put the walker where the current stage begins; the procession phases keep the existing regroup.
  const phase=phaseOf(checkpoint);
  contacts.letter.p.group.visible=phase==='letter';contacts.gate.p.group.visible=phase==='gate';contacts.neighbour.p.group.visible=false;
  task.hidden=phase!=='letter';task.textContent=say(`임무 물품: ${data.letter.item} (거래 불가)`,`Task item: ${data.letter.item_en} (cannot be traded)`);
  root.visible=phase==='procession'||phase==='aftermath';rejoin.hidden=phase!=='procession';face.hidden=!(phase==='letter'||phase==='gate');
  if(phase==='letter'){fp.placeAt(spots.start.x,spots.start.z,faceTowards(spots.start,spots.letter));fp.clearInput()}
  else if(phase==='gate'){fp.placeAt(spots.letter.x,spots.letter.z,faceTowards(spots.letter,spots.gate));fp.clearInput()}
  else{place();regroup()}
 }
 const target=()=>phaseOf(checkpoint)==='letter'?spots.letter:phaseOf(checkpoint)==='gate'?spots.gate:null;
 function sample(s){
  s=Math.max(0,Math.min(s,lengths.at(-1)));let i=1;while(i<lengths.length-1&&lengths[i]<s)i++;const a=path[i-1],b=path[i],p=a.clone().lerp(b,(s-lengths[i-1])/Math.max(.0001,lengths[i]-lengths[i-1]));return {p,yaw:Math.atan2(b.x-a.x,b.z-a.z)};
 }
 function place(){for(const [i,c] of chairs.entries()){const {p,yaw}=sample(distance-i*data.spacing_m);c.group.position.set(p.x,fp.groundAt(p.x,p.z),p.z);c.group.rotation.y=yaw}}
 function regroup(){const {p,yaw}=sample(Math.max(0,distance-data.spacing_m-7));fp.placeAt(p.x,p.z,yaw+Math.PI);fp.clearInput()}
 function enqueue(point){writeCount++;saveQueue=saveQueue.then(()=>api('checkpoint',point)).catch(error=>{saveError=true;message.textContent=error.message;active=false;fp.clearInput();start.hidden=false;start.textContent=say('저장 확인 후 이어하기','Reload saved progress')}).finally(()=>writeCount--)}
 async function begin(restart=false){
  if(busy)return;busy=true;start.disabled=true;
  try{
   await walking.shop.whenReady;
   if(!walking.shop.state.loggedIn){const name=await walking.shop.requireLogin({message:say('회상 진행을 저장하려면 로그인해 주세요.','Sign in to save your progress.')});if(!name)return}
   if(!lengths.length)prepare();
   saved=await api(restart?'restart':'status');
   if(saved.version!==data.version){finished=true;start.textContent=say('새 버전으로 다시 시작','Restart updated visit');message.textContent=say('회상 경로가 바뀌었습니다. 처음부터 다시 시작해 주세요.','The route changed. Please restart.');return}
   if(saved.status==='completed'&&!restart){start.textContent=say('처음부터 다시 보기','Replay');finished=true;message.textContent=say('이미 마친 회상입니다. 다시 체험할 수 있습니다.','You have completed this visit. You can replay it.');return}
   saved=await api('start');checkpoint=saved.checkpoint;prepareStages();
   distance=Math.min(lengths.at(-1),Math.max(data.spacing_m+7,milestones[Math.max(0,Math.min(data.route.length-1,checkpoint-routeOffset))]));saveError=false;finished=false;arrival?.reset();arrival=null;aftermathStep=0;dialogue.end();setDawn(0);
   if(!fp.active)fp.enter();if(!fp.active)throw Error(say('1인칭을 시작하지 못했습니다.','Could not start walking.'));
   fp.setMounted(false);stagePlacement();active=true;start.hidden=true;
   if(phaseOf(checkpoint)==='done'){complete();return}
  }catch(error){message.textContent=error.message}finally{busy=false;start.disabled=false}
 }
 start.onclick=()=>begin(finished);rejoin.onclick=()=>{if(fp.active)regroup()};
 face.onclick=()=>{const to=target();if(fp.active&&to){fp.placeAt(fp.eye.x,fp.eye.z,faceTowards(fp.eye,to));fp.clearInput()}};
 // Stage transitions: each saves its checkpoint in order; the walker never moves past a wall to reach the next.
 function advance(point,then){checkpoint=Math.max(checkpoint,point);retryAt=0;enqueue(point);then?.()}
 function letterDone(){advance(1,()=>{stagePlacement();fp.placeAt(fp.eye.x,fp.eye.z,faceTowards(fp.eye,spots.gate));message.textContent=say('영추문 밖의 연락책을 찾아가세요. 궁궐 서쪽 문입니다.','Find the contact outside Yeongchumun, the west gate of the palace.')})}
 function gateDone(){advance(2,()=>{stagePlacement();advance(routeOffset);const p=spots.gate;fp.placeAt(p.x,p.z,faceTowards(p,path[0]));fp.clearInput();message.textContent=say('문이 열립니다. 가마와 거리를 두고 따라가세요.','The gate opens. Follow the chairs at a distance.')})}
 function startAftermath(){
  const host=arrival.host,actor={p:host,spec:data.aftermath.interpreter,nodes:null};
  message.textContent=say('공사관의 통역이 다가옵니다.','The legation interpreter approaches.');
  talk(actor,data.aftermath.interpreter_nodes,()=>{
   const p=fp.eye.clone().add(new THREE.Vector3(3.2,0,2.4));const q=nearestSafe(new THREE.Vector3(p.x,0,p.z));
   standAt(contacts.neighbour,q,faceTowards(q,fp.eye)+Math.PI);
   message.textContent=say('날이 밝았습니다. 이웃이 소문을 전합니다.','It is light now. A neighbour brings the rumours.');
   talk(contacts.neighbour,data.aftermath.neighbour_nodes,()=>advance(lastCheckpoint,complete));
  });
 }
 leave.onclick=async()=>{active=false;fp.clearInput();await saveQueue;location.href='/1907/?returnFromAgwan=1'+(english?'&lang=en':'')};
 function update(dt){
  neighborhood?.setLod(camera.position);
  if(!active)return;
  if(!fp.active){active=false;start.hidden=false;start.textContent=say('이어서 걷기','Resume walking');message.textContent=say('회상을 멈췄습니다. 마지막 확인 지점부터 이어갈 수 있습니다.','Paused. Resume from the last checkpoint.');return}
  if(fp.mounted)fp.setMounted(false);
  const phase=phaseOf(checkpoint);
  if(phase==='letter'||phase==='gate'){
   const to=target(),actor=phase==='letter'?contacts.letter:contacts.gate,left=Math.hypot(fp.eye.x-to.x,fp.eye.z-to.z);
   actor.p.group.rotation.y=Math.atan2(fp.eye.x-to.x,fp.eye.z-to.z);
   if(!talking&&!dialogue.current)message.textContent=phase==='letter'?say(`정동의 연락책에게 밀서를 전하세요. ${Math.round(left)}m`,`Deliver the letter to the contact in Jeongdong. ${Math.round(left)} m`):say(`영추문 밖 연락책까지 ${Math.round(left)}m — 궁궐 서쪽 문으로 가세요.`,`${Math.round(left)} m to the contact outside Yeongchumun, the west gate.`);
   if(left<3.5&&!talking&&!dialogue.current&&!saveError&&performance.now()>=retryAt)talk(actor,phase==='letter'?data.letter.nodes:data.gate.nodes,phase==='letter'?letterDone:gateDone);
   return;
  }
  if(phase==='aftermath'){if(!arrival)arrival=createRoyalArrival({scene,camera,container,chairs,building:buildings.find(b=>b.userData.feature.id==='russian-legation-1907'),fp,say,guard});if(arrival.done){if(!aftermathStep){aftermathStep=1;startAftermath()}if(dawn<1)setDawn(Math.min(1,dawn+Math.min(dt,.1)/25));return}arrival.update(Math.min(dt,.1));return}
  if(arrival){if(arrival.update(Math.min(dt,.1)))advance(routeEnd);return}
  const leader=chairs[0].group.position,tail=chairs[1].group.position,eye=fp.eye,near=Math.min(Math.hypot(eye.x-leader.x,eye.z-leader.z),Math.hypot(eye.x-tail.x,eye.z-tail.z)),far=Math.hypot(eye.x-tail.x,eye.z-tail.z);
  const moving=far<=45&&near>=3&&!saveError;
  if(moving)distance=Math.min(lengths.at(-1),distance+Math.min(dt,.1)*data.speed_mps);
  place();for(const c of chairs){c.cabin.position.y=moving?Math.sin(distance*2)*.025:0;for(const p of c.bearers){p.update(distance,moving);for(const arm of p.group.children.filter(o=>o.isGroup&&Math.abs(o.position.y-1.35)<.01))arm.rotation.x=-1.25}}
  while(checkpoint-routeOffset<milestones.length-2&&distance>=milestones[checkpoint-routeOffset+1]&&far<45){checkpoint++;enqueue(checkpoint)}
  const percent=Math.round(distance/lengths.at(-1)*100),name=data.route[Math.min(checkpoint-routeOffset+1,data.route.length-1)];
  message.textContent=near<3?say('가마에 너무 가깝습니다. 조금 물러서 주세요.','Step back from the chairs.'):far>45?say('가마가 기다립니다. 가까이 오거나 가마 뒤로 돌아가세요.','The chairs are waiting. Catch up or rejoin.'):say(`${name.name} · ${percent}% — 가마와 거리를 두고 따라가세요.`,`${name.name_en} · ${percent}% — Follow at a distance.`);
  if(distance>=lengths.at(-1)&&far<30&&!writeCount){
   fp.clearInput();rejoin.hidden=true;
   arrival=createRoyalArrival({scene,camera,container,chairs,building:buildings.find(b=>b.userData.feature.id==='russian-legation-1907'),fp,say,guard});
   message.textContent=say('러시아공사관에 도착했습니다. 가마에서 내리는 일행을 지켜보세요.','The chairs have arrived. Watch the passengers enter the legation.');
  }
 }
 function complete(){
   active=false;fp.clearInput();saveQueue.then(()=>{if(saveError)return;return api('complete')}).then(result=>{
    if(!result)return;finished=true;start.hidden=false;start.textContent=say('처음부터 다시 보기','Replay');
    contacts.neighbour.p.group.visible=false;
    message.replaceChildren(say('1896년 2월 11일, 고종과 왕세자는 경복궁을 떠나 러시아공사관으로 거처를 옮겼습니다. 그 뒤의 일은 날짜와 함께 남깁니다.','On 11 February 1896 Gojong and the crown prince moved from Gyeongbokgung to the Russian legation. What followed is listed with its dates.'));
    const list=document.createElement('ul');list.id='historical-event-epilogue';list.style.cssText='margin:6px 0 0;padding-left:18px';
    for(const e of data.aftermath.epilogue){const li=document.createElement('li');const a=document.createElement('a');a.href=e.source;a.target='_blank';a.rel='noopener';a.style.color='#e9d7a2';a.textContent=e.date;li.append(a,' — ',say(e.text,e.text_en));list.append(li)}
    message.append(list,document.createElement('br'),say('회상 완료가 계정에 기록되었습니다.','Completion has been saved.'));note.open=true;
   }).catch(error=>{message.textContent=error.message;start.hidden=false});
 }
 return {update,begin,regroup,root,chairs,contacts,get dawn(){return dawn},get spots(){return spots},get phase(){return phaseOf(checkpoint)},get arrival(){return arrival},guard,get neighborhood(){return neighborhood},get path(){return path},get milestones(){return milestones},get active(){return active},get distance(){return distance},get checkpoint(){return checkpoint},get saving(){return writeCount>0}};
}
