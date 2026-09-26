import * as THREE from 'three';

// The source-map layer (and in 1750 the road layer) lies on the terrain and is drawn after all opaque objects with a
// depth offset towards the camera (polygonOffset). That offset grows at shallow viewing angles, so a surface only a
// few centimetres to tens of centimetres above the terrain — a building's base, a courtyard, a low terrace or footing —
// loses to the map from some angles and wins from others: the map shows through in patches as the view turns.
// Drawing those ground-level surfaces in the transparent pass after the map layers lets them cover it. Taller parts
// are left alone. Shared by both eras.
//
// A mesh counts as ground-level when its top is within `lift` metres of the floor: `floor` when the building has one
// flat base (1907), otherwise the highest terrain under the mesh (1750, where footings follow the ground).
export function coverMapOverlay(root,{floor=null,groundAt=null,order=2,lift=1.2}={}){
 const box=new THREE.Box3(),clones=new Map();let count=0;
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||!mesh.material||Array.isArray(mesh.material))return;
  const material=mesh.material;if(material.transparent||material.visible===false)return;
  box.setFromObject(mesh);if(box.isEmpty())return;
  let ground=floor;
  if(ground===null){
   if(!groundAt)return;
   for(const [x,z] of [[box.min.x,box.min.z],[box.max.x,box.min.z],[box.min.x,box.max.z],[box.max.x,box.max.z],[(box.min.x+box.max.x)/2,(box.min.z+box.max.z)/2]]){
    const g=groundAt(x,z);if(g!==null&&Number.isFinite(g))ground=ground===null?g:Math.max(ground,g)}
   if(ground===null)return;
  }
  if(box.max.y-ground>lift)return;
  let cover=clones.get(material);if(!cover){cover=material.clone();cover.transparent=true;cover.opacity=1;clones.set(material,cover)}
  mesh.material=cover;mesh.renderOrder=order;count++;
 });
 return count;
}
