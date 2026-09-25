import * as THREE from 'three';
import {createWalker} from '../pedestrians.js';

// Stage module: a knot of people murmuring in the street. From afar only fragments float over their heads; once the
// walker squeezes in among them (within `join_radius_m` of the centre) the murmur gives way to a conversation the
// walker overhears line by line — the people talk to each other, not to the walker. Stepping out pauses it. When the
// last line is said the crowd breaks up. One checkpoint. The people and their lines are invented; the rumours they
// pass on follow the sources in the visit's notes.
export function createCrowd(api){
 const {data,say,text,fp,scene,camera,container,nearestSafe,atPixel}=api;
 const centre=nearestSafe(atPixel(data.pixel)),join=data.join_radius_m??4.5,ring=data.ring_m??2.4;
 const people=data.people.map((spec,i)=>{
  const p=createWalker();p.group.name='crowd-'+i;if(spec.color)p.group.getObjectByName('walker-body').material.color.set(spec.color);
  p.group.visible=false;scene.add(p.group);
  const bubble=document.createElement('div');bubble.className='crowd-bubble';bubble.hidden=true;
  bubble.style.cssText='position:absolute;z-index:1040;transform:translate(-50%,-100%);padding:5px 9px;border-radius:10px;background:#fff9e8e6;color:#25231d;max-width:240px;text-align:center;pointer-events:none;font:13px/1.4 sans-serif';
  container.append(bubble);
  return {p,spec,bubble,until:0,phase:i*1.7};
 });
 // A ring around the centre with a gap where the walker squeezes in (the side facing where they come from).
 function arrange(){
  const gapYaw=Math.atan2(fp.eye.x-centre.x,fp.eye.z-centre.z),n=people.length;
  for(const [i,m] of people.entries()){
   const a=gapYaw+(i+.5+.25)/(n+.5)*Math.PI*2*.86+Math.PI*.07,r=ring+(i%3)*.35;
   const q=nearestSafe(new THREE.Vector3(centre.x+Math.sin(a)*r,0,centre.z+Math.cos(a)*r));
   m.p.group.position.set(q.x,fp.groundAt(q.x,q.z)??centre.y,q.z);m.p.group.rotation.y=Math.atan2(centre.x-q.x,centre.z-q.z);m.p.group.visible=true;m.p.update(0,false);
  }
 }
 let nextLine=null,state='approach',clock=0,line=-1,lineUntil=0,nextMurmur=0,awayFor=0,ending=0;
 function show(m,words,seconds,full=false){m.bubble.replaceChildren();const s=document.createElement('span');s.textContent=words;m.bubble.append(s);
  if(full){const who=document.createElement('small');who.style.cssText='display:block;color:#6b6456';who.textContent=say(m.spec.name,m.spec.name_en);m.bubble.prepend(who);m.bubble.style.maxWidth='280px'}else m.bubble.style.maxWidth='200px';
  m.until=clock+seconds}
 function placeBubbles(){
  const r=container.getBoundingClientRect();camera.updateMatrixWorld();
  for(const m of people){
   if(clock>=m.until||!m.p.group.visible){m.bubble.hidden=true;continue}
   const head=m.p.group.position.clone();head.y+=2.2;const far=head.distanceTo(camera.position)>45;head.project(camera);
   m.bubble.style.left=(head.x*.5+.5)*r.width+'px';m.bubble.style.top=(-head.y*.5+.5)*r.height+'px';m.bubble.hidden=far||head.z>1||head.z<-1;
  }
 }
 const murmurs=data.murmurs??[];
 function murmur(){
  if(!murmurs.length||clock<nextMurmur)return;nextMurmur=clock+.9+Math.random()*1.2;
  const idle=people.filter(m=>clock>=m.until);if(!idle.length)return;
  const m=idle[Math.floor(Math.random()*idle.length)],w=murmurs[Math.floor(Math.random()*murmurs.length)];show(m,say(w.ko,w.en),1.8+Math.random());
 }
 // Joining: whoever stands where the walker squeezes in steps aside to the edge of the gap.
 function makeRoom(){
  const gapYaw=Math.atan2(fp.eye.x-centre.x,fp.eye.z-centre.z),half=data.gap_rad??.5;
  for(const m of people){const pos=m.p.group.position,a=Math.atan2(pos.x-centre.x,pos.z-centre.z),r=Math.hypot(pos.x-centre.x,pos.z-centre.z);let rel=Math.atan2(Math.sin(a-gapYaw),Math.cos(a-gapYaw));
   if(Math.abs(rel)<half)rel=(rel<0?-1:1)*(half+Math.random()*.25);const t=nearestSafe(new THREE.Vector3(centre.x+Math.sin(gapYaw+rel)*r,0,centre.z+Math.cos(gapYaw+rel)*r));m.target=t}
 }
 // People shift their weight and glance at whoever is talking.
 function sway(dt,speaker){
  for(const m of people){
   const pos=m.p.group.position,look=speaker&&speaker!==m?speaker.p.group.position:(state==='joined'&&!speaker?fp.eye:centre);
   const want=Math.atan2(look.x-pos.x,look.z-pos.z)+Math.sin(clock*.7+m.phase)*.08;let dy=want-m.p.group.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));m.p.group.rotation.y+=dy*Math.min(1,dt*3);
   let walking=false;if(m.target){const dx=m.target.x-pos.x,dz=m.target.z-pos.z,d=Math.hypot(dx,dz);if(d>.05){const st=Math.min(d,dt*1.2);pos.x+=dx/d*st;pos.z+=dz/d*st;pos.y=fp.groundAt(pos.x,pos.z)??pos.y;walking=true}else m.target=null}
   m.p.update(clock*(walking?1.3:.4)+m.phase,walking);
  }
 }
 const lines=data.lines;
 const lineSeconds=l=>Math.max(data.min_line_s??4,text(l,'text').length/(data.chars_per_s??11));
 function sayLine(){
  line++;if(line>=lines.length){state='ending';ending=0;for(const m of people)m.until=0;api.panel.message(text(data,'outro'));return}
  const l=lines[line],m=people[l.who];for(const o of people)if(o!==m)o.until=0;show(m,text(l,'text'),lineSeconds(l),true);lineUntil=clock+lineSeconds(l);
  api.panel.message(`${say(m.spec.name,m.spec.name_en)}: ${text(l,'text')}`);
 }
 function enter(){
  state='approach';clock=0;line=-1;awayFor=0;ending=0;for(const m of people)m.target=null;arrange();api.quest.follow(people[0].p.group);api.markMap(centre);
  api.panel.message(text(data,'intro'));
  nextLine??=api.panel.button('crowd-next',say('다음 말 듣기 ▸','Next ▸'),()=>{if(state==='joined'&&line>=0)lineUntil=clock});nextLine.hidden=true;
 }
 function exit(){for(const m of people){m.bubble.hidden=true;m.p.group.visible=false}api.quest.follow(null);api.markMap(null);if(nextLine)nextLine.hidden=true}
 function reset(){state='approach';clock=0;line=-1}
 function update(dt){
  clock+=dt;api.quest.update(dt);
  const left=Math.hypot(fp.eye.x-centre.x,fp.eye.z-centre.z);
  if(state==='approach'){
   murmur();sway(dt,null);placeBubbles();
   api.panel.message(text(data,'approach').replace('{m}',Math.round(left)));
   if(left<=join){state='joined';makeRoom();api.quest.follow(null);api.markMap(null);fp.face(Math.atan2(-(centre.x-fp.eye.x),-(centre.z-fp.eye.z)));fp.clearInput();for(const m of people)m.until=0;api.panel.message(text(data,'joined'));lineUntil=clock+(data.first_line_after_s??1.5);nextLine.hidden=false}
   return;
  }
  if(state==='joined'){
   const speaker=line>=0&&line<lines.length?people[lines[line].who]:null;sway(dt,speaker);placeBubbles();
   if(left>join+2.5){awayFor+=dt;if(awayFor>.5){for(const m of people)if(m!==speaker)m.until=0;api.panel.message(text(data,'stray'))}murmur();lineUntil+=dt;if(speaker)speaker.until+=dt;return}
   awayFor=0;if(clock>=lineUntil)sayLine();
   return;
  }
  if(state==='ending'){
   if(nextLine)nextLine.hidden=true;ending+=dt;placeBubbles();
   // The crowd breaks up: everyone walks a few steps outwards and fades from the street.
   for(const m of people){const pos=m.p.group.position,dx=pos.x-centre.x,dz=pos.z-centre.z,d=Math.hypot(dx,dz)||1,q=new THREE.Vector3(pos.x+dx/d*dt*1.1,0,pos.z+dz/d*dt*1.1);
    if(api.safe(q)){pos.x=q.x;pos.z=q.z;pos.y=fp.groundAt(q.x,q.z)??pos.y}m.p.group.rotation.y=Math.atan2(dx,dz);m.p.update(clock*1.3+m.phase,true);if(ending>(data.disperse_s??4))m.p.group.visible=false}
   if(ending>=(data.disperse_s??4)&&!api.saving){state='done';api.finish()}
  }
 }
 return {enter,exit,reset,update,people,centre,get state(){return state},get line(){return line},get bubbles(){return people.filter(m=>!m.bubble.hidden).map(m=>m.bubble.textContent)}};
}
