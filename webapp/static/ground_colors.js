import * as THREE from 'three';

// A static, soft woodland mask from the trees that were actually placed.
// It changes the ground material only; map opacity and geometry stay independent.
export function createGroundColors(material,geometry,trees){
 geometry.computeBoundingBox();const bounds=geometry.boundingBox;
 const min=new THREE.Vector2(bounds.min.x,bounds.min.z),size=new THREE.Vector2(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,2048,2048);
 const sx=2048/size.x,sy=2048/size.y;
 for(const tree of trees){
  const radius=Math.max(24,tree.radius*3.5),x=(tree.x-min.x)*sx,y=(tree.z-min.y)*sy;
  ctx.save();ctx.translate(x,y);ctx.scale(sx,sy);
  const gradient=ctx.createRadialGradient(0,0,radius*.2,0,0,radius);
  gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(-radius,-radius,radius*2,radius*2);ctx.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;
 const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
 material.onBeforeCompile=shader=>{
  compile.call(material,shader);
  Object.assign(shader.uniforms,{woodlandMask:{value:texture},woodlandMin:{value:min},woodlandSize:{value:size},woodlandColor:{value:new THREE.Color('#668347')}});
  shader.vertexShader='varying vec2 vWoodlandPosition;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvWoodlandPosition=(modelMatrix*vec4(transformed,1.)).xz;');
  shader.fragmentShader='varying vec2 vWoodlandPosition;\nuniform sampler2D woodlandMask;\nuniform vec2 woodlandMin;\nuniform vec2 woodlandSize;\nuniform vec3 woodlandColor;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
#ifndef USE_MAP
 vec2 woodlandUV=(vWoodlandPosition-woodlandMin)/woodlandSize;
 woodlandUV.y=1.-woodlandUV.y;
 float woodland=texture2D(woodlandMask,woodlandUV).r;
 diffuseColor.rgb=mix(diffuseColor.rgb,woodlandColor,woodland*.92);
#endif
`);
 };
 material.customProgramCacheKey=()=>cacheKey+'-woodland-v1';material.needsUpdate=true;
 return {canvas,texture,min,size,treeCount:trees.length};
}
