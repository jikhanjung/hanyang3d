import * as THREE from 'three';
import {createWalker} from './pedestrians.js';
import {createQuestMarker} from './quest_marker.js';

// Framework for historical visits (quests): a definition in gis/events/<slug>.json drives the panel, the keepsake
// gate, the account checkpoints, the scene dressing and lighting, the talk stages with their question marks, and the
// epilogue. Anything with moving parts (a procession, an escape, a patrol) is a stage *module* registered by name;
// the framework hosts it, gives it helpers, and takes its progress reports. Checkpoints are account-scoped and grant
// no economic rewards.
//
// Stage types: 'talk' (walk to one person and hear them out), 'talks' (a sequence of speakers who come to the walker),
// 'module' (a named module owning one or more checkpoints). Checkpoint 0 is 'started'.
export function createHistoricalEvent({data,modules,scene,camera,walking,buildings,infrastructure,settlement,trams,material,surface,channel}){
 const english=document.documentElement.lang==='en',say=(ko,en)=>english?(en??ko):ko,text=(o,key)=>say(o[key],o[key+'_en']);
 const fp=walking.firstPerson,container=document.getElementById('scene'),dialogue=walking.dialogue,curtain=walking.curtain;

 // ---- panel -------------------------------------------------------------------------------------------------------
 const panel=document.createElement('section');panel.id='historical-event-panel';panel.style.cssText='position:absolute;top:12px;left:12px;z-index:1050;max-width:min(430px,calc(100vw - 24px));padding:12px;border-radius:8px;background:#152b30df;color:#fff;font:14px/1.5 sans-serif';
 const title=document.createElement('strong');title.textContent=text(data,'panel_title');
 const message=document.createElement('p');message.setAttribute('role','status');message.textContent=text(data,'intro');
 const task=document.createElement('p');task.id='historical-event-task';task.hidden=true;task.style.cssText='margin:4px 0;color:#e9d7a2';
 const buttons=document.createElement('div');buttons.id='historical-event-buttons';
 const note=document.createElement('details'),summary=document.createElement('summary');summary.textContent=say('역사와 창작·출처','History, interpretation and sources');note.append(summary,document.createTextNode(text(data,'note')));
 for(const source of data.sources){const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener';a.style.cssText='display:block;color:#e9d7a2';a.textContent=source.title;note.append(a)}
 const button=(id,label,onclick,hidden=true)=>{const b=document.createElement('button');b.id=id;b.textContent=label;b.hidden=hidden;b.onclick=onclick;buttons.append(b);return b};
 const start=button('historical-event-start',say('회상 시작 / 이어하기','Start / resume'),()=>begin(finished),false);
 const face=button('historical-event-face',say('목적지 방향 보기','Face the destination'),()=>{const to=talkTarget();if(fp.active&&to){fp.placeAt(fp.eye.x,fp.eye.z,faceTowards(fp.eye,to));fp.clearInput()}});
 const leave=button('historical-event-leave',say('1907년으로 돌아가기','Return to 1907'),async()=>{active=false;fp.clearInput();await Promise.all([saveQueue,curtain.show(text(data.transition,'back_out'))]);curtain.remember(text(data.transition,'back_in'));location.href='/1907/?returnFromAgwan=1'+(english?'&lang=en':'')},false);
 panel.append(title,message,task,buttons,note);container.append(panel);
 document.querySelector('.toolbar').hidden=true;
 const css=document.createElement('style');css.textContent='body.historical-visit .toolbar,body.historical-visit #action-bar,body.historical-visit #money-hud,body.historical-visit #player-hud,body.historical-visit #walk-together-status{display:none!important}#historical-event-panel button{margin:3px;padding:7px}';document.head.append(css);document.body.classList.add('historical-visit');

 // ---- scene dressing and lighting ---------------------------------------------------------------------------------
 for(const id of ['people3d','names3d','trams3d'])document.getElementById(id).checked=false;
 document.getElementById('labels').hidden=true;material.opacity=0;
 const keep=new Set(data.scene.retained_buildings);for(const b of buildings)b.visible=keep.has(b.userData.feature.id);
 if(data.scene.hide_people!==false){settlement.group.visible=false;trams.group.visible=false;walking.pedestrians.group.visible=false;walking.stationary.group.visible=false;walking.horseDealer.visible=false}
 document.title=text(data,'document_title');
 const lights=[];scene.traverse(o=>{if(o.isHemisphereLight||o.isDirectionalLight)lights.push(o)});
 const presets=data.scene.lighting,color=k=>new THREE.Color(k);
 let lightMix=0;
 // Lighting is a blend between the 'start' and 'end' presets; a stage can ask to drift towards 'end' over some seconds.
 function setLighting(t){lightMix=t;const a=presets.start,b=presets.end??presets.start;scene.background=color(a.sky).lerp(color(b.sky),t);
  for(const o of lights){if(o.isHemisphereLight){o.color=color(a.hemi).lerp(color(b.hemi),t);o.groundColor=color(a.ground).lerp(color(b.ground),t);o.intensity=a.hemi_intensity+(b.hemi_intensity-a.hemi_intensity)*t}else{o.color=color(a.sun).lerp(color(b.sun),t);o.intensity=a.sun_intensity+(b.sun_intensity-a.sun_intensity)*t}}}
 setLighting(0);

 // ---- helpers shared with modules ---------------------------------------------------------------------------------
 const waterAt=(x,z)=>globalThis.ChannelTerrain.nearest(x,z,channel.path);
 const safe=p=>{const y=fp.groundAt(p.x,p.z),water=waterAt(p.x,p.z);return Number.isFinite(y)&&!(water.distance<water.width+1.4&&y<water.level+.15)&&!walking.collision.hit(p.x,p.z,1.35)};
 // Data points that overlap a wall move to the nearest passable spot rather than putting a person inside masonry.
 function nearestSafe(p){
  if(safe(p))return p;
  for(let r=1.5;r<=15;r+=1.5)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,q=p.clone().add(new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r));if(safe(q))return q}
  throw Error(say('설 자리를 찾지 못했습니다. 회상 배치 점검이 필요합니다.','No passable spot. This reconstruction needs a placement check.'));
 }
 const atPixel=pixel=>{const p=surface(...pixel);p.y=0;return nearestSafe(p)};
 const faceTowards=(from,to)=>Math.atan2(-(to.x-from.x),-(to.z-from.z));
 const person=(spec)=>{const p=createWalker();p.group.name='event-'+(spec.portrait??'person');if(spec.color)p.group.getObjectByName('walker-body').material.color.set(spec.color);p.group.visible=false;scene.add(p.group);return {p,spec,nodes:null}};
 function standAt(actor,p,facing){actor.p.group.position.set(p.x,fp.groundAt(p.x,p.z),p.z);actor.p.group.rotation.y=facing;actor.p.group.visible=true;actor.p.update(0,false)}

 // ---- checkpoints and stages --------------------------------------------------------------------------------------
 const stages=data.stages.map(s=>({...s,count:s.type==='module'?(s.checkpoints??s.route?.length??1):1}));
 let offset=1;for(const s of stages){s.first=offset;s.last=offset+s.count-1;offset+=s.count}
 const lastCheckpoint=offset-1;
 // Stage index for a checkpoint: the stage whose checkpoints are still ahead of it; past the end means 'done'.
 const stageAt=c=>stages.findIndex(s=>c<s.last||(s.type!=='module'&&c<s.first));
 const stageKeyAt=c=>{const i=stageAt(c);return i<0?'done':stages[i].key};
 let checkpoint=0,active=false,busy=false,finished=false,saveQueue=Promise.resolve(),saveError=false,writeCount=0;
 const csrf=()=>document.cookie.split('; ').find(v=>v.startsWith('csrftoken='))?.slice(10)??'';
 async function api(action,point){const r=await fetch(`/api/events/${data.slug}/`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf()},body:JSON.stringify({action,checkpoint:point,version:data.version})});const result=await r.json();if(!r.ok)throw Error(result.error||'Event request failed');return result}
 function enqueue(point){writeCount++;saveQueue=saveQueue.then(()=>api('checkpoint',point)).catch(error=>{saveError=true;message.textContent=error.message;active=false;fp.clearInput();start.hidden=false;start.textContent=say('저장 확인 후 이어하기','Reload saved progress')}).finally(()=>writeCount--)}
 function advance(point,then){checkpoint=Math.max(checkpoint,point);retryAt=0;enqueue(point);then?.()}

 // ---- talk stages -------------------------------------------------------------------------------------------------
 const quest=createQuestMarker();scene.add(quest.sprite);const MAP_MARK_M=250;
 let talking=null,pendingDone=null,retryAt=0;
 function pointQuest(actor){quest.follow(actor?actor.p.group:null);walking.navigation.questMarkers.length=0}
 const localize=nodes=>Object.fromEntries(Object.entries(nodes).map(([k,n])=>[k,{...n,text:say(n.text,n.text_en),options:n.options?.map(o=>({...o,label:say(o.label,o.label_en)}))}]));
 function talk(actor,nodes,onDone){
  if(dialogue.current)return;
  if(quest.sprite.visible)pointQuest(null);
  actor.nodes=localize(nodes);const spec=actor.spec,position=actor.p.group.position;
  talking=actor;pendingDone=onDone;fp.clearInput();
  // Closing the window early leaves the person waiting; a short pause stops it reopening on the same spot.
  dialogue.start({key:'event-'+(spec.portrait??'person'),name:say(spec.name,spec.name_en),subtitle:say(spec.subtitle,spec.subtitle_en),portrait:spec.portrait??'walker',nodes:actor.nodes,position:()=>position,maxDistance:200,finish:()=>{talking=null;retryAt=performance.now()+3000;if(pendingDone)pointQuest(currentTalk()?.actor??null)}});
 }
 walking.setEventAction(()=>{const done=pendingDone;pendingDone=null;pointQuest(null);done?.()});
 // Each talk stage owns one standing person; the walker starts where the stage says (or where the last one ended).
 const talks=new Map();
 function prepareTalks(){
  if(talks.size)return;
  for(const s of stages)if(s.type==='talk'){
   const spot=atPixel(s.contact_pixel),startSpot=s.walker_start_pixel?atPixel(s.walker_start_pixel):null,actor=person(s.contact);
   talks.set(s.key,{stage:s,spot,startSpot,actor});
  }
 }
 const currentTalk=()=>talks.get(stageKeyAt(checkpoint))??null;
 const talkTarget=()=>currentTalk()?.spot??null;
 function updateTalk(dt,t){
  const {stage,spot,actor}=t,left=Math.hypot(fp.eye.x-spot.x,fp.eye.z-spot.z);
  actor.p.group.rotation.y=Math.atan2(fp.eye.x-spot.x,fp.eye.z-spot.z);
  quest.update(dt);const marks=walking.navigation.questMarkers;if(left<MAP_MARK_M){if(!marks.length)marks.push({x:spot.x,z:spot.z})}else marks.length=0;
  if(!talking&&!dialogue.current&&stage.hint)message.textContent=text(stage,'hint').replace('{m}',Math.round(left));
  if(left<3.5&&!talking&&!dialogue.current&&!saveError&&performance.now()>=retryAt)talk(actor,stage.nodes,()=>advance(stage.last,()=>{enterStage();if(stage.after)message.textContent=text(stage,'after')}));
 }
 // ---- talks stages (speakers come to the walker) ------------------------------------------------------------------
 let talksStep=null,lightDrift=null;
 function runTalks(stage){
  const speakers=stage.speakers.map(sp=>({...sp,actor:sp.at?.startsWith('module:')?null:person(sp.spec)}));
  let i=0;
  const next=()=>{
   if(i>=speakers.length){advance(stage.last,complete);return}
   const sp=speakers[i++];let actor=sp.actor;
   if(sp.at?.startsWith('module:')){const anchor=lastModule?.anchors?.()[sp.at.slice(7)];if(!anchor)throw Error('missing module anchor '+sp.at);actor={p:anchor,spec:sp.spec,nodes:null}}
   else{const q=nearestSafe(fp.eye.clone().add(new THREE.Vector3(3.2,0,2.4)).setY(0));standAt(actor,q,faceTowards(q,fp.eye)+Math.PI)}
   if(sp.intro)message.textContent=text(sp,'intro');
   talk(actor,sp.nodes,()=>{if(sp.actor)sp.actor.p.group.visible=false;next()});
  };
  if(stage.lighting_to)lightDrift={target:stage.lighting_to==='end'?1:0,seconds:stage.lighting_seconds??20};
  talksStep={stage,next};next();
 }

 // ---- module stages -----------------------------------------------------------------------------------------------
 const instances=new Map();let lastModule=null,current=null;
 const moduleApi=stage=>({
  data:stage,say,text,fp,scene,camera,container,walking,buildings,infrastructure,surface,safe,nearestSafe,atPixel,faceTowards,waterAt,
  panel:{message:t=>{message.textContent=t},button:(id,label,onclick)=>button(id,label,onclick)},
  // A module reports its checkpoints by index within its own range, and finish() when its last one is reached.
  reach:i=>{const point=stage.first+i;if(point>checkpoint&&point<stage.last)advance(point)},
  finish:()=>{advance(stage.last,()=>{lastModule=instances.get(stage.key);enterStage()})},
  get checkpointIndex(){return Math.max(0,Math.min(stage.count-1,checkpoint-stage.first))},
  get saving(){return writeCount>0},get saveError(){return saveError},
 });
 function moduleFor(stage){
  if(!instances.has(stage.key)){const factory=modules[stage.module];if(!factory)throw Error('unknown stage module '+stage.module);instances.set(stage.key,factory(moduleApi(stage)))}
  return instances.get(stage.key);
 }

 // ---- stage entry -------------------------------------------------------------------------------------------------
 function enterStage(resume=false){
  const i=stageAt(checkpoint),stage=i<0?null:stages[i];
  for(const t of talks.values())t.actor.p.group.visible=false;
  pointQuest(null);task.hidden=true;face.hidden=true;
  if(current?.exit&&current!==(stage?.type==='module'?moduleFor(stage):null))current.exit();current=null;
  if(!stage){complete();return}
  if(stage.type==='talk'){
   const t=talks.get(stage.key);t.actor.p.group.visible=true;pointQuest(t.actor);face.hidden=false;
   if(stage.task){task.hidden=false;task.textContent=text(stage,'task')}
   // On resume the walker stands where the previous person stood; advancing naturally keeps the current position.
   const from=t.startSpot??(resume&&i>0?previousSpot(i):null);
   if(from){fp.placeAt(from.x,from.z,faceTowards(from,t.spot))}else fp.placeAt(fp.eye.x,fp.eye.z,faceTowards(fp.eye,t.spot));fp.clearInput();
   standAt(t.actor,t.spot,Math.atan2(fp.eye.x-t.spot.x,fp.eye.z-t.spot.z));
  }else if(stage.type==='module'){
   current=moduleFor(stage);current.enter(Math.max(0,checkpoint-stage.first));
  }else if(stage.type==='talks'){
   runTalks(stage);
  }
 }
 // Where the walker stands when a talk stage begins: where the previous talk stage's person stood.
 function previousSpot(i){for(let j=i-1;j>=0;j--){const t=talks.get(stages[j].key);if(t)return t.spot}return null}

 // ---- lifecycle ---------------------------------------------------------------------------------------------------
 async function begin(restart=false){
  if(busy)return;busy=true;start.disabled=true;
  try{
   await walking.shop.whenReady;
   if(!walking.shop.state.loggedIn){curtain.hide();const name=await walking.shop.requireLogin({message:say('회상 진행을 저장하려면 로그인해 주세요.','Sign in to save your progress.')});if(!name)return}
   await walking.shop.refresh();
   if(!(walking.shop.state.items[data.keepsake.item]>0)){message.textContent=text(data.keepsake,'missing');return}
   for(const s of stages)if(s.type==='module')moduleFor(s).prepare?.();
   prepareTalks();
   let saved=await api(restart?'restart':'status');
   if(saved.version!==data.version){finished=true;start.textContent=say('새 버전으로 다시 시작','Restart updated visit');message.textContent=say('회상 내용이 바뀌었습니다. 처음부터 다시 시작해 주세요.','The visit changed. Please restart.');return}
   if(saved.status==='completed'&&!restart){start.textContent=say('처음부터 다시 보기','Replay');finished=true;message.textContent=say('이미 마친 회상입니다. 다시 체험할 수 있습니다.','You have completed this visit. You can replay it.');return}
   saved=await api('start');checkpoint=saved.checkpoint;saveError=false;finished=false;dialogue.end();setLighting(0);lightDrift=null;talksStep=null;
   for(const m of instances.values())m.reset?.();lastModule=null;
   if(!fp.active)fp.enter();if(!fp.active)throw Error(say('1인칭을 시작하지 못했습니다.','Could not start walking.'));
   fp.setMounted(false);active=true;start.hidden=true;
   // Resuming past a module: that module still supplies anchors (e.g. the interpreter) for the talks after it.
   const i=stageAt(checkpoint);for(let j=0;j<(i<0?stages.length:i);j++)if(stages[j].type==='module'){lastModule=moduleFor(stages[j]);if(i>=0)lastModule.enter(stages[j].count-1,true)}
   enterStage(true);
  }catch(error){message.textContent=error.message}finally{busy=false;start.disabled=false}
 }
 function update(dt){
  for(const m of instances.values())m.idle?.(dt);
  if(!active)return;
  if(!fp.active){active=false;start.hidden=false;start.textContent=say('이어서 걷기','Resume walking');message.textContent=say('회상을 멈췄습니다. 마지막 확인 지점부터 이어갈 수 있습니다.','Paused. Resume from the last checkpoint.');current?.exit?.();return}
  if(fp.mounted)fp.setMounted(false);
  if(lightDrift&&lightMix!==lightDrift.target)setLighting(Math.min(1,lightMix+Math.min(dt,.1)/lightDrift.seconds));
  const t=currentTalk();if(t){updateTalk(dt,t);return}
  current?.update(Math.min(dt,.1));
 }
 function complete(){
  active=false;fp.clearInput();saveQueue.then(()=>{if(saveError)return;return api('complete')}).then(result=>{
   if(!result)return;finished=true;start.hidden=false;start.textContent=say('처음부터 다시 보기','Replay');
   message.replaceChildren(text(data.epilogue,'lead'));
   const list=document.createElement('ul');list.id='historical-event-epilogue';list.style.cssText='margin:6px 0 0;padding-left:18px';
   for(const e of data.epilogue.items){const li=document.createElement('li');const a=document.createElement('a');a.href=e.source;a.target='_blank';a.rel='noopener';a.style.color='#e9d7a2';a.textContent=e.date;li.append(a,' — ',say(e.text,e.text_en));list.append(li)}
   message.append(list,document.createElement('br'),say('회상 완료가 계정에 기록되었습니다.','Completion has been saved.'));note.open=true;
  }).catch(error=>{message.textContent=error.message;start.hidden=false});
 }
 // Arrived behind the curtain from the base scene: begin at once so the first thing seen is the street, not the overview.
 if(curtain.holding)begin().finally(()=>curtain.hide());
 return {update,begin,quest,stages,panel,
  regroup:()=>current?.regroup?.(),
  module:key=>instances.get(key),get current(){return current},
  get spots(){return Object.fromEntries([...talks].map(([k,t])=>[k,t.spot]))},get contacts(){return Object.fromEntries([...talks].map(([k,t])=>[k,t.actor]))},
  get phase(){return stageKeyAt(checkpoint)},get lighting(){return lightMix},get lastCheckpoint(){return lastCheckpoint},
  get active(){return active},get checkpoint(){return checkpoint},get saving(){return writeCount>0}};
}
