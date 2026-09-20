import {createFirstPerson} from './first_person.js';
import * as THREE from 'three';
import {createGranite} from './granite.js';
import {setupOrbitNavigation} from './orbit_navigation.js';
import {createTrees} from './trees.js';
import {createPedestrians} from './pedestrians.js';
import {createCollision} from './collision.js';
import {createHouseSite} from './house_site.js';
import {createSiteMarker} from './site_marker.js';
import {createBellTower} from './bell_tower.js';
import {createTrainingGround} from './training_ground.js';
import {createDrill} from './drill.js';
import {createHorseDealer} from './horse_dealer.js';
import {createNpcDialogue} from './npc_dialogue.js';
import {createShop} from './shop.js';
import {createPagoda} from './pagoda.js';
import {createObservatory} from './observatory.js';
import {createSettlement} from './settlement.js';
import {createSijeon} from './sijeon.js';
import {createPlaceNames} from './placenames.js';
import {createGyeonghoeruPond,createHallSite} from './gyeongbokgung_ruins.js';
import {createThroneHall} from './throne_hall.js';
import {createCityGate} from './gate.js';
import {createGuards} from './guards.js';
import {createCityWall,surfaceIndex} from './city_wall.js';
import {createPalace,createPalaceGate} from './palace.js';
import {createJongmyo} from './jongmyo.js';
import {createWalkTogether} from './walk_together.js';
import {createWalkProfile} from './walk_profile.js';
import {createYukjo,groundYukjo,heightYukjo} from './yukjo.js';
import {createGroundColors} from './ground_colors.js';
import {createCompass3D} from './compass3d.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';
import {t,lang,setLang} from './i18n.js';

