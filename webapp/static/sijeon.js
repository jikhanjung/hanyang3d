import * as THREE from 'three';

// Shop rows (행랑) lining both sides of the read Unjongga centreline.
// The map does not draw the individual shops: only the street line and its width
// come from the reading, the rows themselves are a stated display assumption.
export function createSijeon(data,sourceSurface,landmarks){
 const group=new THREE.Group();group.name='unjongga-shop-rows';
 const {bay_m:bay,depth_m:depth,height_m:height,setback_m:setback,min_half_width_m:minHalf=0,block_bays:[minBays,maxBays],gap_m:[minGap,maxGap]}=data.placement;
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
   // The drawn street is narrower than the real avenue, so hold a minimum clear width.
   const nx=-mid.dz,nz=mid.dx,offset=Math.max(mid.half,minHalf)+setback+depth/2;
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
  counter:new THREE.MeshStandardMaterial({color:0x6d5334,roughness:1}),
  awning:new THREE.MeshStandardMaterial({color:0xcbb789,roughness:1}),
  post:new THREE.MeshStandardMaterial({color:0x7a5c3c,roughness:1}),
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
 // Open shopfronts: a counter under an awning on posts, with the keeper standing behind it.
 const counters=make(new THREE.BoxGeometry(1,1,1),mats.counter);counters.name='shop-counters';
 const awnings=make(new THREE.BoxGeometry(1,1,1),mats.awning);awnings.name='shop-awnings';
 const postsLeft=make(new THREE.CylinderGeometry(.09,.11,1,6),mats.post);postsLeft.name='awning-post-left';
 const postsRight=make(new THREE.CylinderGeometry(.09,.11,1,6),mats.post);postsRight.name='awning-post-right';
 // Keepers and signboards live in their own group: their counts differ from the block count.
 const extras=new THREE.Group();extras.name='shop-keepers-and-signs';group.add(extras);
 const keeperSpots=[];
 records.forEach((r,i)=>{
  const count=r.bays<=5?1:2;
  for(let k=0;k<count;k++){
   // Leave some counters unattended so the row does not look staffed by clones.
   if(((i*7+k*3)%9)===4)continue;
   keeperSpots.push({record:i,along:count===1?0:(k===0?-.25:.25)*r.length,look:(i+k)%5,dress:(i*3+k)%4});
  }
 });
 const keeperMesh=(geometry,color,name)=>{const mesh=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}),keeperSpots.length);mesh.name=name;mesh.frustumCulled=false;extras.add(mesh);return mesh};
 const keeperBody=keeperMesh(new THREE.BoxGeometry(.46,.68,.3),0xffffff,'shopkeepers');
 const keeperLegs=keeperMesh(new THREE.BoxGeometry(.4,.75,.24),0xc8c2b1,'shopkeeper-legs');
 const keeperArms=keeperMesh(new THREE.BoxGeometry(.72,.16,.3),0xffffff,'shopkeeper-arms');
 const keeperHead=keeperMesh(new THREE.SphereGeometry(.15,8,6),0xc5a17e,'shopkeeper-heads');
 const keeperHair=keeperMesh(new THREE.SphereGeometry(.157,8,5,0,Math.PI*2,0,1.25),0x302b28,'shopkeeper-hair');
 const keeperKnot=keeperMesh(new THREE.SphereGeometry(.07,6,5),0x302b28,'shopkeeper-topknots');
 const coats=['#d8cdb2','#bfc2b6','#cdbb9b','#a9aea3'];
 keeperSpots.forEach((k,j)=>{const c=new THREE.Color(coats[k.dress]);keeperBody.setColorAt(j,c);keeperArms.setColorAt(j,c)});
 // Signboards: one hanja board every few blocks, named by the shop zone it falls in.
 const belfry=landmarks?.children.find(b=>b.userData.feature.id==='jongru');
 const signs=[];
 if(data.signs&&belfry){
  records.forEach((r,i)=>{
   if(i%data.signs.every_blocks!==1)return;
   // Signed distance from the bell tower along the street's west-to-east axis.
   const axis=sample(0),offset=(r.x-belfry.position.x)*axis.dx+(r.z-belfry.position.z)*axis.dz;
   const zone=data.signs.zones.find(z=>offset>=z.from_m&&offset<z.to_m);if(!zone)return;
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=72;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#5a3f26';ctx.fillRect(0,0,256,72);
   ctx.strokeStyle='#c9a86a';ctx.lineWidth=5;ctx.strokeRect(5,5,246,62);
   ctx.fillStyle='#f3e6c4';ctx.font='700 44px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(zone.hanja,128,39);
   const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
   // Text only on the street face; a plain wooden back keeps the reverse from showing mirrored hanja.
   const board=new THREE.Mesh(new THREE.PlaneGeometry(2.8,.8),new THREE.MeshStandardMaterial({map:texture,roughness:1}));
   const back=new THREE.Mesh(new THREE.BoxGeometry(2.9,.9,.06),new THREE.MeshStandardMaterial({color:0x5a3f26,roughness:1}));
   back.position.z=-.04;back.name='shop-sign-back';board.add(back);
   board.name='shop-sign';board.userData={record:i,hanja:zone.hanja,hangul:zone.hangul,sells:zone.sells,offsetM:offset};
   extras.add(board);signs.push(board);
  });
 }
 const dummy=new THREE.Object3D();
 let exaggeration=1,mapVisible=true,visible=0;
 function updateHeights(ex){
  exaggeration=ex;visible=0;
  records.forEach((r,i)=>{
   const surface=r.support&&(mapVisible?r.support:r.support.terrain);
   const show=surface&&(surface.max-surface.min)*ex<=1.6;
   r.displayed=!!show;
   if(!show){dummy.scale.set(0,0,0);dummy.updateMatrix();for(const m of group.children)if(m.isInstancedMesh)m.setMatrixAt(i,dummy.matrix);return}
   visible++;
   const floor=surface.min*ex+.05;r.floor=floor;
   const place=(mesh,y,sx,sy,sz,dz=0,dx=0)=>{
    dummy.position.set(r.x+dz*Math.sin(r.yaw)+dx*Math.cos(r.yaw),y,r.z+dz*Math.cos(r.yaw)-dx*Math.sin(r.yaw));
    dummy.rotation.set(0,r.yaw,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   };
   const sill=floor+.4,eave=sill+height;
   place(footing,floor+.2,r.length+.5,.4,depth+.9);
   // Only the back half is walled; the street side stands open for trade.
   place(walls,sill+height/2,r.length,height,depth*.5,depth*.24);
   place(roofs,sill+height,r.length+1.1,1.55,depth+1.7);
   place(counters,sill+.4,r.length*.94,.8,.8,-depth*.42);
   place(awnings,eave-.35,r.length+.7,.16,2.2,-depth*.5-1);
   for(const [mesh,side] of [[postsLeft,-1],[postsRight,1]]){
    dummy.position.set(r.x+(-depth*.5-1.9)*Math.sin(r.yaw)+side*r.length*.46*Math.cos(r.yaw),
     (sill+eave-.35)/2,r.z+(-depth*.5-1.9)*Math.cos(r.yaw)-side*r.length*.46*Math.sin(r.yaw));
    dummy.rotation.set(0,r.yaw,0);dummy.scale.set(1,eave-.35-sill,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
  });
  // Keepers stand between the counter and the back wall, facing the street.
  keeperSpots.forEach((k,j)=>{
   const r=records[k.record],parts=[keeperBody,keeperLegs,keeperArms,keeperHead,keeperHair,keeperKnot];
   if(!r.displayed){dummy.scale.set(0,0,0);dummy.updateMatrix();for(const m of parts)m.setMatrixAt(j,dummy.matrix);return}
   // Just behind the counter's back face, arms resting on its top.
   const sill=r.floor+.4,s=Math.sin(r.yaw),c=Math.cos(r.yaw),dz=-depth*.42+.4+.35,turn=(k.look-2)*.18;
   const put=(mesh,ly,lz=0,sx=1,sy=1,sz=1)=>{
    dummy.position.set(r.x+(dz+lz)*s+k.along*c,sill+ly,r.z+(dz+lz)*c-k.along*s);
    dummy.rotation.set(0,r.yaw+Math.PI+turn,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);
   };
   put(keeperLegs,.38);put(keeperBody,1.1);put(keeperArms,.9,-.26);put(keeperHead,1.6);put(keeperHair,1.6);put(keeperKnot,1.77,.02);
  });
  for(const board of signs){
   const r=records[board.userData.record];board.visible=!!r.displayed;if(!r.displayed)continue;
   const s=Math.sin(r.yaw),c=Math.cos(r.yaw),dz=-depth*.5-2.05,eave=r.floor+.35+height;
   board.position.set(r.x+dz*s,eave+.2,r.z+dz*c);board.rotation.set(0,r.yaw+Math.PI,0);
  }
  for(const mesh of [...group.children,...extras.children])if(mesh.isInstancedMesh){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere()}
 }
 function updateGround(supportAt){
  for(const r of records)r.support=supportAt(r.x,r.z,r.length+1,depth+1,r.yaw);
  updateHeights(exaggeration);
 }
 const setMapVisible=value=>{mapVisible=value;updateHeights(exaggeration)};
 const toggle=document.getElementById('sijeon3d');
 if(toggle)toggle.onchange=e=>{group.visible=e.target.checked};
 return {group,records,signs,keeperCount:keeperSpots.length,updateGround,updateHeights,setMapVisible,get visibleCount(){return visible},
  get bayCount(){return records.reduce((sum,r)=>sum+r.bays,0)}};
}
