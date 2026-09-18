import * as THREE from 'three';

// A palace throne hall (정전) with its two-tier stone terrace, courtyard, cloister and inner gate.
// Proportions follow the recorded bay counts of each hall; the ornament is a simplified 단청 scheme.
// This is a concept model, not a measured reconstruction.
const PALETTE={stone:0xb9b1a1,paleStone:0xcdc6b7,column:0x8e2f22,wall:0xe6dcc4,lattice:0x7c4a2d,beam:0x2f6b53,bracket:0xb9432c,
 roof:0x3a4346,ridge:0x8e9294,court:0xc4b08b,path:0xa39a8a,cloisterWall:0xd9c9a8,rank:0x8b8577};
function materials(){return Object.fromEntries(Object.entries(PALETTE).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,roughness:1,side:k==='roof'?THREE.DoubleSide:THREE.FrontSide})]))}
function mergeByMaterial(model){
 const buckets=new Map(),v=new THREE.Vector3();
 for(const mesh of [...model.children]){
  if(mesh.userData.walkable)continue;
  mesh.updateMatrix();const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position;
  if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);const values=buckets.get(mesh.material);
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrix);values.push(v.x,v.y,v.z)}
  model.remove(mesh);
 }
 for(const [material,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const mesh=new THREE.Mesh(g,material);mesh.name='hall-surfaces';model.add(mesh)}
}
// Hip-and-gable roof (팔작지붕): long slopes trimmed by the end hips up to the gable line, then a vertical gable
// panel; with gableFrac 1 the hips reach the ridge and the roof is a plain hip (우진각). Concave slope profile and
// eaves that lift toward the corners.
export function hipGableRoof(width,depth,rise,lift=.5,gableFrac=.55){
 const pos=[],a=width/2,b=depth/2,N=12,M=6;
 const slope=t=>rise*Math.pow(t,1.45);
 const quad=(p1,p2,p3,p4)=>{pos.push(...p1,...p2,...p3,...p1,...p3,...p4)};
 for(const sign of [-1,1]){ // front (+z) and back (-z) long slopes
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){
   // The long slopes narrow as they rise so the hips cut them cleanly; above the gable line the width stays.
   const pt=(ii,jj)=>{const u=ii/N,v=jj/M,half=a-Math.min(v,gableFrac)*b,x=-half+u*half*2,ex=Math.abs(x)/a,z=sign*b*(1-v),y=slope(v)+lift*Math.pow(ex,3)*(1-v);return [x,y,z]};
   sign>0?quad(pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1)):quad(pt(i,j),pt(i,j+1),pt(i+1,j+1),pt(i+1,j));
  }
 }
 for(const sign of [-1,1]){ // end hips up to the gable line, then the gable panel
  for(let i=0;i<M;i++)for(let j=0;j<M;j++){
   // Each end hip narrows toward the top, meeting the long slopes along the hip ridges.
   const pt=(ii,jj)=>{const v=(jj/M)*gableFrac,u=ii/M,half=b*(1-v),z=-half+u*half*2,ez=Math.abs(z)/b,x=sign*(a-(v*b)),y=slope(v)+lift*Math.pow(ez,3)*(1-v);return [x,y,z]};
   sign>0?quad(pt(i,j),pt(i,j+1),pt(i+1,j+1),pt(i+1,j)):quad(pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1));
  }
  const v=gableFrac,x=sign*(a-v*b),yv=slope(v),zt=b*(1-v);
  const g1=[x,yv,-zt],g2=[x,yv,zt],g3=[x,rise,0];
  sign>0?pos.push(...g1,...g2,...g3):pos.push(...g1,...g3,...g2);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();return g;
}

