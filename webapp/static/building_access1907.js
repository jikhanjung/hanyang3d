import * as THREE from 'three';

// Conceptual access stairs join the model's level plinth to the displayed DEM.
// They are not a reconstruction of a documented historical stair footprint.
export function addBuildingAccess1907(model,groundAt){
 const f=model.userData.feature;
 if(!model.userData.blockingRects)return;
 const [w,h,d]=f.symbol_size_m,floor=model.userData.groundFloor;
 const surfaces=model.userData.walkSurfaces??[];
 const foundation=model.getObjectByName('terrain-foundation');
 foundation.userData.solidSupport=true;surfaces.push(foundation);
 const x=model.userData.accessX??0,width=Math.min(8,w*.25),front=model.userData.accessFront??d/2,entryHeight=model.userData.accessHeight??0,tread=.8,riser=.3;
 const vertices=[],point=new THREE.Vector3(),v=new THREE.Vector3();
 let end=front;
 model.updateMatrixWorld(true);
 for(let i=0;i<256;i++){
  const z=front+(i+.5)*tread,top=floor+entryHeight-(i+1)*riser;
  const heights=[-width/2,0,width/2].map(dx=>{point.set(x+dx,-h/2,z+tread/2);model.localToWorld(point);return groundAt(point.x,point.z)});
  if(heights.some(y=>y===null))break;
  const bottom=Math.min(...heights)-.3;
  if(top<bottom)break;
  // Slight overlap prevents raycast cracks at Float32 tread seams.
  const geometry=new THREE.BoxGeometry(width,top-bottom,tread+.02).toNonIndexed();
  geometry.translate(x,(top+bottom)/2-model.position.y,z);
  const p=geometry.attributes.position;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j);vertices.push(v.x,v.y,v.z)}geometry.dispose();
  end=z+tread/2;
  if(top<=Math.min(...heights)+riser)break;
 }
 if(vertices.length){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const stairs=new THREE.Mesh(geometry,foundation.material);stairs.name='access-stairs';stairs.userData.walkable=true;model.add(stairs);surfaces.push(stairs);
 }
 model.userData.walkSurfaces=surfaces;
 model.userData.access={x,front,end,width,riser,tread,estimated:true};
}
