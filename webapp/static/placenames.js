import * as THREE from 'three';

// Neighbourhood names read on 도성대지도 (坊, 契, 洞 and village names). There are no buildings behind them,
// so each name is a clickable text label; the card shows the description built with the data.
const STYLE={
 bang:{fill:'#6b4a12',stroke:'rgba(255,244,214,.95)',font:'700 24px system-ui'},
 gye:{fill:'#2c5a78',stroke:'rgba(255,253,243,.9)',font:'500 21px system-ui'},
 dong:{fill:'#4f5a55',stroke:'rgba(255,253,243,.9)',font:'italic 500 20px system-ui'},
 other:{fill:'#4f5a55',stroke:'rgba(255,253,243,.9)',font:'italic 500 20px system-ui'},
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
  const {tag,aspect,height:px}=sprite(document.documentElement.lang==='en'&&feature.name_en?feature.name_en:feature.name,style);
  // Cards read the same fields as building cards; there is no footprint or source reference link.
  tag.userData={feature:{...feature,note:feature.info.summary,placeName:true},x,y,base:height(x,y),aspect,px};
  group.add(tag);return tag;
 });
 // Levels for the shared label ranking in terrain3d.js: 坊 1, 契 and villages 3, 洞 4.
 const LEVEL={bang:1,gye:3,other:3,dong:4};
 for(const tag of labels)tag.userData.level=LEVEL[tag.userData.feature.kind]??3;
 // Position every label for this frame; terrain3d.js decides which ones are shown.
 function place(enabled){
  group.visible=enabled;
  for(const tag of labels)tag.visible=false;
  if(!enabled)return [];
  return labels.map(tag=>{const u=tag.userData;tag.position.set(...world(u.x,u.y,u.base+14));return {tag,aspect:u.aspect,level:u.level}});
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
 return {group,labels,place,pick};
}
