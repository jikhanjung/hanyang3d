import * as THREE from 'three';

// A yellow question mark that floats over the person the current task points to, and the same mark drawn small
// on the minimap and the large map. Not a reward or shop sign: it only says "talk to this person next".
const COLORS={fill:'#f4c542',edge:'#4a3608'};
let texture=null;
function markTexture(){
 if(texture)return texture;
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 g.font='bold 104px system-ui, sans-serif';g.textAlign='center';g.textBaseline='middle';
 g.lineJoin='round';g.lineWidth=14;g.strokeStyle=COLORS.edge;g.strokeText('?',64,70);g.fillStyle=COLORS.fill;g.fillText('?',64,70);
 texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
export function createQuestMarker(){
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:markTexture(),transparent:true,depthTest:false}));
 sprite.name='quest-marker';sprite.scale.set(1.1,1.1,1);sprite.renderOrder=20;sprite.visible=false;
 let target=null,time=0;
 return {sprite,
  follow(object){target=object;sprite.visible=!!object},
  update(dt){if(!target||!sprite.visible)return;time+=dt;sprite.position.copy(target.position);sprite.position.y+=2.55+Math.sin(time*3)*.12},
 };
}
// Shared 2D mark for both maps; `size` is the glyph height in canvas pixels.
export function drawQuestMark(ctx,x,y,size){
 ctx.save();ctx.font=`bold ${size}px system-ui, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 ctx.lineWidth=Math.max(2,size*.18);ctx.strokeStyle=COLORS.edge;ctx.strokeText('?',x,y);ctx.fillStyle=COLORS.fill;ctx.fillText('?',x,y);ctx.restore();
}