export function createThroneHall(feature,w,h,d){
 const spec=feature.throne_hall??{};
 const [cols,rows]=spec.bays??[5,4],[hallW,hallD]=spec.hall_m??[30,20],roofTiers=spec.roof_tiers??feature.palace_roof_tiers??1,terraceTiers=spec.terrace_tiers??2;
 const model=new THREE.Group();model.name='throne-hall';const mats=materials(),parts=[],walkSurfaces=[],blockingRects=[];
 const surfaces=new Set(['courtyard','central-path','gate-platform','gate-step','lower-terrace','upper-terrace','stair','hall-floor']);
 const box=(name,x,y,z,sx,sy,sz,material,ry=0)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);m.position.set(x,y-h/2,z);m.rotation.y=ry;m.name=name;model.add(m);parts.push(name);if(surfaces.has(name)){m.userData.walkable=true;walkSurfaces.push(m)}if(name==='cloister-wall'||name==='hall-walls')blockingRects.push({x,z,hw:sx/2,hd:sz/2});return m};
 const roof=(name,x,z,width,depth,eave,rise,lift,ry=0)=>{const m=new THREE.Mesh(hipGableRoof(width,depth,rise,lift),mats.roof);m.position.set(x,eave-h/2,z);m.rotation.y=ry;m.name=name;model.add(m);parts.push(name);
  const r=box('ridge',x,eave+rise+.15,z,width-depth*.55*2+.6,.32,.5,'ridge',ry);r.rotation.y=ry;return m};
 // Courtyard with cloister ring, inner gate on the south, and rank stones beside the central path.
 const cw=w*.96,cd=d*.96,clW=Math.min(6,w*.1),clH=3.2,gateW=Math.min(cw*.28,18);
 box('courtyard',0,.1,0,cw,.2,cd,'court');
 for(const side of [-1,1]){
  box('cloister-wall',side*(cw/2-clW/2),clH/2+.2,0,clW,clH,cd,'cloisterWall');
  roof('cloister-roof',side*(cw/2-clW/2),0,cd+1,clW+2.2,clH+.2,2.2,.2,Math.PI/2);
 }
 box('cloister-wall',0,clH/2+.2,-(cd/2-clW/2),cw,clH,clW,'cloisterWall');roof('cloister-roof',0,-(cd/2-clW/2),cw+1,clW+2.2,clH+.2,2.2,.2);
 for(const side of [-1,1]){const run=(cw-gateW)/2;box('cloister-wall',side*(gateW/2+run/2),clH/2+.2,cd/2-clW/2,run,clH,clW,'cloisterWall');roof('cloister-roof',side*(gateW/2+run/2),cd/2-clW/2,run+1,clW+2.2,clH+.2,2.2,.2)}
 // Inner gate (정문): taller three-bay gate on the south wall.
 const gH=5.2;
 box('gate-platform',0,.4,cd/2-clW/2,gateW+2,.8,clW+3,'stone');
 for(const side of [-1,1])box('gate-step',0,.2,cd/2-clW/2+side*((clW+3)/2+.4),gateW,.4,.8,'stone');
 for(let i=0;i<=3;i++)for(const zz of [-1,1])blockingRects.push({x:-gateW/2+i*gateW/3,z:cd/2-clW/2+zz*(clW/2+.4),hw:.28,hd:.28});
 for(let i=0;i<=3;i++)for(const zz of [-1,1]){const c=new THREE.Mesh(new THREE.CylinderGeometry(.24,.28,gH,10),mats.column);c.position.set(-gateW/2+i*gateW/3,.8+gH/2-h/2,cd/2-clW/2+zz*(clW/2+.4));c.name='gate-column';model.add(c);parts.push(c.name)}
 box('gate-beam',0,.8+gH-.3,cd/2-clW/2,gateW+.8,.6,clW+1.4,'beam');
 roof('gate-roof',0,cd/2-clW/2,gateW+4,clW+5,.8+gH+.3,3.4,.5);
 // Central path and two rows of rank stones (품계석).
 const pathD=cd/2-clW-hallD/2-d*.1;
 box('central-path',0,.22,cd/2-clW-pathD/2,Math.min(8,cw*.14),.08,pathD,'path');
 for(let i=0;i<9;i++)for(const side of [-1,1])box('rank-stone',side*Math.min(6,cw*.11),.5,cd/2-clW-2-i*(pathD-4)/8,.35,.6,.2,'rank');
 // Two-tier terrace (월대) with balustrade posts and south stairs.
 const hz=-d*.5+clW+d*.08+hallD/2+ (terraceTiers===2?8:5),lowH=1.2,upH=terraceTiers===2?1.3:0;
 const tW=hallW+(terraceTiers===2?18:10),tD=hallD+(terraceTiers===2?14:8);
 box('lower-terrace',0,lowH/2+.2,hz,tW,lowH,tD,'stone');
 if(terraceTiers===2)box('upper-terrace',0,lowH+upH/2+.2,hz,tW*.78,upH,tD*.76,'stone');
 const top=.2+lowH+upH;
 for(let i=0;i<Math.round(tW/3);i++)for(const zz of [-1,1]){
  const x=-tW/2+.3+i*(tW-.6)/Math.round(tW/3);
  if(zz===1&&Math.abs(x)<Math.min(12,hallW*.4)/2+.3)continue;
  box('balustrade-post',x,lowH+.2+.45,hz+zz*(tD/2-.3),.28,.9,.28,'paleStone');
 }
 const stairs=(base,height,front,width)=>{for(let s=0;s<4;s++){const sh=height*(s+1)/4;box('stair',0,base+sh/2,front+(3-s)*.7+.35,width,sh,.72,'stone')}};
 stairs(.2,lowH,hz+tD/2,Math.min(12,hallW*.4));if(terraceTiers===2)stairs(.2+lowH,upH,hz+tD*.76/2,Math.min(10,hallW*.33));
 // The hall: round red columns on stone footings, plaster walls with lattice doors between them,
 // a painted beam and bracket band, and the roof(s).
 const postH=roofTiers===2?h*.34:h*.42,eave=top+postH;
 box('hall-floor',0,top+.15,hz,hallW+1.2,.3,hallD+1.2,'paleStone');
 for(let i=0;i<=cols;i++)for(let j=0;j<=rows;j++){
  if(i>0&&i<cols&&j>0&&j<rows)continue;
  const x=-hallW/2+i*hallW/cols,z=hz-hallD/2+j*hallD/rows;
  box('column-foot',x,top+.35,z,.6,.4,.6,'paleStone');
  const c=new THREE.Mesh(new THREE.CylinderGeometry(.27,.32,postH,10),mats.column);c.position.set(x,top+.3+postH/2-h/2,z);c.name='column';model.add(c);parts.push(c.name);
 }
 box('hall-walls',0,top+.3+postH*.5,hz,hallW-.5,postH*.9,hallD-.5,'wall');
 for(let i=0;i<cols;i++){const x=-hallW/2+(i+.5)*hallW/cols;box('lattice-door',x,top+.3+postH*.45,hz+hallD/2+.05,hallW/cols-.8,postH*.78,.12,'lattice')}
 box('beam-band',0,eave-.55,hz,hallW+.6,.5,hallD+.6,'beam');
 box('bracket-band',0,eave-.05,hz,hallW+1.6,.55,hallD+1.6,'bracket');
 roof('main-roof',0,hz,hallW+8,hallD+7,eave+.4,roofTiers===2?h*.17:h*.3,.9);
 if(roofTiers===2){
  const ub=eave+.4+h*.17+.2,uH=h*.2;
  box('upper-wall',0,ub+uH/2,hz,hallW*.8,uH,hallD*.75,'wall');
  for(let i=0;i<cols;i++)box('upper-window',-hallW*.4+(i+.5)*hallW*.8/cols,ub+uH*.5,hz+hallD*.375+.06,hallW*.8/cols-.7,uH*.6,.1,'lattice');
  box('upper-beam',0,ub+uH-.3,hz,hallW*.8+.6,.5,hallD*.75+.6,'beam');box('upper-bracket',0,ub+uH+.2,hz,hallW*.8+1.4,.5,hallD*.75+1.4,'bracket');
  roof('upper-roof',0,hz,hallW*.8+7,hallD*.75+6,ub+uH+.5,h*.2,.8);
 }
 mergeByMaterial(model);
 model.userData={conceptual:true,roofTiers,terraceTiers,bays:[cols,rows],hallM:[hallW,hallD],parts,footprint:[w,d],hallCenterZ:hz,period:feature.temporal,walkSurfaces,blockingRects,accessFront:Math.max(d/2,cd/2+2.3),accessHeight:.4};
 return model;
}
