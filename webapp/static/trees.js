import * as THREE from 'three';

export function createTrees(data,sourceSurface,landmarks,settlement,channelPath,wall,granite=null){
 const group=new THREE.Group();group.name='map-woodland';
 let rockThinned=0;
 const records=[],cells=new Map(),obstacles=new Map(),cellSize=24;
 const key=(x,z)=>Math.floor(x/cellSize)+','+Math.floor(z/cellSize);
 const add=(map,r)=>{const k=key(r.x,r.z);if(!map.has(k))map.set(k,[]);map.get(k).push(r)};
 for(const r of settlement.records)add(obstacles,r);
 for(const s of wall.segments)add(obstacles,{x:s.x,z:s.z,radius:s.length/2+5});
 function clashes(map,p,radius){
  const ix=Math.floor(p.x/cellSize),iz=Math.floor(p.z/cellSize);
  for(let x=ix-2;x<=ix+2;x++)for(let z=iz-2;z<=iz+2;z++)for(const r of map.get(x+','+z)??[])
   if(Math.hypot(p.x-r.x,p.z-r.z)<radius+r.radius+2)return true;
  return false;
 }
 for(const [px,py,h,radius,pine,tint,region] of data.features){
  const p=sourceSurface(px,py),water=ChannelTerrain.nearest(p.x,p.z,channelPath);
  if(water.distance<water.width+radius+8||clashes(obstacles,p,radius)||clashes(cells,p,radius))continue;
  if(landmarks.children.some(b=>Math.hypot(p.x-b.position.x,p.z-b.position.z)<Math.hypot(b.userData.feature.symbol_size_m[0],b.userData.feature.symbol_size_m[2])/2+radius+10))continue;
  // Stable sampling keeps the same sparse trees through reloads and height changes.
  const sample=Math.sin(px*12.9898+py*78.233)*43758.5453;
  if(sample-Math.floor(sample)>(granite?.treeProbability(p)??1)){rockThinned++;continue}
  const r={x:p.x,z:p.z,h,radius,pine:!!pine,tint,region,pixel:[px,py]};records.push(r);add(cells,r);
 }
 const make=(geometry,color,name)=>{const m=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}),records.length);m.name=name;group.add(m);return m};
 const trunk=make(new THREE.CylinderGeometry(.65,1,1,6),0x685039,'tree-trunks');
 const broad=make(new THREE.IcosahedronGeometry(1,1),0xffffff,'tree-round-crowns');
 const pineLower=make(new THREE.ConeGeometry(1,1,8),0xffffff,'tree-pine-lower');
 const pineUpper=make(new THREE.ConeGeometry(1,1,8),0xffffff,'tree-pine-upper');
 records.forEach((r,i)=>{const color=new THREE.Color().setHSL(.24+r.tint*.065,.23+r.tint*.1,.24+r.tint*.09);for(const m of [broad,pineLower,pineUpper])m.setColorAt(i,color)});
 let exaggeration=1,mapVisible=true;
 const dummy=new THREE.Object3D();
 function updateHeights(ex=exaggeration){
  exaggeration=ex;
  records.forEach((r,i)=>{
   const s=mapVisible?r.support:r.support.terrain;r.floor=s.max*ex-.12;
   const place=(m,y,sx,sy,sz)=>{dummy.position.set(r.x,r.floor+y,r.z);dummy.rotation.set(0,r.tint*6.28,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix)};
   place(trunk,r.h*.3,r.h*.027,r.h*.6,r.h*.027);
   place(broad,r.h*.68,r.pine?0:r.radius,r.pine?0:r.h*.32,r.pine?0:r.radius*.9);
   place(pineLower,r.h*.55,r.pine?r.radius:0,r.pine?r.h*.56:0,r.pine?r.radius:0);
   place(pineUpper,r.h*.79,r.pine?r.radius*.73:0,r.pine?r.h*.42:0,r.pine?r.radius*.73:0);
  });
  for(const m of group.children){m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere()}
 }
 // Called while shared ground geometry is at its unexaggerated height.
 function updateGround(supportAt){for(const r of records)r.support=supportAt(r.x,r.z,.6,.6,0)}
 function setMapVisible(value){mapVisible=value;updateHeights()}
 document.getElementById('trees3d').onchange=e=>{group.visible=e.target.checked};
 return {group,records,rockThinned,updateGround,updateHeights,setMapVisible};
}
