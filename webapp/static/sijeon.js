import * as THREE from 'three';

// Shop rows (행랑) lining both sides of the read Unjongga centreline.
// The map does not draw the individual shops: only the street line and its width
// come from the reading, the rows themselves are a stated display assumption.
export function createSijeon(data,sourceSurface,landmarks){
 const group=new THREE.Group();group.name='unjongga-shop-rows';
 const {bay_m:bay,depth_m:depth,height_m:height,setback_m:setback,block_bays:[minBays,maxBays],gap_m:[minGap,maxGap]}=data.placement;
 const line=data.street_points.map(([px,py,half])=>{const p=sourceSurface(px,py);return {x:p.x,z:p.z,half,pixel:[px,py]}});
 let total=0;
 line.forEach((p,i)=>{if(i)total+=Math.hypot(p.x-line[i-1].x,p.z-line[i-1].z);p.distance=total});
 function sample(distance){
  let i=1;while(i<line.length-1&&line[i].distance<distance)i++;
  const a=line[i-1],b=line[i],span=b.distance-a.distance||1,t=(distance-a.distance)/span;
  const dx=(b.x-a.x)/span,dz=(b.z-a.z)/span;
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,dx,dz,half:a.half+(b.half-a.half)*t};
 }
 // Deterministic block lengths and alley gaps, so the row looks laid out rather than random.
 const records=[];let seed=7;
 const next=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648};
 for(const side of [-1,1]){
  let distance=bay;
  while(distance<total-bay*minBays){
   const bays=Math.round(minBays+next()*(maxBays-minBays)),length=bays*bay;
   if(distance+length>total)break;
   const mid=sample(distance+length/2),yaw=Math.atan2(-mid.dz,mid.dx);
   const nx=-mid.dz,nz=mid.dx,offset=mid.half+setback+depth/2;
   const x=mid.x+side*nx*offset,z=mid.z+side*nz*offset,reach=Math.hypot(length,depth)/2;
   // Leave room for the named landmarks that already stand along the street.
   const clash=landmarks&&landmarks.children.some(b=>{
    const [bw,,bd]=b.userData.feature.symbol_size_m;
    return Math.hypot(x-b.position.x,z-b.position.z)<reach+Math.hypot(bw,bd)/2+3;
   });
   if(!clash)records.push({x,z,yaw:side>0?yaw:yaw+Math.PI,bays,length,side});
   distance+=length+minGap+next()*(maxGap-minGap);
  }
 }
 const mats={
  stone:new THREE.MeshStandardMaterial({color:0x9d9583,roughness:1}),
  wall:new THREE.MeshStandardMaterial({color:0xd7cbb2,roughness:1}),
  roof:new THREE.MeshStandardMaterial({color:0x454f52,roughness:1}),
  front:new THREE.MeshStandardMaterial({color:0x5b4630,roughness:1}),
 };
 // A unit gable prism: ridge along local X, eaves at z = ±0.5, base at y = 0.
 const prism=new THREE.BufferGeometry();
 prism.setAttribute('position',new THREE.Float32BufferAttribute([
  -.5,0,-.5, .5,0,-.5, .5,0,.5, -.5,0,.5, -.5,1,0, .5,1,0],3));
 prism.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3]);
 prism.computeVertexNormals();
 const make=(geometry,material)=>{const mesh=new THREE.InstancedMesh(geometry,material,records.length);mesh.frustumCulled=false;group.add(mesh);return mesh};
 const footing=make(new THREE.BoxGeometry(1,1,1),mats.stone);footing.name='shop-footing';
 const walls=make(new THREE.BoxGeometry(1,1,1),mats.wall);walls.name='shop-walls';
 const roofs=make(prism,mats.roof);roofs.name='shop-roofs';
 const fronts=make(new THREE.BoxGeometry(1,1,1),mats.front);fronts.name='shop-fronts';
 const dummy=new THREE.Object3D();
 let exaggeration=1,mapVisible=true,visible=0;
 function updateHeights(ex){
  exaggeration=ex;visible=0;
  records.forEach((r,i)=>{
   const surface=r.support&&(mapVisible?r.support:r.support.terrain);
   const show=surface&&(surface.max-surface.min)*ex<=1.6;
   r.displayed=!!show;
   if(!show){dummy.scale.set(0,0,0);dummy.updateMatrix();for(const m of group.children)m.setMatrixAt(i,dummy.matrix);return}
   visible++;
   const floor=surface.min*ex+.05;r.floor=floor;
   const place=(mesh,y,sx,sy,sz,dz=0)=>{
    dummy.position.set(r.x+dz*Math.sin(r.yaw),y,r.z+dz*Math.cos(r.yaw));
    dummy.rotation.set(0,r.yaw,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   };
   place(footing,floor+.2,r.length+.5,.4,depth+.5);
   place(walls,floor+.4+height/2,r.length,height,depth*.92);
   place(roofs,floor+.4+height,r.length+1.1,1.55,depth+1.7);
   // The shop side facing the street: a dark timber front under the eaves.
   place(fronts,floor+.4+height*.45,r.length*.96,height*.72,.3,-depth*.46);
  });
  for(const mesh of group.children){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere()}
 }
 function updateGround(supportAt){
  for(const r of records)r.support=supportAt(r.x,r.z,r.length+1,depth+1,r.yaw);
  updateHeights(exaggeration);
 }
 const setMapVisible=value=>{mapVisible=value;updateHeights(exaggeration)};
 const toggle=document.getElementById('sijeon3d');
 if(toggle)toggle.onchange=e=>{group.visible=e.target.checked};
 return {group,records,updateGround,updateHeights,setMapVisible,get visibleCount(){return visible},
  get bayCount(){return records.reduce((sum,r)=>sum+r.bays,0)}};
}
