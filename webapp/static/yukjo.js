import * as THREE from 'three';

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

// Independently made schematic compounds, informed by the pre-1865 street plan.
export function createYukjo(feature,w,h,d){
 const model=new THREE.Group();model.name='yukjo-compound';const parts=[];
 const palette={wall:0xcebea0,timber:0x794d35,roof:0x485150,stone:0xa49a86,door:0x513c2d,trim:0x617a65};
 const mats=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:1})]));
 function block(parent,name,x,y,z,sx,sy,sz,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mats[material]);mesh.name=name;mesh.position.set(x,y,z);parent.add(mesh);return mesh}
 function roof(parent,width,depth,eave,rise){
  const rw=width/2,rd=depth/2,g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-rw,eave,-rd,rw,eave,-rd,rw,eave,rd,-rw,eave,rd,-rw*.65,eave+rise,0,rw*.65,eave+rise,0],3));
  g.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=new THREE.Mesh(g,mats.roof);mesh.name='tile-roof';parent.add(mesh);
  block(parent,'ridge',0,eave+rise+.12,0,width*.66,.24,.3,'stone');
  block(parent,'eave',0,eave,0,width,.25,depth,'roof');
 }
 function part(x,z,width,depth,yaw=0){
  const root=new THREE.Group();root.position.set(x,-h/2,z);root.rotation.y=yaw;model.add(root);
  const footing=block(root,'footing',0,-.15,0,width,.3,depth,'stone');
  const record={root,footing,x,z,w:width,d:depth,yaw};parts.push(record);return root;
 }
 function hall(x,z,width,depth,height,yaw=0,gate=false){
  const root=part(x,z,width+2,depth+2,yaw),bayCount=Math.max(3,Math.round(width/4.5)),bay=width/bayCount;
  if(gate){
   for(const side of [-1,1])block(root,'gate-pier',side*(width/4+1),height/2,0,width/2-2,height,depth,'wall');
  }else{
   block(root,'hall-wall',0,height/2,-.7,width,height,depth-1.4,'wall');
   for(let i=0;i<bayCount;i++){
    const px=-width/2+bay*(i+.5);
    block(root,'window',px,height*.56,depth/2-.67,bay*.64,height*.5,.14,'trim');
    for(const k of [-1,0,1])block(root,'window-lattice',px+k*bay*.19,height*.56,depth/2-.55,.1,height*.5,.12,'wall');
   }
  }
  for(let i=0;i<=bayCount;i++)for(const side of [-1,1])block(root,'timber-post',-width/2+i*bay,height/2,side*depth/2,.3,height,.3,'timber');
  block(root,'beam',0,height-.25,depth/2,width,.45,.4,'timber');
  roof(root,width+2,depth+2,height,gate?1.9:2.3);return root;
 }
 function wall(x,z,width,depth){const root=part(x,z,width,depth);block(root,'plaster-wall',0,1.15,0,width,2.3,depth,'wall');roof(root,width+.3,depth+.5,2.3,.4)}
 // The front of every plot faces the street. Keep an open passage in the gate.
 const gateWidth=Math.min(13,w*.24),front=d/2-5;
 for(const side of [-1,1]){
  const length=(w-gateWidth)/2-2;
  hall(side*(gateWidth/2+length/2),front,length,6,3.5);
  // Side/back enclosure is divided so it follows the terrain instead of hovering.
  const count=Math.ceil((d-10)/10),step=(d-10)/count;
  for(let i=0;i<count;i++)wall(side*(w/2-.8),-d/2+3+(i+.5)*step,1.2,step+.05);
 }
 hall(0,front,gateWidth,7,4.8,0,true);
 const count=Math.ceil(w/10),step=w/count;
 for(let i=0;i<count;i++)wall(-w/2+(i+.5)*step,-d/2+2,step+.05,1.2);
 // Main court, flanking offices and a secondary rear office vary with plot size.
 const large=feature.court_type==='large';
 hall(0,-d*.12,w*(large?.52:.6),Math.min(13,d*.2),large?5.7:4.8);
 if(d>45)hall(-w*.13,-d*.36,w*.42,8,3.6);
 for(const side of [-1,1])hall(side*w*.33,d*.05,Math.min(d*.36,25),7,3.5,Math.PI/2);
 if(large)hall(w*.28,-d*.3,w*.22,8,3.6);
 model.userData={parts,conceptual:true,reference:feature.reference};batch(model);return model;
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
