import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

// City and palace gates: a dressed-stone base pierced by arched passages, battlements on top, and a timber
// gate pavilion of one or two storeys with red columns, lattice windows and a curved-eave roof.
// The arch outline and userData fields are shared with the walking, orientation and river-gate checks.
const PALETTE={stone:0xb5aa94,stoneDark:0x9d9280,column:0x8e2f22,wall:0xe6dcc4,lattice:0x6f4a2e,beam:0x2f6b53,bracket:0xb9432c,roof:0x364345,ridge:0x8e9294,floor:0x7a5a3c};
function materials(){return Object.fromEntries(Object.entries(PALETTE).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,roughness:1,side:k==='stone'||k==='roof'?THREE.DoubleSide:THREE.FrontSide})]))}

export function createCityGate(feature,w,h,d){
 const model=new THREE.Group();model.name='gate-model';const mats=materials(),parts=[];
 const box=(name,x,y,z,sx,sy,sz,material)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);m.position.set(x,y-h/2,z);m.name=name;model.add(m);parts.push(name);return m};
 const tiers=feature.gate_tiers??(feature.id==='donuimun'?1:2);
 const base=tiers===0?h*.9:h*.43,doors=feature.id==='gwanghwamun'?3:1;
 const doorWidth=w*(doors===3?.14:.25),spring=base*.48,archTop=base*.85;
 // Stone base with the arched passages (kept as one extruded outline so the passages stay open).
 const outline=new THREE.Shape();outline.moveTo(-w/2,0);outline.lineTo(-w/2,base);outline.lineTo(w/2,base);outline.lineTo(w/2,0);
 const centres=Array.from({length:doors},(_,i)=>(i-(doors-1)/2)*w*.27);
 for(const x of [...centres].reverse()){
  outline.lineTo(x+doorWidth/2,0);outline.lineTo(x+doorWidth/2,spring);
  outline.quadraticCurveTo(x+doorWidth/2,archTop,x,archTop);
  outline.quadraticCurveTo(x-doorWidth/2,archTop,x-doorWidth/2,spring);outline.lineTo(x-doorWidth/2,0);
 }
 outline.closePath();
 const arch=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:d,bevelEnabled:false,curveSegments:12}),mats.stone);
 arch.name='stone-arch';arch.position.set(0,-h/2,-d/2);model.add(arch);parts.push('stone-arch');
 // Coursing lines and a projecting cornice make the base read as dressed stone.
 // Coursing lines run only over solid stone: they stop at each passage below the arch top.
 const edges=[-w/2,...centres.flatMap(x=>[x-doorWidth/2-.15,x+doorWidth/2+.15]),w/2];
 for(let y=1.4;y<base-.6;y+=1.4)for(const zz of [-1,1]){
  if(y>=archTop){box('stone-course',0,y,zz*(d/2+.02),w+.04,.12,.04,'stoneDark');continue}
  for(let i=0;i<edges.length;i+=2){const x0=edges[i],x1=edges[i+1];if(x1-x0>.3)box('stone-course',(x0+x1)/2,y,zz*(d/2+.02),x1-x0,.12,.04,'stoneDark')}
 }
 box('cornice',0,base+.15,0,w+.6,.3,d+.6,'stoneDark');
 // Battlements (여장) around the top of the base, open in front of the pavilion doors.
 const merlon=1.1,gapM=.5,mh=1.3;
 const crenel=(x0,z0,x1,z1)=>{const len=Math.hypot(x1-x0,z1-z0),n=Math.max(1,Math.floor(len/(merlon+gapM))),ux=(x1-x0)/len,uz=(z1-z0)/len;
  for(let i=0;i<n;i++){const s=(i+.5)*len/n;const m=box('merlon',x0+ux*s,base+.3+mh/2,z0+uz*s,merlon,mh,.5,'stone');m.rotation.y=Math.atan2(ux,uz)+Math.PI/2}};
 crenel(-w/2+.3,-d/2+.25,w/2-.3,-d/2+.25);crenel(-w/2+.3,d/2-.25,w/2-.3,d/2-.25);crenel(-w/2+.25,-d/2+.3,-w/2+.25,d/2-.3);crenel(w/2-.25,-d/2+.3,w/2-.25,d/2-.3);
 // Gate pavilion: a timber hall on the base with red columns, plaster and lattice, and a hip-and-gable roof
 // (a plain hip for the great south gate).
 if(tiers>0){
  const pw=w*.72,pd=d*.62,step=(h-base)/tiers,gable=feature.id==='sungnyemun'?1:.55;
  for(let tier=0;tier<tiers;tier++){
   const shrink=1-tier*.12,tw=pw*shrink,td=pd*shrink,bottom=base+.3+tier*step,postH=step*.55,eave=bottom+postH;
   const cols=doors===3?7:5,rows=2;
   box('pavilion-floor',0,bottom+.15,0,tw+1,.3,td+1,'floor');
   for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++){
    if(i>0&&i<cols&&j>0&&j<rows)continue;
    const c=new THREE.Mesh(new THREE.CylinderGeometry(.22,.26,postH,10),mats.column);c.position.set(-tw/2+i*tw/cols,bottom+.3+postH/2-h/2,-td/2+j*td/rows);c.name='column';model.add(c);parts.push('column');
   }
   box('pavilion-wall',0,bottom+.3+postH*.5,0,tw-.4,postH*.92,td-.4,'wall');
   for(let i=0;i<cols;i++)for(const zz of [-1,1])box('lattice-window',-tw/2+(i+.5)*tw/cols,bottom+.3+postH*.55,zz*(td/2-.1),tw/cols-.6,postH*.55,.1,'lattice');
   box('beam-band',0,eave-.4,0,tw+.6,.45,td+.6,'beam');box('bracket-band',0,eave+.05,0,tw+1.4,.5,td+1.4,'bracket');
   const roof=new THREE.Mesh(hipGableRoof(tw+6,td+5,step*.4,tiers===2?.8:.5,gable),mats.roof);roof.position.set(0,eave+.35-h/2,0);roof.name='gate-roof';model.add(roof);parts.push('gate-roof');
   box('ridge',0,eave+.35+step*.4+.15,0,(tw+6)-(td+5)*gable+.6,.3,.5,'ridge');
  }
 }
 // The barbican (옹성) of Heunginjimun: a curved outer wall in front of the gate (local +z is the outer side
 // once the gate is road-aligned), with its opening left on one side as in the real barbican.
 if(feature.id==='heunginjimun'){
  const R=w*.6,segs=16,a0=-Math.PI/2+.08,a1=Math.PI/2-.55,bh=base*.7;
  for(let i=0;i<segs;i++){const s0=a0+(a1-a0)*i/segs,s1=a0+(a1-a0)*(i+1)/segs,am=(s0+s1)/2,len=R*(s1-s0)+.25;
   box('barbican-wall',R*Math.sin(am),bh/2,d/2+R*Math.cos(am),len,bh,1.8,'stone').rotation.y=am;
   box('barbican-merlon',R*Math.sin(am),bh+.55,d/2+R*Math.cos(am),len*.55,1.1,1.4,'stone').rotation.y=am}
 }
 // Merge static parts by material; the arch stays its own mesh for the passage checks.
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  if(mesh===arch)continue;mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='gate-surfaces';model.add(mesh)}
 model.userData={doors,centres,doorWidth,archTestY:-h/2+spring*.6,tiers,parts,conceptual:true};
 return model;
}
