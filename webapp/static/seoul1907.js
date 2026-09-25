import {createHistoricalEvent,visitKeeps} from './historical_event.js';
import {createProcession} from './events/procession.js';
import {createShadow} from './events/shadow.js';
import {createCrowd} from './events/crowd.js';
import {createHide} from './events/hide.js';
import {createScreenshotMode} from './screenshot_mode.js';
import {createHerbs} from './herbs.js';
import {createNature1907} from './nature1907.js';
import {createChannel1907} from './channel1907.js';
import {createSettlement1907} from './settlement1907.js';
import {createTrams1907} from './trams1907.js';
import {createWalk1907} from './walk1907.js';
import {createMap1907Transform} from './map1907_transform.js';
import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {setupOrbitNavigation} from './orbit_navigation.js';
import {createCompass3D} from './compass3d.js';
import {t} from './i18n.js';
import {createInfrastructure1907} from './infrastructure1907.js';
import {prepareLandmarkLod,updateLandmarkLod} from './lod1907.js';
import {createLandmark1907} from './landmarks1907.js';
import {addBuildingAccess1907} from './building_access1907.js';
const el=id=>document.getElementById(id),base=new URL('../../',import.meta.url),asset=p=>new URL(p.replace(/^\//,''),base).href;
const eventData=JSON.parse(el('historical-event')?.textContent??'null');
const cfg=JSON.parse(el('map-config').textContent);
el('menu').onclick=()=>{const open=el('options').classList.toggle('open');el('menu').setAttribute('aria-expanded',String(open))};
el('era').onchange=()=>{location.href=el('era').value};
const loading=window.seoul1907Loading={stage:0,history:[],ready:false};
let paintLoading=()=>{};
async function stage(number,message){
 loading.stage=number;loading.history.push({stage:number,message,time:performance.now()});
 el('loading-message').textContent=message;el('loading-progress').value=number;
 paintLoading();await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
}
async function main(){
 el('labels').hidden=true;
 await stage(0,t('고도 자료를 불러오는 중입니다'));
 const response=await fetch(asset('/gis/georeferenced/terrain3d/dem.json'));if(!response.ok)throw Error('DEM');const dem=await response.json();
 const [xmin,ymin,xmax,ymax]=dem.bounds_3857,n=dem.size,z=dem.elevations;
 if(z.length!==n*n||!z.every(Number.isFinite))throw Error('DEM grid');
 const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,R=6378137,scale=Math.cos(2*Math.atan(Math.exp(cy/R))-Math.PI/2);
 const [iw,ih]=cfg.image_size,[left,top,right,bottom]=cfg.crop;
 const {project,inverse}=createMap1907Transform(cfg,dem.bounds_3857);
 const world=(x,y,h)=>new THREE.Vector3((x-cx)*scale,h,-(y-cy)*scale);
 const scene=new THREE.Scene();scene.background=new THREE.Color('#dce5e4');
 scene.add(new THREE.HemisphereLight(0xffffff,0x6a7864,1.6));const light=new THREE.DirectionalLight(0xfff5db,1.5);light.position.set(-4000,9000,3500);scene.add(light);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));el('scene').append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(43,1,1,60000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxDistance=21000;controls.maxPolarAngle=Math.PI*.47;
 createScreenshotMode({renderer,scene,camera,menu:el('options'),era:1907});
 let needsRender=true;controls.addEventListener('change',()=>{needsRender=true});
 const positions=[],uv=[],indices=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=xmin+i*(xmax-xmin)/(n-1),y=ymax-j*(ymax-ymin)/(n-1),p=world(x,y,z[j*n+i]),pixel=inverse(x,y);
  positions.push(p.x,p.y,p.z);uv.push(pixel[0]/iw,1-pixel[1]/ih);
  if(i<n-1&&j<n-1){const a=j*n+i;indices.push(a,a+n+1,a+1,a,a+n,a+n+1)}
 }
 let geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const terrain=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xc4aa7f,roughness:1}));scene.add(terrain);
 // Show and allow orbiting the terrain while later assets are still loading.
 const resize=()=>{needsRender=true;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()};window.addEventListener('resize',resize);resize();
 const center=world(...project((left+right)/2,(top+bottom)/2),100);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,6100,6100).multiplyScalar(Math.max(1,.9/camera.aspect)));controls.update();
 const raycaster=new THREE.Raycaster();
 const pick=ray=>{raycaster.ray.copy(ray);return raycaster.intersectObject(terrain)[0]?.point??null};
