// Heavy channel refinement runs away from the UI, while the existing scene remains visible.
importScripts('/webapp/static/channel_terrain.js');
onmessage=({data})=>{
 try{
  const result=ChannelTerrain.refine(data.geometry,data.path);
  const positions=new Float32Array(result.positions),uv=new Float32Array(result.uv),colors=new Float32Array(result.colors),index=new Uint32Array(result.index),matches=new Float64Array(positions.length);
  for(let i=0;i<positions.length/3;i++){
   const m=ChannelTerrain.nearest(positions[i*3],positions[i*3+2],data.path);
   matches[i*3]=m.distance;matches[i*3+1]=m.level;matches[i*3+2]=m.width;
  }
  postMessage({positions,uv,colors,index,matches},[positions.buffer,uv.buffer,colors.buffer,index.buffer,matches.buffer]);
 }catch(error){postMessage({error:error.message})}
};
