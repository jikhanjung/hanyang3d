import * as THREE from 'three';
import './channel_terrain.js';
import {surfaceIndex} from './city_wall.js';

// A conceptual 2 m bed, not a historical depth measurement. Refine only near
// the traced stream so the visible terrain and the walking support agree.
export function createChannel1907(river,baseGeometry,sourceSurface,baseGround){
 const path=[];
 for(let i=0;i<river.centerline.length-1;i++){
  const a=river.centerline[i],b=river.centerline[i+1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),steps=Math.ceil(length/3);
  for(let j=0;j<steps+(i===river.centerline.length-2?1:0);j++){
   const t=j/steps,width=THREE.MathUtils.lerp(river.half_widths_px[i],river.half_widths_px[i+1],t),x=a[0]+dx*t,y=a[1]+dy*t;
   const left=sourceSurface(x-dy/length*width,y+dx/length*width),right=sourceSurface(x+dy/length*width,y-dx/length*width),mid=left.clone().add(right).multiplyScalar(.5);
   path.push({x:mid.x,z:mid.z,level:mid.y+.08,width:Math.hypot(left.x-right.x,left.z-right.z)/2,left,right});
  }
 }
 const C=globalThis.ChannelTerrain,grid=C.segmentGrid(path),reach=Math.max(...path.map(p=>p.width))+20;
 const match=(x,z)=>C.nearestWithin(x,z,grid,reach);
 const raw={positions:baseGeometry.attributes.position.array,index:baseGeometry.index.array,uv:baseGeometry.attributes.uv.array,colors:new Float32Array(baseGeometry.attributes.position.count*3).fill(1)};
 const refined=C.weld(C.refine(raw,path));
 for(let i=0;i<refined.positions.length;i+=3){
  const x=refined.positions[i],z=refined.positions[i+2],m=match(x,z);
  if(m.distance>=m.width)continue;
  const fade=Math.min(1,(m.width-m.distance)/Math.min(4,m.width*.45)),blend=fade*fade*(3-2*fade);
  refined.positions[i+1]+=Math.min(0,m.level-2-refined.positions[i+1])*blend;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(refined.positions,3));geometry.setAttribute('uv',new THREE.BufferAttribute(refined.uv,2));geometry.setIndex(new THREE.BufferAttribute(refined.index,1));geometry.computeVertexNormals();
 const nearby=surfaceIndex([{positions:refined.positions,index:refined.index}]);
 function groundAt(x,z){
  const base=baseGround(x,z);if(base===null)return null;
  const m=match(x,z);if(m.distance>m.width+8||!Number.isFinite(m.distance))return base;
  const [{positions:p,index}]=nearby(x,z,0);
  for(let i=0;i<index.length;i+=3){
   const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3,dx=p[b]-p[a],dz=p[b+2]-p[a+2],ex=p[c]-p[a],ez=p[c+2]-p[a+2],det=dx*ez-dz*ex;
   if(Math.abs(det)<1e-9)continue;
   const u=((x-p[a])*ez-(z-p[a+2])*ex)/det,v=(dx*(z-p[a+2])-dz*(x-p[a]))/det;
   if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)return p[a+1]+u*(p[b+1]-p[a+1])+v*(p[c+1]-p[a+1]);
  }
  return base;
 }
 return {geometry,groundAt,path,depth:2};
}
