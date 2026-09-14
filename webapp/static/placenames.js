import * as THREE from 'three';

// Neighbourhood names read on 도성대지도 (坊, 契, 洞 and village names). There are no buildings behind them,
// so each name is a clickable text label; the card shows the description built with the data.
const STYLE={
 bang:{fill:'#6b4a12',stroke:'rgba(255,244,214,.95)',font:'700 24px system-ui',reach:9000,rank:0},
 gye:{fill:'#2c5a78',stroke:'rgba(255,253,243,.9)',font:'500 21px system-ui',reach:1700,rank:1},
 dong:{fill:'#4f5a55',stroke:'rgba(255,253,243,.9)',font:'italic 500 20px system-ui',reach:1100,rank:2},
 other:{fill:'#4f5a55',stroke:'rgba(255,253,243,.9)',font:'italic 500 20px system-ui',reach:2600,rank:2},
};
function sprite(text,style){
 const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 ctx.font=style.font;canvas.width=Math.ceil(ctx.measureText(text).width)+8;canvas.height=34;
 ctx.font=style.font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.strokeStyle=style.stroke;ctx.lineWidth=4;ctx.strokeText(text,canvas.width/2,17);ctx.fillStyle=style.fill;ctx.fillText(text,canvas.width/2,17);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,sizeAttenuation:false}));
 tag.center.set(.5,0);tag.renderOrder=6;return {tag,aspect:canvas.width/canvas.height,height:canvas.height};
}

export function createPlaceNames(data,{warp,world,height,camera,canvas}){
 const group=new THREE.Group();group.name='place-name-labels';
 const labels=data.features.map(feature=>{
  const style=STYLE[feature.kind]??STYLE.other,[x,y]=warp(...feature.pixel);
  const {tag,aspect,height:px}=sprite(feature.name,style);
  // Cards read the same fields as building cards; there is no footprint or source reference link.
  tag.userData={feature:{...feature,note:feature.info.summary,placeName:true},x,y,base:height(x,y),aspect,px,reach:style.reach,rank:style.rank};
  group.add(tag);return tag;
 });
 // Draw order: 坊 first, then 契, then 洞 and villages; nearer labels win within a rank.
 labels.sort((a,b)=>a.userData.rank-b.userData.rank);
 const v=new THREE.Vector3(),cells=new Map(),cell=48;
 function update(scale,enabled){
  group.visible=enabled;if(!enabled)return;
  const r=canvas.getBoundingClientRect();cells.clear();
  const candidates=[];
  for(const tag of labels){
   const u=tag.userData;tag.position.set(...world(u.x,u.y,u.base+14));tag.scale.set(scale*u.aspect,scale,1);
   const d=camera.position.distanceTo(tag.position);tag.visible=false;
   if(d>=u.reach)continue;
   v.copy(tag.position).project(camera);if(v.z<-1||v.z>1||Math.abs(v.x)>1.1||Math.abs(v.y)>1.1)continue;
   candidates.push({tag,d,sx:(v.x+1)*r.width/2,sy:(1-v.y)*r.height/2});
  }
  candidates.sort((a,b)=>a.tag.userData.rank-b.tag.userData.rank||a.d-b.d);
  // Hide a label that would overlap one already shown, using a coarse screen grid.
  for(const c of candidates){
   const h=c.tag.userData.px*.7,w=h*c.tag.userData.aspect,box=[c.sx-w/2-2,c.sy-h-2,c.sx+w/2+2,c.sy+2];
   const keys=[];let clash=false;
   for(let gx=Math.floor(box[0]/cell);gx<=Math.floor(box[2]/cell)&&!clash;gx++)for(let gy=Math.floor(box[1]/cell);gy<=Math.floor(box[3]/cell)&&!clash;gy++){
    const key=gx+','+gy;keys.push(key);
    for(const o of cells.get(key)??[])if(box[0]<o[2]&&box[2]>o[0]&&box[1]<o[3]&&box[3]>o[1]){clash=true;break}
   }
   if(clash)continue;
   c.tag.visible=true;for(const key of keys){if(!cells.has(key))cells.set(key,[]);cells.get(key).push(box)}
  }
 }
 // Screen-space picking: a label is hit when the pointer lies inside its drawn text box.
 function pick(event){
  if(!group.visible)return null;
  const r=canvas.getBoundingClientRect(),v=new THREE.Vector3();let best=null,bestDistance=Infinity;
  for(const tag of labels){
   if(!tag.visible)continue;
   v.copy(tag.position).project(camera);if(v.z<-1||v.z>1)continue;
   const sx=r.left+(v.x+1)*r.width/2,sy=r.top+(1-v.y)*r.height/2,h=tag.userData.px*.7,w=h*tag.userData.aspect;
   if(Math.abs(event.clientX-sx)<=w/2+4&&event.clientY<=sy+4&&event.clientY>=sy-h-4){
    const d=camera.position.distanceTo(tag.position);if(d<bestDistance){best=tag;bestDistance=d}
   }
  }
  return best;
 }
 return {group,labels,update,pick};
}
