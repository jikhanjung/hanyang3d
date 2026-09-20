import * as THREE from 'three';
import {createWalker} from './pedestrians.js';

// Interpretive scenery and motion; checkpoints are account-scoped and grant no economic rewards.
export function createAgwanpacheon({data,scene,camera,walking,buildings,infrastructure,settlement,trams,material,surface}){
 const english=document.documentElement.lang==='en',say=(ko,en)=>english?en:ko;
 const fp=walking.firstPerson,container=document.getElementById('scene');
 const panel=document.createElement('section');panel.id='historical-event-panel';panel.style.cssText='position:absolute;top:12px;left:12px;z-index:1050;max-width:min(430px,calc(100vw - 24px));padding:12px;border-radius:8px;background:#152b30df;color:#fff;font:14px/1.5 sans-serif';
 const title=document.createElement('strong');title.textContent=say('1896년 2월 11일 · 두 대의 가마','11 February 1896 · Two Sedan Chairs');
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent=say('영추문 밖에서 가마를 따라 정동으로 향합니다.','Follow the chairs from Yeongchumun to Jeongdong.');
 const note=document.createElement('details'),summary=document.createElement('summary');summary.textContent=say('역사와 창작·출처','History, interpretation and sources');note.append(summary,document.createTextNode(english?data.note_en:data.note));
 for(const source of data.sources){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.style.cssText='display:block;color:#e9d7a2';a.textContent=source.title;note.append(a)}
 const start=document.createElement('button'),rejoin=document.createElement('button'),leave=document.createElement('button');start.textContent=say('회상 시작 / 이어하기','Start / resume');rejoin.textContent=say('가마 뒤로 돌아가기','Rejoin the chairs');rejoin.hidden=true;leave.textContent=say('1907년으로 돌아가기','Return to 1907');
 panel.append(title,message,start,rejoin,leave,note);container.append(panel);
 document.querySelector('.toolbar').hidden=true;
 const css=document.createElement('style');css.textContent='body.historical-visit .toolbar,body.historical-visit #action-bar,body.historical-visit #money-hud,body.historical-visit #player-hud,body.historical-visit #walk-together-status{display:none!important}#historical-event-panel button{margin:3px;padding:7px}';document.head.append(css);document.body.classList.add('historical-visit');
 for(const id of ['people3d','names3d','trams3d'])document.getElementById(id).checked=false;
 document.getElementById('labels').hidden=true;material.opacity=0;
 const keep=new Set(data.retained_buildings);for(const b of buildings)b.visible=keep.has(b.userData.feature.id);
 settlement.group.visible=false;trams.group.visible=false;walking.pedestrians.group.visible=false;walking.stationary.group.visible=false;walking.horseDealer.visible=false;
 // Roads are 1907 reference geometry, not a claim of a surveyed 1896 escape route.
 const root=new THREE.Group();root.name='agwanpacheon-procession';root.visible=false;scene.add(root);
 document.title=say('아관파천 회상 · 한양3D','Agwanpacheon · Hanyang3D');scene.background=new THREE.Color('#8d9da5');
 scene.traverse(o=>{if(o.isLight)o.intensity*=.72});
 function chair(index){
  const group=new THREE.Group(),cabin=new THREE.Group();group.add(cabin);root.add(group);
  const mats={wood:new THREE.MeshStandardMaterial({color:0x66442f}),cloth:new THREE.MeshStandardMaterial({color:index?0x736d61:0x5b6870}),roof:new THREE.MeshStandardMaterial({color:0x363934})};
  const box=(x,y,z,w,h,d,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mats[mat]);m.position.set(x,y,z);cabin.add(m)};
  box(0,.85,0,1.15,.12,1.5,'wood');box(0,1.48,0,1.1,1.2,1.4,'cloth');box(0,2.12,0,1.4,.16,1.7,'roof');
  for(const x of [-.56,.56]){box(x,1.48,-.7,.08,1.25,.08,'wood');box(x,1.48,.7,.08,1.25,.08,'wood');box(x,1.31,0,.1,.1,4.7,'wood')}
  const bearers=[];for(const x of [-.92,.92])for(const z of [-1.75,1.75]){const p=createWalker();p.group.position.set(x,0,z);group.add(p.group);bearers.push(p)}
  return {group,cabin,bearers};
 }
 const chairs=[chair(0),chair(1)];
 let path=[],lengths=[],milestones=[],distance=0,active=false,busy=false,saved=null,finished=false,checkpoint=0,saveQueue=Promise.resolve(),saveError=false,writeCount=0;
 const csrf=()=>document.cookie.split('; ').find(v=>v.startsWith('csrftoken='))?.slice(10)??'';
 async function api(action,point){const r=await fetch('/api/events/agwanpacheon/',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf()},body:JSON.stringify({action,checkpoint:point,version:data.version})});const result=await r.json();if(!r.ok)throw Error(result.error||'Event request failed');return result}
 // Short A* detours respect current walls and retained buildings. Never fall back to moving through solids.
 const safe=p=>Number.isFinite(fp.groundAt(p.x,p.z))&&!walking.collision.hit(p.x,p.z,1.35);
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
  const nodes=data.route.map(r=>{const p=surface(...r.pixel);p.y=0;return p});
  for(let i=0;i<nodes.length;i++){
   if(!safe(nodes[i]))throw Error(say('확인 지점이 건물과 겹칩니다. 경로 점검이 필요합니다.','A checkpoint overlaps an obstacle.'));
   if(i)path.push(...connect(nodes[i-1],nodes[i]).slice(1));else path.push(nodes[i]);
   milestones.push(path.length-1);
  }
  lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i].distanceTo(path[i-1]));milestones=milestones.map(i=>lengths[i]);
 }
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
   saved=await api('start');checkpoint=saved.checkpoint;distance=Math.min(lengths.at(-1),Math.max(data.spacing_m+7,milestones[checkpoint]));saveError=false;finished=false;
   if(!fp.active)fp.enter();if(!fp.active)throw Error(say('1인칭을 시작하지 못했습니다.','Could not start walking.'));
   fp.setMounted(false);root.visible=true;place();regroup();active=true;start.hidden=true;rejoin.hidden=false;
  }catch(error){message.textContent=error.message}finally{busy=false;start.disabled=false}
 }
 start.onclick=()=>begin(finished);rejoin.onclick=()=>{if(fp.active)regroup()};
 leave.onclick=async()=>{active=false;fp.clearInput();await saveQueue;location.href='/1907/?returnFromAgwan=1'+(english?'&lang=en':'')};
 function update(dt){
  if(!active)return;
  if(!fp.active){active=false;start.hidden=false;start.textContent=say('이어서 걷기','Resume walking');message.textContent=say('회상을 멈췄습니다. 마지막 확인 지점부터 이어갈 수 있습니다.','Paused. Resume from the last checkpoint.');return}
  if(fp.mounted)fp.setMounted(false);
  const leader=chairs[0].group.position,tail=chairs[1].group.position,eye=fp.eye,near=Math.min(Math.hypot(eye.x-leader.x,eye.z-leader.z),Math.hypot(eye.x-tail.x,eye.z-tail.z)),far=Math.hypot(eye.x-tail.x,eye.z-tail.z);
  const moving=far<=45&&near>=3&&!saveError;
  if(moving)distance=Math.min(lengths.at(-1),distance+Math.min(dt,.1)*data.speed_mps);
  place();for(const c of chairs){c.cabin.position.y=moving?Math.sin(distance*2)*.025:0;for(const p of c.bearers){p.update(distance,moving);for(const arm of p.group.children.filter(o=>o.isGroup&&Math.abs(o.position.y-1.35)<.01))arm.rotation.x=-1.25}}
  while(checkpoint<milestones.length-1&&distance>=milestones[checkpoint+1]&&far<45){checkpoint++;enqueue(checkpoint)}
  const percent=Math.round(distance/lengths.at(-1)*100),name=data.route[Math.min(checkpoint+1,data.route.length-1)];
  message.textContent=near<3?say('가마에 너무 가깝습니다. 조금 물러서 주세요.','Step back from the chairs.'):far>45?say('가마가 기다립니다. 가까이 오거나 가마 뒤로 돌아가세요.','The chairs are waiting. Catch up or rejoin.'):say(`${name.name} · ${percent}% — 가마와 거리를 두고 따라가세요.`,`${name.name_en} · ${percent}% — Follow at a distance.`);
  if(distance>=lengths.at(-1)&&far<30&&!writeCount){
   active=false;fp.clearInput();saveQueue.then(()=>{if(saveError)return;return api('complete')}).then(result=>{
    if(!result)return;finished=true;start.hidden=false;start.textContent=say('처음부터 다시 보기','Replay');
    message.textContent=say('가마에 탄 이들은 고종과 왕세자였습니다. 1896년 2월 11일, 두 사람은 경복궁을 떠나 러시아공사관으로 거처를 옮겼습니다. 위협을 피해 도착했지만 외국 공관에 의지해야 했던 결정이기도 했습니다. 고종은 이듬해 경운궁으로 옮겼습니다. 회상 완료가 계정에 기록되었습니다.','The passengers were Gojong and the crown prince. On 11 February 1896 they moved from Gyeongbokgung to the Russian legation, seeking safety but also depending on a foreign mission. Gojong moved to Gyeongungung the following year. Completion has been saved.');note.open=true;
   }).catch(error=>{message.textContent=error.message;start.hidden=false});
  }
 }
 return {update,begin,regroup,root,chairs,get path(){return path},get milestones(){return milestones},get active(){return active},get distance(){return distance},get checkpoint(){return checkpoint},get saving(){return writeCount>0}};
}
