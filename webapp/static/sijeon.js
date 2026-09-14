import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

// Shop rows (행랑) lining both sides of the read Unjongga centreline.
// The map does not draw the individual shops: only the street line and its width
// come from the reading, the rows themselves are a stated display assumption.
// Painted goods cards for the counters: flat pictures, one design per shop kind.
function drawGoods(kind){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
 const g=canvas.getContext('2d');
 if(kind==='내어물전'){
  // Dried pollack laid in a row on a straw mat.
  g.fillStyle='#b79b62';g.fillRect(6,58,244,64);
  for(let i=0;i<7;i++){
   const x=24+i*33;g.fillStyle=i%2?'#8f7b5f':'#a38d6c';
   g.beginPath();g.ellipse(x,70,9,38,0,0,Math.PI*2);g.fill();
   g.fillStyle='#6d5d47';g.beginPath();g.moveTo(x-10,104);g.lineTo(x+10,104);g.lineTo(x,120);g.fill();
  }
 }else if(kind==='면포전'){
  // Rolls of cotton cloth seen end-on, stacked two deep.
  const colors=['#f1ead8','#e7dcc1','#f6f1e4','#ddd0b2'];
  for(let row=0;row<2;row++)for(let i=0;i<6;i++){
   const x=26+i*40+(row?20:0),y=96-row*34;
   g.fillStyle=colors[(i+row)%colors.length];g.beginPath();g.arc(x,y,18,0,Math.PI*2);g.fill();
   g.strokeStyle='#b39f7c';g.lineWidth=2;g.stroke();g.beginPath();g.arc(x,y,6,0,Math.PI*2);g.stroke();
  }
 }else{
  // Folded bolts in piles: bright imported silk, pale native silk or greenish ramie.
  const palettes={'선전':['#b8322f','#2f5f9e','#d6a53a','#3f7d4f','#8b3f8f'],'면주전':['#efd9c6','#e8c9c2','#f2e6c9','#d9c7a8'],'저포전':['#e6ead6','#d8dfc4','#eef0e0','#cfd6b8']};
  const colors=palettes[kind]??palettes['면주전'];
  for(let pile=0;pile<4;pile++)for(let k=0;k<4;k++){
   const x=10+pile*60,y=102-k*22;g.fillStyle=colors[(pile*2+k)%colors.length];g.fillRect(x,y,52,20);
   g.fillStyle='rgba(255,255,255,.28)';g.fillRect(x+4,y+3,44,3);
   g.strokeStyle='rgba(60,40,20,.4)';g.lineWidth=1;g.strokeRect(x+.5,y+.5,51,19);
  }
 }
 return canvas;
}

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
 // A unit hip-and-gable roof with a short hip, so each row block reads as one long tiled hall.
 const prism=hipGableRoof(1,1,1,.06,.16);
 const make=(geometry,material)=>{const mesh=new THREE.InstancedMesh(geometry,material,records.length);mesh.frustumCulled=false;group.add(mesh);return mesh};
 const footing=make(new THREE.BoxGeometry(1,1,1),mats.stone);footing.name='shop-footing';
 const walls=make(new THREE.BoxGeometry(1,1,1),mats.wall);walls.name='shop-walls';
 const roofs=make(prism,mats.roof);roofs.name='shop-roofs';
 mats.ridge=new THREE.MeshStandardMaterial({color:0x8b908f,roughness:1});mats.roof.side=THREE.DoubleSide;
 const ridges=make(new THREE.BoxGeometry(1,1,1),mats.ridge);ridges.name='shop-ridges';
 // Gable-end walls close both ends of each block.
 const endLeft=make(new THREE.BoxGeometry(1,1,1),mats.wall);endLeft.name='shop-end-wall-left';
 const endRight=make(new THREE.BoxGeometry(1,1,1),mats.wall);endRight.name='shop-end-wall-right';
 // Open shopfronts: a counter under an awning on posts, with the keeper standing behind it.
 const counters=make(new THREE.BoxGeometry(1,1,1),mats.counter);counters.name='shop-counters';
 const awnings=make(new THREE.BoxGeometry(1,1,1),mats.awning);awnings.name='shop-awnings';
 const postsLeft=make(new THREE.CylinderGeometry(.09,.11,1,6),mats.post);postsLeft.name='awning-post-left';
 const postsRight=make(new THREE.CylinderGeometry(.09,.11,1,6),mats.post);postsRight.name='awning-post-right';
 // Keepers and signboards live in their own group: their counts differ from the block count.
 const extras=new THREE.Group();extras.name='shop-keepers-and-signs';group.add(extras);
 // Timber posts on the open front mark every bay (칸) of the row.
 const baySpots=records.flatMap((r,i)=>Array.from({length:r.bays+1},(_,k)=>({record:i,along:(k/r.bays-.5)*r.length})));
 const bayPosts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.14,1,6),mats.post,baySpots.length);bayPosts.name='shop-bay-posts';bayPosts.frustumCulled=false;extras.add(bayPosts);
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
 // Every shop gets goods cards for its zone's trade, one or two along the counter.
 const goodsMeshes=[];
 if(data.signs&&belfry){
  const axis=sample(0),byZone=new Map();
  records.forEach((r,i)=>{
   const offset=(r.x-belfry.position.x)*axis.dx+(r.z-belfry.position.z)*axis.dz;
   const zone=data.signs.zones.find(z=>offset>=z.from_m&&offset<z.to_m);if(!zone)return;
   r.trade=zone.hangul;if(!byZone.has(zone.hangul))byZone.set(zone.hangul,[]);
   const count=r.bays>=6?2:1;
   for(let k=0;k<count;k++)byZone.get(zone.hangul).push({record:i,along:count===1?0:(k?.22:-.22)*r.length});
  });
  for(const [trade,spots] of byZone){
   const texture=new THREE.CanvasTexture(drawGoods(trade));texture.colorSpace=THREE.SRGBColorSpace;
   const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1.7,.85),new THREE.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.3,roughness:1,side:THREE.DoubleSide}),spots.length);
   mesh.name='shop-goods';mesh.frustumCulled=false;mesh.userData={trade,spots};extras.add(mesh);goodsMeshes.push(mesh);
  }
 }
 // Invisible pick boxes make each row clickable; the card describes the trade of its zone.
 const SOURCES=[
  {title:'우리역사넷 육의전',url:'https://contents.history.go.kr/front/km/view.do?levelId=km_003_0040_0030_0010'},
  {title:'우리역사넷 조선 전기 신도의 시전 상업',url:'https://contents.history.go.kr/front/km/view.do?levelId=km_003_0040_0020_0010'},
  {title:'우리역사넷 도가와 시전 행랑',url:'https://contents.history.go.kr/mobile/km/view.do?levelId=km_003_0040_0040_0050_0010'}];
 const TRADES={
  '선전':'중국산 비단을 파는 시전. 육의전 가운데 으뜸인 수전(首廛)으로 국역 부담이 가장 컸다.',
  '면포전':'무명과 은을 파는 시전. 무명이 돈처럼 쓰여 국역 부담이 컸고 육의전에 들었다.',
  '면주전':'국산 명주를 파는 시전으로 육의전에 들었다.',
  '내어물전':'말린 어물과 소금에 절인 어물을 파는 어물전으로 육의전에 들었다.',
  '저포전':'모시를 파는 시전으로 육의전에 들었다.'};
 const picks=new THREE.Group();picks.name='shop-picks';group.add(picks);
 const pickMaterial=new THREE.MeshBasicMaterial({visible:false});
 records.forEach((r,i)=>{
  const zone=data.signs?.zones.find(z=>z.hangul===r.trade);
  const name=zone?`${zone.hangul}(${zone.hanja}) 행랑`:'시전 행랑';
  const feature={id:`sijeon-row-${i}`,name,category:'상업',symbol_size_m:[r.length,height,depth],reference:SOURCES[0].url,
   note:zone?`${zone.sells}을 파는 ${zone.hangul}. 행랑 한 채의 위치는 표시용이다.`:'운종가 시전 행랑. 행랑 한 채의 위치는 표시용이다.',
   info:{summary:(zone?TRADES[zone.hangul]+' ':'')+'운종가 양쪽에 나라가 지어 상인에게 빌려준 가게 줄(행랑)의 한 채다.',
    period:'1412년(태종 12) 이후 세 차례 공사로 혜정교에서 창덕궁 동구까지 행랑 2,027칸을 지었다. 시전 체제가 끝난 시기는 미확인.',
    in_1750:'있었다. 다만 행랑 한 채씩은 원도에 그려져 있지 않아, 원도에서 읽은 길을 따라 표시용으로 늘어놓았다.'+(zone?` 이 구간을 ${zone.hangul}으로 둔 것은 ${zone.basis}에 있었다는 문헌 위치를 따른 가정이다.`:''),
    sources:SOURCES}};
  const box=new THREE.Mesh(new THREE.BoxGeometry(r.length,height+1.5,depth+3),pickMaterial);
  box.name='shop-pick';box.userData={feature,record:i};picks.add(box);
 });
 // A signboard opens the same card as its row.
 for(const board of signs)board.userData.feature=picks.children[board.userData.record].userData.feature;
 const dummy=new THREE.Object3D(),tilt=new THREE.Euler();
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
   place(roofs,sill+height,r.length+1.1,1.7,depth+1.7);
   place(ridges,sill+height+1.75,r.length+1.1-(depth+1.7)*.16,.2,.3);
   for(const [mesh,side] of [[endLeft,-1],[endRight,1]])place(mesh,sill+height/2,.25,height,depth,0,side*(r.length/2-.12));
   place(counters,sill+.4,r.length*.94,.8,.8,-depth*.42);
   place(awnings,eave-.35,r.length+.7,.16,2.2,-depth*.5-1);
   for(const [mesh,side] of [[postsLeft,-1],[postsRight,1]]){
    dummy.position.set(r.x+(-depth*.5-1.9)*Math.sin(r.yaw)+side*r.length*.46*Math.cos(r.yaw),
     (sill+eave-.35)/2,r.z+(-depth*.5-1.9)*Math.cos(r.yaw)-side*r.length*.46*Math.sin(r.yaw));
    dummy.rotation.set(0,r.yaw,0);dummy.scale.set(1,eave-.35-sill,1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
   }
  });
  baySpots.forEach((b,j)=>{
   const r=records[b.record];
   if(!r.displayed){dummy.scale.set(0,0,0);dummy.updateMatrix();bayPosts.setMatrixAt(j,dummy.matrix);return}
   const s=Math.sin(r.yaw),c=Math.cos(r.yaw),dz=-depth*.5+.15,sill=r.floor+.4;
   dummy.position.set(r.x+dz*s+b.along*c,sill+height/2,r.z+dz*c-b.along*s);dummy.rotation.set(0,r.yaw,0);dummy.scale.set(1,height,1);dummy.updateMatrix();bayPosts.setMatrixAt(j,dummy.matrix);
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
  // Goods cards lie on the counter top, tipped up toward the street.
  for(const mesh of goodsMeshes)mesh.userData.spots.forEach((g,j)=>{
   const r=records[g.record];
   if(!r.displayed){dummy.scale.set(0,0,0);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);return}
   const s=Math.sin(r.yaw),c=Math.cos(r.yaw),dz=-depth*.42;
   dummy.position.set(r.x+dz*s+g.along*c,r.floor+.4+.8+.27,r.z+dz*c-g.along*s);
   dummy.quaternion.setFromEuler(tilt.set(-1,r.yaw+Math.PI,0,'YXZ'));dummy.scale.set(1,1,1);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);
  });
  picks.children.forEach(box=>{
   const r=records[box.userData.record];box.visible=!!r.displayed;if(!r.displayed)return;
   const s=Math.sin(r.yaw),c=Math.cos(r.yaw),dz=-.75;
   box.position.set(r.x+dz*s,r.floor+.4+(height+1.5)/2,r.z+dz*c);box.rotation.set(0,r.yaw,0);
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
 return {group,records,signs,goodsMeshes,picks,keeperCount:keeperSpots.length,updateGround,updateHeights,setMapVisible,get visibleCount(){return visible},
  get bayCount(){return records.reduce((sum,r)=>sum+r.bays,0)}};
}
