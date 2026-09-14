/* Conceptual channel carving. Original elevations remain the source of every update. */
(function(root){
 function nearest(x,z,path){
  let best={distance:Infinity};
  for(let i=0;i<path.length-1;i++){
   if(path[i+1].breakBefore)continue;
   const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
   const t=l2?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)):0;
   const distance=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
   if(distance<best.distance)best={distance,index:i,t,level:a.level+(b.level-a.level)*t,width:a.width+(b.width-a.width)*t};
  }
  return best;
 }
 // Bucket path segments by X/Z cell. nearestWithin returns exactly what nearest returns whenever the
 // true nearest distance is below reach, and {distance:Infinity} otherwise, visiting only nearby segments.
 function segmentGrid(path,size=64){
  const cells=new Map();
  for(let i=0;i<path.length-1;i++){
   if(path[i+1].breakBefore)continue;
   const a=path[i],b=path[i+1];
   for(let x=Math.floor(Math.min(a.x,b.x)/size);x<=Math.floor(Math.max(a.x,b.x)/size);x++)
    for(let z=Math.floor(Math.min(a.z,b.z)/size);z<=Math.floor(Math.max(a.z,b.z)/size);z++){
     const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
    }
  }
  return {path,size,cells};
 }
 function nearestWithin(x,z,grid,reach){
  const {path,size,cells}=grid,found=new Set();
  for(let i=Math.floor((x-reach)/size);i<=Math.floor((x+reach)/size);i++)
   for(let j=Math.floor((z-reach)/size);j<=Math.floor((z+reach)/size);j++)
    for(const k of cells.get(i+','+j)??[])found.add(k);
  let best={distance:Infinity};
  // Same formula and index order as nearest, so ties resolve identically.
  for(const i of [...found].sort((p,q)=>p-q)){
   const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz;
   const t=l2?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)):0;
   const distance=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
   if(distance<best.distance)best={distance,index:i,t,level:a.level+(b.level-a.level)*t,width:a.width+(b.width-a.width)*t};
  }
  return best.distance<reach?best:{distance:Infinity};
 }
 function profile(nodes){
  let previous=Infinity;
  const result=nodes.map((p,i)=>{
   const distance=i?Math.hypot(p.x-nodes[i-1].x,p.z-nodes[i-1].z):0;
   // Never raise a valley to enforce flow; lower upstream-to-downstream at least 0.3 m/km.
   const level=Math.min(p.height-1,previous-distance*.0003);previous=level;return {...p,level};
  });
  // Limit abrupt DEM drops to an 8% conceptual longitudinal grade, by cutting only.
  for(let i=result.length-2;i>=0;i--){
   const a=result[i],b=result[i+1],distance=Math.hypot(a.x-b.x,a.z-b.z);
   a.level=Math.min(a.level,b.level+distance*.08);
  }
  return result;
 }
 function carvedHeight(original,match,depth,offset=0){
  const shoulder=20,edge=match.width+shoulder;
  if(match.distance>=edge)return original;
  const t=Math.max(0,Math.min(1,(match.distance-match.width)/shoulder)),blend=1-t*t*(3-2*t);
  return original+Math.min(0,match.level-depth+offset-original)*blend;
 }
 function refine(geometry,path){
  const {positions,index,uv,colors}=geometry,out={positions:[],uv:[],colors:[],index:[]};
  const radius=Math.max(...path.map(p=>p.width))+20;
  const get=i=>[positions[i*3],positions[i*3+1],positions[i*3+2],uv[i*2],uv[i*2+1],colors[i*3],colors[i*3+1],colors[i*3+2]];
  const grid=segmentGrid(path);
  function triangle(a,b,c,depth){
   const edge=Math.max(Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2]));
   const centre=nearestWithin((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3,grid,radius+edge);
   if(depth<5&&edge>6&&centre.distance<radius+edge){
    const mid=(u,v)=>u.map((n,i)=>(n+v[i])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
    triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);
   }else{
    for(const v of [a,b,c]){out.index.push(out.positions.length/3);out.positions.push(v[0],v[1],v[2]);out.uv.push(v[3],v[4]);out.colors.push(v[5],v[6],v[7])}
   }
  }
  for(let i=0;i<index.length;i+=3)triangle(get(index[i]),get(index[i+1]),get(index[i+2]),0);
  return out;
 }
 // Merge refined vertices that share an exact position. Refinement emits every triangle with its own three
 // vertices; midpoints of a shared edge are computed from the same two endpoints, so they compare equal.
 function weld(out){
  const count=out.positions.length/3,table=new Int32Array(2**Math.ceil(Math.log2(count*2+1))).fill(-1),mask=table.length-1;
  const bits=new Float64Array(1),words=new Uint32Array(bits.buffer),remap=new Uint32Array(count);
  const positions=new Float32Array(count*3),uv=new Float32Array(count*2),colors=new Float32Array(count*3),p=out.positions;
  const kept=[];let unique=0;
  for(let v=0;v<count;v++){
   let h=2166136261;
   for(let k=0;k<3;k++){bits[0]=p[v*3+k];h=Math.imul(h^words[0],16777619);h=Math.imul(h^words[1],16777619)}
   let slot=h&mask,found=-1;
   while(table[slot]!==-1){const u=kept[table[slot]];if(p[u*3]===p[v*3]&&p[u*3+1]===p[v*3+1]&&p[u*3+2]===p[v*3+2]){found=table[slot];break}slot=(slot+1)&mask}
   if(found===-1){
    found=unique++;table[slot]=found;kept.push(v);
    positions.set([p[v*3],p[v*3+1],p[v*3+2]],found*3);uv.set([out.uv[v*2],out.uv[v*2+1]],found*2);colors.set([out.colors[v*3],out.colors[v*3+1],out.colors[v*3+2]],found*3);
   }
   remap[v]=found;
  }
  const index=new Uint32Array(out.index.length);for(let i=0;i<index.length;i++)index[i]=remap[out.index[i]];
  return {positions:positions.slice(0,unique*3),uv:uv.slice(0,unique*2),colors:colors.slice(0,unique*3),index};
 }
 const api={nearest,nearestWithin,segmentGrid,profile,carvedHeight,refine,weld};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChannelTerrain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
