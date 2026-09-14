import * as THREE from 'three';

// Gyeongbokgung as it lay around 1750: the palace burned in 1592 and was not rebuilt until 1867.
// What remained were the walls, the Gyeonghoeru pond with the pavilion's stone pillars, and the stone
// terraces and column footings of the halls. These models follow the recorded sizes, not a survey.
function merge(parts,name){
 const group=new THREE.Group();group.name=name;const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of parts){
  mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const m=new THREE.Mesh(g,material);m.name=name+'-surfaces';group.add(m)}
 return group;
}
const mats={
 granite:new THREE.MeshStandardMaterial({color:0xb5aea0,roughness:1}),
 darkStone:new THREE.MeshStandardMaterial({color:0x8d877b,roughness:1}),
 basin:new THREE.MeshStandardMaterial({color:0x5c6a63,roughness:1}),
 water:new THREE.MeshStandardMaterial({color:0x3f7f8f,roughness:.35,metalness:.1,transparent:true,opacity:.85}),
 earth:new THREE.MeshStandardMaterial({color:0xb8a77e,roughness:1}),
 grass:new THREE.MeshStandardMaterial({color:0x7d8f52,roughness:1}),
};
const box=(parts,name,mat,x,y,z,sx,sy,sz,ry=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[mat]);m.position.set(x,y,z);m.rotation.y=ry;m.name=name;parts.push(m);return m};

// Pond 128 m east–west by 113 m north–south (위키백과 경회루), the pavilion island near the east bank with its
// 48 stone pillars (8 by 6) still standing after 1592, two small square islands (당주) to the west, and
// three stone bridges from the east bank. The bank stands about a metre above the ground plate.
export function createGyeonghoeruPond(feature,w,h,d){
 // The display size may be smaller than the recorded 128 x 113 m; the pavilion and islands scale with it.
 const parts=[],y0=-h/2,rim=1.2,depth=.9,k=w/128;
 box(parts,'bank-north','granite',0,y0+depth/2,-d/2+rim/2,w,depth,rim);
 box(parts,'bank-south','granite',0,y0+depth/2,d/2-rim/2,w,depth,rim);
 box(parts,'bank-west','granite',-w/2+rim/2,y0+depth/2,0,rim,depth,d);
 box(parts,'bank-east','granite',w/2-rim/2,y0+depth/2,0,rim,depth,d);
 box(parts,'basin-floor','basin',0,y0+.05,0,w-rim*2,.1,d-rim*2);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(w-rim*2,d-rim*2),mats.water);water.rotation.x=-Math.PI/2;water.position.y=y0+depth-.35;water.name='pond-water';
 // Pavilion island: 7 by 5 bays (34.4 by 28.5 m at full size) on a stone platform near the east bank.
 const pw=34.4*k,pd=28.5*k,px=w/2-rim-8*k-pw/2-2*k,pz=-4*k;
 box(parts,'pavilion-platform','granite',px,y0+depth/2+.15,pz,pw+4*k,depth+.3,pd+4*k);
 for(let i=0;i<8;i++)for(let j=0;j<6;j++){
  const outer=i===0||i===7||j===0||j===5,x=px-pw/2+i*pw/7,z=pz-pd/2+j*pd/5;
  const pillar=new THREE.Mesh(outer?new THREE.BoxGeometry(.8*k+.3,4.6,.8*k+.3):new THREE.CylinderGeometry(.32*k+.12,.36*k+.12,4.6,10),mats.darkStone);
  pillar.position.set(x,y0+depth+.3+2.3,z);pillar.name='stone-pillar';parts.push(pillar);
 }
 for(const z of [-9,0,9])box(parts,'stone-bridge','granite',w/2-rim-4*k-1*k,y0+depth+.1,pz+z*k,8*k,.5,2.6*k);
 // Two square islands with grass, on the west side.
 for(const [ix,iz] of [[-w/2+rim+22*k,-d/2+rim+30*k],[-w/2+rim+22*k,d/2-rim-30*k]]){
  box(parts,'island-kerb','granite',ix,y0+depth/2+.1,iz,13*k,depth+.2,13*k);box(parts,'island-top','grass',ix,y0+depth+.25,iz,11.5*k,.3,11.5*k);
 }
 const model=merge(parts,'gyeonghoeru-pond');model.add(water);
 model.userData={conceptual:true,pillars:48,pondM:[w,d],pavilionM:[pw,pd],period:feature.temporal};
 return model;
}

// Hall sites: a stone terrace (one or two tiers) with south stairs and the column footings of the hall on top;
// the halls themselves did not exist in 1750. feature.hall_site gives the hall size in metres and its bays.
export function createHallSite(feature,w,h,d){
 const spec=feature.hall_site??{hall_m:[30,21],bays:[5,5],tiers:2};
 const parts=[],y0=-h/2,[hallW,hallD]=spec.hall_m,[cols,rows]=spec.bays,tiers=spec.tiers??1;
 const lowH=tiers===2?1.3:h-.6,upH=tiers===2?1.42:0;
 box(parts,'lower-terrace','granite',0,y0+lowH/2,0,w,lowH,d);
 if(tiers===2)box(parts,'upper-terrace','granite',0,y0+lowH+upH/2,-2,w*.8,upH,d*.78);
 // South stairs: four steps up to each terrace, each step 0.7 m deep.
 const stairs=(base,height,front,width)=>{for(let s=0;s<4;s++){const sh=height*(s+1)/4;box(parts,'stair','darkStone',0,base+sh/2,front+(3-s)*.7+.35,width,sh,.7)}};
 stairs(y0,lowH,d/2,Math.min(12,w*.3));if(tiers===2)stairs(y0+lowH,upH,d*.78/2-2,10);
 const top=y0+lowH+upH,cz=tiers===2?-2:0;
 for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++)box(parts,'column-footing','darkStone',-hallW/2+i*hallW/cols,top+.25,cz-hallD/2+j*hallD/rows,.9,.5,.9);
 box(parts,'hall-floor','earth',0,top+.06,cz,hallW+1,.12,hallD+1);
 const model=merge(parts,'hall-site');
 model.userData={conceptual:true,terraceM:[w,d],hallM:[hallW,hallD],footings:(cols+1)*(rows+1),tiers,period:feature.temporal};
 return model;
}
