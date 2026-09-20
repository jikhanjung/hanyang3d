import * as THREE from 'three';
import {createLargeMap} from './large_map.js';
import {createWalker} from './pedestrians.js';
import {createHorse} from './horse_dealer.js';
import {createWalkJoystick} from './walk_joystick.js';
import {addPlayerNameTag} from './walk_profile.js';
import {t} from './i18n.js';
const el=id=>document.getElementById(id);

// Shared controls for both eras; terrain, collision and map HUD belong to the scene.
export function createFirstPerson({scene,camera,controls,renderer,pedestrians,shop,npcData,walkProfile,navigation,positionWorld,
 terrainGround,getWalkables,getSurfaceVersion=()=>1,getCollision=()=>null,getCameraObstacles=()=>[],getInterior=()=>null,onBeforeEnter=()=>{},onExit=()=>{},walkerFactory=createWalker}){

  // yaw is the walking (body) direction; lookYaw is a right-drag look offset that eases back after release.
  // A/D turn the body, Q/E move diagonally forward; left/right arrows and the mobile stick retain lateral movement.
  // autoRun (Alt+W) keeps walking forward until Alt+W again, W or S. Space jumps.
  // Riding: trot normally, gallop while Shift is held; the rider and eye rise with the saddle.
  // Space jumps: `air` is the height of the feet above the ground under them, `vy` the vertical speed.
  let fishing=null;
  let active=false,saved=null,yaw=0,pitch=0,lookYaw=0,autoRun=false,drag=null,lastGround=null,walked=0,view=4.5,walker=null,lastRemembered=0,mounted=false,horse=null,air=0,vy=0,galloping=false;
  const JUMP_SPEED=4.5,RIDE_JUMP_SPEED=6.3,GRAVITY=9.8;
  const WALK=3,FAST=8,TROT=12,GALLOP=24,SADDLE=.35,eyeHeight=()=>1.65+(mounted?SADDLE:0);

  const eye=new THREE.Vector3(),boom=new THREE.Vector3(),cameraRay=new THREE.Raycaster(),cameraDirection=new THREE.Vector3();
  let unfocusedMotion=null,mouseForward=false,mouseChord=false;
  const keys=new Set(),canvas=renderer.domElement,hud=el('walk-joystick'),jumpButton=el('walk-jump');canvas.tabIndex=0;
  // One jump at a time: Space on a keyboard, the on-screen button on phones.
  function jump(){if(!active||air!==0||vy!==0)return false;vy=mounted?RIDE_JUMP_SPEED:JUMP_SPEED;return true}
  jumpButton.addEventListener('pointerdown',event=>{event.preventDefault();jumpButton.classList.add('pressed');jump()});
  for(const type of ['pointerup','pointercancel','pointerleave'])jumpButton.addEventListener(type,()=>jumpButton.classList.remove('pressed'));
  const joystick=createWalkJoystick(el('walk-joystick'),()=>active);
  const held=code=>keys.has(code);
  function clearInput(){joystick.reset();keys.clear();drag=null;autoRun=false;unfocusedMotion=null;mouseForward=false;mouseChord=false}
  const mapDirection=new THREE.Vector3();
  const largeMap=createLargeMap({source:navigation.largeMapSource,container:el('scene'),getPose:()=>{camera.getWorldDirection(mapDirection);return {at:active?eye:controls.target,yaw:Math.atan2(-mapDirection.x,-mapDirection.z),walking:active}},onOpen:()=>{drag=null},returnFocus:()=>canvas.focus({preventScroll:true})});
  function rememberPosition(){if(active){walkProfile.savePosition(positionWorld,{x:eye.x,z:eye.z,yaw});lastRemembered=performance.now()}}
  // Walkable raised surfaces: bridge decks and their ramps, and the Gyeongbokgung hall sites (foundation, terraces,
  // stairs). The displayed meshes are cast against straight down, so height exaggeration is followed. While walking
  // only a surface at most a step above the current footing counts, so terraces are climbed by their stairs and a
  // bridge deck does not trap someone walking underneath.
  const STEP=.7,down=new THREE.Vector3(0,-1,0),surfaceRay=new THREE.Raycaster(),rayOrigin=new THREE.Vector3(),normal=new THREE.Vector3();
  let walkables=null,walkableScale=null;
  function walkableList(){
   const scale=getSurfaceVersion();
   if(walkables&&walkableScale===scale)return walkables;
   walkableScale=scale;
   const entries=getWalkables();
   walkables=entries.map(([object,visible])=>{object.updateMatrixWorld(true);return {object,visible,box:new THREE.Box3().setFromObject(object)}});
   return walkables;
  }
  // Returns the highest walkable top, null when there is none, or BLOCKED when (while walking) a surface rises more
  // than a step but less than head height above the footing: the side of a terrace is a wall, a deck overhead is not.
  // Solid building foundations also block taller faces; unlike a bridge, there is no passage underneath them.
  const HEADROOM=2.2,BLOCKED=Symbol('blocked');
  function surfaceAt(x,z,reference=null){
   let best=null,blocked=false;
   for(const {object,visible,box} of walkableList()){
    if(x<box.min.x||x>box.max.x||z<box.min.z||z>box.max.z||!visible())continue;
    surfaceRay.set(rayOrigin.set(x,box.max.y+1,z),down);
    for(const hit of surfaceRay.intersectObject(object,true)){
     // Skip invisible placeholder boxes and downward faces (the underside of a double-sided deck).
     if(hit.object.material?.visible===false||!hit.face)continue;
     if(normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).y<.5)continue;
     if(reference!==null&&hit.point.y>reference+STEP){if(hit.object.userData.solidSupport||hit.point.y<reference+HEADROOM)blocked=true;continue}
     if(best===null||hit.point.y>best)best=hit.point.y;
    }
   }
   return blocked?BLOCKED:best;
  }
  function groundAt(x,z,reference=null){
   // Clamp exploration to the prepared map; support queries outside it have no triangles.
   // Terrain/map positions are already scaled; road support stores unscaled heights.
   // Include the raised road overlay so eye height matches the surface walkers stand on.
   const terrain=terrainGround(x,z);
   if(terrain===null||!Number.isFinite(terrain))return null;
   const surface=surfaceAt(x,z,reference);
   if(surface===BLOCKED)return null;
   return surface===null?terrain:Math.max(terrain,surface);
  }
  function place(){
   // Third-person boom: the eye stays at walking height and the camera pulls back along the view.
   boom.set(0,0,1).applyEuler(camera.rotation).multiplyScalar(view);
   // Lift with the boom so the character sits low in frame instead of blocking the view.
   camera.position.copy(eye).add(boom);camera.position.y+=view*.22;
   const obstacles=getCameraObstacles();
   if(obstacles.length){
    cameraDirection.copy(camera.position).sub(eye);const length=cameraDirection.length();
    if(length>.001){cameraRay.set(eye,cameraDirection.normalize());cameraRay.far=length;const hit=cameraRay.intersectObjects(obstacles,true)[0];if(hit)camera.position.copy(eye).addScaledVector(cameraDirection,Math.max(.05,hit.distance-.18))}
   }
   const ground=groundAt(camera.position.x,camera.position.z);
   if(ground!==null)camera.position.y=Math.max(camera.position.y,ground+.6);
   if(walker){
    const feet=eye.y-eyeHeight();
    walker.group.visible=view>=.8;
    walker.group.position.set(eye.x,feet+(mounted?SADDLE+(horse?.riderVerticalOffset??0):0),eye.z);walker.group.rotation.y=yaw+Math.PI;
    if(horse){horse.group.visible=mounted&&view>=.8;horse.group.position.set(eye.x,feet,eye.z);horse.group.rotation.y=yaw+Math.PI}
   }
  }
  function look(){camera.rotation.set(pitch,yaw+lookYaw,0,'YXZ');place();if(active)navigation.update(yaw,eye)}
  function enter(){
   if(active)return;onBeforeEnter();
   if(!walkProfile.name){walkProfile.requestName({message:t('1인칭으로 들어가려면 이름을 대시오.')}).then(name=>{if(name)enter()});return false}
   saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),fov:camera.fov,near:camera.near};
   const path=pedestrians.routes[0].points,index=Math.floor(path.length*.42),p=path[index],q=path[index+1];
   let spawn={x:p.x,z:p.z,yaw:Math.atan2(-(q.x-p.x),-(q.z-p.z))};
   const remembered=walkProfile.readPosition(positionWorld);
   if(remembered&&Number.isFinite(groundAt(remembered.x,remembered.z))&&!getCollision()?.hit(remembered.x,remembered.z,.35))spawn=remembered;
   yaw=spawn.yaw;pitch=0;lookYaw=0;
   const ground=groundAt(spawn.x,spawn.z);if(!Number.isFinite(ground))return;
   controls.enabled=false;active=true;clearInput();lastGround=ground;
   camera.near=.08;camera.fov=70;camera.updateProjectionMatrix();mounted=false;air=0;vy=0;eye.set(spawn.x,ground+eyeHeight(),spawn.z);
   if(!walker){walker=walkerFactory();scene.add(walker.group)}
   if(walker.group.userData.playerName!==walkProfile.name){const tag=walker.group.getObjectByName('player-name');if(tag){tag.material.map.dispose();tag.material.dispose();tag.removeFromParent()}addPlayerNameTag(walker.group,walkProfile.name)}
   walked=0;walker.update(0,false);look();
   navigation.show(yaw,eye);hud.hidden=false;jumpButton.hidden=false;shop?.showHud(true);canvas.focus({preventScroll:true});
  }
  function exit(){
   rememberPosition();
   onExit();
   if(!active)return;fishing?.cancel();active=false;clearInput();hud.hidden=true;jumpButton.hidden=true;shop?.showHud(false);navigation.hide();if(walker)walker.group.visible=false;mounted=false;if(horse)horse.group.visible=false;
   camera.near=saved.near;camera.fov=saved.fov;camera.updateProjectionMatrix();camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);controls.target.copy(saved.target);controls.enabled=true;controls.update();
  }
  function update(dt){
   largeMap.update();if(!active)return;
   if(lookYaw&&!drag?.look){lookYaw*=Math.exp(-8*Math.min(dt,.1));if(Math.abs(lookYaw)<1e-3)lookYaw=0;look()}
   const forward=unfocusedMotion?.forward??(Math.min(1,Number(held('KeyW')||held('ArrowUp')||held('KeyQ')||held('KeyE')||mouseForward)+Number(autoRun))-Number(held('KeyS')||held('ArrowDown'))-joystick.value.y);
   const side=unfocusedMotion?.side??(Number(held('ArrowRight')||held('KeyE'))-Number(held('ArrowLeft')||held('KeyQ'))+joystick.value.x);
   const turn=unfocusedMotion?.turn??(Number(held('KeyA'))-Number(held('KeyD')));
   yaw+=turn*Math.PI*.65*Math.min(dt,.1);
   // Selling the reins (or logging out) takes the horse away.
   if(mounted&&(!(shop?.state.items[RIDE_ITEM]>0)||getInterior(eye)))setMounted(false);
   // Walking (not jumping) stays on the ground when stepping down, so a downhill stride never counts as airborne.
   const grounded=air===0&&vy===0;
   if(!grounded){const step=Math.min(dt,.1);vy-=GRAVITY*step;air=Math.max(0,air+vy*step);if(air===0)vy=0}
   const fast=unfocusedMotion?.fast??(keys.has('ShiftLeft')||keys.has('ShiftRight'));
   galloping=mounted&&fast;
   const speed=(mounted?(galloping?GALLOP:TROT):fast?FAST:WALK)*Math.min(dt,.1),norm=Math.max(1,Math.hypot(forward,side));
   const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)/norm*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)/norm*speed;
   let moved=false;
   if(dx||dz){
    // Buildings, walls, shop rows and other walkers block the character; slide along them. Move in steps of at most
    // half a metre so a galloping horse cannot pass through a thin wall in one frame.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.5));
    for(let i=0;i<steps;i++){
     const collision=getCollision();
     const [x,z]=collision?collision.move(eye.x,eye.z,eye.x+dx/steps,eye.z+dz/steps,.35,(px,pz)=>pedestrians?.near(px,pz,.6)):[eye.x+dx/steps,eye.z+dz/steps];
     // Surfaces count from the feet, so a jump can land on a ledge up to a step above the feet. Where the ground
     // falls away by more than a step (off a rail, a terrace or a bridge) the walker goes airborne and gravity
     // brings them down onto whatever is below, so nowhere is a dead end.
     const feet=lastGround+air,ground=groundAt(x,z,feet);
     if((x!==eye.x||z!==eye.z)&&ground!==null&&ground-feet<STEP){walked+=Math.hypot(x-eye.x,z-eye.z);eye.x=x;eye.z=z;
      // Coming down within a hand of the ground counts as landed; otherwise a downhill stride re-adds a few
      // millimetres of air every frame and the walker never lands while moving (so a second jump is refused).
      const landing=!grounded&&vy<=0&&feet-ground<.15;
      air=grounded?(feet-ground>STEP?feet-ground:0):landing?0:Math.max(0,feet-ground);if(air===0&&vy<0)vy=0;lastGround=ground;moved=true}else break;
    }
   }
   // Standing still on ground that moves (height exaggeration, channel carving) stays on the ground; only walking off
   // an edge above, or a jump, leaves the feet in the air here.
   const ground=groundAt(eye.x,eye.z,lastGround+air);if(ground!==null){air=air===0&&vy===0?0:Math.max(0,lastGround+air-ground);if(air===0&&vy<0)vy=0;lastGround=ground}
   if(lastGround!==null)eye.y=lastGround+air+eyeHeight();
   if(mounted&&getInterior(eye))setMounted(false);
   walker?.update(walked,moved&&!mounted,mounted);
   fishing?.update();
   if(mounted)horse.update(performance.now(),moved,air>0||vy!==0,galloping);
   look();
   if(performance.now()-lastRemembered>=1000)rememberPosition();
  }
  const RIDE_ITEM=Object.keys(npcData.items).find(id=>npcData.items[id].use==='mount');
  // Mount or dismount; returns the message shown in the pack window.
  function setMounted(on){
   if(on&&!active)return t('1인칭에서만 말을 탈 수 있소.');
   if(on&&getInterior(eye))return t('실내에서는 말을 탈 수 없소.');
   if(on&&!(shop?.state.items[RIDE_ITEM]>0))return t('말고삐가 없소.');
   mounted=on;if(!on)galloping=false;
   if(on&&!horse){horse=createHorse();horse.group.name='player-horse';scene.add(horse.group)}
   if(horse)horse.group.visible=on;
   walker?.update(walked,false,on);
   if(lastGround!==null)eye.y=lastGround+air+eyeHeight();
   look();
   return on?t('말에 올랐소. 빨리 달릴 수 있소.'):t('말에서 내렸소.');
  }
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
  document.addEventListener('keydown',event=>{
   if(!active)return;if(event.code==='Escape'){event.preventDefault();exit();return}
   if(event.target.matches?.('input,select,textarea,button')&&!event.target.closest?.('#large-map'))return;
   if(movement.has(event.code))unfocusedMotion=null;
   if(event.altKey&&event.code==='KeyW'){event.preventDefault();autoRun=!autoRun;return}
   if(event.code==='KeyI'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();shop?.togglePack();return}
   if(event.code==='Space'){event.preventDefault();if(!event.repeat)jump();return}
   if(autoRun&&['KeyW','KeyS','ArrowUp','ArrowDown'].includes(event.code))autoRun=false;
   if(movement.has(event.code)){event.preventDefault();keys.add(event.code)}
  });
  document.addEventListener('keyup',event=>{keys.delete(event.code);if(movement.has(event.code)&&document.hasFocus())unfocusedMotion=null});
  // Moving focus to a touch control must not cancel a held direction.
  canvas.addEventListener('blur',()=>{drag=null});
  window.addEventListener('blur',()=>{
   if(!active)return;drag=null;if(unfocusedMotion)return;
   const forward=Math.min(1,Number(held('KeyW')||held('ArrowUp')||held('KeyQ')||held('KeyE')||mouseForward)+Number(autoRun))-Number(held('KeyS')||held('ArrowDown'))-joystick.value.y;
   const side=Number(held('ArrowRight')||held('KeyE'))-Number(held('ArrowLeft')||held('KeyQ'))+joystick.value.x;
   const turn=Number(held('KeyA'))-Number(held('KeyD'));
   const fast=held('ShiftLeft')||held('ShiftRight');clearInput();
   if(forward||side||turn)unfocusedMotion={forward,side,turn,fast};
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){rememberPosition();drag=null}});
  window.addEventListener('pagehide',rememberPosition);
  canvas.addEventListener('pointerdown',event=>{if(!active||drag)return;canvas.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY,look:event.button===2};canvas.setPointerCapture(event.pointerId)});
  // Pointerdown fires only for the first mouse button; mousedown also sees the second.
  canvas.addEventListener('mousedown',event=>{if(!active||!drag)return;mouseForward=(event.buttons&3)===3;if(mouseForward){mouseChord=true;unfocusedMotion=null;event.preventDefault()}});
  document.addEventListener('mouseup',event=>{if(active){mouseForward=(event.buttons&3)===3&&!!drag;if(document.hasFocus())unfocusedMotion=null}},true);
  canvas.addEventListener('pointermove',event=>{if(active&&drag&&event.pointerType==='mouse'){mouseForward=(event.buttons&3)===3;if(mouseForward)mouseChord=true}});
  // A two-button movement gesture must not also select the building/NPC underneath.
  canvas.addEventListener('pointerup',event=>{if(mouseChord)event.preventDefault()},true);
  // Left drag turns the walker; right drag only looks around (the walking direction stays).
  canvas.addEventListener('pointermove',event=>{if(!active||!drag||drag.id!==event.pointerId)return;const dx=(event.clientX-drag.x)*.003;if(drag.look)lookYaw=Math.max(-Math.PI*.9,Math.min(Math.PI*.9,lookYaw-dx));else yaw-=dx;pitch=Math.max(-Math.PI*.47,Math.min(Math.PI*.47,pitch-(event.clientY-drag.y)*.003));drag.x=event.clientX;drag.y=event.clientY;look()});
  canvas.addEventListener('contextmenu',event=>{if(active)event.preventDefault()});
  canvas.addEventListener('wheel',event=>{
   if(!active)return;event.preventDefault();
   view=Math.max(0,Math.min(12,view+Math.sign(event.deltaY)*.6));look();
  },{passive:false});
  const release=event=>{if(drag?.id===event.pointerId){drag=null;mouseForward=false;mouseChord=false}};for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,release);
  // Put the walker at a ground point facing `heading`; used by checks and focus buttons.
  function placeAt(x,z,heading=yaw){const g=groundAt(x,z);if(g===null)return false;air=0;vy=0;eye.set(x,g+eyeHeight(),z);lastGround=g;yaw=heading;if(mounted&&getInterior(eye))setMounted(false);else look();return true}
  return {get fishing(){return fishing},set fishing(value){fishing=value},get active(){return active},get ground(){return lastGround},get eye(){return eye.clone()},get yaw(){return yaw},get lookYaw(){return lookYaw},get autoRun(){return autoRun},get mounted(){return mounted},get galloping(){return mounted&&galloping},get air(){return air},jump,surfaceAt:(x,z,reference=null)=>{const v=surfaceAt(x,z,reference);return v===BLOCKED?'blocked':v},get horse(){return horse},setMounted,get view(){return view},get walker(){return walker},enter,exit,update,placeAt,groundAt,clearInput};

}
