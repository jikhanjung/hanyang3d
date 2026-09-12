import * as THREE from 'three';

// Focus zoom on the visible ground instead of an arbitrary fixed-height orbit plane.
export function setupOrbitNavigation(camera,controls,canvas,pickGround,isFirstPerson,groundAt){
 controls.minDistance=1;controls.zoomToCursor=true;controls.zoomSpeed=1.6;
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),forward=new THREE.Vector3(),touches=new Map();
 function updateNear(){
  if(isFirstPerson())return;
  const ground=groundAt(camera.position.x,camera.position.z);
  if(Number.isFinite(ground)&&camera.position.y<ground+1.1){
   const lift=ground+1.1-camera.position.y;camera.position.y+=lift;controls.target.y+=lift;camera.updateMatrixWorld();
  }
  const near=Math.max(.05,Math.min(10,controls.getDistance()*.01));
  if(Math.abs(camera.near-near)>1e-6){camera.near=near;camera.updateProjectionMatrix()}
 }
 function focus(x,y){
  if(!controls.enabled||isFirstPerson())return;
  const rect=canvas.getBoundingClientRect();pointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
  camera.updateMatrixWorld();raycaster.setFromCamera(pointer,camera);
  const hit=pickGround(raycaster.ray);if(!hit)return;
  camera.getWorldDirection(forward);
  const depth=hit.sub(camera.position).dot(forward);
  if(depth<=0)return;
  // Keep the viewing direction stable; OrbitControls moves along the pointer ray.
  controls.target.copy(camera.position).addScaledVector(forward,Math.max(controls.minDistance,Math.min(controls.maxDistance,depth)));
  updateNear();
 }
 canvas.addEventListener('wheel',event=>focus(event.clientX,event.clientY),{capture:true,passive:true});
 canvas.addEventListener('pointerdown',event=>{
  if(event.pointerType==='touch')touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  else if(event.button===1||event.button===2)focus(event.clientX,event.clientY);
 },true);
 canvas.addEventListener('pointermove',event=>{
  if(!touches.has(event.pointerId))return;
  touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(touches.size===2){const [a,b]=[...touches.values()];focus((a.x+b.x)/2,(a.y+b.y)/2)}
 },true);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>touches.delete(event.pointerId),true);
 window.addEventListener('blur',()=>touches.clear());
 controls.addEventListener('change',updateNear);updateNear();
 return {focus,updateNear};
}
