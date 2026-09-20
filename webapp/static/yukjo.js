import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

// Batch the many posts and walls by material; rebuild only when ground heights change.
function batch(model){
 for(const mesh of model.userData.batches??[]){model.remove(mesh);mesh.geometry.dispose()}
 const buckets=new Map(),matrix=new THREE.Matrix4(),vertex=new THREE.Vector3();
 for(const p of model.userData.parts){
  p.root.updateMatrix();p.root.visible=false;
  for(const mesh of p.root.children){
   mesh.updateMatrix();matrix.multiplyMatrices(p.root.matrix,mesh.matrix);
   const geometry=mesh.geometry,positions=geometry.attributes.position,indices=geometry.index;
   if(!buckets.has(mesh.material))buckets.set(mesh.material,[]);
   const out=buckets.get(mesh.material),count=indices?indices.count:positions.count;
   for(let i=0;i<count;i++){vertex.fromBufferAttribute(positions,indices?indices.getX(i):i).applyMatrix4(matrix);out.push(vertex.x,vertex.y,vertex.z)}
  }
 }
 model.userData.batches=[];
 for(const [material,positions] of buckets){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,material);mesh.name='compound-surfaces';model.add(mesh);model.userData.batches.push(mesh);
 }
}

// Government office compound (관아) laid out the way Joseon offices were: an outer three-bay gate (외삼문) in the
// front row of corridor halls, a stone-paved court with a central path, an inner gate (내삼문) on deeper plots, the
// main hall (정당·동헌) on a stone terrace with stairs, wing corridors (익랑) along both sides, and behind it the
// rear quarters and a storehouse. Every hall and wall segment is its own part with a footing so it follows the ground.
// Bay counts follow feature.court_type (large: seven-bay main hall); the layout is a concept, not a survey.
export function createYukjo(feature,w,h,d){
 const model=new THREE.Group();model.name='yukjo-compound';const parts=[],blockingRects=[],walkSurfaces=[];
 const palette={wall:0xe2d7bf,timber:0x6f4630,roof:0x485150,stone:0xb3a993,paleStone:0xc9c1b0,door:0x513c2d,trim:0x7a5a3c,court:0xc6b48f,path:0xa59c8c,store:0xd8ccb2,ridge:0x8e9294};
 const mats=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:1,side:key==='roof'?THREE.DoubleSide:THREE.FrontSide})]));
 function block(parent,name,x,y,z,sx,sy,sz,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh}
 // Gable roof (맞배지붕): two slopes with a slight concave curve, open gable ends closed by a panel.
 function gableRoof(parent,width,depth,eave,rise,lift=.35){
  const pos=[],a=width/2,b=depth/2,N=8,M=4,slope=t=>rise*Math.pow(t,1.35);
  const quad=(p1,p2,p3,p4)=>{pos.push(...p1,...p2,...p3,...p1,...p3,...p4)};
  for(const sign of [-1,1])for(let i=0;i<N;i++)for(let j=0;j<M;j++){
   const pt=(ii,jj)=>{const u=ii/N,v=jj/M,x=-a+u*width,ex=Math.abs(x)/a;return [x,eave+slope(v)+lift*Math.pow(ex,3)*(1-v),sign*b*(1-v)]};
   sign>0?quad(pt(i,j),pt(i+1,j),pt(i+1,j+1),pt(i,j+1)):quad(pt(i,j),pt(i,j+1),pt(i+1,j+1),pt(i+1,j));
  }
  for(const sign of [-1,1]){const x=sign*a,g1=[x,eave,-b],g2=[x,eave,b],g3=[x,eave+rise,0];sign>0?pos.push(...g1,...g2,...g3):pos.push(...g1,...g3,...g2)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name='tile-roof';parent.add(mesh);
  block(parent,'ridge',0,eave+rise+.1,0,width-.4,.22,.4,'ridge');
 }
 function hipRoof(parent,width,depth,eave,rise){
  const mesh=new THREE.Mesh(hipGableRoof(width,depth,rise,.6,.5),mats.roof);mesh.position.y=eave;mesh.name='tile-roof';parent.add(mesh);
  block(parent,'ridge',0,eave+rise+.12,0,width-depth*.5*2+.6,.26,.4,'ridge');
 }
 function part(x,z,width,depth,yaw=0){
  const root=new THREE.Group();root.position.set(x,-h/2,z);root.rotation.y=yaw;model.add(root);
  const footing=block(root,'footing',0,-.15,0,width,.3,depth,'stone');
  const record={root,footing,x,z,w:width,d:depth,yaw};parts.push(record);return root;
 }
 // A timber hall: posts on a low floor, plaster walls, lattice windows on the front, beam, roof.
 function hall(x,z,width,depth,height,{yaw=0,gate=false,terrace=0,hip=false,store=false,bays}={}){
  const root=part(x,z,width+2+terrace*2,depth+2+terrace*2,yaw),bayCount=bays??Math.max(3,Math.round(width/3.6)),bay=width/bayCount;
  if(gate){for(const side of [-1,1])blockingRects.push({x:x+side*width/3,z,hw:width/6,hd:depth/2,yaw})}
  else blockingRects.push({x,z,hw:width/2,hd:depth/2,yaw});
  let base=0;
  if(terrace){base=.9;block(root,'terrace',0,base/2,0,width+terrace*2,base,depth+terrace*2,'stone');
   for(let s=0;s<3;s++)block(root,'stair',0,base*(s+1)/6,depth/2+terrace+(2-s)*.6+.3,Math.min(6,width*.3),base*(s+1)/3,.6,'paleStone')}
  const floor=block(root,'hall-floor',0,base+.12,0,width+.6,.24,depth+.6,'paleStone');if(gate)walkSurfaces.push(floor);
  if(gate){
   // Three-bay gate: the centre bay is a taller passage with double doors, the side bays are closed rooms.
   const cb=width/3;
   for(const side of [-1,1])block(root,'gate-room',side*cb,base+height*.45,0,cb-.4,height*.9,depth-.6,'wall');
   for(const side of [-1,1])block(root,'gate-leaf',side*(cb/2-.1),base+height*.5,-cb*.23,.2,height*.85,cb*.46,'door');
  }else if(store){
   block(root,'store-wall',0,base+height*.5,0,width-.3,height,depth-.4,'store');
   for(let i=0;i<bayCount;i+=2)block(root,'store-vent',-width/2+bay*(i+.5),base+height*.7,depth/2-.1,bay*.4,height*.2,.1,'door');
  }else{
   block(root,'hall-wall',0,base+height*.5,-.3,width-.3,height*.96,depth-.9,'wall');
   for(let i=0;i<bayCount;i++){
    const px=-width/2+bay*(i+.5),doorBay=i===Math.floor(bayCount/2);
    block(root,doorBay?'door':'window',px,base+height*(doorBay?.45:.58),depth/2-.35,bay*.68,height*(doorBay?.86:.5),.14,doorBay?'door':'trim');
    for(const k of [-1,0,1])block(root,'window-lattice',px+k*bay*.2,base+height*(doorBay?.45:.58),depth/2-.25,.08,height*(doorBay?.8:.46),.1,'wall');
   }
  }
  for(let i=0;i<=bayCount;i++)for(const side of [-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.16,.19,height,8),mats.timber);post.name='timber-post';post.position.set(-width/2+i*bay,base+height/2,side*depth/2);root.add(post)}
  block(root,'beam',0,base+height-.2,0,width+.4,.4,depth+.4,'timber');
  if(hip)hipRoof(root,width+4.5,depth+4,base+height+.15,Math.min(4.2,1.6+depth*.18));else gableRoof(root,width+2.4,depth+3,base+height+.15,Math.min(3.2,1.2+depth*.17));
  return root;
 }
 function wall(x,z,width,depth){blockingRects.push({x,z,hw:width/2,hd:depth/2,yaw:0});const root=part(x,z,width,depth);block(root,'plaster-wall',0,1.15,0,width,2.3,depth,'wall');block(root,'wall-cap',0,2.45,0,width+.3,.3,depth+.5,'roof')}
 function ground(name,x,z,width,depth,material,height=.12){const root=part(x,z,width,depth);walkSurfaces.push(block(root,name,0,height/2,0,width,height,depth,material))}
 const large=feature.court_type==='large',deep=d>=50,front=d/2-5;
 // Front row: corridor halls (행랑) either side of the outer gate; enclosure walls along the sides and back.
 const gateWidth=Math.min(12,w*.24);
 for(const side of [-1,1]){
  const length=(w-gateWidth)/2-2;
  hall(side*(gateWidth/2+length/2),front,length,5.5,3.3);
  const count=Math.ceil((d-10)/10),step=(d-10)/count;
  for(let i=0;i<count;i++)wall(side*(w/2-.8),-d/2+3+(i+.5)*step,1.2,step+.05);
 }
 hall(0,front,gateWidth,6.5,4.6,{gate:true});
 const back=Math.ceil(w/10),bstep=w/back;
 for(let i=0;i<back;i++)wall(-w/2+(i+.5)*bstep,-d/2+2,bstep+.05,1.2);
 // Main hall on its terrace; inner gate and cross wall on deep plots; central stone path from the gate.
 // Wing corridors need room beside the main hall; plots narrower than 44 m go without them.
 const wings=w>=44,hallW=Math.min(w*(large?.5:.56),wings?w-30:w-12),hallD=Math.min(12,d*.2),hallZ=deep?-d*.08:-d*.14,hallH=large?5.4:4.6;
 hall(0,hallZ,hallW,hallD,hallH,{terrace:1.6,hip:true,bays:large?7:5});
 if(deep){
  const gz=hallZ+hallD/2+d*.2,innerW=Math.min(9,w*.18);
  hall(0,gz,innerW,4.5,3.8,{gate:true});
  for(const side of [-1,1]){const run=(w-innerW)/2-3-(hallW>w*.5?0:0);wall(side*(innerW/2+run/2),gz,run,1)}
 }
 ground('central-path',0,(front-3+hallZ+hallD/2+2)/2,Math.min(5,w*.12),front-3-(hallZ+hallD/2+2),'path');
 // Wing corridors (익랑) along both sides of the main court, between the front row and the main hall's front.
 if(wings){const z0=hallZ-hallD/2-2,z1=front-6,len=Math.min(z1-z0-2,26);for(const side of [-1,1])hall(side*(w/2-6.5),(z0+z1)/2,len,5.5,3.2,{yaw:Math.PI/2})}
 // Rear quarters: living hall offset to one side, storehouse along the back, a well in the yard.
 if(d>=40&&w>=30){
  hall(-w*.16,-d*.34,Math.min(w*.36,20),7,3.6,{hip:large});
  if(w>=40)hall(w*.25,-d*.35,Math.min(w*.3,16),6,3.4,{store:true});
  blockingRects.push({x:w*.05,z:-d*.3,hw:1.1,hd:1.1,yaw:0});const well=part(w*.05,-d*.3,2.2,2.2);const ring=new THREE.Mesh(new THREE.CylinderGeometry(1,1.1,.8,10),mats.stone);ring.name='well';ring.position.y=.4;well.add(ring);
 }
 if(large&&d>60)hall(w*.3,-d*.15,Math.min(w*.22,14),6,3.4,{yaw:Math.PI/2});
 model.userData={parts,blockingRects,walkSurfaces,conceptual:true,reference:feature.reference};batch(model);return model;
}

// Each hall and short wall segment has its own ground contact and footing.
export function groundYukjo(box,supportAt){
 const model=box.getObjectByName('yukjo-compound');if(!model)return;
 const c=Math.cos(box.rotation.y),s=Math.sin(box.rotation.y);
 for(const p of model.userData.parts){
  const x=box.position.x+c*p.x+s*p.z,z=box.position.z-s*p.x+c*p.z;
  p.support=supportAt(x,z,p.w,p.d,box.rotation.y+p.yaw);
 }
}
export function heightYukjo(box,ex){
 const model=box.getObjectByName('yukjo-compound');if(!model)return;
 for(const p of model.userData.parts){
  if(!p.support)continue;
  const floor=p.support.max*ex+.08,bottom=p.support.min*ex-.2,depth=floor-bottom;
  p.root.position.y=floor-box.position.y;
  p.footing.scale.y=depth/.3;p.footing.position.y=-depth/2;
 }
 batch(model);
}
