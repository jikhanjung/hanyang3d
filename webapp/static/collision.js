// Flat 2D collision for walking: oriented rectangles on the ground plane, bucketed in a grid.
// Each obstacle is {x,z,hw,hd,yaw,visible?} with local X along hw and local Z along hd,
// matching three.js rotation.y (local +X -> (cos, -sin), local +Z -> (sin, cos)).
export function createCollision(cell=16){
 const grid=new Map(),obstacles=[];
 const key=(i,j)=>i+','+j;
 function add(o){
  o.c=Math.cos(o.yaw);o.s=Math.sin(o.yaw);o.r=Math.hypot(o.hw,o.hd);
  for(let i=Math.floor((o.x-o.r)/cell);i<=Math.floor((o.x+o.r)/cell);i++)
   for(let j=Math.floor((o.z-o.r)/cell);j<=Math.floor((o.z+o.r)/cell);j++){
    const k=key(i,j);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(o);
   }
  obstacles.push(o);return o;
 }
 // Rectangle given in another object's local frame (e.g. one wall of a compound).
 function addLocal(frame,lx,lz,hw,hd,visible){
  const c=Math.cos(frame.yaw),s=Math.sin(frame.yaw);
  return add({x:frame.x+lx*c+lz*s,z:frame.z-lx*s+lz*c,hw,hd,yaw:frame.yaw,visible});
 }
 function hit(x,z,radius){
  const ci=Math.floor(x/cell),cj=Math.floor(z/cell);
  for(let i=ci-1;i<=ci+1;i++)for(let j=cj-1;j<=cj+1;j++)for(const o of grid.get(key(i,j))??[]){
   if(Math.abs(x-o.x)>o.r+radius||Math.abs(z-o.z)>o.r+radius)continue;
   if(o.visible&&!o.visible())continue;
   const dx=x-o.x,dz=z-o.z,lx=dx*o.c-dz*o.s,lz=dx*o.s+dz*o.c;
   const qx=Math.max(Math.abs(lx)-o.hw,0),qz=Math.max(Math.abs(lz)-o.hd,0);
   if(qx*qx+qz*qz<radius*radius)return o;
  }
  return null;
 }
 // Slide along obstacles: try the full step, then each axis on its own.
 function move(x,z,nx,nz,radius,extraBlocked){
  const blocked=(px,pz)=>!!hit(px,pz,radius)||!!extraBlocked?.(px,pz);
  if(!blocked(nx,nz))return [nx,nz];
  if(!blocked(nx,z))return [nx,z];
  if(!blocked(x,nz))return [x,nz];
  return [x,z];
 }
 function clear(){grid.clear();obstacles.length=0}
 return {add,addLocal,hit,move,clear,obstacles};
}