const el=id=>document.getElementById(id),R=6378137,H=Math.PI*R;
// Resources share the versioned prefix this module was loaded from (/v/<version>/ or /), so a release can be cached forever.
const assetBase=new URL('../../',import.meta.url),asset=path=>new URL(path.replace(/^\//,''),assetBase).href;
const project=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
async function main(){
 el('era-select').onchange=()=>{location.href=el('era-select').value};
 const loading=window.terrainLoading={stage:0,history:[],ready:false};
 el('map-options-toggle').onclick=()=>{const open=el('map-options').classList.toggle('open');el('map-options-toggle').setAttribute('aria-expanded',String(open))};
 // About opens a short project introduction over the map and closes the menu.
 const closeAbout=()=>{el('about-panel').hidden=true};
 el('about-open').onclick=()=>{el('about-panel').hidden=false;el('map-options').classList.remove('open');el('map-options-toggle').setAttribute('aria-expanded','false');el('about-close').focus()};
 el('about-close').onclick=closeAbout;
 document.addEventListener('keydown',event=>{if(event.code==='Escape'&&!el('about-panel').hidden)closeAbout()});
 const toolbarControls=[...document.querySelectorAll('.toolbar input,.toolbar select,.toolbar button')].filter(c=>c.id!=='about-open'&&c.id!=='era-select');toolbarControls.forEach(c=>c.disabled=true);
 let npcDialogue=null,horseDealer=null,shop=null,granite=null,trees=null,settlement=null,sijeon=null,collision=null,pedestrians=null,firstPerson=null,together=null,palaceWall=null,frameUpdate=()=>{};

 const scene=new THREE.Scene();scene.background=new THREE.Color('#dce5e4');
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;el('scene').append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(43,1,10,60000);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=1;controls.maxDistance=21000;controls.maxPolarAngle=Math.PI*.47;
 scene.add(new THREE.HemisphereLight(0xffffff,0x6a7864,1.6));const light=new THREE.DirectionalLight(0xfff5db,1.5);light.position.set(-4000,9000,3500);scene.add(light);

 const compass=createCompass3D(el('first-person-compass'));
 const updateCompass=()=>compass.update(camera);
 let renderDirty=true;controls.addEventListener('change',()=>{renderDirty=true});
 const resize=()=>{renderDirty=true;const box=el('scene');renderer.setSize(box.clientWidth,box.clientHeight);camera.aspect=box.clientWidth/box.clientHeight;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(el('scene'));resize();
 camera.position.set(0,6200,7600);controls.target.set(0,150,0);controls.update();
 let lastFrame=performance.now();
 renderer.setAnimationLoop(now=>{const dt=Math.max(0,(now-lastFrame)/1000);lastFrame=now;if(!firstPerson?.active)controls.update();frameUpdate(dt);updateCompass();if(loading.ready||renderDirty){renderer.render(scene,camera);renderDirty=false}});
 Object.assign(loading,{renderer,scene,camera,controls});
 const yieldPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
 async function stage(number,message){
  loading.stage=number;loading.history.push({stage:number,message,time:performance.now(),objects:scene.children.length});
  el('loading-message').textContent=message;el('loading-progress').value=number;el('status').textContent=message;
  frameUpdate(0);renderer.render(scene,camera);renderDirty=false;await yieldPaint();
 }
 function refineTerrain(geometry,path){
  let worker;
  const job=new Promise((resolve,reject)=>{
   worker=new Worker(new URL('./terrain_worker.js',import.meta.url));
   worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data)};
   worker.onerror=event=>{worker.terminate();reject(Error(event.message||t('지형 계산을 완료하지 못했습니다.')))};
   worker.postMessage({geometry,path});
  });
  job.cancel=()=>worker.terminate();
  return job;
 }
 // A pre-computed refinement is used only when its key matches the exact inputs of this browser's run
 // (terrain grid, channel path and algorithm); otherwise the worker computes it as before.
 const REFINE_ALGORITHM='channel-refine-weld-v1',params=new URLSearchParams(location.search);
 function refineKey(geometry,path){
  let a=2166136261,b=5381;
  const mix=words=>{for(let i=0;i<words.length;i++){a=Math.imul(a^words[i],16777619);b=Math.imul(b,33)^words[i]}};
  for(const array of [geometry.positions,geometry.uv,geometry.colors])mix(new Uint32Array(array.buffer,array.byteOffset,array.length));
  mix(Uint32Array.from(geometry.index));
  mix(new Uint32Array(Float64Array.from(path.flatMap(p=>[p.x,p.z,p.level,p.width,p.breakBefore?1:0])).buffer));
  for(const c of REFINE_ALGORITHM)mix([c.charCodeAt(0)]);
  return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+'-'+geometry.positions.length+'-'+path.length;
 }
 function packRefinement(key,r){
  const near=[];for(let i=0;i<r.matches.length/3;i++)if(r.matches[i*3]!==Infinity)near.push(i);
  const header=new TextEncoder().encode(JSON.stringify({key,vertices:r.positions.length/3,indices:r.index.length,near:near.length}));
  const start=12+header.length,pad=(8-start%8)%8,sizes=[r.positions.byteLength,r.uv.byteLength,r.colors.byteLength,r.index.byteLength,near.length*4],body=sizes.reduce((s,v)=>s+v,0);
  const tailPad=(8-(start+pad+body)%8)%8,buffer=new ArrayBuffer(start+pad+body+tailPad+near.length*24),view=new DataView(buffer),bytes=new Uint8Array(buffer);
  bytes.set([72,89,67,82]);view.setUint32(4,1,true);view.setUint32(8,header.length,true);bytes.set(header,12);
  let offset=start+pad;
  for(const array of [r.positions,r.uv,r.colors,r.index,Uint32Array.from(near)]){bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),offset);offset+=array.byteLength}
  offset+=tailPad;const values=new Float64Array(buffer,offset,near.length*3);near.forEach((v,j)=>{values.set(r.matches.subarray(v*3,v*3+3),j*3)});
  return buffer;
 }
 function unpackRefinement(buffer,key){
  const view=new DataView(buffer);
  if(view.getUint32(0,true)!==0x52435948||view.getUint32(4,true)!==1)return null;
  const length=view.getUint32(8,true),header=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,12,length)));
  if(header.key!==key)return null;
  let offset=12+length;offset+=(8-offset%8)%8;
  const take=(Type,count)=>{const array=new Type(buffer,offset,count);offset+=array.byteLength;return array};
  const positions=take(Float32Array,header.vertices*3),uv=take(Float32Array,header.vertices*2),colors=take(Float32Array,header.vertices*3),index=take(Uint32Array,header.indices),near=take(Uint32Array,header.near);
  offset+=(8-offset%8)%8;const values=take(Float64Array,header.near*3);
  const matches=new Float64Array(header.vertices*3);for(let i=0;i<header.vertices;i++)matches[i*3]=Infinity;
  near.forEach((v,j)=>matches.set(values.subarray(j*3,j*3+3),v*3));
  return {positions,uv,colors,index,matches};
 }
 async function refineTerrainCached(geometry,path){
  // Download the file and run the worker together; whichever yields a valid result first wins.
  const key=refineKey(geometry,path),job=refineTerrain(geometry,path),download=new AbortController();
  const fromFile=params.get('refine-cache')==='off'?Promise.resolve(null):
   fetch(asset('/gis/georeferenced/terrain3d/channel_refined.bin.gz'),{signal:download.signal})
    .then(response=>response.ok?response.arrayBuffer():null).then(buffer=>buffer&&unpackRefinement(buffer,key)).catch(()=>null);
  const {result,source}=await Promise.race([
   job.then(result=>({result,source:'worker'})),
   fromFile.then(result=>result?{result,source:'file'}:job.then(result=>({result,source:'worker'})))]);
  if(source==='file')job.cancel();else download.abort();
  // Build-time export of the worker result; only kept when explicitly requested.
  if(params.get('refine-export')==='1')loading.exportRefinement=()=>{const bytes=new Uint8Array(packRefinement(key,result));let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)};
  return {...result,source,key};
 }
 const matchAt=(matches,i)=>({distance:matches[i*3],level:matches[i*3+1],width:matches[i*3+2]});
 await stage(0,t('고도 자료를 불러오는 중입니다'));
 const response=await fetch(asset('/gis/georeferenced/terrain3d/dem.json'));
 if(!response.ok)throw Error(t('고도 자료를 불러오지 못했습니다.'));
 const dem=await response.json(),exp=JSON.parse(el('experiment').textContent);
 const points=[...exp.landmarks,...exp.suggested_anchors];
 const alignTerrain=new URLSearchParams(location.search).get('alignment')!=='base';
 el('align-terrain').checked=alignTerrain;el('align-terrain').onchange=()=>{const url=new URL(location.href);url.searchParams.set('alignment',el('align-terrain').checked?'mountains':'base');location.href=url};
 const warp=DoseongWarp.fitTerrainTPS(points.map(p=>p.pixel),points.map(p=>project(p.lon,p.lat)),alignTerrain?exp.terrain_alignment:null);
 const [xmin,ymin,xmax,ymax]=dem.bounds_3857,n=dem.size;
 if(dem.elevations.length!==n*n||!dem.elevations.every(Number.isFinite))throw Error(t('고도 격자가 올바르지 않습니다.'));
 const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
 const latitude=2*Math.atan(Math.exp(cy/R))-Math.PI/2,ground=Math.cos(latitude);
 let exaggeration=1;
 const world=(x,y,h)=>[(x-cx)*ground,h*exaggeration,-(y-cy)*ground];
 function height(x,y){
  const u=(x-xmin)/(xmax-xmin)*(n-1),v=(ymax-y)/(ymax-ymin)*(n-1);
  if(u<0||v<0||u>n-1||v>n-1)throw Error(t('원도 배치가 준비된 고도 범위를 벗어났습니다.'));
  const i=Math.min(n-2,Math.floor(u)),j=Math.min(n-2,Math.floor(v)),a=u-i,b=v-j,k=j*n+i,z=dem.elevations;
  return (1-b)*((1-a)*z[k]+a*z[k+1])+b*((1-a)*z[k+n]+a*z[k+n+1]);
 }
 const surfaceMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
 function grid(cols,rows,location,textured=false){
  const positions=[],uv=[],indices=[],heights=[],colors=[];let folded=0;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const [x,y]=location(i/cols,j/rows),z=height(x,y);positions.push(...world(x,y,z));heights.push(z);uv.push(i/cols,1-j/rows);
   const color=new THREE.Color('#c4aa7f').multiplyScalar(1-Math.min(z/2400,.18));colors.push(color.r,color.g,color.b);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const a=j*(cols+1)+i,b=a+1,c=a+cols+1,d=c+1;
   for(const tri of [[a,d,b],[a,c,d]]){
    const [p,q,r]=tri.map(k=>[positions[k*3],positions[k*3+2]]);
    if((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])>=0)folded++;
    indices.push(...tri);
   }
  }
  if(textured&&folded)throw Error(t('원도 격자 접힘이 발견되어 3D 표시를 중단했습니다.'));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.heights=heights;return geometry;
 }
 const terrain=new THREE.Mesh(grid(n-1,n-1,(u,v)=>[xmin+u*(xmax-xmin),ymax-v*(ymax-ymin)]),surfaceMaterial);scene.add(terrain);
 const initial=world(...warp(1560,1470),150);controls.target.set(...initial);camera.position.set(initial[0],6200,initial[2]+7600);controls.update();
 await stage(1,t('지형 표시 완료 · 도성대지도를 불러오는 중입니다'));
 const texture=await new THREE.TextureLoader().loadAsync(asset(exp.image_url));texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const [iw,ih]=exp.image_size;
 const historical=new THREE.Mesh(grid(128,112,(u,v)=>warp(u*iw,v*ih),true),new THREE.MeshStandardMaterial({map:texture,transparent:true,opacity:Number(el('opacity3d').value)/100,roughness:1,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));historical.renderOrder=1;scene.add(historical);
 const mapGround=terrain; // One physical surface for terrain, map and road overlays.
 const sourceImagePositions=historical.geometry.attributes.position.clone();
 await stage(2,t('지도 표시 완료 · 주요 건물과 문을 준비합니다'));
 const labels=new THREE.Group();labels.visible=el('anchors3d').checked;scene.add(labels);
 const dotCanvas=document.createElement('canvas');dotCanvas.width=32;dotCanvas.height=32;
 const dotContext=dotCanvas.getContext('2d');dotContext.beginPath();dotContext.arc(16,16,12,0,Math.PI*2);dotContext.fillStyle='#167bb5';dotContext.fill();dotContext.strokeStyle='#ffffff';dotContext.lineWidth=4;dotContext.stroke();
 const dotTexture=new THREE.CanvasTexture(dotCanvas);
 for(const p of points){
  const [x,y]=project(p.lon,p.lat),z=height(x,y)+8;
  const dot=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTexture,depthTest:false,depthWrite:false,sizeAttenuation:false}));
  dot.renderOrder=10;dot.position.set(...world(x,y,z));dot.scale.set(.011,.011,1);dot.userData={x,y,z,name:p.name};if(p.dem_height_m)dot.material.color.setHex(0xffa84c);labels.add(dot);
 }
 const gateModel=createCityGate;
 const buildings=new THREE.Group();scene.add(buildings);
 const foundations=new THREE.Group();scene.add(foundations);
 const supportSurfaces=[terrain,historical].map(mesh=>({positions:mesh.geometry.attributes.position.array,index:mesh.geometry.index.array}));
 // A coarse X/Z index keeps each footprint test to the triangles near the building.
 const supportNearby=surfaceIndex(supportSurfaces);
 const drills=[],guardModels=[];
 const buildingData=JSON.parse(el('buildings').textContent);
 // Place stories are kept in their own file and attached to the feature they belong to by type and id (or name).
 const storyData=JSON.parse(el('stories')?.textContent??'{"stories":[]}');
 function attachStories(type,features,key=f=>f.id){
  for(const f of features){const list=storyData.stories.filter(s=>s.target.type===type&&s.target.key===key(f));if(list.length)f.info={...(f.info??{summary:f.note,sources:f.reference?[{title:'참고 자료',url:f.reference}]:[]}),stories:list}}
 }
 attachStories('landmark',buildingData.features);
 const siteMarkers=[];
 const colors={'궁궐':0xb66841,'제례':0x786091,'교육':0x397b83,'관청':0x4b6b9b,'상업':0xa48734,'성문':0x98564b,'집터':0x8a8577,'시설':0x7f6a4c,'탑':0xd8d4c8,'궁가':0xa87a55};
 const wallData=JSON.parse(el('wall').textContent);
 if(wallData.source_sha256!==exp.input_sha256)throw Error(t('성벽 판독 원본이 현재 원도와 다릅니다.'));
 // A gate stands square to the wall it pierces: its yaw is the wall's local direction turned 90°, on whichever
 // side faces the road axis read from the map. 숭례문 is the exception: there the wall is bent to the gate's
 // transverse axis instead (wall_connection in city_wall.js), so its road-axis yaw is kept.
 const wallNodes=[];
 wallData.centerline.slice(0,-1).forEach((a,i)=>{const b=wallData.centerline[i+1],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3);
  for(let j=0;j<steps;j++){const p=sourceSurface(a[0]+(b[0]-a[0])*j/steps,a[1]+(b[1]-a[1])*j/steps);wallNodes.push([p.x,p.z])}});
 // The city centre (mean of the wall line) tells which side of a city gate faces out of the city.
 const cityCentre=wallNodes.reduce((c,[x,z])=>({x:c.x+x/wallNodes.length,z:c.z+z/wallNodes.length}),{x:0,z:0});
 function wallSquareYaw(wx,wz,roadYaw,radius=45){
  const near=wallNodes.filter(([x,z])=>Math.hypot(x-wx,z-wz)<radius);if(near.length<4)return null;
  // Principal direction of the nearby wall nodes.
  const mx=near.reduce((a,p)=>a+p[0],0)/near.length,mz=near.reduce((a,p)=>a+p[1],0)/near.length;
  let sxx=0,sxz=0,szz=0;for(const [x,z] of near){sxx+=(x-mx)**2;sxz+=(x-mx)*(z-mz);szz+=(z-mz)**2}
  const theta=.5*Math.atan2(2*sxz,sxx-szz),tx=Math.cos(theta),tz=Math.sin(theta);
  const candidates=[Math.atan2(-tz,tx),Math.atan2(tz,-tx)];
  const diff=a=>Math.abs(Math.atan2(Math.sin(a-roadYaw),Math.cos(a-roadYaw)));
  return candidates.sort((a,b)=>diff(a)-diff(b))[0];
 }
 for(const feature of buildingData.features){
  let x,y;
  if(feature.source_position){
   if(feature.source_position.source_sha256!==exp.input_sha256)throw Error(t('문 위치 판독 원본이 현재 원도와 다릅니다.'));
   const p=sourceSurface(...feature.source_position.pixel);
   x=cx+p.x/ground;y=cy-p.z/ground;
  }else [x,y]=project(feature.lon,feature.lat);
  let [w,h,d]=feature.symbol_size_m;
  const [wx,,wz]=world(x,y,0);
  let yaw=(feature.display_yaw_deg??0)*Math.PI/180;
  if(feature.source_plot){
   const plot=feature.source_plot,a=sourceSurface(...plot.near_start),b=sourceSurface(...plot.near_end),back=sourceSurface(...plot.back);
   const nx=(a.x+b.x)/2-back.x,nz=(a.z+b.z)/2-back.z;
   yaw=Math.atan2(nx,nz);w=a.distanceTo(b)*.96;d=Math.hypot(nx,nz)*.96;
   feature.symbol_size_m=[w,h,d];
  }
  if(feature.road_axis){
   if(feature.road_axis.source_sha256!==exp.input_sha256)throw Error(t('문 진입로 판독 원본이 현재 원도와 다릅니다.'));
   const [a,b]=feature.road_axis.pixel_points.map(p=>warp(...p));
   // Local +z is the open passage; world +z points south.
   yaw=Math.atan2(b[0]-a[0],-(b[1]-a[1]));
   if(feature.category==='성문'&&!wallData.openings.some(o=>o.model_id===feature.id&&o.wall_connection)&&feature.id!=='gwanghwamun'){const square=wallSquareYaw(wx,wz,yaw);if(square!==null){feature.wall_square_deg=Math.round((square-yaw)*180/Math.PI*10)/10;yaw=square}}
  }
  const support=TerrainSupport.footprintRange(supportNearby(wx,wz,Math.hypot(w,d)/2+1),[wx-w/2,wz-d/2,wx+w/2,wz+d/2],yaw);
  const z=support.max+.5,bottom=support.min-.25;
  const foundation=new THREE.Mesh(new THREE.BoxGeometry(w,z-bottom,d),new THREE.MeshStandardMaterial({color:0x8a8273,roughness:1}));
  foundation.rotation.y=yaw;foundation.position.set(wx,(z+bottom)/2,wz);foundation.userData={top:z,bottom,featureId:feature.id};foundations.add(foundation);
  const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:colors[feature.category]??0x856549,roughness:.8}));
  box.position.set(...world(x,y,z));box.position.y+=h/2;
  box.rotation.y=yaw;box.userData={feature,x,y,z,boxHeight:h,support};
  if(feature.display_model==='conceptual_gate_with_open_arch_and_roof'||(!feature.model_resource&&feature.category==='성문')){box.material.visible=false;feature.outer_side=Math.sign(Math.sin(yaw)*(wx-cityCentre.x)+Math.cos(yaw)*(wz-cityCentre.z))||1;const gate=gateModel(feature,w,h,d);box.add(gate);const guards=createGuards(feature,w,h,d,gate);if(guards){box.add(guards);guardModels.push(guards);if(guards.userData.update)drills.push(guards)}}
  if(feature.display_model==='throne_hall'){box.material.visible=false;foundation.visible=false;box.add(createThroneHall(feature,w,h,d))}
  if(feature.display_model==='palace_compound'){box.material.visible=false;box.add(createPalace(feature,w,h,d))}
  if(feature.display_model==='palace_gate'){box.material.visible=false;box.add(createPalaceGate(feature,w,h,d));const guards=createGuards(feature,w,h,d);if(guards){box.add(guards);guardModels.push(guards)}}
  if(feature.display_model==='gyeonghoeru_pond'){box.material.visible=false;foundation.visible=false;box.add(createGyeonghoeruPond(feature,w,h,d))}
  if(feature.display_model==='hall_site'){
   box.material.visible=false;const site=createHallSite(feature,w,h,d);box.add(site);
   // On sloping ground the terrace base (the highest ground under it) floats above the ground in front of the south
   // stairs; approach steps bridge that drop so the stairs can be walked up.
   const lz=d/2+3.5,fx=wx+Math.sin(yaw)*lz,fz=wz+Math.cos(yaw)*lz;
   box.userData.approachGround=TerrainSupport.footprintRange(supportNearby(fx,fz,8),[fx-3,fz-1.5,fx+3,fz+1.5],yaw).min;
   site.userData.setApproach((z-box.userData.approachGround)*exaggeration);
  }
  if(feature.display_model==='observatory'){box.material.visible=false;foundation.visible=false;box.add(createObservatory(feature,w,h,d))}
  if(feature.display_model==='wongaksa_pagoda'){box.material.visible=false;box.add(createPagoda(feature,w,h,d))}
  if(feature.display_model==='training_ground'){box.material.visible=false;foundation.visible=false;box.add(createTrainingGround(feature,w,h,d));const drill=createDrill(feature,w,h,d);box.add(drill);drills.push(drill)}
  if(feature.display_model==='bell_tower'){box.material.visible=false;box.add(createBellTower(feature,w,h,d))}
  if(feature.display_model==='site_marker'){box.material.visible=false;foundation.visible=false;box.add(createSiteMarker(feature,w,h,d));siteMarkers.push({box,foundation})}
  if(feature.display_model==='house_site'){box.material.visible=false;foundation.visible=false;box.add(createHouseSite(feature,w,h,d));siteMarkers.push({box,foundation})}
  if(feature.display_model==='jongmyo_15_chambers'){box.material.visible=false;box.add(createJongmyo(w,h,d))}
  if(feature.display_model==='yukjo_compound'){box.material.visible=false;foundation.visible=false;box.add(createYukjo(feature,w,h,d))}
  buildings.add(box);
 }
 // Far level of detail for landmarks: beyond LANDMARK_LOD_M a detailed model (often hundreds of meshes) is replaced by one
 // merged low model — a base plate, a hall block and a roof — so the whole city costs about one draw call per building.
 const LANDMARK_LOD_M=2400,proxyMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),landmarkLods=[];
 function proxyGeometry(feature,w,h,d){
  const positions=[],colors=[],m=new THREE.Matrix4(),v=new THREE.Vector3();
  // Every upward face of a wall block is painted tile colour so the simplified city reads as roofs from above; the
  // ground plate of a compound keeps its courtyard colour.
  const tile=0x4b5254,tileC=new THREE.Color(tile);
  const push=(geometry,color,x,y,z,ry=0,tileTop=true)=>{const g=geometry.index?geometry.toNonIndexed():geometry,p=g.attributes.position,n=g.attributes.normal,c=new THREE.Color(color);
   m.makeRotationY(ry).setPosition(x,y,z);
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m);positions.push(v.x,v.y,v.z);const up=tileTop&&n&&n.getY(i)>.5;colors.push(up?tileC.r:c.r,up?tileC.g:c.g,up?tileC.b:c.b)}};
  const roof=(rw,rd,rise)=>{const g=new THREE.BufferGeometry(),a=rw/2,b=rd/2;
   g.setAttribute('position',new THREE.Float32BufferAttribute([-a,0,-b,a,0,-b,a,rise,0, -a,0,-b,a,rise,0,-a,rise,0, a,0,b,-a,0,b,-a,rise,0, a,0,b,-a,rise,0,a,rise,0, -a,0,-b,-a,rise,0,-a,0,b, a,0,b,a,rise,0,a,0,-b],3));return g};
  const ground=-h/2,compound=['yukjo_compound','training_ground','house_site','palace_compound','observatory','throne_hall'].includes(feature.display_model);
  // Walls stay close to the beige of the detailed timber-and-plaster models, with only a hint of the category colour.
  const wall=new THREE.Color(0xc9bb9f).lerp(new THREE.Color(colors3d[feature.category]??0x856549),.25);
  // A hall is a wall block with a pitched roof of ordinary house pitch; the rise never scales with the plot.
  const hall=(x,z,hw,hd,hh,ry=0)=>{push(new THREE.BoxGeometry(hw,hh,hd),wall,x,ground+.6+hh/2,z,ry);push(roof(hw+1.6,hd+1.6,Math.min(3.2,1.2+hd*.16)),tile,x,ground+.6+hh,z,ry)};
  if(feature.pavilion){
   const garden=feature.pavilion.pond||feature.pavilion.rice;
   const hw=w*(garden ? .48 : .86),hd=d*(garden ? .42 : .8),hz=garden?-d*.17:0;
   push(new THREE.BoxGeometry(hw,.5,hd),0xb4ac99,0,ground+.25,hz,0,false);
   for(const x of [-hw*.42,hw*.42])for(const z of [-hd*.4,hd*.4])push(new THREE.BoxGeometry(.35,h*.6,.35),0x76503a,x,ground+h*.3,hz+z,0,false);
   if(feature.pavilion.enclosed)push(new THREE.BoxGeometry(hw*.85,h*.55,hd*.8),wall,0,ground+h*.3,hz);
   push(roof(hw+1.2,hd+1.2,h*.3),feature.pavilion.roof==='thatch'?0xa99768:tile,0,ground+h*.63,hz,0,false);
  }else if(feature.display_model==='yukjo_compound'){
   // Mirror the detailed layout: plate, enclosure wall, front row with the gate, main hall and two side halls.
   push(new THREE.BoxGeometry(w,.6,d),0xc6b48f,0,ground+.3,0,0,false);
   const gateW=Math.min(13,w*.24),front=d/2-5,run=(w-gateW)/2-2;
   for(const side of [-1,1]){hall(side*(gateW/2+run/2),front,run,6,3.5);push(new THREE.BoxGeometry(1.2,2.3,d-10),0xd5c8ad,side*(w/2-.8),ground+.6+1.15,-2)}
   hall(0,front,gateW,7,4.8);push(new THREE.BoxGeometry(w,2.3,1.2),0xd5c8ad,0,ground+.6+1.15,-d/2+2);
   hall(0,-d*.12,w*(feature.court_type==='large'?.52:.6),Math.min(13,d*.2),feature.court_type==='large'?5.7:4.8);
   for(const side of [-1,1])hall(side*w*.33,d*.05,Math.min(d*.36,25),7,3.5,Math.PI/2);
  }else if(compound){
   push(new THREE.BoxGeometry(w,.6,d),0xc6b48f,0,ground+.3,0,0,false);
   const hw=Math.max(6,w*.5),hd=Math.min(14,Math.max(5,d*.25)),hh=Math.min(Math.max(3,h*.45),7);
   hall(0,-d*.15,hw,hd,hh);
   for(const side of [-1,1])push(new THREE.BoxGeometry(1.2,2.3,d-2),0xd5c8ad,side*(w/2-.8),ground+.6+1.15,0);
   for(const side of [-1,1])push(new THREE.BoxGeometry(w,2.3,1.2),0xd5c8ad,0,ground+.6+1.15,side*(d/2-.8));
  }else{
   const bh=Math.max(2,h*.65);
   push(new THREE.BoxGeometry(w*.85,bh,d*.85),wall,0,ground+bh/2,0);push(roof(w*.95,d*.95,Math.max(1,h*.3)),tile,0,ground+bh,0);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
 }
 const colors3d=colors;
 for(const box of buildings.children){
  const detail=[...box.children];if(!detail.length||['gyeonghoeru_pond','hall_site'].includes(box.userData.feature.display_model))continue;
  const f=box.userData.feature,[w,h,d]=f.symbol_size_m;
  const proxy=new THREE.Mesh(proxyGeometry(f,w,h,d),proxyMaterial);proxy.name='landmark-lod';proxy.visible=false;box.add(proxy);
  landmarkLods.push({box,detail,proxy,near:true,far:null});
 }
 // Important buildings keep their detail farther out (level 0 to 7200 m, level 1 to 4320 m, level 2 to 2880 m).
 // A small distance gap keeps a model from flickering between its two forms at the boundary.
 function updateLandmarkLod(){
  for(const l of landmarkLods){
   l.far??=LANDMARK_LOD_M*[3,1.8,1.2,1][buildingLevel(l.box.userData.feature)];
   const dist=camera.position.distanceTo(l.box.position),near=l.near?dist<l.far+100:dist<l.far-100;
   if(near===l.near)continue;l.near=near;for(const c of l.detail)c.visible=near;l.proxy.visible=!near;
  }
 }
 // Commemorative house sites are optional: they are modern markers, not 1750 buildings.
 function updateSites(){const on=el('sites3d').checked;for(const {box} of siteMarkers)box.visible=on}
 el('sites3d').onchange=()=>{updateSites();updateBuildingNames()};updateSites();
 // Transparent text sprites live above the models in the 3D scene.
 function nameSprite(name){
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  ctx.font='500 24px system-ui';canvas.width=Math.ceil(ctx.measureText(name).width)+8;canvas.height=36;
  ctx.font='500 24px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  ctx.strokeStyle='rgba(255,253,243,.9)';ctx.lineWidth=3;ctx.strokeText(name,canvas.width/2,18);
  ctx.fillStyle='#25362f';ctx.fillText(name,canvas.width/2,18);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,sizeAttenuation:false}));
  tag.center.set(.5,0);return {tag,aspect:canvas.width/canvas.height};
 }
 const buildingNames=new THREE.Group();buildingNames.name='building-name-labels';scene.add(buildingNames);
 // Names like "창덕궁 · 인정전 일대" put the palace name where it was and the hall name on the modelled hall.
 // The palace tag stays first per building (checks look it up by feature id) and is lifted one line on screen.
 const nameTags=buildings.children.flatMap(building=>{
  const [name,detail]=building.userData.feature.name.split(' · '),hall=detail?.endsWith(' 일대')?detail.replace(/ 일대$/,''):/ area$/i.test(detail??'')?detail.replace(/ area$/i,''):null;
  const {tag,aspect}=nameSprite(name);
  tag.renderOrder=5;tag.userData={name,featureId:building.userData.feature.id,role:hall?'palace':'building'};buildingNames.add(tag);
  if(!hall)return [{building,tag,aspect}];
  tag.center.set(.5,-1.15);
  const hallSprite=nameSprite(hall);hallSprite.tag.renderOrder=5;hallSprite.tag.userData={name:hall,featureId:building.userData.feature.id,role:'hall'};buildingNames.add(hallSprite.tag);
  return [{building,tag,aspect},{building,...hallSprite}];
 });
 // The ten Yukjo street offices share one "육조거리" label from afar and show their own names up close.
 const YUKJO_STREET=new Set(['uijeongbu','ijo','hojo','hanseongbu','yejo','jungchubu','saheonbu','byeongjo','hyeongjo','gongjo']),YUKJO_NEAR_M=1200;
 const yukjoOffices=nameTags.filter(n=>YUKJO_STREET.has(n.tag.userData.featureId)).map(n=>n.building);
 const yukjoStreetTag=nameSprite(t('육조거리'));yukjoStreetTag.tag.renderOrder=5;yukjoStreetTag.tag.userData={name:'육조거리',role:'street'};buildingNames.add(yukjoStreetTag.tag);
 const mountainNames=new THREE.Group();mountainNames.name='mountain-name-labels';scene.add(mountainNames);
 const districtNames=new THREE.Group();districtNames.name='district-name-labels';scene.add(districtNames);
 function placeTag(name,x,y,group){
  const {tag,aspect}=nameSprite(name);
  tag.userData={name,x,y,z:height(x,y)+20};tag.renderOrder=6;group.add(tag);
  return {tag,aspect};
 }
 // Lowland anchors (e.g. 만리창) only stretch the outskirts; mountain name tags come from the ridge anchors.
 const mountainTags=exp.terrain_alignment.anchors.filter(p=>p.kind!=='lowland').map(p=>{
  const name=p.name.startsWith('백악')?'북악산':p.name.replace(' 능선','');
  const [x,y]=alignTerrain?project(p.lon,p.lat):warp(...p.pixel);return placeTag(t(name),x,y,mountainNames);
 });
 // Approximate area labels, not surveyed points or historical administrative boundaries.
 // Seochon follows the drawn palace wall and upstream channel, not a historical center.
 // Area descriptions: hanok.seoul.go.kr/front/kor/town/town01.do and town02.do.
 // 경복궁 sits at the centre of its drawn wall; the palace itself is not modelled.
 const districtTags=[{name:'북촌',pixel:[1445,965]},{name:'서촌',pixel:[1042,1085]},{name:'경복궁',pixel:[1153,983]}].map(p=>{
  const [x,y]=warp(...p.pixel);const made=placeTag(t(p.name),x,y,districtNames);made.tag.userData.name=p.name;return made;
 });
 // Neighbourhood names from the map; missing data only hides the layer.
 let placeNames=null;
 try{const response=await fetch(asset('/gis/placenames/doseong_placenames.json'));if(response.ok){const data=await response.json();if(data.source_sha256===exp.input_sha256){attachStories('place',data.features,f=>f.name);placeNames=createPlaceNames(data,{warp,world,height,camera,canvas:renderer.domElement});scene.add(placeNames.group)}}}catch{}
 // Name levels by importance: 0 always shown (palaces, 종묘, great gates, mountains, 육조거리, 경복궁); 1 wards (방),
 // small gates, 북촌·서촌 and landmark sites; 2 other large offices and shrines, and palace halls; 3 small buildings and 계;
 // 4 동 and lanes. Each level has a viewing distance, and a label that would overlap a more important (then nearer)
 // label is hidden for that frame.
 const LABEL_REACH=[Infinity,7000,3000,1500,1000];
 const LEVEL0=new Set(['changdeok','changgyeong','gyeongdeok','jongmyo','heunginjimun','sungnyemun','donuimun','sukjeongmun']);
 const LEVEL1=new Set(['gyeonghoeru_pond','geunjeongjeon_site','sajeongjeon_site','gangnyeongjeon_site','gyotaejeon_site','sajik','sungkyun','gwanghwamun','donhwamun','honghwamun','heunghwamun','gwanghuimun','souimun','changuimun','hyehwamun','jongru','wongaksa_pagoda','hullyeonwon','gyeongmogung','dongmyo','nammyo','uigeumbu','bibyeonsa','seonhyecheong','hunguk','daebodan','yeonghuijeon','yuksanggung']);
 function buildingLevel(f){
  if(LEVEL0.has(f.id))return 0;if(LEVEL1.has(f.id))return 1;
  const [w,,d]=f.symbol_size_m??[0,0,0];
  return f.category!=='집터'&&w*d>=900&&['궁궐','제례','관청','교육','궁가'].includes(f.category)?2:3;
 }
 for(const n of nameTags)n.level=n.tag.userData.role==='hall'?(LEVEL0.has(n.building.userData.feature.id)?1:2):buildingLevel(n.building.userData.feature);
 const areaLevel=name=>name==='북촌'||name==='서촌'?1:0;
 const labelCells=new Map(),projected=new THREE.Vector3(),LABEL_PX=24,LABEL_CELL=48;
 function updateBuildingNames(){
  updateLandmarkLod();settlement?.setLod(camera.position);
  const namesOn=el('names3d').checked;
  buildingNames.visible=buildings.visible&&namesOn;mountainNames.visible=namesOn;districtNames.visible=namesOn;
  const scale=24*2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,el('scene').clientHeight); // 24px font on a 36px canvas yields ~16px text.
  const yukjoCentre=new THREE.Vector3();for(const b of yukjoOffices)yukjoCentre.add(b.position);yukjoCentre.multiplyScalar(1/Math.max(1,yukjoOffices.length));
  const yukjoFar=camera.position.distanceTo(yukjoCentre)>YUKJO_NEAR_M;
  const r=renderer.domElement.getBoundingClientRect(),candidates=[];
  const consider=(tag,aspect,level,eligible)=>{
   tag.scale.set(scale*aspect,scale,1);tag.visible=false;if(!eligible)return;
   const d=camera.position.distanceTo(tag.position);if(d>=LABEL_REACH[level])return;
   projected.copy(tag.position).project(camera);if(projected.z<-1||projected.z>1||Math.abs(projected.x)>1.1||Math.abs(projected.y)>1.1)return;
   candidates.push({tag,aspect,level,d,sx:(projected.x+1)*r.width/2,sy:(1-projected.y)*r.height/2,owner:tag.userData.featureId??null});
  };
  yukjoStreetTag.tag.position.copy(yukjoCentre);yukjoStreetTag.tag.position.y+=16;
  consider(yukjoStreetTag.tag,yukjoStreetTag.aspect,0,buildingNames.visible&&yukjoFar&&yukjoOffices.some(b=>b.visible));
  for(const n of nameTags){
   n.tag.position.copy(n.building.position);n.tag.position.y+=n.building.userData.boxHeight/2+4;
   consider(n.tag,n.aspect,n.level,buildingNames.visible&&n.building.visible&&!(yukjoFar&&YUKJO_STREET.has(n.tag.userData.featureId)));
  }
  for(const {tag,aspect} of mountainTags){const p=tag.userData;tag.position.set(...world(p.x,p.y,p.z));consider(tag,aspect,0,namesOn)}
  for(const {tag,aspect} of districtTags){const p=tag.userData;tag.position.set(...world(p.x,p.y,p.z));consider(tag,aspect,areaLevel(p.name),namesOn)}
  for(const c of placeNames?.place(namesOn&&(el('placenames3d')?.checked??true))??[])consider(c.tag,c.aspect,c.level,true);
  candidates.sort((a,b)=>a.level-b.level||a.d-b.d);
  labelCells.clear();
  for(const c of candidates){
   // Sprites are anchored at their bottom centre; palace names are lifted by their negative centre offset.
   // Level 0 names are never hidden: when one collides it steps up a line (at most two) before being placed anyway.
   c.tag.userData.baseCenterY??=c.tag.center.y;c.tag.center.y=c.tag.userData.baseCenterY;
   const tries=c.level===0?3:1;let box,keys,clash;
   for(let step=0;step<tries;step++){
   const w=LABEL_PX*c.aspect,bottom=c.sy+(c.tag.userData.baseCenterY-step*1.1)*LABEL_PX;box=[c.sx-w/2-2,bottom-LABEL_PX-2,c.sx+w/2+2,bottom+2];keys=[];clash=false;
   for(let gx=Math.floor(box[0]/LABEL_CELL);gx<=Math.floor(box[2]/LABEL_CELL);gx++)for(let gy=Math.floor(box[1]/LABEL_CELL);gy<=Math.floor(box[3]/LABEL_CELL);gy++){
    const key=gx+','+gy;keys.push(key);
    if(!clash)for(const o of labelCells.get(key)??[])if(box[0]<o[2]&&box[2]>o[0]&&box[1]<o[3]&&box[3]>o[1]&&!(c.owner&&o[4]===c.owner)){clash=true;break}
   }
   if(!clash||step===tries-1){c.tag.center.y=c.tag.userData.baseCenterY-step*1.1;break}
   }
   if(clash&&c.level>0)continue;
   box[4]=c.owner;c.tag.visible=true;for(const key of keys){if(!labelCells.has(key))labelCells.set(key,[]);labelCells.get(key).push(box)}
  }
 }
 frameUpdate=()=>updateBuildingNames();
 await stage(3,t('주요 건물·문 표시 완료 · 물길을 준비합니다'));
 const waterData=JSON.parse(el('water').textContent),waterLayer=new THREE.Group(),bridges=new THREE.Group();scene.add(waterLayer);scene.add(bridges);
 if(waterData.source_sha256!==exp.input_sha256)throw Error(t('물길 판독 원본이 현재 원도와 다릅니다.'));
 function sourceSurface(px,py){
  const cols=128,rows=112,u=px/iw*cols,v=py/ih*rows,i=Math.min(cols-1,Math.floor(u)),j=Math.min(rows-1,Math.floor(v)),a=u-i,b=v-j;
  if(i<0||j<0||u>cols||v>rows)throw Error(t('물길 판독점이 원도 밖에 있습니다.'));
  const k=j*(cols+1)+i,ids=a>=b?[k,k+1,k+cols+2]:[k,k+cols+1,k+cols+2],weights=a>=b?[1-a,a-b,b]:[1-b,b-a,a];
  const p=new THREE.Vector3(),positions=sourceImagePositions;
  ids.forEach((id,c)=>p.addScaledVector(new THREE.Vector3().fromBufferAttribute(positions,id),weights[c]));
  // The denser DEM mesh may rise above the coarse image mesh between its vertices.
  const tx=cx+p.x/ground,ty=cy-p.z/ground,gu=(tx-xmin)/(xmax-xmin)*(n-1),gv=(ymax-ty)/(ymax-ymin)*(n-1);
  const gi=Math.min(n-2,Math.floor(gu)),gj=Math.min(n-2,Math.floor(gv)),ga=gu-gi,gb=gv-gj,gk=gj*n+gi;
  const zs=dem.elevations,land=ga>=gb?(1-ga)*zs[gk]+(ga-gb)*zs[gk+1]+gb*zs[gk+n+1]:(1-gb)*zs[gk]+(gb-ga)*zs[gk+n]+ga*zs[gk+n+1];
  p.y=Math.max(p.y,land);return p;
 }
 const riverNodes=[],riverHalfWidths=[];
 for(let i=0;i<waterData.centerline.length-1;i++){
  const a=waterData.centerline[i],b=waterData.centerline[i+1],steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4);
  for(let j=0;j<steps;j++){
   const t=j/steps;riverNodes.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
   riverHalfWidths.push(waterData.half_widths_px[i]*(1-t)+waterData.half_widths_px[i+1]*t);
  }
 }
 riverNodes.push(waterData.centerline.at(-1));riverHalfWidths.push(waterData.half_widths_px.at(-1));
 function banksAt(line,index,widths=waterData.half_widths_px){
  const p=line[index],a=line[Math.max(0,index-1)],b=line[Math.min(line.length-1,index+1)],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const nx=-(b[1]-a[1])/length*widths[index],ny=(b[0]-a[0])/length*widths[index];
  return [sourceSurface(p[0]-nx,p[1]-ny),sourceSurface(p[0]+nx,p[1]+ny)];
 }
 const riverEdges=riverNodes.map((_,i)=>banksAt(riverNodes,i,riverHalfWidths));
 function ribbon(pairs,color,offset){
  const pos=[],heights=[],idx=[];pairs.forEach(pair=>pair.forEach(v=>{pos.push(v.x,v.y+offset,v.z);heights.push(v.y+offset)}));
  for(let i=0;i<pairs.length-1;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();g.userData.heights=heights;
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color,roughness:.5,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));m.renderOrder=2;m.userData.centres=pairs.map(pair=>pair[0].clone().add(pair[1]).multiplyScalar(.5));m.userData.bank=false;waterLayer.add(m);return m;
 }
 const river=ribbon(riverEdges,0x278fb0,.35);river.name='cheonggyecheon-water';
 // Low schematic bank edges; this does not excavate or reconstruct the riverbed.
 for(const side of [0,1]){const bank=ribbon(riverEdges.map(pair=>{const p=pair[side].clone(),q=p.clone();q.y+=.65;return [p,q]}),0x8b9180,.35);bank.userData.bank=true;bank.userData.centres=river.userData.centres;}
 // The water is a sheet at the surface; a face hangs from each of its edges down past the carved bed, so the channel
 // reads as full of water rather than a sheet floating over an empty trench. The hem depth follows the channel depth.
 const WATER_BODY_EXTRA=1;
 for(const side of [0,1]){const face=ribbon(riverEdges.map(pair=>{const q=pair[side].clone(),p=q.clone();p.y-=2+WATER_BODY_EXTRA;return [p,q]}),0x2384a6,.35);face.userData.body=true;face.userData.centres=river.userData.centres;face.name='cheonggyecheon-water-body'}
 attachStories('bridge',waterData.bridges);
 for(const feature of waterData.bridges){
  const road=feature.road_connections.pixel_points.map(p=>sourceSurface(...p)),ends=road.slice(1,3),mid=ends[0].clone().add(ends[1]).multiplyScalar(.5),direction=ends[1].clone().sub(ends[0]);
  const length=Math.hypot(direction.x,direction.z),w=feature.deck_width_m,h=1.6,base=Math.max(ends[0].y,ends[1].y)+.35;
  const f={...feature,symbol_size_m:[w,h,length]},bridge=new THREE.Mesh(new THREE.BoxGeometry(w,h,length),new THREE.MeshStandardMaterial({color:0xb6aa90,roughness:.9,side:THREE.DoubleSide}));
  bridge.position.set(mid.x,base+.3+h/2,mid.z);bridge.rotation.y=Math.atan2(direction.x,direction.z);
  for(const side of [-1,1]){
   const rail=new THREE.Mesh(new THREE.BoxGeometry(.4,1,length),new THREE.MeshStandardMaterial({color:0x897d69,roughness:1}));rail.position.set(side*(w/2-.2),h/2+.65,0);bridge.add(rail);
   for(const z of [-length*.38,0,length*.38]){const post=new THREE.Mesh(new THREE.BoxGeometry(.65,1.3,.65),rail.material);post.position.set(side*(w/2-.2),h/2+.65,z);bridge.add(post)}
  }
  bridge.userData={feature:f,x:cx+mid.x/ground,y:cy-mid.z/ground,z:base,lift:.3,boxHeight:h,roadEnds:[road[0],road[3]].map(p=>{const dx=p.x-mid.x,dz=p.z-mid.z,c=Math.cos(bridge.rotation.y),s=Math.sin(bridge.rotation.y);return {x:c*dx-s*dz,z:s*dx+c*dz}})};bridges.add(bridge);
 }
 // A horse dealer with one horse beside the north approach of 수표교 (마전교); see horse_dealer.js for the record.
 {
  const b=waterData.bridges.find(f=>f.id==='supyo');
  if(b){
   const road=b.road_connections.pixel_points.map(p=>sourceSurface(...p)),dir=road[2].clone().sub(road[1]).setY(0).normalize(),side=new THREE.Vector3(dir.z,0,-dir.x);
   const at=road[0].clone().addScaledVector(side,b.deck_width_m/2+4).addScaledVector(dir,-2);
   horseDealer=createHorseDealer({position:at,yaw:Math.atan2(-side.x,-side.z)});scene.add(horseDealer);
  }
 }
 // Sample only triangles near each crossing, then clip exact rotated footprints.
 function updateBridgeGround(surfaces){
  for(const b of bridges.children){
   const u=b.userData,[w,,length]=u.feature.symbol_size_m;
   const yaw=b.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw),extent=Math.max(...u.roadEnds.map(p=>Math.abs(p.z)))+2;
   const halfWidth=w/2+Math.max(...u.roadEnds.map(p=>Math.abs(p.x)));
   const rx=Math.abs(c)*halfWidth+Math.abs(s)*extent+1,rz=Math.abs(s)*halfWidth+Math.abs(c)*extent+1;
   const local=surfaces.map(({positions,index})=>{
    const selected=[];
    for(let i=0;i<index.length;i+=3){
     const a=index[i]*3,d=index[i+1]*3,e=index[i+2]*3;
     if(Math.max(positions[a],positions[d],positions[e])<b.position.x-rx||Math.min(positions[a],positions[d],positions[e])>b.position.x+rx||Math.max(positions[a+2],positions[d+2],positions[e+2])<b.position.z-rz||Math.min(positions[a+2],positions[d+2],positions[e+2])>b.position.z+rz)continue;
     selected.push(index[i],index[i+1],index[i+2]);
    }
    return {positions,index:selected};
   });
   const range=(z,depth,lx=0)=>{const x=b.position.x+s*z+c*lx,y=b.position.z+c*z-s*lx;return TerrainSupport.footprintRange(local,[x-w/2,y-depth/2,x+w/2,y+depth/2],yaw)};
   u.z=range(0,length+1).max;
   u.connections=[-1,1].map((side,k)=>({side,footing:range(side*(length/2-2),4),rows:Array.from({length:15},(_,i)=>{
    const t=i/14,x=u.roadEnds[k].x*t,z=side*length/2*(1-t)+u.roadEnds[k].z*t;
    return {x,z,...range(z,.5,x)};
   })}));
  }
 }
 function renderBridgeConnections(b){
  const u=b.userData;if(!u.connections)return;
  const old=b.getObjectByName('bridge-connections');
  if(old){old.traverse(m=>{if(m.isMesh)m.geometry.dispose()});b.remove(old)}
  const group=new THREE.Group();group.name='bridge-connections';b.add(group);
  const [w,h,length]=u.feature.symbol_size_m,top=h/2,deckWorld=b.position.y+top;
  for(const conn of u.connections){
   const bottom=(conn.footing.min-.2)*exaggeration-b.position.y;
   const abutment=new THREE.Mesh(new THREE.BoxGeometry(w,-h/2-bottom,4),b.material);
   abutment.name='bridge-abutment';abutment.position.set(0,(bottom-h/2)/2,conn.side*(length/2-2));group.add(abutment);
   const rows=conn.rows,outer=rows.at(-1).max*exaggeration+.12,positions=[],indices=[];
   rows.forEach((row,i)=>{
    const t=i/(rows.length-1),rampTop=i===0?deckWorld:Math.max(deckWorld*(1-t)+outer*t,row.max*exaggeration+.12);
    const rampBottom=(row.min-.2)*exaggeration;
    positions.push(row.x-w/2,rampTop-b.position.y,row.z,row.x+w/2,rampTop-b.position.y,row.z,row.x-w/2,rampBottom-b.position.y,row.z,row.x+w/2,rampBottom-b.position.y,row.z);
    if(i){const a=(i-1)*4,d=i*4;indices.push(a,a+1,d+1,a,d+1,d,a,d,d+2,a,d+2,a+2,a+1,a+3,d+3,a+1,d+3,d+1,a+2,d+2,d+3,a+2,d+3,a+3)}
   });
   const end=(rows.length-1)*4;indices.push(0,2,3,0,3,1,end,end+1,end+3,end,end+3,end+2);
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
   const approach=new THREE.Mesh(geometry,b.material);approach.name='bridge-approach';group.add(approach);
  }
 }
 const selectable=()=>[...(buildings.visible?buildings.children:[]),...(bridges.visible?bridges.children:[]),
  ...(buildings.visible&&sijeon?.group.visible?[...sijeon.picks.children,...sijeon.signs].filter(o=>o.visible):[])];
 el('water3d').onchange=()=>{waterLayer.visible=el('water3d').checked;bridges.visible=waterLayer.visible;selected=null;clearHover()};
 el('water-focus').onclick=()=>{const target=sourceSurface(1523,1554);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(0,900,1300));controls.update()};
 el('namsan-focus').onclick=()=>{const target=sourceSurface(...exp.terrain_alignment.anchors[0].pixel);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(400,1200,1700));controls.update()};
 el('upstream-focus').onclick=()=>{const target=sourceSurface(990,1160);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(500,1700,2000));controls.update()};
 const tooltip=document.createElement('div');tooltip.id='building-tooltip';tooltip.hidden=true;
 Object.assign(tooltip.style,{position:'absolute',pointerEvents:'none',background:'#fffdf2',color:'#24372e',padding:'6px 10px',border:'1px solid #829783',borderRadius:'4px',maxWidth:'250px',zIndex:'20'});el('scene').append(tooltip);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let hovered=null,selected=null,press=null;
 // Clicking a building opens a card with its introduction, period and sources.
 const guideAnchors=new Set(JSON.parse(el('guide-anchors')?.textContent??'[]'));
 const popup=document.createElement('section');popup.id='building-popup';popup.hidden=true;popup.setAttribute('aria-live','polite');el('scene').append(popup);
 function renderPopup(box){
  const f=box?.userData.feature;popup.hidden=!f;if(!f)return;
  const info=f.info??{summary:f.note,sources:f.reference?[{title:t('참고 자료'),url:f.reference}]:[]};
  popup.replaceChildren();
  const head=document.createElement('header');
  const title=document.createElement('strong');title.textContent=f.name.split(' · ')[0];
  const kind=document.createElement('small');kind.textContent=f.category;
  const close=document.createElement('button');close.type='button';close.textContent=t('닫기');close.setAttribute('aria-label',t('건물 정보 닫기'));
  close.onclick=()=>{selected=null;clearHover()};
  head.append(title,kind,close);popup.append(head);
  const para=(label,text)=>{if(!text)return;const p=document.createElement('p');if(label){const b=document.createElement('b');b.textContent=label+' ';p.append(b)}p.append(text);popup.append(p)};
  para('',info.summary);para(t('존재 시기'),info.period);para(t('1750년 무렵'),info.in_1750);
  if(f.position_status==='estimated_region')para(t('위치·모형'),t('추정 위치 · 개략 모형. ')+(f.source_position?.note||''));
  if(info.stories?.length){
   const label=document.createElement('p');label.className='popup-stories';label.textContent=t('이야기');popup.append(label);
   for(const story of info.stories){
    const p=document.createElement('p');p.className='story';
    const t=document.createElement('b');t.textContent=story.title;p.append(t);
    if(story.year){const y=document.createElement('small');y.textContent=' ('+story.year+')';p.append(y)}
    if(story.legend){const tag=document.createElement('span');tag.className='legend';tag.textContent=t('전해지는 이야기');p.append(tag)}
    p.append(document.createElement('br'),story.text,' ');
    story.sources.forEach((source,i)=>{const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.title;const s=document.createElement('small');s.append(i?', ':'— ',a);p.append(s)});
    popup.append(p);
   }
  }
  if(info.sources?.length){
   const list=document.createElement('ul');
   for(const source of info.sources){const li=document.createElement('li'),a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.title;li.append(a);list.append(li)}
   const label=document.createElement('p');label.className='popup-sources';label.textContent=t('출처');popup.append(label,list);
  }
  // Link to the same building in the site's guide page when it has a section there.
  const guideKey=f.guide_key??f.name.split(' · ')[0];
  if(guideAnchors.has(guideKey)){const p=document.createElement('p'),a=document.createElement('a');a.href='/guide/#'+encodeURIComponent(guideKey);a.target='_blank';a.textContent=t('건물 안내에서 자세히 보기');p.append(a);popup.append(p)}
 }
 function showBuilding(box){
  const f=box?.userData.feature;
  el('building-name').textContent=f?f.name+' · '+t(f.category):t('박스에 커서를 올리거나 클릭하면 이름을 볼 수 있습니다.');
  el('building-name').style.fontWeight=f?'bold':'';
  el('building-note').textContent=!f?'':f.placeName?' — '+f.note:' — '+f.note+' · '+t('개략 크기 {w} × {d} m / 높이 {h} m',{w:f.symbol_size_m[0],d:f.symbol_size_m[2],h:f.symbol_size_m[1]})+' · '+(f.category==='교량'?t('다리 구조는 개념 모형'):t('지형 받침은 개관용 가정'));
  el('building-reference').hidden=!f?.reference;
  if(f?.reference)el('building-reference').href=f.reference;else el('building-reference').removeAttribute('href');
  el('clear-building').hidden=!selected;
  el('focus-building').hidden=!selected;
  renderPopup(selected);
  for(const b of [...buildings.children,...bridges.children]){const glow=b===selected?0x5b3918:b===hovered?0x343b21:0;b.traverse(part=>{if(part.isMesh&&part.material.emissive)part.material.emissive.setHex(glow)})}
 }
 function hit(event){
  if(!selectable().length)return null;
  const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);
  raycaster.setFromCamera(pointer,camera);const candidate=raycaster.intersectObjects(selectable(),true)[0];
  if(candidate)while(candidate.object&&!candidate.object.userData.feature)candidate.object=candidate.object.parent;
  const groundHit=raycaster.intersectObject(terrain,false)[0];
  if(candidate&&(!groundHit||groundHit.distance>=candidate.distance))return candidate.object;
  // Keep small, correctly scaled boxes selectable without enlarging their geometry.
  let nearest=null,best=event.pointerType==='touch'?14:8;
  for(const box of selectable()){
   const centre=box.position.clone(),screen=centre.clone().project(camera);
   if(screen.z<-1||screen.z>1)continue;
   const distance=Math.hypot(event.clientX-(r.left+(screen.x+1)*r.width/2),event.clientY-(r.top+(1-screen.y)*r.height/2));
   if(distance>=best)continue;
   const visibilityRay=new THREE.Raycaster(camera.position,centre.clone().sub(camera.position).normalize());
   const obstruction=visibilityRay.intersectObject(terrain,false)[0];
   if(obstruction&&obstruction.distance<camera.position.distanceTo(centre)-1)continue;
   nearest=box;best=distance;
  }
  return nearest;
 }
 function clearHover(){hovered=null;tooltip.hidden=true;renderer.domElement.style.cursor='';showBuilding(selected)}
 renderer.domElement.addEventListener('pointermove',event=>{
  if(firstPerson?.active)return;
  if(press){clearHover();return}
  hovered=hit(event)??placeNames?.pick(event)??null;renderer.domElement.style.cursor=hovered?'pointer':'';
  tooltip.hidden=!hovered;
  if(hovered){const r=renderer.domElement.getBoundingClientRect();tooltip.textContent=hovered.userData.feature.name;tooltip.style.left=Math.max(0,Math.min(event.clientX-r.left+14,r.width-260))+'px';tooltip.style.top=Math.max(0,Math.min(event.clientY-r.top+12,r.height-50))+'px'}
  showBuilding(selected??hovered);
 });
 // Clicks select in both orbit and first-person views; a drag (6 px or more) only turns the view.
 renderer.domElement.addEventListener('pointerdown',event=>{if(event.button!==0){press=null;return}press={x:event.clientX,y:event.clientY,id:event.pointerId};tooltip.hidden=true});
  renderer.domElement.addEventListener('pointerup',event=>{
  if(event.defaultPrevented){press=null;return}
  if(press&&press.id===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<6){
   // People on the map (keeper, gate guards, shopkeepers, passers-by) are picked before buildings.
   if(npcDialogue?.pick(event)){hovered=null;tooltip.hidden=true}
   else{selected=hit(event)??placeNames?.pick(event)??null;hovered=null;tooltip.hidden=true;showBuilding(selected)}
  }
  press=null;
 });
 renderer.domElement.addEventListener('pointercancel',()=>{press=null;clearHover()});
 renderer.domElement.addEventListener('pointerleave',clearHover);
 controls.addEventListener('change',()=>{if(hovered)clearHover()});
 el('clear-building').onclick=()=>{selected=null;clearHover()};
 el('focus-building').onclick=()=>{
  if(!selected)return;
  const target=selected.position.clone();controls.target.copy(target);
  const distance=Math.max(120,...(selected.userData.feature.symbol_size_m??[60]).map(v=>v*4));
  camera.position.copy(target).add(new THREE.Vector3(distance*.3,distance*.65,distance));controls.update();
 };
 el('buildings3d').onchange=()=>{buildings.visible=el('buildings3d').checked;foundations.visible=buildings.visible;selected=null;clearHover()};
 function home(){const p=sourceSurface(1560,1470);controls.target.set(p.x,150,p.z);camera.position.set(p.x,6200,p.z+7600);controls.update()}
 el('home3d').onclick=home;
 el('top3d').onclick=()=>{controls.target.set(0,0,0);camera.position.set(0,11000,1);controls.update()};
 el('opacity3d').oninput=()=>{historical.material.opacity=Number(el('opacity3d').value)/100;el('opacity-value').textContent=el('opacity3d').value+'%';firstPerson?.update(0)};
 el('anchors3d').onchange=()=>{labels.visible=el('anchors3d').checked};
 el('height3d').onchange=()=>{
  exaggeration=Number(el('height3d').value);granite?.setHeight(exaggeration);
  for(const mesh of [terrain,historical]){const pos=mesh.geometry.attributes.position;mesh.geometry.userData.heights.forEach((h,i)=>pos.setY(i,h*exaggeration));pos.needsUpdate=true;if(mesh===terrain)mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()}
  labels.children.forEach(l=>l.position.set(...world(l.userData.x,l.userData.y,l.userData.z)));
  buildings.children.forEach(b=>{const u=b.userData;b.position.set(...world(u.x,u.y,u.z));b.position.y+=u.boxHeight/2;heightYukjo(b,exaggeration);if(u.approachGround!==undefined)b.getObjectByName('hall-site')?.userData.setApproach((u.z-u.approachGround)*exaggeration)});
  foundations.children.forEach(f=>{f.position.y=(f.userData.top+f.userData.bottom)/2*exaggeration;f.scale.y=exaggeration});
  waterLayer.children.forEach(mesh=>{const p=mesh.geometry.attributes.position;mesh.geometry.userData.heights.forEach((h,i)=>p.setY(i,h*exaggeration));p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()});
  bridges.children.forEach(b=>{b.position.y=b.userData.z*exaggeration+b.userData.lift+b.userData.boxHeight/2;renderBridgeConnections(b)});
  cityWall.updateHeights(exaggeration);palaceWall?.updateHeights(exaggeration);settlement?.updateHeights(exaggeration);sijeon?.updateHeights(exaggeration);trees?.updateHeights(exaggeration);pedestrians?.setHeight(exaggeration);
  const rp=roadLayer.geometry.attributes.position;roadLayer.geometry.userData.heights.forEach((h,i)=>rp.setY(i,h*exaggeration));rp.needsUpdate=true;roadLayer.geometry.computeBoundingSphere();
  firstPerson?.update(0);clearHover();
 };
 // Preserve the original display surfaces and refine only the channel corridor.
 const historicNodes=waterData.centerline.map((p,i)=>{
  const centre=sourceSurface(...p),edges=banksAt(waterData.centerline,i);
  return {x:centre.x,z:centre.z,height:height(cx+centre.x/ground,cy-centre.z/ground),width:Math.hypot(edges[0].x-edges[1].x,edges[0].z-edges[1].z)/2};
 });
 // Display only the source-map river; omit the later modern downstream extension.
 const mainPath=ChannelTerrain.profile(historicNodes),northPath=[],joinIndex=mainPath.length-1;
 const channelPath=mainPath;
 await stage(4,t('물길 표시 완료 · 하천 주변 지형을 계산합니다'));
 const surfaceBaselines=[];
 for(const mesh of [terrain]){
  const refineStart=performance.now(),old=mesh.geometry,refined=await refineTerrainCached({positions:old.attributes.position.array,index:old.index.array,uv:old.attributes.uv.array,colors:old.attributes.color.array},channelPath);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(refined.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(refined.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(refined.colors,3));g.setIndex(new THREE.BufferAttribute(refined.index,1));
  const original=Array.from({length:g.attributes.position.count},(_,i)=>g.attributes.position.getY(i));
  const matches=refined.matches;
  g.userData.heights=[...original];g.computeVertexNormals();mesh.geometry=g;old.dispose();surfaceBaselines.push({mesh,original,matches,offset:0});
  // Read-only load diagnostics: channel refinement runs in a worker and is otherwise invisible to profiles.
  loading.refine={ms:Math.round(performance.now()-refineStart),source:refined.source,key:refined.key,vertices:[old.attributes.position.count,g.attributes.position.count],pathNodes:channelPath.length};
 }
 // Project the warped source image onto the canonical DEM triangles without a height offset.
 // Index source triangles in X/Z so inverse UV lookup preserves the existing TPS placement.
 const bins=new Map(),binSize=200,sourceTriangles=[];
 function addSourceTriangle(ids){
  const points=ids.map(i=>[sourceImagePositions.getX(i),sourceImagePositions.getZ(i)]);
  const triangle={points,uv:ids.map(i=>[(i%129)/128,1-Math.floor(i/129)/112])};
  const index=sourceTriangles.push(triangle)-1;
  for(let x=Math.floor(Math.min(...points.map(p=>p[0]))/binSize);x<=Math.floor(Math.max(...points.map(p=>p[0]))/binSize);x++)
   for(let z=Math.floor(Math.min(...points.map(p=>p[1]))/binSize);z<=Math.floor(Math.max(...points.map(p=>p[1]))/binSize);z++){
    const key=x+','+z;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(index);
   }
 }
 for(let j=0;j<112;j++)for(let i=0;i<128;i++){const a=j*129+i;addSourceTriangle([a,a+130,a+1]);addSourceTriangle([a,a+129,a+130])}
 const canonical=terrain.geometry,canonicalPositions=canonical.attributes.position,overlayUV=new Float32Array(canonicalPositions.count*2),inside=new Uint8Array(canonicalPositions.count);
 for(let i=0;i<canonicalPositions.count;i++){
  const x=canonicalPositions.getX(i),z=canonicalPositions.getZ(i);
  for(const index of bins.get(Math.floor(x/binSize)+','+Math.floor(z/binSize))??[]){
   const {points,uv}=sourceTriangles[index],weights=DoseongWarp.barycentric({x,y:z},...points.map(p=>({x:p[0],y:p[1]})));
   if(weights&&weights.every(w=>w>=-1e-7)){
    overlayUV[i*2]=weights.reduce((v,w,k)=>v+w*uv[k][0],0);overlayUV[i*2+1]=weights.reduce((v,w,k)=>v+w*uv[k][1],0);inside[i]=1;break;
   }
  }
 }
 const overlayIndex=[];for(let i=0;i<canonical.index.count;i+=3){const ids=[canonical.index.getX(i),canonical.index.getX(i+1),canonical.index.getX(i+2)];if(ids.every(j=>inside[j]))overlayIndex.push(...ids)}
 if(!overlayIndex.length)throw Error(t('지형 위의 지도 좌표를 계산하지 못했습니다.'));
 const overlayGeometry=new THREE.BufferGeometry();
 for(const name of ['position','normal','color'])overlayGeometry.setAttribute(name,canonical.attributes[name]);
 overlayGeometry.setAttribute('uv',new THREE.BufferAttribute(overlayUV,2));overlayGeometry.setIndex(overlayIndex);overlayGeometry.userData.heights=canonical.userData.heights;
 historical.geometry.dispose();historical.geometry=overlayGeometry;
 const roadRecord=await (await fetch(asset('/gis/roads/doseong_road_mask.json'))).json();
 if(roadRecord.source_sha256!==exp.input_sha256)throw Error(t('길 판독 원본이 현재 원도와 다릅니다.'));
 const roadTexture=await new THREE.TextureLoader().loadAsync(asset(roadRecord.mask_url));roadTexture.colorSpace=THREE.SRGBColorSpace;
 const roadLayer=new THREE.Mesh(historical.geometry.clone(),new THREE.MeshBasicMaterial({map:roadTexture,color:roadRecord.display_color,transparent:true,opacity:.8,alphaTest:.04,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
 roadLayer.geometry.userData={heights:[...historical.geometry.userData.heights]};
 roadLayer.name='source-road-overlay';roadLayer.renderOrder=2;scene.add(roadLayer);
 el('roads3d').onchange=()=>{roadLayer.visible=el('roads3d').checked;pedestrians?.setRoadVisible(roadLayer.visible)};
 const waterBaselines=waterLayer.children.map(m=>[...m.geometry.userData.heights]);
 const channelState={enabled:true,depth:2,maxCut:0,path:channelPath,mainPath,northPath,joinIndex};
 const cityWall=createCityWall(wallData,sourceSurface,buildings);scene.add(cityWall.group);
 const palaceResponse=await fetch(asset('/gis/walls/gyeongbokgung_wall.json'));
 if(!palaceResponse.ok)throw Error(t('경복궁 담장 자료를 불러오지 못했습니다.'));
 const palaceData=await palaceResponse.json();
 if(palaceData.source_sha256!==exp.input_sha256)throw Error(t('경복궁 담장 판독 원본이 현재 원도와 다릅니다.'));
 palaceWall=createCityWall(palaceData,sourceSurface,buildings);palaceWall.group.name='gyeongbokgung-wall';scene.add(palaceWall.group);
 granite=createGranite([surfaceMaterial,historical.material],sourceSurface);
 el('granite3d').onchange=e=>{granite.setEnabled(e.target.checked);renderDirty=true};
 el('granite-focus').onclick=()=>{const p=granite.patches[0].centre.clone();p.y*=exaggeration;controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(220,160,240));controls.update()};
 el('walls3d').onchange=()=>{cityWall.group.visible=palaceWall.group.visible=el('walls3d').checked};
 function applyChannel(){
  const enabled=el('carve3d').checked,depth=Number(el('channel-depth').value);let maxCut=0;
  // Work in unexaggerated elevations. The shared height handler restores display scaling.
  for(const {mesh,original,matches,offset} of surfaceBaselines){
   const values=original.map((h,i)=>enabled?ChannelTerrain.carvedHeight(h,matchAt(matches,i),depth,offset):h);
   mesh.geometry.userData.heights=values;values.forEach((h,i)=>mesh.geometry.attributes.position.setY(i,h));
   if(mesh===terrain)values.forEach((h,i)=>{maxCut=Math.max(maxCut,original[i]-h)});
   mesh.geometry.attributes.position.needsUpdate=true;
  }
  historical.geometry.userData.heights=terrain.geometry.userData.heights;
  const surfaces=[terrain,historical].map(m=>({positions:m.geometry.attributes.position.array,index:m.geometry.index.array})),nearbySurfaces=surfaceIndex(surfaces);
  buildings.children.forEach((box,i)=>{
   const u=box.userData,[w,,d]=u.feature.symbol_size_m;
   const range=TerrainSupport.footprintRange(nearbySurfaces(box.position.x,box.position.z,Math.hypot(w,d)/2+1),[box.position.x-w/2,box.position.z-d/2,box.position.x+w/2,box.position.z+d/2],box.rotation.y);
   u.support=range;u.z=range.max+.5;
   const f=foundations.children[i];f.geometry.dispose();f.geometry=new THREE.BoxGeometry(w,u.z-range.min+.25,d);f.userData.top=u.z;f.userData.bottom=range.min-.25;
  });
  waterLayer.children.forEach((mesh,layer)=>{
   mesh.geometry.userData.heights=waterBaselines[layer].map((h,i)=>{
    // Without carving the sheet lies on the ground, so the hems fold up to the surface instead of poking out of slopes.
    if(!enabled)return mesh.userData.body&&i%2===0?waterBaselines[layer][i+1]:h;
    const centre=mesh.userData.centres[Math.floor(i/2)],match=ChannelTerrain.nearest(centre.x,centre.z,channelPath);
    return match.level+.35+(mesh.userData.bank?(i%2)*.65:0)-(mesh.userData.body&&i%2===0?depth+WATER_BODY_EXTRA:0);
   });
  });
  // The carved bed keeps its full depth out to the recorded bank line and only then climbs a 20 m shoulder, so the
  // water level meets the bank well outside the drawn sheet. Widen the sheet (and the hems and bank strips that share
  // its edges) to where the carved ground rises through the water level, so no dry bed shows beside the water.
  const [sheet,bankA,bankB,bodyA,bodyB]=waterLayer.children,ground_m=ground;
  const sideMeshes=[[bankA,bodyA],[bankB,bodyB]];
  riverEdges.forEach((pair,i)=>{
   const centre=sheet.userData.centres[i];
   pair.forEach((edge,side)=>{
    let x=edge.x,z=edge.z;
    if(enabled){
     const nx=edge.x-centre.x,nz=edge.z-centre.z,base=Math.hypot(nx,nz)||1,ux=nx/base,uz=nz/base;
     // Along the outward normal the distance to the centreline is d itself, so the carve profile can be evaluated
     // directly from the original ground height instead of sampling the carved mesh.
     const match=ChannelTerrain.nearest(centre.x,centre.z,channelPath),level=match.level+.35;
     for(let d=base;d<=base+22;d+=.5){
      const qx=centre.x+ux*d,qz=centre.z+uz*d;
      let original;try{original=height(cx+qx/ground_m,cy-qz/ground_m)}catch{break}
      const carved=ChannelTerrain.carvedHeight(original,{distance:d,level:match.level,width:match.width},depth);
      if(carved>=level-.05){x=centre.x+ux*(d-.3);z=centre.z+uz*(d-.3);break}
      x=qx;z=qz;
     }
    }
    const sp=sheet.geometry.attributes.position;sp.setX(i*2+side,x);sp.setZ(i*2+side,z);
    for(const mesh of sideMeshes[side]){const a=mesh.geometry.attributes.position;for(const k of [i*2,i*2+1]){a.setX(k,x);a.setZ(k,z)}}
   });
  });
  for(const mesh of waterLayer.children){mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()}
  roadLayer.geometry.userData.heights=[...terrain.geometry.userData.heights];
  updateBridgeGround(surfaces);
  cityWall.updateGround(surfaces,roadLayer.geometry.userData.heights);palaceWall.updateGroundFrom(cityWall.supportAt);sijeon?.updateGround(cityWall.supportAt);settlement?.updateGround(cityWall.supportAt);pedestrians?.updateGround(cityWall.supportAt);trees?.updateGround(cityWall.supportAt);
  buildings.children.forEach(b=>groundYukjo(b,cityWall.supportAt));
  Object.assign(channelState,{enabled,depth,maxCut});
  el('channel-depth').disabled=!enabled;
  el('channel-status').textContent=enabled?t('개념 하도 보정 · 수면 아래 {depth} m · 현대 지형 대비 최대 낮춤 {cut} m · 역사적 깊이 미확정',{depth,cut:maxCut.toFixed(1)}):t('원래 고도 표시 · 청계천은 원도 위치의 지형 표면을 따릅니다.');
  el('height3d').onchange();
 }
 el('carve3d').onchange=applyChannel;
 el('channel-depth').oninput=()=>{el('channel-depth-value').textContent=el('channel-depth').value+' m'};
 el('channel-depth').onchange=applyChannel;
 applyChannel();
 await stage(5,t('하천·성벽·길 표시 완료 · 주택과 상가를 배치합니다'));
 const sijeonData=await(await fetch(asset('/gis/buildings/doseong_sijeon.json'))).json();
 if(sijeonData.source_sha256!==exp.input_sha256)throw Error(t('시전 배치의 길 판독 원본이 현재 원도와 다릅니다.'));
 sijeon=createSijeon(sijeonData,sourceSurface,buildings);sijeon.updateGround(cityWall.supportAt);sijeon.updateHeights(exaggeration);scene.add(sijeon.group);
 const sijeonBlockers=sijeon.records.map(r=>({x:r.x,z:r.z,radius:Math.hypot(r.length,sijeonData.placement.depth_m)/2+2}));
 const settlementData=await(await fetch(asset('/gis/buildings/doseong_settlement.json'))).json();
 if(settlementData.source_sha256!==exp.input_sha256)throw Error(t('추정 건물 배치 원본이 현재 원도와 다릅니다.'));
 settlement=createSettlement(settlementData,sourceSurface,(x,z)=>height(cx+x/ground,cy-z/ground),buildings,channelPath,sijeonBlockers);settlement.updateGround(cityWall.supportAt);settlement.updateHeights(exaggeration);scene.add(settlement.group);
 await stage(6,t('주택·상가 표시 완료 · 숲과 걷는 사람을 준비합니다'));
 const treeResponse=await fetch(asset('/gis/vegetation/doseong_trees.json'));
 if(!treeResponse.ok)throw Error(t('수목 배치 자료를 불러오지 못했습니다.'));
 const treeData=await treeResponse.json();
 if(treeData.source_sha256!==exp.input_sha256)throw Error(t('수목 배치 원도가 현재 지도와 다릅니다.'));
 trees=createTrees(treeData,sourceSurface,buildings,settlement,channelPath,{segments:[...cityWall.segments,...palaceWall.segments]},granite);trees.updateGround(cityWall.supportAt);trees.updateHeights(exaggeration);scene.add(trees.group);
 const groundColors=createGroundColors(surfaceMaterial,terrain.geometry,trees.records);
 await yieldPaint();
 el('trees-focus').onclick=()=>{const r=trees.records.find(r=>r.region==='gyeongbok');if(!r)return;controls.target.set(r.x,r.floor,r.z);camera.position.copy(controls.target).add(new THREE.Vector3(120,240,320));controls.update()};
 const walkingData=await(await fetch(asset('/gis/roads/doseong_walking_routes.json'))).json();
 if(walkingData.source_sha256!==exp.input_sha256)throw Error(t('보행 경로 원도가 현재 지도와 다릅니다.'));
 pedestrians=createPedestrians(walkingData,sourceSurface);pedestrians.updateGround(cityWall.supportAt);pedestrians.setHeight(exaggeration);scene.add(pedestrians.group);
 // Moving figures (the drill, the Gyeongbokgung keeper) stand on the ground under their current position, in the
 // local frame of their building.
 const groundAt=obj=>(x,z)=>{const p=obj.parent.localToWorld(new THREE.Vector3(x,0,z)),s=cityWall.supportAt(p.x,p.z,.5,.5,0);return s.max*exaggeration+.05-obj.parent.position.y};
 frameUpdate=dt=>{pedestrians.update(dt);const now=performance.now();for(const drill of drills)if(drill.visible&&drill.parent?.visible)drill.userData.update(now,groundAt(drill));if(horseDealer){horseDealer.visible=bridges.visible;if(horseDealer.visible)horseDealer.userData.update(now,groundAt(horseDealer))}updateBuildingNames()};
 await stage(7,t('숲·사람 표시 완료 · 마무리합니다'));
 el('people-focus').onclick=()=>{const p=pedestrians.walkers[20].position;controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(18,28,45));controls.update()};
 el('settlement-focus').onclick=()=>{const r=settlement.records.filter(r=>r.shop&&r.displayed).sort((a,b)=>Math.hypot(a.pixel[0]-1520,a.pixel[1]-1440)-Math.hypot(b.pixel[0]-1520,b.pixel[1]-1440))[0];if(!r)return;const target=new THREE.Vector3(r.x,r.floor,r.z);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(100,220,300));controls.update()};
 let osmTexture=null;
 async function osm(){
  const zoom=12,span=2*H/2**zoom,tx0=Math.floor((xmin+H)/span),tx1=Math.floor((xmax+H)/span),ty0=Math.floor((H-ymax)/span),ty1=Math.floor((H-ymin)/span);
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=2048;const ctx=canvas.getContext('2d');
  await Promise.all(Array.from({length:ty1-ty0+1},(_,j)=>Array.from({length:tx1-tx0+1},(_,i)=>[tx0+i,ty0+j])).flat().map(async([x,y])=>{
   const img=new Image();img.crossOrigin='anonymous';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(t('OSM 타일을 불러오지 못했습니다. 고도 지형으로 표시합니다.')));img.src=`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`});
   ctx.drawImage(img,((x*span-H)-xmin)/(xmax-xmin)*2048,(ymax-(H-y*span))/(ymax-ymin)*2048,span/(xmax-xmin)*2048,span/(ymax-ymin)*2048);
  }));
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
 }
 el('base3d').onchange=async()=>{
  el('error').textContent='';
  if(el('base3d').value==='osm'){
   try{el('base3d').disabled=true;osmTexture??=await osm();surfaceMaterial.map=osmTexture;surfaceMaterial.vertexColors=false}
   catch(error){el('error').textContent=error.message;el('base3d').value='relief';surfaceMaterial.map=null;surfaceMaterial.vertexColors=true}
   finally{el('base3d').disabled=false}
  }else{surfaceMaterial.map=null;surfaceMaterial.vertexColors=true}
  surfaceMaterial.needsUpdate=true;
 };
 // Bake the same warped image triangles once; the HUD only crops this 2D map.
 const navigation=(()=>{
  const panel=el('first-person-map'),map=el('walking-minimap'),ctx=map.getContext('2d');
  const size=240,span=1800,baked=document.createElement('canvas');baked.width=baked.height=2048;
  let ready=false,minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
  for(let i=0;i<sourceImagePositions.count;i++){const x=sourceImagePositions.getX(i),z=sourceImagePositions.getZ(i);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z)}
  const scale=2048/Math.max(maxX-minX,maxZ-minZ);
  function bake(){
   if(ready)return;const b=baked.getContext('2d');b.fillStyle='#e9e2cb';b.fillRect(0,0,2048,2048);
   const point=k=>[(sourceImagePositions.getX(k)-minX)*scale,(sourceImagePositions.getZ(k)-minZ)*scale];
   for(let j=0;j<112;j++)for(let i=0;i<128;i++){
    const a=j*129+i;
    for(const ids of [[a,a+130,a+1],[a,a+129,a+130]]){
     const target=ids.map(point),src=ids.map(k=>[(k%129)*iw/128,Math.floor(k/129)*ih/112]);
     const [p,q,r]=src,[u,v,w]=target,dx=q[0]-p[0],dy=q[1]-p[1],ex=r[0]-p[0],ey=r[1]-p[1],det=dx*ey-ex*dy;
     const aa=((v[0]-u[0])*ey-(w[0]-u[0])*dy)/det,cc=((w[0]-u[0])*dx-(v[0]-u[0])*ex)/det;
     const bb=((v[1]-u[1])*ey-(w[1]-u[1])*dy)/det,dd=((w[1]-u[1])*dx-(v[1]-u[1])*ex)/det;
     b.save();b.beginPath();b.moveTo(...u);b.lineTo(...v);b.lineTo(...w);b.closePath();b.clip();
     b.setTransform(aa,bb,cc,dd,u[0]-aa*p[0]-cc*p[1],u[1]-bb*p[0]-dd*p[1]);b.drawImage(texture.image,0,0,iw,ih);b.restore();
    }
   }
   ready=true;
  }
  function update(yaw,at=camera.position){
   const heading=(((-yaw*180/Math.PI)%360)+360)%360;
   ctx.clearRect(0,0,size,size);ctx.fillStyle='#e9e2cb';ctx.fillRect(0,0,size,size);
   const x=at.x,z=at.z;
   ctx.drawImage(baked,(x-span/2-minX)*scale,(z-span/2-minZ)*scale,span*scale,span*scale,0,0,size,size);
   ctx.save();ctx.translate(size/2,size/2);ctx.rotate(-yaw);
   ctx.fillStyle='#1686b84d';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,47,-Math.PI/2-.6,-Math.PI/2+.6);ctx.closePath();ctx.fill();
   ctx.fillStyle='#006fa8';ctx.strokeStyle='white';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,8);ctx.lineTo(0,5);ctx.lineTo(-7,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
   ctx.font='bold 14px system-ui';ctx.fillStyle='#24372e';ctx.fillText('N ↑',10,21);
   ctx.fillStyle='#fffdf2dd';ctx.fillRect(9,210,68,23);ctx.fillStyle='#24372e';ctx.fillRect(15,216,200/span*size,2);ctx.font='11px system-ui';ctx.fillText('200 m',15,230);
   map.dataset.worldX=x;map.dataset.worldZ=z;map.dataset.heading=heading;
  }
  return {largeMapSource:{image:baked,minX,minZ,maxX,maxZ,scale,prepare:bake},show(yaw,at){bake();panel.hidden=false;update(yaw,at)},hide(){panel.hidden=true},update};
 })();
 // Ground-following first-person exploration; drag works over plain Tailscale HTTP too.
 // The shop owns the account state (login, coins); the walking profile takes its name from it.
 const npcData=JSON.parse(el('npcs').textContent);
 shop=createShop({container:el('scene'),data:npcData,onLogout:()=>firstPerson?.exit(),
  onUse:id=>npcData.items[id]?.use==='mount'?(firstPerson?.active?firstPerson.setMounted(!firstPerson.mounted):t('1인칭에서만 말을 탈 수 있소.')):null});
 const walkProfile=createWalkProfile({account:shop});
 firstPerson=createFirstPerson({scene,camera,controls,renderer,pedestrians,shop,npcData,walkProfile,navigation,
  positionWorld:{alignment:alignTerrain?'mountains':'base',routeKey:pedestrians.routeKey},
  getCollision:()=>collision,getSurfaceVersion:()=>exaggeration,onBeforeEnter:()=>{clearHover();press=null},onExit:()=>together?.stop(),
  terrainGround:(x,z)=>{try{const s=cityWall.supportAt(x,z,.3,.3,0,roadLayer.visible);return Math.max(s.max,roadLayer.visible&&s.road?s.road.max*exaggeration:-Infinity)}catch{return null}},
  getWalkables:()=>{const halls=buildings.children.filter(b=>b.userData.feature.display_model==='hall_site'),ids=new Set(halls.map(b=>b.userData.feature.id));return [...bridges.children.map(o=>[o,()=>bridges.visible]),...halls.map(o=>[o,()=>buildings.visible&&o.visible]),...foundations.children.filter(f=>ids.has(f.userData.featureId)).map(o=>[o,()=>foundations.visible])]}
 });
 el('walk-together').addEventListener('click',()=>{el('map-options').classList.remove('open');el('map-options-toggle').setAttribute('aria-expanded','false')});
 document.querySelector('.toolbar').addEventListener('click',event=>{if(firstPerson.active&&event.target.closest('button')&&!['map-options-toggle','walk-together'].includes(event.target.id))firstPerson.exit()},true);
 el('focus-building').addEventListener('click',()=>{if(firstPerson.active)firstPerson.exit()},true);
 const togetherStatus=document.createElement('div');togetherStatus.id='walk-together-status';togetherStatus.hidden=true;togetherStatus.setAttribute('role','status');
 Object.assign(togetherStatus.style,{position:'absolute',top:'64px',left:'12px',zIndex:'25',background:'#fffdf2eb',padding:'6px 10px',borderRadius:'5px',fontSize:'12px',maxWidth:'calc(100% - 150px)',pointerEvents:'none'});el('scene').append(togetherStatus);
 together=createWalkTogether({scene,firstPerson,pedestrians,profile:walkProfile,alignment:alignTerrain?'mountains':'base',groundAt:firstPerson.groundAt,endpoint:new URL(JSON.parse(el('multiplayer-url').textContent),location.href).href,mapVersion:JSON.parse(el('map-version').textContent),button:el('walk-together'),status:togetherStatus});
 const orbitNavigation=setupOrbitNavigation(camera,controls,renderer.domElement,ray=>cityWall.raycastGround(ray,true),()=>!!firstPerson?.active,(x,z)=>{
  try{const s=cityWall.supportAt(x,z,.2,.2,0,roadLayer.visible);return Math.max(s.max,roadLayer.visible?s.road.max*exaggeration:-Infinity)}catch{return null}
 });
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();el('error').textContent=t('3D 그래픽 연결이 끊겼습니다. 페이지를 새로 고쳐 주세요.')});
 // NPC conversations and the shop. Facts in dialogue carry sources; greetings do not.
 {
  const fill=(text,values)=>text.replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
  const fillNodes=(nodes,values)=>Object.fromEntries(Object.entries(nodes).map(([id,n])=>[id,{...n,text:fill(n.text,values)}]));
  const pickOne=(list,seed)=>list[Math.abs(Math.floor(seed))%list.length];
  npcDialogue=createNpcDialogue({camera,canvas:renderer.domElement,container:el('scene'),note:npcData.note,onAction:(action,npc)=>{if(action==='shop'&&npc.merchant)shop.open(npc.merchant)}});
  const shown=o=>{for(let x=o;x;x=x.parent)if(!x.visible)return false;return true};
  const feet=new THREE.Vector3();
  npcDialogue.register({pick(event,hitTest){
   let best=null;
   for(const model of guardModels){
    if(!shown(model))continue;
    const feature=model.parent.userData.feature,gate=feature.name.split(' · ')[0],unit=t(model.userData.unit);
    for(const person of model.children){
     const role=person.userData.role;if(!role)continue;
     const at=person.getWorldPosition(new THREE.Vector3()),distance=hitTest(event,at,1.9,role==='keeper'?300:150);
     if(distance===null||(best&&best.distance<=distance))continue;
     const position=()=>person.getWorldPosition(feet);
     let npc;
     if(role==='keeper')npc={key:'keeper',mode:'overlay',portrait:'keeper',name:npcData.keeper.name,subtitle:npcData.keeper.subtitle,nodes:npcData.keeper.nodes,position,maxDistance:300,
      begin:()=>model.userData.startTalk(),finish:()=>model.userData.stopTalk(),face:camera=>{model.userData.talk.face=model.worldToLocal(camera.clone())}};
     else if(role==='officer')npc={key:'officer:'+feature.id,mode:'overlay',portrait:'officer',name:t('{gate} 수문장',{gate}),subtitle:fill(npcData.officer.subtitle,{unit}),nodes:fillNodes(npcData.officer.nodes,{gate,unit}),position};
     else npc={key:'soldier:'+feature.id,mode:'bubble',portrait:'soldier',name:t('{unit} 군사',{unit:feature.category==='성문'?gate:unit}),nodes:{hello:{text:pickOne(npcData.soldier.greetings,at.x+at.z)}},position};
     best={distance,npc};
    }
   }
   return best;
  }});
  npcDialogue.register({pick(event,hitTest){
   if(!sijeon?.group.visible)return null;let best=null;
   for(const k of sijeon.keepers()){
    const distance=hitTest(event,k.position,1.8,120);if(distance===null||(best&&best.distance<=distance))continue;
    const values={shop:lang==='en'?t(k.trade):`${k.trade}(${k.hanja})`,sells:t(k.sells),about:npcData.shops[k.trade]?.about??''};
    best={distance,npc:{key:'merchant:'+k.index,mode:'overlay',portrait:'merchant',name:t('{shop} 상인',{shop:t(k.trade)}),subtitle:t('{sells}을 파는 시전',{sells:t(k.sells)}),nodes:fillNodes(npcData.merchant.nodes,values),merchant:k,position:()=>k.position,maxDistance:120}};
   }
   return best;
  }});
  npcDialogue.register({pick(event,hitTest){
   if(!horseDealer?.visible)return null;
   const person=horseDealer.userData.person,at=person.getWorldPosition(new THREE.Vector3()),distance=hitTest(event,at,1.9,150);if(distance===null)return null;
   const d=npcData.horse_dealer;
   return {distance,npc:{key:'horse-dealer',mode:'overlay',portrait:'horseDealer',name:d.name,subtitle:d.subtitle,nodes:d.nodes,merchant:{trade:'말 장수',sells:'말'},position:()=>person.getWorldPosition(feet),maxDistance:150,
    finish:()=>horseDealer.userData.stopTalk(),face:camera=>horseDealer.userData.face(camera)}};
  }});
  npcDialogue.register({pick(event,hitTest){
   if(!pedestrians?.group.visible)return null;let best=null;
   for(const w of pedestrians.walkers){
    const distance=hitTest(event,w.position,1.7,100);if(distance===null||(best&&best.distance<=distance))continue;
    const greetings=npcData.pedestrian.greetings[w.costume==='female'?'female':'male'];
    best={distance,npc:{key:'walker:'+w.id,mode:'bubble',portrait:'walker',name:npcData.pedestrian.name,nodes:{hello:{text:pickOne(greetings,w.seed??0)}},position:()=>w.position,maxDistance:100}};
   }
   return best;
  }});
 }
 frameUpdate=dt=>{firstPerson?.update(dt);together?.update(dt);npcDialogue?.update();pedestrians?.setAvoidPoint(firstPerson?.active?firstPerson.eye:null);pedestrians?.update(dt);const time=pedestrians.networkSnapshot?pedestrians.elapsed*1000:performance.now();for(const drill of drills)if(drill.visible&&drill.parent?.visible)drill.userData.update(time,groundAt(drill));if(horseDealer){horseDealer.visible=bridges.visible;if(horseDealer.visible)horseDealer.userData.update(time,groundAt(horseDealer))}updateBuildingNames()};
 toolbarControls.forEach(c=>c.disabled=false);el('channel-depth').disabled=!channelState.enabled;
 await stage(8,t('모든 요소를 불러왔습니다'));loading.ready=true;el('scene-loading').hidden=true;
 el('status').textContent=t('3D 지형 로드 완료 · 기존 TPS 5점 · 높이 기본 1배 · 북쪽은 초기 화면 위쪽');
 // Read-only diagnostics for browser verification; no point coordinates are modified here.
 // Collision world for walking, built once every layer has placed its buildings.
 collision=createCollision();
 for(const b of buildings.children){
  // Hall sites are walkable terraces (their height comes from first-person groundAt).
  const f=b.userData.feature;if(f.display_model==='hall_site')continue;
  const [w,,d]=f.symbol_size_m,frame={x:b.position.x,z:b.position.z,yaw:b.rotation.y},shown=()=>buildings.visible&&b.visible;
  // Gates block everything except their passages: the arched openings of a city gate (from the gate model), the
  // door bays of a palace gate (outer bays are plastered walls). Solid stretches are added as blocks along local x.
  const gate=b.getObjectByName('gate-model');
  if(gate?.userData.centres||f.display_model==='palace_gate'){
   let open,depth;
   if(gate?.userData.centres){const {centres,doorWidth}=gate.userData;open=centres.map(c=>[c-doorWidth/2,c+doorWidth/2]);depth=d/2}
   else{const bays=f.palace_gate_bays??3,doorBays=Math.min(3,bays),gw=w*.8,bayW=gw/bays,half=doorBays*bayW/2;open=[[-half,half]];depth=d*.3}
   const edges=[-w/2,...open.flat(),w/2];
   for(let i=0;i<edges.length;i+=2){const a=edges[i],c=edges[i+1];if(c-a>.2)collision.addLocal(frame,(a+c)/2,0,(c-a)/2,depth,shown)}
   // The barbican of Heunginjimun: the same 16 wall pieces as gate.js draws, one oriented block each.
   if(f.id==='heunginjimun'){
    const R=w*.6,segs=16,a0=-Math.PI/2+.08,a1=Math.PI/2-.55,out=f.outer_side??1,c=Math.cos(frame.yaw),sn=Math.sin(frame.yaw);
    for(let i=0;i<segs;i++){
     const s0=a0+(a1-a0)*i/segs,s1=a0+(a1-a0)*(i+1)/segs,am=(s0+s1)/2,len=R*(s1-s0)+.25,lx=R*Math.sin(am),lz=out*(d/2+R*Math.cos(am));
     collision.add({x:frame.x+lx*c+lz*sn,z:frame.z-lx*sn+lz*c,hw:len/2,hd:.9,yaw:frame.yaw+out*am,visible:shown});
    }
   }
   continue;
  }
  if(f.display_model==='house_site'||f.display_model==='training_ground'){
   // Walled compounds block only their walls, leaving the south gate open.
   const t=1.2,gate=Math.min(9,w*.2),run=(w-gate)/2;
   collision.addLocal(frame,0,-d/2+t/2,w/2,t/2,shown);
   for(const side of [-1,1]){
    collision.addLocal(frame,side*(w/2-t/2),0,t/2,d/2,shown);
    collision.addLocal(frame,side*(gate/2+run/2),d/2-t/2,run/2,t/2,shown);
   }
  }else collision.add({...frame,hw:w/2,hd:d/2,visible:shown});
 }
 for(const [wall,data] of [[cityWall,wallData],[palaceWall,palaceData]])
  for(const seg of wall.segments)collision.add({x:seg.x,z:seg.z,hw:data.width_m/2,hd:seg.length/2,yaw:seg.yaw,visible:()=>wall.group.visible});
 for(const r of sijeon.records)collision.add({x:r.x,z:r.z,hw:r.length/2,hd:(sijeonData.placement.depth_m+.9)/2,yaw:r.yaw,visible:()=>sijeon.group.visible&&r.displayed});
 for(const r of settlement.records)collision.add({x:r.x,z:r.z,hw:r.w/2,hd:r.d/2,yaw:r.yaw,visible:()=>settlement.group.visible&&r.displayed});
 window.terrain3d={ready:true,cityCentre,drills,guardModels,horseDealer,get npcDialogue(){return npcDialogue},get shop(){return shop},landmarkLods,anchorCount:points.length,anchorError:Math.max(...points.map(p=>{const a=warp(...p.pixel),b=project(p.lon,p.lat);return Math.hypot(a[0]-b[0],a[1]-b[1])})),elevationRange:[dem.elevations.reduce((a,b)=>Math.min(a,b),Infinity),dem.elevations.reduce((a,b)=>Math.max(a,b),-Infinity)],renderer,scene,camera,controls,historical,terrain,mapGround,labels,buildings,foundations,waterLayer,bridges,river,channelState,surfaceBaselines,cityWall,palaceWall,alignTerrain,warp,roadLayer,roadRecord,settlement,sijeon,buildingNames,nameTags,mountainNames,districtNames,updateBuildingNames,pedestrians,trees,granite,firstPerson,collision,orbitNavigation,updateCompass,compass,groundColors};
}
main().catch(error=>{el('error').textContent=t('일부 요소를 불러오지 못했습니다: ')+(error.message||t('지도 또는 화면 자료 요청에 실패했습니다.'));el('status').textContent=t('현재까지 준비된 화면을 유지합니다.');el('loading-message').textContent=t('불러오기가 중단되었습니다. 새로고침해서 다시 시도해 주세요.');el('loading-retry').hidden=false;console.error(error)});
