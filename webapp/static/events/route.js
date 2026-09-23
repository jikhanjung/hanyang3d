import * as THREE from 'three';

// Shared by stage modules that move people along a checkpointed route (a procession, a group to shadow).
// Route points are original-map pixels, a bridge approach, or the front of a building; consecutive points are joined
// by a straight line when it is passable, otherwise by a short A* detour that respects the current walls and
// buildings. It never falls back to moving through solids: an unreachable point is reported as an error.
export function buildRoute(api,points){
 const {say,safe,surface,infrastructure,buildings}=api;
 function connect(a,b,label=''){
  const span=a.distanceTo(b),steps=Math.ceil(span/2),direct=Array.from({length:steps+1},(_,i)=>a.clone().lerp(b,i/steps));if(direct.every(safe))return direct;
  const step=3,margin=60,minX=Math.min(a.x,b.x)-margin,minZ=Math.min(a.z,b.z)-margin,maxX=Math.max(a.x,b.x)+margin,maxZ=Math.max(a.z,b.z)+margin;
  const point=(x,z)=>new THREE.Vector3(minX+x*step,0,minZ+z*step),cell=p=>[Math.round((p.x-minX)/step),Math.round((p.z-minZ)/step)],startCell=cell(a),goalCell=cell(b),key=(x,z)=>x+','+z;
  const nodes=new Map(),open=[];const seed={x:startCell[0],z:startCell[1],g:0,f:0,parent:null};open.push(seed);nodes.set(key(seed.x,seed.z),seed);
  for(let count=0;open.length&&count<18000;count++){
   let bi=0;for(let i=1;i<open.length;i++)if(open[i].f<open[bi].f)bi=i;const n=open.splice(bi,1)[0];if(n.closed)continue;n.closed=true;
   if(n.x===goalCell[0]&&n.z===goalCell[1]){const result=[b];for(let c=n;c;c=c.parent)result.push(point(c.x,c.z));result.push(a);return result.reverse()}
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const x=n.x+dx,z=n.z+dz,p=point(x,z);if(p.x<minX||p.x>maxX||p.z<minZ||p.z>maxZ||!safe(p))continue;
    if(dx&&dz&&(!safe(point(n.x+dx,n.z))||!safe(point(n.x,n.z+dz))))continue;
    const k=key(x,z),prev=nodes.get(k),g=n.g+Math.hypot(dx,dz);if(prev&&g>=prev.g)continue;
    const v={x,z,g,f:g+Math.hypot(x-goalCell[0],z-goalCell[1]),parent:n};nodes.set(k,v);open.push(v);
   }
  }
  throw Error(say(`통과할 길을 찾지 못했습니다(${label}). 회상 경로 점검이 필요합니다.`,`No passable route (${label}). This reconstruction needs a route check.`));
 }
 const nodes=points.map((r,i)=>{
  let p;
  if(r.bridge_id){const bridge=infrastructure.bridges.getObjectByName(r.bridge_id);bridge.updateWorldMatrix(true,false);p=bridge.localToWorld(new THREE.Vector3(0,0,r.bridge_side*bridge.userData.approachDistance))}
  else if(r.building_front){const b=buildings.find(b=>b.userData.feature.id===r.building_front);b.updateWorldMatrix(true,false);p=b.localToWorld(new THREE.Vector3(0,0,25))}
  else p=surface(...r.pixel);
  p.y=0;
  if(!safe(p))throw Error(say(`확인 지점 ${i+1}(${r.name})이 건물과 겹칩니다. 경로 점검이 필요합니다.`,`Checkpoint ${i+1} (${r.name_en??r.name}) overlaps an obstacle.`));
  return p;
 });
 // Two consecutive points on the same bridge are its two ends: take first the end nearer where the route comes from,
 // so the route crosses once instead of stepping over and back.
 for(let i=0;i+1<points.length;i++){
  const a=points[i],b=points[i+1];if(!a.bridge_id||a.bridge_id!==b.bridge_id)continue;
  const from=i>0?nodes[i-1]:null,[x,y]=[nodes[i],nodes[i+1]];
  if(from&&from.distanceTo(y)<from.distanceTo(x)){nodes[i]=y;nodes[i+1]=x}
 }
 const clear=(a,b)=>{const n=Math.max(1,Math.ceil(a.distanceTo(b)));for(let k=1;k<n;k++)if(!safe(a.clone().lerp(b,k/n)))return false;return true};
 // Grid detours are jagged: pull each section taut where a straight line is passable (looking a limited way ahead).
 function taut(section){
  const out=[section[0]];let i=0;
  while(i<section.length-1){let j=Math.min(section.length-1,i+60);while(j>i+1&&!clear(section[i],section[j]))j--;out.push(section[j]);i=j}
  return out;
 }
 let path=[];
 for(let i=0;i<nodes.length;i++){if(i)path.push(...taut(connect(nodes[i-1],nodes[i],`${points[i-1].name} → ${points[i].name}`)).slice(1));else path.push(nodes[i])}
 // Smooth the corners between sections too: resample every 2 m, then round corners (Chaikin), keeping any rounded
 // point only where it is passable, so the group turns in arcs rather than snapping to a new heading at each point.
 // Even spacing by arc length (short Chaikin segments are merged, long straight ones split).
 const resample=(pts,step=2)=>{
  const out=[pts[0].clone()];let carry=0;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=a.distanceTo(b);let t=step-carry;while(t<=len){out.push(a.clone().lerp(b,t/len));t+=step}carry=len-(t-step)}
  if(out.at(-1).distanceTo(pts.at(-1))>.2)out.push(pts.at(-1).clone());return out};
 path=resample(path);
 for(let pass=0;pass<3;pass++){
  const out=[path[0]];
  for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],q=a.clone().lerp(b,.25),r=a.clone().lerp(b,.75);out.push(safe(q)?q:a.clone(),safe(r)?r:b.clone())}
  out.push(path.at(-1));path=resample(out.filter((p,i)=>i===0||p.distanceTo(out[i-1])>.05),2);
 }
 const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i].distanceTo(path[i-1]));
 // Checkpoints sit where the smoothed route passes closest to each original point, in order.
 const milestones=[];let from=0;
 for(const n of nodes){let best=from,bd=Infinity;for(let i=from;i<path.length;i++){const d=path[i].distanceTo(n);if(d<bd){bd=d;best=i}if(d>bd+60)break}milestones.push(lengths[best]);from=best}
 const total=lengths.at(-1);
 function sample(s){
  s=Math.max(0,Math.min(s,total));let lo=1,hi=lengths.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(lengths[mid]<s)lo=mid+1;else hi=mid}const i=lo;
  const a=path[i-1],b=path[i],p=a.clone().lerp(b,(s-lengths[i-1])/Math.max(.0001,lengths[i]-lengths[i-1]));return {p,yaw:Math.atan2(b.x-a.x,b.z-a.z)};
 }
 return {path,lengths,milestones,total,sample,nodes};
}
