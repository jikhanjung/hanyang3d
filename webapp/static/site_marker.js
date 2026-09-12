import * as THREE from 'three';

// Small standing stone for a remembered site that the old map does not draw.
export function createSiteMarker(feature,w,h,d){
 const model=new THREE.Group();model.name='site-marker';
 const stone=new THREE.MeshStandardMaterial({color:0xa9a496,roughness:1});
 const base=new THREE.MeshStandardMaterial({color:0x8f8a7c,roughness:1});
 const face=new THREE.MeshStandardMaterial({color:0x4a4a44,roughness:1});
 const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y-h/2,z);model.add(mesh);return mesh};
 const slab=h*.82,plinth=h*.18;
 add(new THREE.BoxGeometry(w*1.5,plinth,d*1.5),base,0,plinth/2,0).name='marker-plinth';
 add(new THREE.BoxGeometry(w*.72,slab,d*.42),stone,0,plinth+slab/2,0).name='marker-stone';
 // A darker inscription panel reads as an engraved face from walking distance.
 add(new THREE.BoxGeometry(w*.46,slab*.66,.03),face,0,plinth+slab*.54,d*.21+.02).name='marker-inscription';
 add(new THREE.BoxGeometry(w*.74,h*.035,d*.44),base,0,plinth+slab,0).name='marker-cap';
 model.userData={conceptual:true,commemorative:true,footprint:[w,d],position_status:feature.position_status};
 return model;
}
