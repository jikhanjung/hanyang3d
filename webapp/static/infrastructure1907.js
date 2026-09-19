import * as THREE from 'three';
import {createCityWall} from './city_wall.js';

// Period-specific pixel traces; the 1750 geometry is never reprojected into this scene.
export function createInfrastructure1907(data,surface,buildings){
 const roads=new THREE.Group();roads.name='major-roads-1907';
 const roadMaterial=new THREE.MeshStandardMaterial({color:0xd4c3a1,roughness:1,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
 for(const f of data.roads?.features??[]){
  const positions=[],indices=[],points=f.centerline.map(p=>surface(...p));
  // Shared mitred edges keep bends joined instead of leaving triangular gaps between segments.
  const edges=points.map((p,i)=>{
   const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
   let ux=p.x-a.x,uz=p.z-a.z,vx=b.x-p.x,vz=b.z-p.z;
   let ul=Math.hypot(ux,uz),vl=Math.hypot(vx,vz);if(!ul){ux=vx;uz=vz;ul=vl}if(!vl){vx=ux;vz=uz;vl=ul}
   ux/=ul||1;uz/=ul||1;vx/=vl||1;vz/=vl||1;
   let nx=-uz-vz,nz=ux+vx,len=Math.hypot(nx,nz);if(len<.001){nx=-vz;nz=vx;len=1}nx/=len;nz/=len;
   const offset=Math.min(f.width_m,f.width_m/2/Math.max(.5,nx*-vz+nz*vx));
   return [[p.x-nx*offset,p.z-nz*offset],[p.x+nx*offset,p.z+nz*offset]];
  });
  for(let i=1;i<f.centerline.length;i++){
   const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.001)continue;
   const quad=[edges[i-1][0],edges[i][0],edges[i][1],edges[i-1][1]];
   // Clip to each DEM triangle so no road triangle cuts through a terrain ridge.
   const grid=surface.grid,minX=Math.min(...quad.map(p=>p[0])),maxX=Math.max(...quad.map(p=>p[0])),minZ=Math.min(...quad.map(p=>p[1])),maxZ=Math.max(...quad.map(p=>p[1]));
   const ix0=Math.max(0,Math.floor((minX-grid.xmin)/grid.stepX)),ix1=Math.min(grid.size-2,Math.floor((maxX-grid.xmin)/grid.stepX)),iz0=Math.max(0,Math.floor((minZ-grid.zmin)/grid.stepZ)),iz1=Math.min(grid.size-2,Math.floor((maxZ-grid.zmin)/grid.stepZ));
   for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
    const x=grid.xmin+ix*grid.stepX,z=grid.zmin+iz*grid.stepZ,p00=[x,z],p10=[x+grid.stepX,z],p01=[x,z+grid.stepZ],p11=[x+grid.stepX,z+grid.stepZ];
    for(const tri of [[p00,p10,p11],[p00,p11,p01]]){
     let poly=quad;
     for(let edge=0;edge<3&&poly.length;edge++){
      const u=tri[edge],v=tri[(edge+1)%3],side=p=>(v[0]-u[0])*(p[1]-u[1])-(v[1]-u[1])*(p[0]-u[0]),out=[];
      for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],dp=side(p),dq=side(q);if(dp>=-1e-8)out.push(p);if((dp<0&&dq>0)||(dp>0&&dq<0)){const t=dp/(dp-dq);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])])}}
      poly=out;
     }
     if(poly.length<3)continue;const base=positions.length/3;
     for(const [px,pz] of poly){const y=surface.ground(px,pz);if(y===null)throw Error('Road outside terrain: '+f.id);positions.push(px,y+.025,pz)}
     for(let k=1;k<poly.length-1;k++)indices.push(base,base+k,base+k+1);
    }
   }
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.Mesh(g,roadMaterial);m.name=f.id;m.userData.feature=f;m.renderOrder=1.5;roads.add(m);
 }
 const wall=createCityWall(data.wall,surface,{children:buildings});
 wall.updateGroundFrom((x,z,w,d,yaw)=>{
  const heights=[];for(const a of [-.5,0,.5])for(const b of [-.5,0,.5]){
   const dx=a*w,dz=b*d;heights.push(surface.ground(x+dx*Math.cos(yaw)+dz*Math.sin(yaw),z-dx*Math.sin(yaw)+dz*Math.cos(yaw)));
  }return {min:Math.min(...heights),max:Math.max(...heights)};
 });wall.updateHeights(1);
 const water=new THREE.Group();water.name='cheonggyecheon-1907';const bridges=new THREE.Group();bridges.name='bridges-1907';
 const river=data.river,edges=[],nodes=[];
 for(let i=0;i<river.centerline.length-1;i++){
  const a=river.centerline[i],b=river.centerline[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.ceil(len/3);
  for(let j=0;j<steps;j++){
   const t=j/steps,width=THREE.MathUtils.lerp(river.half_widths_px[i],river.half_widths_px[i+1],t),x=THREE.MathUtils.lerp(a[0],b[0],t),y=THREE.MathUtils.lerp(a[1],b[1],t),nx=-(b[1]-a[1])/len*width,ny=(b[0]-a[0])/len*width;
   edges.push([surface(x-nx,y-ny),surface(x+nx,y+ny)]);nodes.push({pixel:[x,y],width});
  }
 }
 const last=river.centerline.at(-1),prev=river.centerline.at(-2),len=Math.hypot(last[0]-prev[0],last[1]-prev[1]),width=river.half_widths_px.at(-1),nx=-(last[1]-prev[1])/len*width,ny=(last[0]-prev[0])/len*width;edges.push([surface(last[0]-nx,last[1]-ny),surface(last[0]+nx,last[1]+ny)]);
 const ribbon=(pairs,color,lift)=>{
  const positions=[],indices=[];pairs.forEach(pair=>pair.forEach(p=>positions.push(p.x,p.y+lift,p.z)));
  for(let i=0;i<pairs.length-1;i++){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.6,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));m.renderOrder=2;water.add(m);return m;
 };
 ribbon(edges,0x278fb0,.08).name='water-surface';
 for(const side of [0,1])ribbon(edges.map(pair=>{const p=pair[side].clone(),q=p.clone();q.y+=.45;return[p,q]}),0x8b9180,.08);
 const stone=new THREE.MeshStandardMaterial({color:0xb6aa90,roughness:1}),railmat=new THREE.MeshStandardMaterial({color:0x897d69,roughness:1});
 for(const f of river.bridges){
  const nearest=nodes.reduce((best,n)=>Math.hypot(n.pixel[0]-f.pixel[0],n.pixel[1]-f.pixel[1])<Math.hypot(best.pixel[0]-f.pixel[0],best.pixel[1]-f.pixel[1])?n:best),idx=nodes.indexOf(nearest),pair=edges[idx],a=pair[0],b=pair[1],mid=a.clone().add(b).multiplyScalar(.5),length=a.distanceTo(b)+6,group=new THREE.Group();
  group.name=f.id;group.position.copy(mid);group.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);const deckY=Math.max(a.y,b.y)-mid.y+.9;
  const box=(x,y,z,w,h,d,mat=stone)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m)};
  box(0,deckY,0,f.width_m,.8,length);
  for(const z of [-length*.25,0,length*.25])for(const side of [-1,1])box(side*f.width_m*.3,deckY-.8,z,.7,1.5,.8);
  if(f.rails)for(const side of [-1,1]){box(side*(f.width_m/2-.2),deckY+1,0,.3,.35,length,railmat);for(const z of [-length*.45,0,length*.45])box(side*(f.width_m/2-.2),deckY+.8,z,.5,1.3,.5,railmat)}
  // Bank approaches terminate at the same terrain surface, independent of map opacity.
  for(const side of [-1,1]){
   const z0=side*length/2,z1=side*(length/2+7),pos=[];
   for(const z of [z0,z1])for(const x of [-f.width_m/2,f.width_m/2]){
    const wx=mid.x+x*Math.cos(group.rotation.y)+z*Math.sin(group.rotation.y),wz=mid.z-x*Math.sin(group.rotation.y)+z*Math.cos(group.rotation.y);pos.push(x,z===z0?deckY+.4:surface.ground(wx,wz)-mid.y+.08,z);
   }
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(side>0?[0,2,1,1,2,3]:[0,1,2,1,3,2]);g.computeVertexNormals();group.add(new THREE.Mesh(g,stone));
  }
  const label=mid.clone();label.y+=deckY+2;group.userData={feature:f,labelPosition:label};bridges.add(group);
 }
 return {wall,water,bridges,roads};
}
