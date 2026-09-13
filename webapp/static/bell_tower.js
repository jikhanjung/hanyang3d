import * as THREE from 'three';

// Two-storey belfry: open ground floor, bell on the upper floor, hip-and-gable roof.
// Shape follows the described Bosingak: five bays by four, round columns on round footings.
const BELL_HEIGHT=3.18,BELL_MOUTH=2.28;
export function createBellTower(feature,w,h,d){
 const model=new THREE.Group();model.name='bell-tower';
 const palette={stone:0xb0a892,wood:0x8a4433,rail:0x6a7f6d,roof:0x39464a,gable:0xd8cdb4,bell:0x6f6a58,floor:0x7d6a52};
 const mats=Object.fromEntries(Object.entries(palette).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:1})]));
 const parts=[];
 function add(mesh,name){mesh.name=name;model.add(mesh);parts.push(name);return mesh}
 function box(name,x,y,z,sx,sy,sz,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.position.set(x,y-h/2,z);return add(mesh,name);
 }
 function column(name,x,y,z,height,radius,material){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius*.86,radius,height,10),mats[material]);
  mesh.position.set(x,y+height/2-h/2,z);return add(mesh,name);
 }
 const bx=5,bz=4,spanX=w*.84,spanZ=d*.84; // five bays across the front, four deep
 const colX=i=>(i/bx-.5)*spanX,colZ=j=>(j/bz-.5)*spanZ;
 const perimeter=[];
 for(let i=0;i<=bx;i++)for(let j=0;j<=bz;j++)if(i===0||i===bx||j===0||j===bz)perimeter.push([colX(i),colZ(j)]);
 const base=h*.1,lower=h*.34,deck=.34,upper=h*.27;
 const lowerTop=base+lower,upperTop=lowerTop+deck+upper;
 box('platform',0,base/2,0,w,base,d,'stone');
 for(let i=0;i<3;i++)box('stair',0,base*(i+1)/6,d*.5+.9-i*.3,w*.26,base*(i+1)/3,.6,'stone');
 // Ground floor stands open on round columns, each on a round footing stone.
 for(const [x,z] of perimeter){
  column('footing-stone',x,base,z,.28,.42,'stone');
  column('lower-column',x,base+.28,z,lower-.28,.24,'wood');
 }
 box('lower-beam',0,lowerTop-.22,0,spanX+1,.44,.5,'wood');
 for(const z of [-spanZ/2,spanZ/2])box('lower-eave-beam',0,lowerTop-.22,z,spanX+1,.4,.4,'wood');
 box('upper-floor',0,lowerTop+deck/2,0,spanX+1.4,deck,spanZ+1.4,'floor');
 // Railing around the upper floor: posts and two rails, open between them.
 const railH=.95;
 for(const [x,z] of perimeter.filter(([x,z])=>Math.abs(x)>=spanX/2-.01||Math.abs(z)>=spanZ/2-.01)){
  box('rail-post',x*1.04,lowerTop+deck+railH/2,z*1.06,.14,railH,.14,'rail');
 }
 for(const z of [-spanZ/2*1.06,spanZ/2*1.06])for(const y of [railH*.45,railH*.95]){
  box('rail-bar',0,lowerTop+deck+y,z,spanX*1.04,.1,.1,'rail');
 }
 for(const x of [-spanX/2*1.04,spanX/2*1.04])for(const y of [railH*.45,railH*.95]){
  box('rail-bar',x,lowerTop+deck+y,0,.1,.1,spanZ*1.06,'rail');
 }
 for(const [x,z] of perimeter)column('upper-column',x,lowerTop+deck,z,upper,.2,'wood');
 box('upper-beam',0,upperTop-.25,0,spanX+.8,.5,.55,'wood');
 // The 1468 bell that hung here: 3.18 m tall with a 2.28 m mouth, hung under the ridge beam.
 const mouth=BELL_MOUTH/2,profile=[[mouth,0],[mouth*1.02,.35],[mouth,.9],[mouth*.92,1.6],[mouth*.75,2.2],[mouth*.53,2.7],[mouth*.26,2.98],[mouth*.09,3.06]]
  .map(([r,y])=>new THREE.Vector2(r,y));
 const bellBottom=lowerTop+deck+.45;
 const bell=new THREE.Mesh(new THREE.LatheGeometry(profile,18),mats.bell);
 bell.position.set(0,bellBottom-h/2,0);add(bell,'great-bell');
 const hook=new THREE.Mesh(new THREE.TorusGeometry(.22,.07,6,12),mats.bell);
 hook.position.set(0,bellBottom+BELL_HEIGHT-.1-h/2,0);hook.rotation.y=Math.PI/2;add(hook,'bell-hook');
 box('bell-hanger',0,bellBottom+BELL_HEIGHT+.35,0,.22,.9,.22,'wood');
 box('bell-beam',0,upperTop-.7,0,.55,.45,spanZ*.5,'wood');
 // Hip-and-gable roof: hipped eaves, a ridge, and a plastered gable panel at each end.
 const rw=(spanX+2.6)/2,rd=(spanZ+3.2)/2,rise=h*.3,ridge=rw*.42,eaveLift=h*.06;
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute([
  -rw,0,-rd, rw,0,-rd, rw,0,rd, -rw,0,rd,
  -rw*.72,eaveLift,-rd*.68, rw*.72,eaveLift,-rd*.68, rw*.72,eaveLift,rd*.68, -rw*.72,eaveLift,rd*.68,
  -ridge,rise,0, ridge,rise,0],3));
 g.setIndex([0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,
  4,8,9,4,9,5,5,9,6,6,9,8,6,8,7,7,8,4]);
 g.computeVertexNormals();
 const roof=new THREE.Mesh(g,mats.roof);roof.position.set(0,upperTop-h/2,0);add(roof,'tile-roof');
 box('ridge',0,upperTop+rise+.12,0,ridge*2+.6,.26,.4,'stone');
 for(const side of [-1,1]){
  const panel=new THREE.BufferGeometry();
  panel.setAttribute('position',new THREE.Float32BufferAttribute([
   side*ridge,rise,0, side*ridge,eaveLift*1.6,-rd*.34, side*ridge,eaveLift*1.6,rd*.34],3));
  panel.computeVertexNormals();
  const mesh=new THREE.Mesh(panel,mats.gable);mesh.material.side=THREE.DoubleSide;
  mesh.position.set(0,upperTop-h/2,0);add(mesh,'gable-panel');
 }
 // Eaves board under the tiles stands in for the double eaves of the real roof.
 box('eave-board',0,upperTop+.06,0,rw*2,.18,rd*2,'wood');
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  mesh.updateMatrix();const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<(index?index.count:p.count);i++){v.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);geometry.dispose();
 }
 for(const [material,values] of buckets){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.name='bell-tower-surfaces';model.add(mesh);
 }
 model.userData={conceptual:true,bays:[bx,bz],bellHeightM:BELL_HEIGHT,bellMouthM:BELL_MOUTH,parts,footprint:[w,d],period:feature.temporal};
 return model;
}
