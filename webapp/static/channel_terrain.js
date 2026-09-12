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
  function triangle(a,b,c,depth){
   const edge=Math.max(Math.hypot(a[0]-b[0],a[2]-b[2]),Math.hypot(b[0]-c[0],b[2]-c[2]),Math.hypot(c[0]-a[0],c[2]-a[2]));
   const centre=nearest((a[0]+b[0]+c[0])/3,(a[2]+b[2]+c[2])/3,path);
   if(depth<5&&edge>6&&centre.distance<radius+edge){
    const mid=(u,v)=>u.map((n,i)=>(n+v[i])/2),ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
    triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);
   }else{
    for(const v of [a,b,c]){out.index.push(out.positions.length/3);out.positions.push(...v.slice(0,3));out.uv.push(...v.slice(3,5));out.colors.push(...v.slice(5,8))}
   }
  }
  for(let i=0;i<index.length;i+=3)triangle(get(index[i]),get(index[i+1]),get(index[i+2]),0);
  return out;
 }
 const api={nearest,profile,carvedHeight,refine};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ChannelTerrain=api;
})(typeof globalThis!=='undefined'?globalThis:this);