const baseGroundAt=(x,zz)=>{const u=(x/scale+cx-xmin)/(xmax-xmin)*(n-1),v=(ymax-(cy-zz/scale))/(ymax-ymin)*(n-1);if(u<0||v<0||u>n-1||v>n-1)return null;const i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j,k=j*n+i;return a>=b?(1-a)*z[k]+(a-b)*z[k+1]+b*z[k+n+1]:(1-b)*z[k]+(b-a)*z[k+n]+a*z[k+n+1]};

 const infraData=JSON.parse(el('infrastructure-1907').textContent);
 if(infraData.source_sha256!==cfg.image_sha256)throw Error('Infrastructure map hash mismatch');
 const originalSurface=(x,y)=>{const p=world(...project(x,y),0);p.y=baseGroundAt(p.x,p.z);return p};
 const navigationGeometry=geometry,channel=createChannel1907(infraData.river,geometry,originalSurface,baseGroundAt);
 geometry=channel.geometry;terrain.geometry=geometry;
 const groundAt=channel.groundAt;
 let walking=null;
 setupOrbitNavigation(camera,controls,renderer.domElement,pick,()=>!!walking?.firstPerson.active,groundAt);
 paintLoading=()=>renderer.render(scene,camera);
 renderer.setAnimationLoop(()=>{controls.update();if(needsRender){paintLoading();needsRender=false}});
 await stage(1,t('지형 표시 완료 · 최신경성전도를 불러오는 중입니다'));
 const texture=await new THREE.TextureLoader().loadAsync(asset(cfg.image_url));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const material=new THREE.MeshStandardMaterial({map:texture,roughness:1,transparent:true,opacity:.5,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 // Same vertices as the terrain: changing opacity never moves either surface. Crop only the map frame.
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nif(vMapUv.x < ${left/iw} || vMapUv.x > ${right/iw} || vMapUv.y < ${1-bottom/ih} || vMapUv.y > ${1-top/ih}) discard;`)};
 const historical=new THREE.Mesh(geometry,material);historical.renderOrder=1;scene.add(historical);
 await stage(2,t('지도 표시 완료 · 주요 건물과 문을 준비합니다'));
 const buildings=[],labels=[];
 const majorNames=new Set(['geunjeongjeon-1907','injeongjeon-1907','junghwajeon-1907','myeongjeongjeon-1907','jongmyo-jeongjeon-1907','sungnyemun-1907','heunginjimun-1907','donuimun-1907','gwanghwamun-1907','myeongdong-cathedral-1907']);
 const showBuilding=(model,{focus=false}={})=>{
  if(focus)walking?.firstPerson.exit();else walking?.firstPerson.clearInput();
  const f=model.userData.feature,target=model.userData.hallPosition;
  if(focus){controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(150,160,230).applyAxisAngle(new THREE.Vector3(0,1,0),model.rotation.y).multiplyScalar(Math.max(1,.85/camera.aspect)*Math.max(1,Math.max(...f.symbol_size_m)/150)));controls.update()}
  if(innerWidth<=600){el('options').classList.remove('open');el('menu').setAttribute('aria-expanded','false')}
  const panel=el('building-info');panel.replaceChildren();panel.hidden=false;panel.dataset.kind='building';
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label',t('닫기'));close.onclick=()=>panel.hidden=true;panel.append(close);
  for(const text of [f.name,f.info.period,f.info.summary]){const p=document.createElement('p');p.textContent=text;panel.append(p)}
  const storyteller=walking?.stationary.records.find(r=>r.role==='storyteller'&&r.building===f.id);
  if(storyteller && storyteller.appearance!=='caretaker'){
   const talk=document.createElement('button');talk.id='bookshop-talk';talk.textContent=t('책방 주인과 이야기하기');talk.style.cssText='float:none;display:block;min-height:44px;margin:8px 0';
   talk.onclick=()=>{
    walking.firstPerson.exit();el('people3d').checked=true;walking.stationary.group.visible=true;
    const p=storyteller.position,front=new THREE.Vector3(0,2.5,6).applyAxisAngle(new THREE.Vector3(0,1,0),model.rotation.y);
    camera.position.copy(p).add(front);controls.target.copy(p).add(new THREE.Vector3(0,1,0));controls.update();
    walking.stationary.update(camera);panel.hidden=true;el('options').classList.remove('open');el('menu').setAttribute('aria-expanded','false');
    walking.dialogue.start(walking.npcFor(storyteller));needsRender=true;
   };panel.append(talk);
  }
  for(const source of f.info.sources){const a=document.createElement('a');a.textContent=source.title;a.href=source.url;a.target='_blank';a.rel='noopener';panel.append(a,document.createElement('br'))}
 };
 for(const f of JSON.parse(el('buildings-1907').textContent).features){
  if(f.scene_year!==1907||!['throne_hall','landmark_1907','conceptual_gate_with_open_arch_and_roof'].includes(f.display_model))continue;
  if(eventData&&eventData.stages.some(st=>st.arrival_building===f.id))f.eventEntrance=true;
  const [w,h,d]=f.symbol_size_m,model=createLandmark1907(f,w,h,d),yaw=THREE.MathUtils.degToRad(f.display_yaw_deg??0);
  const hall=world(...project(...f.source_position.pixel),0),offset=new THREE.Vector3(model.userData.anchorOffset?.[0]??0,0,model.userData.anchorOffset?.[1]??model.userData.hallCenterZ??0).applyAxisAngle(new THREE.Vector3(0,1,0),yaw),center=hall.clone().sub(offset);
  const samples=[];
  for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){const p=new THREE.Vector3((i/8-.5)*w,0,(j/8-.5)*d).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(center);samples.push(groundAt(p.x,p.z))}
  if(samples.some(v=>v===null))continue;
  const floor=Math.max(...samples)+.05,bottom=Math.min(...samples)-.5;
  const foundation=new THREE.Mesh(new THREE.BoxGeometry(w,floor-bottom,d),new THREE.MeshStandardMaterial({color:0xb9b1a1,roughness:1}));
  foundation.position.y=(floor-bottom)/2+bottom-floor-h/2;foundation.name='terrain-foundation';model.add(foundation);
  model.position.set(center.x,floor+h/2,center.z);model.rotation.y=yaw;
  hall.y=floor+h;Object.assign(model.userData,{feature:f,hallPosition:hall,groundFloor:floor});scene.add(model);buildings.push(model);
  addBuildingAccess1907(model,groundAt);
  const label=document.createElement('button');label.className='building-label';label.textContent=f.name.replace(/^1907년 /,'').replace(/ \(1907\)$/,'');label.onclick=()=>showBuilding(model);el('labels').append(label);labels.push({label,point:hall,owner:model,layer:'building'});prepareLandmarkLod(model);
  const option=document.createElement('option');option.value=f.id;option.textContent=f.name;el('landmark').append(option);
 }
 await stage(3,t('주요 건물·문 표시 완료 · 성벽과 길·물길을 준비합니다'));
 const surface=(x,y)=>{const p=world(...project(x,y),0);p.y=groundAt(p.x,p.z);if(p.y===null)throw Error('Infrastructure outside terrain');return p};surface.original=originalSurface;surface.ground=(x,z)=>groundAt(x,z);surface.grid={xmin:(xmin-cx)*scale,zmin:-(ymax-cy)*scale,stepX:(xmax-xmin)*scale/(n-1),stepZ:(ymax-ymin)*scale/(n-1),size:n};
 for(const bridge of [eventData?.bridge,...(eventData?.stages??[]).map(st=>st.bridge)].filter(Boolean))infraData.river.bridges.push(bridge);
 const infrastructure=createInfrastructure1907(infraData,surface,buildings);scene.add(infrastructure.wall.group,...infrastructure.palaceWalls.map(w=>w.group),infrastructure.water,infrastructure.bridges,infrastructure.roads);
 const tramData=JSON.parse(el('trams-1907').textContent);
 if(tramData.source_sha256!==cfg.image_sha256)throw Error('Tram map hash mismatch');
 const settlementData=JSON.parse(el('settlement-1907').textContent);
 if(settlementData.source_sha256!==cfg.image_sha256)throw Error('Settlement map mismatch');
 const settlement=createSettlement1907(settlementData,infraData,surface,buildings,(x,z)=>inverse(cx+x/scale,cy-z/scale));scene.add(settlement.group);
 const nature=await createNature1907({terrain,historical,world,groundAt,buildings,settlement,channel,infrastructure});scene.add(nature.trees.group);for(const id of ['trees3d','granite3d'])el(id).addEventListener('change',()=>{needsRender=true});
 const trams=createTrams1907(tramData,surface);scene.add(trams.group);
 el('trams3d').onchange=()=>{trams.group.visible=el('trams3d').checked;needsRender=true};
 const showTramInfo=()=>{
  walking?.firstPerson.clearInput();
  const panel=el('building-info');panel.replaceChildren();panel.hidden=false;panel.dataset.kind='tram';
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label',t('닫기'));close.onclick=()=>panel.hidden=true;panel.append(close);
  for(const text of [t('종로 전차 · 1907년 한미전기회사'),t('1899년 개통한 서대문–종로–동대문–청량리 전차 노선의 종로 구간을 표현했습니다. 1907년에는 한미전기회사가 운영했습니다.'),t('초기 개방형 전차의 중앙 객실과 양쪽 좌석, 승강대와 트롤리 폴을 단순화했습니다. 운전수 1명과 남녀 승객 4명을 배치했습니다.'),t('종로의 붉은 전차선을 따라 달리는 초기 전차입니다. 차량의 색·치수와 왕복 구간·속도·대기는 재현용 설정이며, 양 끝은 당시 종점이 아닙니다.'),t('표현 속도는 약 13km/h입니다. 탑승 인원과 복식은 재현용 설정이며 실제 배차·제복을 확정한 것은 아닙니다.')]){const e=document.createElement('p');e.textContent=text;panel.append(e)}
  for(const source of [{title:t('1907년 최신경성전도 — 서울역사박물관'),url:cfg.source_url},...tramData.sources]){const a=document.createElement('a');a.textContent=document.documentElement.lang==='en'?(source.title_en??source.title):source.title;a.href=source.url;a.target='_blank';a.rel='noopener';panel.append(a,document.createElement('br'))}
  const a=document.createElement('a');a.href='/credits/';a.textContent=t('출처·저작권');panel.append(a);
 };
 let scenePress=null;
 const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{if(e.button===0)scenePress={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false}});
 canvas.addEventListener('pointermove',e=>{if(scenePress&&Math.hypot(e.clientX-scenePress.x,e.clientY-scenePress.y)>7)scenePress.moved=true});
 canvas.addEventListener('pointercancel',()=>scenePress=null);
 canvas.addEventListener('pointerup',e=>{
  const press=scenePress;scenePress=null;
  if(eventData||e.defaultPrevented||!press||press.id!==e.pointerId||press.moved||original)return;
  const bounds=canvas.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-bounds.left)/bounds.width*2-1,1-(e.clientY-bounds.top)/bounds.height*2),camera);
  scene.updateMatrixWorld(true);
  const hit=raycaster.intersectObjects(scene.children,true).find(hit=>{let o=hit.object;while(o){if(!o.visible)return false;o=o.parent}return true});
  let object=hit?.object;
  while(object){
   // OrbitControls installs its pointerup listener on pointerdown, after ours.
   // Do not stop propagation: it must release capture and finish the gesture.
   // Mark selection for the NPC picker, then open UI after all release handlers.
   if(object===trams.car){e.preventDefault();setTimeout(showTramInfo,0);return}
   if(buildings.includes(object)){const selected=object;e.preventDefault();setTimeout(()=>showBuilding(selected),0);return}
   object=object.parent;
  }
 });
 for(const bridge of infrastructure.bridges.children){
  const f=bridge.userData.feature,label=document.createElement('button');label.className='building-label';label.textContent=document.documentElement.lang==='en'?f.name_en:f.name;
  const english=document.documentElement.lang==='en';
  bridge.userData.hallPosition=bridge.userData.labelPosition;
  bridge.userData.feature={...f,name:label.textContent,symbol_size_m:[f.width_m,5,30],info:{period:t('1907년 원도에 표시된 다리'),summary:english?'Placed from the bridge symbol on the 1907 map. Stone deck, piers, dimensions and railings are schematic.':f.note,sources:infraData.river.sources.map(url=>({title:t('출처'),url}))}};
  label.onclick=()=>showBuilding(bridge);
  el('labels').append(label);labels.push({label,point:bridge.userData.labelPosition,owner:bridge,layer:'bridge'});
 }
 // Place names have no building, marker, or click action.
 for(const f of infraData.place_labels??[]){
  const point=world(...project(...f.pixel),0);point.y=groundAt(point.x,point.z)+4;
  const owner=new THREE.Group();owner.userData.feature=f;
  const label=document.createElement('span');label.className='building-label';
  label.textContent=document.documentElement.lang==='en'?(f.name_en??f.name):f.name;
  label.style.pointerEvents='none';label.style.cursor='default';
  el('labels').append(label);labels.push({label,point,owner,layer:'place'});
 }
 const updateLayers=()=>{
  needsRender=true;
  const visible=el('buildings3d').checked;
  for(const model of buildings)model.visible=visible;
  el('labels').hidden=original||!el('names3d').checked;
  infrastructure.wall.group.visible=el('walls3d').checked;
  for(const w of infrastructure.palaceWalls)w.group.visible=el('walls3d').checked;
  settlement.group.visible=el('settlement3d').checked;
  infrastructure.roads.visible=el('roads3d').checked;
  infrastructure.water.visible=infrastructure.bridges.visible=el('water3d').checked;
  el('landmark').disabled=original||!visible;
  if(!visible)el('building-info').hidden=true;
 };
 el('settlement3d').onchange=updateLayers;el('buildings3d').onchange=updateLayers;el('names3d').onchange=updateLayers;el('walls3d').onchange=updateLayers;el('water3d').onchange=updateLayers;el('roads3d').onchange=updateLayers;
 el('landmark').onchange=()=>{const model=buildings.find(m=>m.userData.feature.id===el('landmark').value);if(model)showBuilding(model,{focus:true})};

 const compass=createCompass3D(el('compass'));
 let original=false,leaflet=null;
 const reset=()=>{walking?.firstPerson.exit();if(original){leaflet.fitBounds([[0,0],[ih,iw]]);return}const center=world(...project((left+right)/2,(top+bottom)/2),100);controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(0,6100,6100).multiplyScalar(Math.max(1,.9/camera.aspect)));controls.update()};
 reset();
 el('opacity').oninput=()=>{needsRender=true;material.opacity=Number(el('opacity').value)/100;el('opacity-value').textContent=el('opacity').value+'%'};
 el('reset').onclick=reset;
 el('view').onclick=()=>{
  walking?.firstPerson.exit();el('walk-together').disabled=!original;needsRender=true;original=!original;el('view').setAttribute('aria-pressed',String(original));el('view').textContent=t(original?'3D 지형':'원본 지도');el('original').hidden=!original;el('scene').hidden=original;el('compass').hidden=original;el('opacity').disabled=original;el('labels').hidden=original;el('landmark').disabled=original;el('building-info').hidden=true;updateLayers();
  el('notice').textContent=t(original?'최신경성전도 · 1907년 11월 수정 재판 · 서울역사박물관 소장':'최신경성전도 · 지형 위 추정 배치 · 현대 FABDEM 고도');
  if(original){if(!leaflet){leaflet=L.map('original',{crs:L.CRS.Simple,minZoom:-4,maxZoom:3,attributionControl:false});L.imageOverlay(asset(cfg.image_url),[[0,0],[ih,iw]]).addTo(leaflet)}leaflet.invalidateSize();reset()}
 };
 await stage(4,t('성벽·길·물길 표시 완료 · 걷는 사람과 상인을 준비합니다'));
 walking=createWalk1907({scene,camera,controls,renderer,buildings,infrastructure,infraData,groundAt,surface,geometry:navigationGeometry,texture,settlement,flatMap:{image:texture.image,crop:cfg.crop,toPixel:p=>inverse(cx+p.x/scale,cy-p.z/scale),roads:infraData.roads.features.filter(r=>r.width_m>=10).map(r=>({name:r.name,points:r.centerline})),landmarks:buildings.filter(b=>!eventData||visitKeeps(eventData,b.userData.feature)).filter(b=>majorNames.has(b.userData.feature.id)||['daehanmun-1907','bosingak-1907','hwangudan-1907','sungkyun-1907','russian-legation-1907','sontag-hotel-1907'].includes(b.userData.feature.id)).map(b=>({name:b.userData.feature.name.replace(/^1907년\s*/,''),world:b.position,pixel:inverse(cx+b.position.x/scale,cy-b.position.z/scale)}))}});
 walking.pedestrians.setVehicleAvoider((p,old,dt)=>trams.avoid(p,old,dt,(x,z,r)=>walking.collision.hit(x,z,r)));
 await stage(5,t('사람 표시 완료 · 마무리합니다'));
 updateLayers();
 // Broad-phase bounds avoid raycasting every building for every DOM label. The ray then tests the building's
 // coarse LOD silhouette, whatever its visibility: the detailed cathedral alone has tens of thousands of triangles
 // and every on-screen label would otherwise cross it from inside, at several milliseconds per label.
 scene.updateMatrixWorld(true);
 const occluders=buildings.map(model=>({model,bounds:new THREE.Box3().setFromObject(model),silhouette:model.userData.lod?.proxy??null}));
 const labelRay=new THREE.Raycaster(),labelDirection=new THREE.Vector3();
 const labelOccluded=(point,owner)=>{
  const distance=camera.position.distanceTo(point);
  if(distance<.1)return false;
  labelRay.set(camera.position,labelDirection.copy(point).sub(camera.position).normalize());labelRay.far=distance-.05;
  for(const {model,bounds,silhouette} of occluders){
   if(model===owner||!model.visible||!labelRay.ray.intersectsBox(bounds))continue;
   if(silhouette){if(labelRay.intersectObject(silhouette,true).length)return true;continue}
   const hits=labelRay.intersectObject(model,true);
   if(hits.some(hit=>{let o=hit.object;while(o){if(!o.visible)return false;o=o.parent}return true}))return true;
  }
  return false;
 };
 const herbs=createHerbs({era:1907,scene,camera,canvas:renderer.domElement,firstPerson:walking.firstPerson,shop:walking.shop,dialogue:walking.dialogue,data:JSON.parse(el('npcs').textContent),source:nature.source,groundAt,collision:()=>walking.collision,market:buildings.find(b=>b.userData.feature.id==='bosingak-1907'),visible:()=>el('people3d').checked});
 // Historical visits: the definition picks the stages; modules with moving parts are registered here by name.
 const historicalEvent=eventData?createHistoricalEvent({data:eventData,modules:{procession:createProcession,shadow:createShadow,hide:createHide,crowd:createCrowd},scene,camera,walking,buildings,infrastructure,settlement,trams,material,surface,channel}):null;
 // Coming back from 1896: the page opened behind the curtain; restore the walk first, then lift it.
 const curtainText=walking.curtain.take();if(curtainText)walking.curtain.hold(curtainText);
 if(!eventData&&new URLSearchParams(location.search).has('returnFromAgwan'))walking.shop.whenReady.then(()=>{try{const saved=JSON.parse(sessionStorage.getItem('agwan-return'));if(saved?.name===walking.shop.state.name){walking.firstPerson.enter();walking.firstPerson.setMounted(saved.mounted);sessionStorage.removeItem('agwan-return')}}catch{}finally{if(!eventData)walking.curtain.hide()}});
 else if(!eventData)walking.curtain.hide();
 let lastFrame=performance.now();
 renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min(.1,(now-lastFrame)/1000);lastFrame=now;if(!original){herbs.update();walking.update(dt);historicalEvent?.update(dt);if(trams.update(dt,camera,[...(walking.pedestrians.group.visible?walking.pedestrians.walkers.map(w=>w.position):[]),...(walking.stationary.group.visible?walking.stationary.records.map(r=>r.position):[]),...(walking.firstPerson.active?[walking.firstPerson.eye]:[])]))needsRender=true;if(walking.firstPerson.active||(camera.position.y-controls.target.y<180&&el('people3d').checked&&el('walking3d').checked))needsRender=true;if(!walking.firstPerson.active)controls.update();if(!needsRender)return;needsRender=false;compass.update(camera);
  settlement.setLod(camera.position);
  for(const model of buildings)updateLandmarkLod(model,camera);
  const indoors=walking.interiorAt(walking.firstPerson.active?walking.firstPerson.eye:camera.position);
  const occupied=[];
  for(const {label,point,owner,layer} of [...labels].sort((a,b)=>Number(majorNames.has(b.owner.userData.feature.id))-Number(majorNames.has(a.owner.userData.feature.id))||camera.position.distanceTo(a.point)-camera.position.distanceTo(b.point))){
   if(indoors||!el('names3d').checked||!owner.visible||(layer==='bridge'&&!infrastructure.bridges.visible)){label.hidden=true;continue}
   const major=majorNames.has(owner.userData.feature.id);if(!major&&camera.position.distanceTo(point)>(layer==='bridge'?3500:6500)){label.hidden=true;continue}
   const p=point.clone().project(camera),x=(p.x+1)*innerWidth/2;let y=(1-p.y)*innerHeight/2;
   label.hidden=p.z< -1||p.z>1||Math.abs(p.x)>1||Math.abs(p.y)>1;if(label.hidden)continue;
   if(labelOccluded(point,owner)){label.hidden=true;continue}
   const width=label.offsetWidth||100;
   for(let attempt=0;attempt<(major?2:0);attempt++){if(!occupied.some(r=>Math.abs(r.x-x)<(r.w+width)/2+4&&Math.abs(r.y-y)<26))break;y-=27}
   label.hidden=y<65||(!major&&occupied.some(r=>Math.abs(r.x-x)<(r.w+width)/2+4&&Math.abs(r.y-y)<26));
   if(!label.hidden)occupied.push({x,y,w:width});label.style.left=x+'px';label.style.top=y+'px';
  }
  renderer.render(scene,camera)}});
 await stage(6,t('모든 요소를 불러왔습니다'));loading.ready=true;el('scene-loading').hidden=true;
 el('status').hidden=true;window.seoul1907={ready:true,historicalEvent,nature,herbs,channel,baseGroundAt,settlement,labelOccluded,trams,scene,renderer,camera,controls,terrain,historical,config:cfg,project,inverse,buildings,groundAt,showBuilding,infrastructure,labels,walking,firstPerson:walking.firstPerson,pedestrians:walking.pedestrians};
}
main().catch(error=>{console.error(error);document.getElementById('scene-curtain')?.remove();document.documentElement.classList.remove('curtain-start');el('loading-message').textContent=t('불러오기가 중단되었습니다. 새로고침해서 다시 시도해 주세요.');el('loading-retry').hidden=false;window.seoul1907={ready:false,error:String(error)}});
