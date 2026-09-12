/* Intersect displayed, piecewise planar terrain triangles with a box footprint.
 * Coordinates: x/east, y/up, z/south. No historical foundation is inferred.
 */
(function(root){
 function clip(poly,axis,bound,keepGreater){
  const result=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length];
   const inside=p=>keepGreater?p[axis]>=bound:p[axis]<=bound;
   const ai=inside(a),bi=inside(b);
   if(ai)result.push(a);
   if(ai!==bi){const t=(bound-a[axis])/(b[axis]-a[axis]);result.push(a.map((v,k)=>v+t*(b[k]-v)))}
  }
  return result;
 }
 function footprintRange(surfaces,bounds,yaw=0){
  const [left,near,right,far]=bounds;
  if(!bounds.every(Number.isFinite)||left>=right||near>=far)throw Error('Invalid support footprint');
  if(!Number.isFinite(yaw))throw Error('Invalid support rotation');
  const cx=(left+right)/2,cz=(near+far)/2,c=Math.cos(yaw),s=Math.sin(yaw);
  const rx=(Math.abs(c)*(right-left)+Math.abs(s)*(far-near))/2;
  const rz=(Math.abs(s)*(right-left)+Math.abs(c)*(far-near))/2;
  let min=Infinity,max=-Infinity,count=0;
  for(const {positions,index,heights} of surfaces){
   for(let i=0;i<index.length;i+=3){
    let poly=[index[i],index[i+1],index[i+2]].map(k=>[positions[k*3],heights?heights[k]:positions[k*3+1],positions[k*3+2]]);
    if(Math.max(...poly.map(p=>p[0]))<cx-rx||Math.min(...poly.map(p=>p[0]))>cx+rx||Math.max(...poly.map(p=>p[2]))<cz-rz||Math.min(...poly.map(p=>p[2]))>cz+rz)continue;
    // Clip in the rotated building's local horizontal frame; retain elevation.
    if(yaw)poly=poly.map(([x,y,z])=>[cx+c*(x-cx)-s*(z-cz),y,cz+s*(x-cx)+c*(z-cz)]);
    for(const [axis,bound,greater] of [[0,left,true],[0,right,false],[2,near,true],[2,far,false]])poly=clip(poly,axis,bound,greater);
    for(const p of poly){if(!p.every(Number.isFinite))throw Error('Invalid support surface');min=Math.min(min,p[1]);max=Math.max(max,p[1]);count++}
   }
  }
  if(!count)throw Error('No terrain under building footprint');
  return {min,max,vertices:count};
 }
 const api={footprintRange};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TerrainSupport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
