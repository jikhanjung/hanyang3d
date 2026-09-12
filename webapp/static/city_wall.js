import * as THREE from 'three';

// Clip a line against an oriented gate footprint; retain only the wall outside it.
function outside(a,b,gap){
 const c=Math.cos(gap.yaw),s=Math.sin(gap.yaw);
 const local=p=>[c*(p.x-gap.x)-s*(p.z-gap.z),s*(p.x-gap.x)+c*(p.z-gap.z)];
 const p=local(a),q=local(b),half=[gap.w/2,gap.d/2];let lo=0,hi=1;
 for(let k=0;k<2;k++){
  const delta=q[k]-p[k];
  if(Math.abs(delta)<1e-10){if(Math.abs(p[k])>half[k])return [[a,b]];continue}
  let t0=(-half[k]-p[k])/delta,t1=(half[k]-p[k])/delta;if(t0>t1)[t0,t1]=[t1,t0];
  lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>=hi)return [[a,b]];
 }
 const at=t=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
 return [...(lo>0?[[a,at(lo)]]:[]),...(hi<1?[[at(hi),b]]:[])];
}
function surfaceIndex(surfaces){
 const cells=new Map(),size=60;
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let n=0;n<surfaces.length;n++){
  const {positions:p,index}=surfaces[n];
  for(let i=0;i<index.length;i+=3){
   const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
   const x0=Math.floor(Math.min(p[a],p[b],p[c])/size),x1=Math.floor(Math.max(p[a],p[b],p[c])/size),z0=Math.floor(Math.min(p[a+2],p[b+2],p[c+2])/size),z1=Math.floor(Math.max(p[a+2],p[b+2],p[c+2])/size);
   minX=Math.min(minX,x0);maxX=Math.max(maxX,x1);minZ=Math.min(minZ,z0);maxZ=Math.max(maxZ,z1);
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([n,i])}
  }
 }
 const nearby=(x,z,r)=>{
  const refs=surfaces.map(()=>new Set());
  for(let i=Math.floor((x-r)/size);i<=Math.floor((x+r)/size);i++)for(let j=Math.floor((z-r)/size);j<=Math.floor((z+r)/size);j++)for(const [n,k] of cells.get(i+','+j)??[])refs[n].add(k);
  return surfaces.map((v,n)=>({positions:v.positions,index:[...refs[n]].flatMap(k=>[v.index[k],v.index[k+1],v.index[k+2]])}));
 };
 // Reuse the ground index for pointer picking, visiting only cells crossed by the ray.
 // Positions remain live when height exaggeration changes; X/Z cells do not change.
 nearby.raycast=(ray,mapVisible=true,maxDistance=60000)=>{
  let start=0,end=maxDistance;
  for(const [axis,lo,hi] of [['x',minX*size,(maxX+1)*size],['z',minZ*size,(maxZ+1)*size]]){
   const o=ray.origin[axis],d=ray.direction[axis];
   if(Math.abs(d)<1e-12){if(o<lo||o>hi)return null;continue}
   const a=(lo-o)/d,b=(hi-o)/d;start=Math.max(start,Math.min(a,b));end=Math.min(end,Math.max(a,b));
  }
  if(start>end)return null;
  const point=ray.at(start+1e-7,new THREE.Vector3()),stepX=Math.sign(ray.direction.x),stepZ=Math.sign(ray.direction.z);
  let x=Math.floor(point.x/size),z=Math.floor(point.z/size);
  const deltaX=stepX?size/Math.abs(ray.direction.x):Infinity,deltaZ=stepZ?size/Math.abs(ray.direction.z):Infinity;
  let nextX=stepX?((x+(stepX>0?1:0))*size-ray.origin.x)/ray.direction.x:Infinity;
  let nextZ=stepZ?((z+(stepZ>0?1:0))*size-ray.origin.z)/ray.direction.z:Infinity;
  const seen=surfaces.map(()=>new Set()),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
  let best=null,bestDistance=Infinity;
  while(start<=end){
   const exit=Math.min(nextX,nextZ,end);
   for(const [n,i] of cells.get(x+','+z)??[]){
    if((n>0&&!mapVisible)||seen[n].has(i))continue;seen[n].add(i);
    const {positions:p,index}=surfaces[n];a.fromArray(p,index[i]*3);b.fromArray(p,index[i+1]*3);c.fromArray(p,index[i+2]*3);
    if(ray.intersectTriangle(a,b,c,false,hit)){
     const distance=hit.distanceTo(ray.origin);
     if(distance<bestDistance&&distance<=end){bestDistance=distance;best=hit.clone()}
    }
   }
   if(bestDistance<=exit+1e-6)return best;
   if(exit===end)break;
   start=exit;
   if(nextX<=exit+1e-9){x+=stepX;nextX+=deltaX}
   if(nextZ<=exit+1e-9){z+=stepZ;nextZ+=deltaZ}
  }
  return best;
 };
 return nearby;
}
export function createCityWall(data,sourceSurface,buildings){
 const group=new THREE.Group();group.name='city-wall';
 const gaps=data.openings.map(o=>{
  const b=buildings.children.find(b=>b.userData.feature.id===o.model_id),p=b?.position??sourceSurface(...o.pixel);
  return {id:o.id,connection:o.wall_connection,x:p.x,z:p.z,yaw:b?.rotation.y??0,w:b?b.userData.feature.symbol_size_m[0]+.2:o.width_m,d:b?b.userData.feature.symbol_size_m[2]+.2:o.width_m};
 });
 const nodes=[];
 data.centerline.slice(0,-1).forEach((a,i)=>{
  const b=data.centerline[i+1],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);
  for(let j=0;j<steps;j++)nodes.push(sourceSurface(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps));
 });
 nodes.push(sourceSurface(...data.centerline.at(-1)));
 const sourceNodes=nodes.map(p=>({x:p.x,z:p.z}));
 // Keep the gate passage direction fixed; join the wall to its transverse axis.
 const connections=[];
 for(const gap of gaps.filter(g=>g.connection)){
  const {straight_radius_m:inner,transition_radius_m:outer}=gap.connection;
  const c=Math.cos(gap.yaw),s=Math.sin(gap.yaw);let changed=0,maxShift=0;
  for(const node of nodes){
   const dx=node.x-gap.x,dz=node.z-gap.z,r=Math.hypot(dx,dz);if(r>=outer)continue;
   const x=c*dx-s*dz,z=s*dx+c*dz,t=Math.max(0,(r-inner)/(outer-inner)),blend=t*t*(3-2*t),alignedZ=z*blend;
   node.x=gap.x+c*x+s*alignedZ;node.z=gap.z-s*x+c*alignedZ;
   changed++;maxShift=Math.max(maxShift,Math.abs(z-alignedZ));
  }
  connections.push({id:gap.id,changed,maxShift,inner,outer});
 }
 const segments=[];
 for(let i=0;i<nodes.length-1;i++){
  let parts=[[nodes[i],nodes[i+1]]];for(const gap of gaps)parts=parts.flatMap(([a,b])=>outside(a,b,gap));
  for(const [a,b] of parts){const length=Math.hypot(b.x-a.x,b.z-a.z);if(length>.05)segments.push({a,b,x:(a.x+b.x)/2,z:(a.z+b.z)/2,length,yaw:Math.atan2(b.x-a.x,b.z-a.z)})}
 }
 const body=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0xa69a80,roughness:1}),segments.length);
 body.name='wall-body';group.add(body);
 const tiled=data.cap_style==='tile';
 const capGeometry=new THREE.BufferGeometry();
 capGeometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,-.5,.5,0,-.5,0,1,-.5,-.5,0,.5,.5,0,.5,0,1,.5],3));
 capGeometry.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4,0,1,4,0,4,3]);capGeometry.computeVertexNormals();
 const parapets=new THREE.InstancedMesh(tiled?capGeometry:new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:tiled?0x41464a:0xc0b59b,roughness:1}),segments.length*(tiled?1:2));
 parapets.name='wall-parapets';group.add(parapets);
 const dummy=new THREE.Object3D();
 let nearby,roadHeights;
 function updateGround(surfaces,roads=null){
  roadHeights=roads;
  nearby=surfaceIndex(surfaces);const w=data.width_m;
  for(const seg of segments){
   const {x,z,length,yaw}=seg;
   seg.support=TerrainSupport.footprintRange(nearby(x,z,(length+w)/2+1),[x-w/2,z-length/2,x+w/2,z+length/2],yaw);
  }
 }
 function updateHeights(exaggeration){
  segments.forEach((seg,i)=>{
   const bottom=seg.support.min*exaggeration-.4,top=seg.support.max*exaggeration+data.height_m;
   dummy.position.set(seg.x,(bottom+top)/2,seg.z);dummy.rotation.set(0,seg.yaw,0);dummy.scale.set(data.width_m,top-bottom,seg.length);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);
   if(tiled){
    dummy.position.set(seg.x,top,seg.z);dummy.scale.set(data.width_m+.65,data.parapet_height_m,seg.length+.1);dummy.updateMatrix();parapets.setMatrixAt(i,dummy.matrix);
   }else for(const side of [-1,1]){
    const offset=side*(data.width_m/2-.35);
    dummy.position.set(seg.x+Math.cos(seg.yaw)*offset,top+data.parapet_height_m/2,seg.z-Math.sin(seg.yaw)*offset);
    dummy.scale.set(.7,data.parapet_height_m,seg.length*.55);dummy.updateMatrix();parapets.setMatrixAt(i*2+(side+1)/2,dummy.matrix);
   }
  });
  for(const mesh of [body,parapets]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}
 }
 const supportAt=(x,z,w,d,yaw,includeRoad=false)=>{
  const bounds=[x-w/2,z-d/2,x+w/2,z+d/2],surfaces=nearby(x,z,Math.hypot(w,d)/2+1);
  const ranges=surfaces.map(surface=>TerrainSupport.footprintRange([surface],bounds,yaw));
  // Use the visible upper surface, not the gap between DEM and map overlay.
  return {min:Math.max(...ranges.map(r=>r.min)),max:Math.max(...ranges.map(r=>r.max)),terrain:ranges[0],road:includeRoad&&roadHeights?TerrainSupport.footprintRange([{...surfaces[1],heights:roadHeights}],bounds,yaw):null};
 };
 const updateGroundFrom=support=>{for(const seg of segments)seg.support=support(seg.x,seg.z,data.width_m,seg.length,seg.yaw)};
 return {group,segments,gaps,connections,sourceNodes,nodes,updateGround,updateGroundFrom,updateHeights,supportAt,raycastGround:(ray,mapVisible)=>nearby.raycast(ray,mapVisible)};
}
