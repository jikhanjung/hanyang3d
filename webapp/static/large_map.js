import {t} from './i18n.js';

// Flat source maps stay rectangular; only world markers are inverse-calibrated.
export function createLargeMap({source,container,getPose,onOpen,returnFocus}){
 const flat=source.flatMap;
 const panel=document.createElement('section');panel.id='large-map';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',t('전체 지도'));
 const header=document.createElement('header'),title=document.createElement('strong'),close=document.createElement('button');title.textContent=t('전체 지도');close.type='button';close.textContent=t('닫기')+' · M / Esc';header.append(title,close);
 const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',t('현재 위치와 시선 방향을 표시하는 지도'));
 const status=document.createElement('p');status.setAttribute('role','status');panel.append(header,canvas,status);container.append(panel);
 const ctx=canvas.getContext('2d');let last='';
 function hide(){panel.hidden=true;returnFocus()}
 function update(){
  if(panel.hidden)return;const {at,yaw,walking}=getPose(),rect=canvas.getBoundingClientRect(),w=Math.round(rect.width),h=Math.round(rect.height),key=[at.x,at.z,yaw,walking,w,h].join(',');if(key===last)return;last=key;
  canvas.width=Math.max(1,w*devicePixelRatio);canvas.height=Math.max(1,h*devicePixelRatio);ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.fillStyle='#ded1ad';ctx.fillRect(0,0,w,h);
  const [left,top,right,bottom]=flat.crop,bw=right-left,bh=bottom-top,fit=Math.min((w-16)/bw,(h-16)/bh),dx=(w-bw*fit)/2,dy=(h-bh*fit)/2;
  const mapPoint=p=>[dx+(p[0]-left)*fit,dy+(p[1]-top)*fit];
  ctx.drawImage(flat.image,left,top,bw,bh,dx,dy,bw*fit,bh*fit);
  ctx.save();ctx.beginPath();ctx.rect(dx,dy,bw*fit,bh*fit);ctx.clip();
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const road of flat.roads){
   const points=road.points.map(mapPoint);if(points.length<2)continue;
   ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));
   ctx.strokeStyle='#fff3cdcc';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#9b492d';ctx.lineWidth=2;ctx.stroke();
  }
  const occupied=[],font=w<600?11:13;ctx.font=`bold ${font}px system-ui`;ctx.textBaseline='middle';
  let count=0;
  for(const landmark of flat.landmarks){
   const [x,y]=mapPoint(landmark.pixel);if(x<dx||x>dx+bw*fit||y<dy||y>dy+bh*fit)continue;
   ctx.fillStyle='#174d41';ctx.strokeStyle='#fff4d7';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();ctx.stroke();
   const text=landmark.name,width=ctx.measureText(text).width;
   for(const [ox,oy] of [[7,0],[7,-15],[7,15],[-width-7,0],[-width/2,-16],[-width/2,16]]){
    const bx=x+ox,by=y+oy;
    if(bx<dx+2||bx+width>dx+bw*fit-2||by-font/2<dy||by+font/2>dy+bh*fit||occupied.some(b=>bx<b.x+b.w+4&&bx+width>b.x-4&&Math.abs(by-b.y)<font+4))continue;
    ctx.strokeStyle='#fff4df';ctx.lineWidth=3.5;ctx.strokeText(text,bx,by);ctx.fillStyle='#183c32';ctx.fillText(text,bx,by);occupied.push({x:bx,y:by,w:width});count++;break;
   }
  }
  ctx.restore();
  const pixel=flat.toPixel(at),aim=flat.toPixel({x:at.x-Math.sin(yaw)*20,z:at.z-Math.cos(yaw)*20});
  let x=null,y=null,outside=!pixel;
  if(pixel){
   [x,y]=mapPoint(pixel);outside=x<dx||x>dx+bw*fit||y<dy||y>dy+bh*fit;
   x=Math.max(dx+10,Math.min(dx+bw*fit-10,x));y=Math.max(dy+12,Math.min(dy+bh*fit-12,y));
   const angle=aim?Math.atan2(aim[1]-pixel[1],aim[0]-pixel[0])+Math.PI/2:0;
   ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle='#008ce055';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,32,-Math.PI/2-.5,-Math.PI/2+.5);ctx.closePath();ctx.fill();ctx.fillStyle='#d32821';ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(8,8);ctx.lineTo(0,4);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  status.textContent=t(outside?'지도 범위 밖':walking?'현재 위치':'현재 시점의 중심')+' · '+t('큰 길 · 주요 랜드마크');
  Object.assign(canvas.dataset,{worldX:at.x,worldZ:at.z,markerX:x??'',markerY:y??'',crop:flat.crop.join(','),mapRect:[dx,dy,bw*fit,bh*fit].join(','),roadCount:flat.roads.length,landmarkCount:flat.landmarks.length,labelCount:count});

 }
 function show(){onOpen();panel.hidden=false;last='';update();close.focus({preventScroll:true})}
 close.onclick=hide;
 document.addEventListener('keydown',event=>{
  if(event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.target.closest?.('input,textarea,select,[contenteditable="true"],#account-overlay,#npc-overlay'))return;
  if(event.code==='KeyM'||(!panel.hidden&&event.code==='Escape')){event.preventDefault();event.stopImmediatePropagation();if(event.repeat)return;panel.hidden?show():hide();return}
  if(!panel.hidden){if(event.code==='Tab'){event.preventDefault();close.focus()}event.stopImmediatePropagation()}
 },true);
 for(const type of ['pointerdown','pointerup','wheel'])panel.addEventListener(type,e=>e.stopPropagation());
 return {update,hide,get visible(){return !panel.hidden}};
}
