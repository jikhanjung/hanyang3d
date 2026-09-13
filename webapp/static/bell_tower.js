import * as THREE from 'three';

// Two-storey bell pavilion over an open ground floor, the way the 운종가 belfry is described.
export function createBellTower(feature,w,h,d){
 const model=new THREE.Group();model.name='bell-tower';
 const palette={stone:0xb0a892,wood:0x82402f,rail:0x5d7566,roof:0x39464a,bell:0x6d6a5c};
 const mats=Object.fromEntries(Object.entries(palette).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 const parts=[];
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);mesh.name=name;model.add(mesh);parts.push(name);return mesh;
 }
 function roof(name,x,z,width,depth,eave,rise){
  const g=new THREE.BufferGeometry(),a=width/2,b=depth/2;
  g.setAttribute('position',new THREE.Float32BufferAttribute([-a,.1,-b,a,.1,-b,a,.1,b,-a,.1,b,-a*.78,.42,-b*.66,a*.78,.42,-b*.66,a*.78,.42,b*.66,-a*.78,.42,b*.66,-a*.5,rise,0,a*.5,rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name=name;mesh.position.set(x,eave-h/2,z);model.add(mesh);parts.push(name);
  box('ridge',x,eave+rise+.1,z,width*.5,.2,.24,'stone');
 }
 const base=h*.09,lower=h*.36,upper=h*.24,bays=3;
 box('platform',0,base/2,0,w,base,d,'stone');
 for(let i=0;i<=bays;i++)for(let j=0;j<=bays;j++){
  if(i>0&&i<bays&&j>0&&j<bays)continue;
  const x=(i/bays-.5)*w*.82,z=(j/bays-.5)*d*.82;
  box('column-foot',x,base+.12,z,.55,.24,.55,'stone');
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.21,.26,lower,8),mats.wood);
  post.name='belfry-column';post.position.set(x,base+lower/2-h/2,z);model.add(post);parts.push(post.name);
 }
 // The great bell hangs in the open ground floor between the outer columns.
 const beam=box('bell-beam',0,base+lower-.35,0,w*.5,.4,.4,'wood');
 const bell=new THREE.Mesh(new THREE.CylinderGeometry(w*.1,w*.13,h*.17,12),mats.bell);
 bell.name='great-bell';bell.position.set(0,base+lower-.55-h*.085-h/2,0);model.add(bell);parts.push(bell.name);
 box('bell-hanger',0,base+lower-.45,0,.18,.3,.18,'wood');
 box('floor',0,base+lower+.12,0,w*.94,.24,d*.94,'wood');
 box('railing',0,base+lower+.55,0,w*.96,.55,d*.96,'rail');
 box('railing-open',0,base+lower+.55,0,w*.82,.6,d*.82,'wood');
 for(let i=0;i<=bays;i++)for(let j=0;j<=bays;j++){
  if(i>0&&i<bays&&j>0&&j<bays)continue;
  const x=(i/bays-.5)*w*.78,z=(j/bays-.5)*d*.78;
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.17,.2,upper,8),mats.wood);
  post.name='upper-column';post.position.set(x,base+lower+.3+upper/2-h/2,z);model.add(post);parts.push(post.name);
 }
 const eave=base+lower+.3+upper;
 box('upper-beam',0,eave-.2,0,w*.86,.36,d*.86,'wood');
 roof('tower-roof',0,0,w*1.1,d*1.16,eave,h*.34);
 for(let i=0;i<4;i++)box('stair',0,base*(i+1)/8,d*.5+1.1-i*.32,w*.3,base*(i+1)/4,.7,'stone');
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);g.dispose();
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='bell-tower-surfaces';model.add(mesh)}
 model.userData={conceptual:true,parts,footprint:[w,d],period:feature.temporal};
 return model;
}
