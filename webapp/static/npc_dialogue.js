import * as THREE from 'three';
import {t,lang,setLang} from './i18n.js';

// NPC conversation framework with two presentations.
// - 'bubble': a short greeting in a speech bubble over the person's head, gone after a few seconds.
// - 'overlay': a full conversation in an old adventure-game window over a dimmed screen: portrait and name
//   plate, text that types out (click or Space finishes it), sources, and numbered choices.
// Providers register NPCs that can be picked on screen. Choices move to another node, open a shop, or close.
export function createNpcDialogue({camera,canvas,container,note,onAction}){
 const providers=[];let current=null,node=null,typing=null,bubbleNpc=null,bubbleUntil=0;
 const v=new THREE.Vector3();

 const overlay=document.createElement('div');overlay.id='npc-overlay';overlay.hidden=true;
 const box=document.createElement('section');box.id='npc-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
 const portrait=document.createElement('canvas');portrait.width=120;portrait.height=140;portrait.className='npc-portrait';
 const plate=document.createElement('div');plate.className='npc-plate';
 const who=document.createElement('strong');const subtitle=document.createElement('small');plate.append(who,subtitle);
 const side=document.createElement('div');side.className='npc-side';side.append(portrait,plate);
 const main=document.createElement('div');main.className='npc-main';
 const text=document.createElement('p');text.className='npc-line';
 const sources=document.createElement('p');sources.className='npc-sources';
 const options=document.createElement('ol');options.className='npc-options';
 const footnote=document.createElement('small');footnote.className='npc-note';footnote.textContent=note;
 const close=document.createElement('button');close.type='button';close.className='npc-close';close.textContent='✕';close.setAttribute('aria-label',t('대화 닫기'));
 main.append(text,sources,options,footnote);box.append(close,side,main);overlay.append(box);container.append(overlay);
 const bubble=document.createElement('div');bubble.id='npc-bubble';bubble.hidden=true;bubble.setAttribute('aria-live','polite');container.append(bubble);
 close.onclick=()=>end();
 overlay.addEventListener('pointerdown',event=>{if(event.target===overlay)end()});
 text.onclick=()=>finishTyping();

 const PORTRAIT={keeper:{robe:'#cfd2c8',hat:'gat'},officer:{robe:'#3a5b8c',hat:'jeonrip',plume:true},soldier:{robe:'#2e3440',hat:'jeonrip'},merchant:{robe:'#bfa678',hat:'manggeon'},horseDealer:{robe:'#8a6f4e',hat:'paraengi'},walker:{robe:'#d8cdb2',hat:'topknot'}};
 function drawPortrait(kind){
  const p=PORTRAIT[kind]??PORTRAIT.walker,g=portrait.getContext('2d'),W=portrait.width,H=portrait.height;
  const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#e9dcb8');sky.addColorStop(1,'#b99e6a');g.fillStyle=sky;g.fillRect(0,0,W,H);
  g.fillStyle=p.robe;g.beginPath();g.moveTo(10,H);g.quadraticCurveTo(W/2,H*.55,W-10,H);g.fill();
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(W/2-3,H*.72,6,H*.28);
  g.fillStyle='#c9a37f';g.beginPath();g.ellipse(W/2,H*.5,24,29,0,0,Math.PI*2);g.fill();
  g.fillStyle='#2a2320';g.fillRect(W/2-12,H*.47,6,3);g.fillRect(W/2+6,H*.47,6,3);g.fillRect(W/2-6,H*.6,12,2);
  g.fillStyle='#1f1d1c';
  if(p.hat==='gat'){g.fillRect(W/2-44,H*.3,88,5);g.fillRect(W/2-17,H*.1,34,H*.21)}
  else if(p.hat==='jeonrip'){g.beginPath();g.ellipse(W/2,H*.31,46,8,0,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(W/2,H*.27,24,16,0,Math.PI,0);g.fill();if(p.plume){g.fillStyle='#2f7c7a';g.beginPath();g.moveTo(W/2-4,H*.14);g.lineTo(W/2+6,H*.02);g.lineTo(W/2+8,H*.16);g.fill()}}
  else if(p.hat==='paraengi'){g.fillStyle='#b99a62';g.beginPath();g.moveTo(W/2-46,H*.33);g.lineTo(W/2,H*.12);g.lineTo(W/2+46,H*.33);g.closePath();g.fill()}
  else if(p.hat==='manggeon'){g.fillRect(W/2-26,H*.3,52,7);g.beginPath();g.arc(W/2,H*.26,9,0,Math.PI*2);g.fill()}
  else{g.beginPath();g.ellipse(W/2,H*.33,25,12,0,Math.PI,0);g.fill();g.beginPath();g.arc(W/2,H*.2,8,0,Math.PI*2);g.fill()}
  g.strokeStyle='#5a4631';g.lineWidth=4;g.strokeRect(2,2,W-4,H-4);
 }

 function screen(position){const p=v.copy(position).project(camera),r=canvas.getBoundingClientRect();return {x:(p.x+1)*r.width/2,y:(1-p.y)*r.height/2,z:p.z,left:r.left,top:r.top,width:r.width,height:r.height}}
 // Screen-space hit test for a standing figure: a box around its feet-to-head segment with a minimum radius.
 function figureHit(event,feet,height=1.8,maxDistance=150){
  const distance=camera.position.distanceTo(feet);if(distance>maxDistance)return null;
  const a=screen(feet),b=screen(v.clone().copy(feet).setY(feet.y+height));
  if(a.z<-1||a.z>1)return null;
  const radius=Math.max(event.pointerType==='touch'?20:12,Math.abs(a.y-b.y)*.35);
  const ex=event.clientX-a.left,ey=event.clientY-a.top;
  const x0=Math.min(a.x,b.x)-radius,x1=Math.max(a.x,b.x)+radius,y0=Math.min(a.y,b.y)-radius,y1=Math.max(a.y,b.y)+radius;
  return ex>=x0&&ex<=x1&&ey>=y0&&ey<=y1?distance:null;
 }
 function register(provider){providers.push(provider)}
 function pick(event){
  if(current)return true;
  let best=null;
  for(const provider of providers){const hit=provider.pick(event,figureHit);if(hit&&(!best||hit.distance<best.distance))best=hit}
  if(!best)return false;
  start(best.npc);return true;
 }
 function start(npc){
  if((npc.mode??'overlay')==='bubble'){showBubble(npc);return}
  hideBubble();
  current=npc;current.begin?.();
  who.textContent=npc.name;subtitle.textContent=npc.subtitle??'';drawPortrait(npc.portrait);
  overlay.hidden=false;show('hello');
 }
 function showBubble(npc){
  if(bubbleNpc&&bubbleNpc!==npc)bubbleNpc.finish?.();
  bubbleNpc=npc;npc.begin?.();bubble.textContent=npc.nodes.hello.text;bubble.hidden=false;bubbleUntil=performance.now()+4000;placeBubble();
 }
 function hideBubble(){if(!bubbleNpc)return;const npc=bubbleNpc;bubbleNpc=null;bubble.hidden=true;npc.finish?.()}
 function placeBubble(){
  const position=bubbleNpc.position?.();if(!position){hideBubble();return}
  const s=screen(v.clone().copy(position).setY(position.y+2.2));
  if(s.z<-1||s.z>1){bubble.style.visibility='hidden';return}
  bubble.style.visibility='';
  bubble.style.left=Math.max(8,Math.min(s.x-bubble.offsetWidth/2,s.width-bubble.offsetWidth-8))+'px';
  bubble.style.top=Math.max(8,s.y-bubble.offsetHeight-10)+'px';
 }
 function finishTyping(){if(typing){clearInterval(typing.timer);text.textContent=typing.full;typing=null;options.hidden=false}}
 function show(id){
  node=current.nodes[id];
  finishTyping();
  const full=node.text;let shown=0;text.textContent='';options.hidden=true;
  typing={full,timer:setInterval(()=>{shown+=2;text.textContent=full.slice(0,shown);if(shown>=full.length)finishTyping()},25)};
  sources.replaceChildren();sources.hidden=!node.sources?.length;
  if(node.sources?.length){sources.append((node.year?node.year+' · ':'')+t('출처: '));node.sources.forEach((s,i)=>{const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=s.title;if(i)sources.append(', ');sources.append(a)})}
  options.replaceChildren();
  (node.options??[{label:t('잘 있으시오.'),action:'close'}]).forEach((option,i)=>{
   const li=document.createElement('li'),button=document.createElement('button');button.type='button';
   button.textContent=`${i+1}. ${option.label}`;button.onclick=()=>choose(option);li.append(button);options.append(li);
  });
 }
 function choose(option){
  if(option.next)show(option.next);
  else if(option.action==='close')end();
  else{const npc=current;end();onAction?.(option.action,npc)}
 }
 function end(){
  if(!current)return;const npc=current;finishTyping();current=null;node=null;overlay.hidden=true;npc.finish?.();
 }
 document.addEventListener('keydown',event=>{
  if(!current||event.target.matches?.('input,textarea,select'))return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();end();return}
  if(event.key===' '&&typing){event.preventDefault();finishTyping();return}
  const n=Number(event.key);const list=node?.options;
  if(!typing&&list&&n>=1&&n<=list.length){event.preventDefault();choose(list[n-1])}
 },true);
 function update(){
  if(bubbleNpc){if(performance.now()>bubbleUntil)hideBubble();else placeBubble()}
  if(!current)return;
  const position=current.position?.();
  if(!position||camera.position.distanceTo(position)>(current.maxDistance??150)){end();return}
  current.face?.(camera.position);
 }
 return {register,pick,start,end,update,finishTyping,figureHit,get current(){return current},get node(){return node},get bubbleNpc(){return bubbleNpc},overlay,box,bubble};
}
