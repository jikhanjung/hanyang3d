import * as THREE from 'three';

// Wongaksa ten-storey marble pagoda as it stood around 1750: a three-tier cross-plan base,
// seven standing storeys, and the top three storeys lying beside it (fallen c. 1592, reset 1947).
export function createPagoda(feature,w,h,d){
 const model=new THREE.Group();model.name='wongaksa-pagoda';
 const mats={
  marble:new THREE.MeshStandardMaterial({color:0xe3e0d6,roughness:.9}),
  shade:new THREE.MeshStandardMaterial({color:0xc9c5b8,roughness:1}),
  paving:new THREE.MeshStandardMaterial({color:0xa9a391,roughness:1}),
 };
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material,rx=0,rz=0,ry=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);
  mesh.position.set(x,y-h/2,z);mesh.rotation.set(rx,ry,rz);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 // The lower tiers and first storeys use the 亞-shaped plan: two crossed rectangles.
 function cross(name,y,size,height,material){
  box(name,0,y+height/2,0,size,height,size*.62,material);
  box(name,0,y+height/2,0,size*.62,height,size,material);
 }
 box('paving',0,.1,0,w,.2,d,'paving');
 let y=.2;
 const baseSizes=[7.2,6.2,5.3];
 for(const size of baseSizes){cross('pagoda-base',y,size,.85,'marble');cross('base-cap',y+.85,size+.3,.14,'shade');y+=.99}
 // Ten storeys shrink upward; storeys 1–3 keep the cross plan, 4–10 are square.
 const storey=i=>({size:4.3-i*.28,height:.78-i*.03,cross:i<3});
 const standing=7,fallen=3;
 for(let i=0;i<standing;i++){
  const s=storey(i);
  if(s.cross)cross('pagoda-storey',y,s.size,s.height,'marble');else box('pagoda-storey',0,y+s.height/2,0,s.size,s.height,s.size,'marble');
  // Each storey carries a thin roof stone that overhangs its body.
  box('pagoda-roof',0,y+s.height+.09,0,s.size+.9,.18,s.size+.9,'shade');
  y+=s.height+.18;
 }
 // The three fallen storeys lie flat in a row on the paving south of the pagoda,
 // each with its roof stone resting askew on top.
 for(let k=0;k<fallen;k++){
  const s=storey(standing+k),x=-3.2+k*3.2,z=d*.37;
  box('fallen-storey',x,.2+s.height/2,z,s.size,s.height,s.size,'marble',0,.06*(k-1),.3+k*.4);
  box('fallen-roof',x+.2,.2+s.height+.1,z-.1,s.size+.9,.18,s.size+.9,'shade',.08,0,.5+k*.35);
 }
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='pagoda-surfaces';model.add(mesh)}
 model.userData={conceptual:true,standingStoreys:standing,fallenStoreys:fallen,standingHeightM:y-.2,parts,footprint:[w,d],period:feature.temporal};
 return model;
}
