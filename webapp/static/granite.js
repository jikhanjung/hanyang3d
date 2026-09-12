import * as THREE from 'three';

// Approximate outcrop envelopes around existing source-map mountain anchors.
// These are visual material hints, not surveyed geological or historical boundaries.
export function createGranite(materials,sourceSurface){
 const patches=[
  {id:'inwang',name:'인왕산',pixel:[650,890],radius:[125,190]},
  {id:'baegak',name:'북악산',pixel:[1080,490],radius:[145,130]},
 ].map(r=>{
  const centre=sourceSurface(...r.pixel),u=sourceSurface(r.pixel[0]+r.radius[0],r.pixel[1]).sub(centre),v=sourceSurface(r.pixel[0],r.pixel[1]+r.radius[1]).sub(centre),det=u.x*v.z-u.z*v.x;
  return {...r,centre,inverse:new THREE.Vector4(v.z/det,-v.x/det,-u.z/det,u.x/det)};
 });
 const uniforms={rockEnabled:{value:1},rockHeightScale:{value:1},rockCentres:{value:patches.map(p=>new THREE.Vector2(p.centre.x,p.centre.z))},rockInverse:{value:patches.map(p=>p.inverse)}};
 const definitions=`
 varying vec3 vRockPosition;
 uniform float rockEnabled;
 uniform float rockHeightScale;
 uniform vec2 rockCentres[2];
 uniform vec4 rockInverse[2];
 float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float rockNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);
 }
 `;
 const colour=`
 float rockMask=0.;
 vec3 rockP=vec3(vRockPosition.x,vRockPosition.y/rockHeightScale,vRockPosition.z);
 for(int i=0;i<2;i++){
  vec2 d=rockP.xz-rockCentres[i];vec4 inv=rockInverse[i];vec2 q=vec2(dot(inv.xy,d),dot(inv.zw,d));
  rockMask=max(rockMask,1.-smoothstep(.5,1.05,length(q)+(rockNoise(rockP*.018)-.5)*.22));
 }
 rockMask*=rockEnabled*smoothstep(150.,240.,rockP.y);
 if(rockMask>.001){
  // Broad 60–100 m pale masses carry the distant silhouette and tone.
  float mass=smoothstep(.25,.76,rockNoise(rockP*.011));
  vec3 stone=vec3(.48,.49,.48)+vec3(mass*.16);
  stone+=vec3((rockNoise(rockP*.028)-.5)*.035);
  float pixelFootprint=length(fwidth(rockP));
  float detail=(1.-smoothstep(25.,140.,length(vViewPosition)))*(1.-smoothstep(.035,.16,pixelFootprint));
  if(detail>.001){
   float fleck=rockNoise(rockP*6.),fine=rockNoise(rockP*42.);
   vec3 grain=vec3(.13)*smoothstep(.55,.8,fleck)-vec3(.17)*(1.-smoothstep(.22,.4,fleck));
   grain+=vec3((fine-.5)*.12*(1.-smoothstep(.008,.04,pixelFootprint)));
   stone+=grain*detail;
  }
  // Few broad, softly shaded joints instead of a distant field of hairline cracks.
  float joint=abs(sin(rockP.x*.035+rockP.z*.022+rockNoise(rockP*.009)*1.4));
  float jointWidth=max(.035,fwidth(joint));
  stone*=1.-.1*(1.-smoothstep(jointWidth,jointWidth*3.,joint));
  diffuseColor.rgb=mix(diffuseColor.rgb,stone,rockMask*.94);
 }
 `;
 for(const material of materials){
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 vRockPosition;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvRockPosition=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader=definitions+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+colour);
  };
  material.customProgramCacheKey=()=> 'doseong-granite-v2';material.needsUpdate=true;
 }
 function treeProbability(point){
  let mask=0;
  for(const patch of patches){
   const x=point.x-patch.centre.x,z=point.z-patch.centre.z,v=patch.inverse;
   const radius=Math.hypot(v.x*x+v.y*z,v.z*x+v.w*z);
   mask=Math.max(mask,1-THREE.MathUtils.smoothstep(radius,.5,1.05));
  }
  mask*=THREE.MathUtils.smoothstep(point.y,150,240);
  return 1-.75*mask;
 }
 return {patches,treeProbability,setHeight:value=>{uniforms.rockHeightScale.value=value},setEnabled:value=>{uniforms.rockEnabled.value=value?1:0},get enabled(){return !!uniforms.rockEnabled.value}};
}
