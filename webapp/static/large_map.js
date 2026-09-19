import {t} from './i18n.js';

// Both eras use their calibrated, north-up minimap image and world coordinates.
export function createLargeMap({source,container,getPose,onOpen,returnFocus}){
 let bounds={minX:source.minX,minZ:source.minZ,maxX:source.maxX,maxZ:source.maxZ};
 const positions=source.geometry?.attributes.position,uv=source.geometry?.attributes.uv;
 if(positions&&uv){const b={minX:Infinity,minZ:Infinity,maxX:-Infinity,maxZ:-Infinity};for(let i=0;i<positions.count;i++){if(uv.getX(i)<0||uv.getX(i)>1||uv.getY(i)<0||uv.getY(i)>1)continue;b.minX=Math.min(b.minX,positions.getX(i));b.maxX=Math.max(b.maxX,positions.getX(i));b.minZ=Math.min(b.minZ,positions.getZ(i));b.maxZ=Math.max(b.maxZ,positions.getZ(i))}if(b.maxX>b.minX&&b.maxZ>b.minZ)bounds=b}
 const panel=document.createElement('section');panel.id='large-map';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',t('전체 지도'));
 const header=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');title.textContent=t('전체 지도');close.type='button';close.textContent=t('닫기')+' · M / Esc';header.append(title,close);
 const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('현재 위치와 시선 방향을 표시하는 지도'));
 const status=document.createElement('p');status.setAttribute('role','status');panel.append(header,canvas,status);container.append(panel);
 const ctx=canvas.getContext('2d');let last='';
 function hide(){panel.hidden=true;returnFocus()}
 function update(){
  if(panel.hidden)return;const {at,yaw,walking}=getPose(),rect=canvas.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height),key=[at.x,at.z,yaw,walking,w,h].join(',');if(key===last)return;last=key;
  canvas.width=Math.max(1,w*devicePixelRatio);canvas.height=Math.max(1,h*devicePixelRatio);ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle='#ded1ad';ctx.fillRect(0,0,w,h);
  const {image,scale}=source,minX=Math.min(bounds.minX,at.x-30),minZ=Math.min(bounds.minZ,at.z-30),maxX=Math.max(bounds.maxX,at.x+30),maxZ=Math.max(bounds.maxZ,at.z+30),bw=(maxX-minX)*scale,bh=(maxZ-minZ)*scale,fit=Math.min((w-24)/bw,(h-24)/bh),dx=(w-bw*fit)/2,dy=(h-bh*fit)/2;
  ctx.drawImage(image,(minX-source.minX)*scale,(minZ-source.minZ)*scale,bw,bh,dx,dy,bw*fit,bh*fit);
  const x=dx+(at.x-minX)*scale*fit,y=dy+(at.z-minZ)*scale*fit;
  ctx.save();ctx.translate(x,y);ctx.rotate(-yaw);ctx.fillStyle='#008ce055';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,32,-Math.PI/2-.5,-Math.PI/2+.5);ctx.closePath();ctx.fill();ctx.fillStyle='#d32821';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(8,8);ctx.lineTo(0,4);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  ctx.fillStyle='#263829';ctx.font='bold 14px system-ui';ctx.fillText('N ↑',12,21);
  status.textContent=t(walking?'현재 위치':'현재 시점의 중심');canvas.dataset.worldX=at.x;canvas.dataset.worldZ=at.z;canvas.dataset.markerX=x;canvas.dataset.markerY=y;
 }
 function show(){source.prepare();onOpen();panel.hidden=false;last='';update();close.focus({preventScroll:true})}
 close.onclick=hide;
 document.addEventListener('keydown',event=>{
  if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input,textarea,select,[contenteditable="true"],#account-overlay,#npc-overlay'))return;
  if(event.code==='KeyM'||(!panel.hidden&&event.code==='Escape')){event.preventDefault();event.stopImmediatePropagation();if(event.repeat)return;panel.hidden?show():hide();return}
  if(!panel.hidden){if(event.code==='Tab'){event.preventDefault();close.focus()}event.stopImmediatePropagation()}
 },true);
 for(const type of ['pointerdown','pointerup','wheel'])panel.addEventListener(type,e=>e.stopPropagation());
 return {update,hide,get visible(){return !panel.hidden}};
}
