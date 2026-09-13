import * as THREE from 'three';
import {createGranite} from './granite.js';
import {setupOrbitNavigation} from './orbit_navigation.js';
import {createTrees} from './trees.js';
import {createPedestrians,createWalker} from './pedestrians.js';
import {createHouseSite} from './house_site.js';
import {createBellTower} from './bell_tower.js';
import {createTrainingGround} from './training_ground.js';
import {createSettlement} from './settlement.js';
import {createSijeon} from './sijeon.js';
import {createCityWall} from './city_wall.js';
import {createPalace,createPalaceGate} from './palace.js';
import {createJongmyo} from './jongmyo.js';
import {createWalkJoystick} from './walk_joystick.js';
import {createYukjo,groundYukjo,heightYukjo} from './yukjo.js';
import {createGroundColors} from './ground_colors.js';
import {createCompass3D} from './compass3d.js';
import {OrbitControls} from './vendor/three/OrbitControls.js';

const el=id=>document.getElementById(id),R=6378137,H=Math.PI*R;
const project=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
async function main(){
 const loading=window.terrainLoading={stage:0,history:[],ready:false};
 el('map-options-toggle').onclick=()=>{const open=el('map-options').classList.toggle('open');el('map-options-toggle').setAttribute('aria-expanded',String(open))};
 const toolbarControls=[...document.querySelectorAll('.toolbar input,.toolbar select,.toolbar button')];toolbarControls.forEach(c=>c.disabled=true);
 let granite=null,trees=null,settlement=null,sijeon=null,pedestrians=null,firstPerson=null,palaceWall=null,frameUpdate=()=>{};

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
  return new Promise((resolve,reject)=>{
   const worker=new Worker('/webapp/static/terrain_worker.js');
   worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data)};
   worker.onerror=event=>{worker.terminate();reject(Error(event.message||'지형 계산을 완료하지 못했습니다.'))};
   worker.postMessage({geometry,path});
  });
 }
 const matchAt=(matches,i)=>({distance:matches[i*3],level:matches[i*3+1],width:matches[i*3+2]});
 await stage(0,'고도 자료를 불러오는 중입니다');
 const response=await fetch('/gis/georeferenced/terrain3d/dem.json');
 if(!response.ok)throw Error('고도 자료를 불러오지 못했습니다.');
 const dem=await response.json(),exp=JSON.parse(el('experiment').textContent);
 const points=[...exp.landmarks,...exp.suggested_anchors];
 const alignTerrain=new URLSearchParams(location.search).get('alignment')!=='base';
 el('align-terrain').checked=alignTerrain;el('align-terrain').onchange=()=>{const url=new URL(location.href);url.searchParams.set('alignment',el('align-terrain').checked?'mountains':'base');location.href=url};
 const warp=DoseongWarp.fitTerrainTPS(points.map(p=>p.pixel),points.map(p=>project(p.lon,p.lat)),alignTerrain?exp.terrain_alignment:null);
 const [xmin,ymin,xmax,ymax]=dem.bounds_3857,n=dem.size;
 if(dem.elevations.length!==n*n||!dem.elevations.every(Number.isFinite))throw Error('고도 격자가 올바르지 않습니다.');
 const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
 const latitude=2*Math.atan(Math.exp(cy/R))-Math.PI/2,ground=Math.cos(latitude);
 let exaggeration=1;
 const world=(x,y,h)=>[(x-cx)*ground,h*exaggeration,-(y-cy)*ground];
 function height(x,y){
  const u=(x-xmin)/(xmax-xmin)*(n-1),v=(ymax-y)/(ymax-ymin)*(n-1);
  if(u<0||v<0||u>n-1||v>n-1)throw Error('원도 배치가 준비된 고도 범위를 벗어났습니다.');
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
  if(textured&&folded)throw Error('원도 격자 접힘이 발견되어 3D 표시를 중단했습니다.');
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.userData.heights=heights;return geometry;
 }
 const terrain=new THREE.Mesh(grid(n-1,n-1,(u,v)=>[xmin+u*(xmax-xmin),ymax-v*(ymax-ymin)]),surfaceMaterial);scene.add(terrain);
 const initial=world(...warp(1560,1470),150);controls.target.set(...initial);camera.position.set(initial[0],6200,initial[2]+7600);controls.update();
 await stage(1,'지형 표시 완료 · 도성대지도를 불러오는 중입니다');
 const texture=await new THREE.TextureLoader().loadAsync(exp.image_url);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const [iw,ih]=exp.image_size;
 const historical=new THREE.Mesh(grid(128,112,(u,v)=>warp(u*iw,v*ih),true),new THREE.MeshStandardMaterial({map:texture,transparent:true,opacity:Number(el('opacity3d').value)/100,roughness:1,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));historical.renderOrder=1;scene.add(historical);
 const mapGround=terrain; // One physical surface for terrain, map and road overlays.
 const sourceImagePositions=historical.geometry.attributes.position.clone();
 await stage(2,'지도 표시 완료 · 주요 건물과 문을 준비합니다');
 const labels=new THREE.Group();labels.visible=el('anchors3d').checked;scene.add(labels);
 const dotCanvas=document.createElement('canvas');dotCanvas.width=32;dotCanvas.height=32;
 const dotContext=dotCanvas.getContext('2d');dotContext.beginPath();dotContext.arc(16,16,12,0,Math.PI*2);dotContext.fillStyle='#167bb5';dotContext.fill();dotContext.strokeStyle='#ffffff';dotContext.lineWidth=4;dotContext.stroke();
 const dotTexture=new THREE.CanvasTexture(dotCanvas);
 for(const p of points){
  const [x,y]=project(p.lon,p.lat),z=height(x,y)+8;
  const dot=new THREE.Sprite(new THREE.SpriteMaterial({map:dotTexture,depthTest:false,depthWrite:false,sizeAttenuation:false}));
  dot.renderOrder=10;dot.position.set(...world(x,y,z));dot.scale.set(.011,.011,1);dot.userData={x,y,z,name:p.name};if(p.dem_height_m)dot.material.color.setHex(0xffa84c);labels.add(dot);
 }
 function gateModel(feature,w,h,d){
  const model=new THREE.Group();model.name='gate-model';
  const stone=new THREE.MeshStandardMaterial({color:0xb5aa94,roughness:1,side:THREE.DoubleSide});
  const timber=new THREE.MeshStandardMaterial({color:0x813f2e,roughness:.9});
  const tiles=new THREE.MeshStandardMaterial({color:0x364345,roughness:.85,side:THREE.DoubleSide});
  const base=h*.43,doors=feature.id==='gwanghwamun'?3:1;
  const doorWidth=w*(doors===3?.14:.25),spring=base*.48,archTop=base*.85;
  const outline=new THREE.Shape();outline.moveTo(-w/2,0);outline.lineTo(-w/2,base);outline.lineTo(w/2,base);outline.lineTo(w/2,0);
  const centres=Array.from({length:doors},(_,i)=>(i-(doors-1)/2)*w*.27);
  for(const x of [...centres].reverse()){
   outline.lineTo(x+doorWidth/2,0);outline.lineTo(x+doorWidth/2,spring);
   outline.quadraticCurveTo(x+doorWidth/2,archTop,x,archTop);
   outline.quadraticCurveTo(x-doorWidth/2,archTop,x-doorWidth/2,spring);outline.lineTo(x-doorWidth/2,0);
  }
  outline.closePath();
  const arch=new THREE.Mesh(new THREE.ExtrudeGeometry(outline,{depth:d,bevelEnabled:false,curveSegments:12}),stone);
  arch.name='stone-arch';arch.position.set(0,-h/2,-d/2);model.add(arch);
  const tiers=feature.gate_tiers??(feature.id==='donuimun'?1:2),step=(h-base)/tiers;
  for(let tier=0;tier<tiers;tier++){
   const bottom=base+tier*step-h/2,shrink=1-tier*.13;
   const hall=new THREE.Mesh(new THREE.BoxGeometry(w*.69*shrink,step*.62,d*.68*shrink),timber);
   hall.position.y=bottom+step*.31;hall.name='gate-hall';model.add(hall);
   const rw=w*.49*shrink,rd=d*.49*shrink,low=bottom+step*.62,high=bottom+step;
   const roof=new THREE.BufferGeometry();
   roof.setAttribute('position',new THREE.Float32BufferAttribute([-rw,low,-rd,rw,low,-rd,rw,low,rd,-rw,low,rd,-rw*.65,high,0,rw*.65,high,0],3));
   roof.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0,0,1,2,0,2,3]);roof.computeVertexNormals();
   const roofMesh=new THREE.Mesh(roof,tiles);roofMesh.name='gate-roof';model.add(roofMesh);
   // Posts and dark window bays make the upper storey legible without detailed reconstruction.
   for(let col=0;col<5;col++){
    const window=new THREE.Mesh(new THREE.BoxGeometry(w*.085*shrink,step*.32,.12),new THREE.MeshStandardMaterial({color:0x252e29,roughness:1}));
    window.position.set((col-2)*w*.125*shrink,bottom+step*.33,d*.34*shrink+.08);model.add(window);
   }
  }
  model.userData={doors,centres,doorWidth,archTestY:-h/2+spring*.6,conceptual:true};return model;
 }
 const buildings=new THREE.Group();scene.add(buildings);
 const foundations=new THREE.Group();scene.add(foundations);
 const supportSurfaces=[terrain,historical].map(mesh=>({positions:mesh.geometry.attributes.position.array,index:mesh.geometry.index.array}));
 const buildingData=JSON.parse(el('buildings').textContent);
 const siteMarkers=[];
 const colors={'궁궐':0xb66841,'제례':0x786091,'교육':0x397b83,'관청':0x4b6b9b,'상업':0xa48734,'성문':0x98564b,'집터':0x8a8577,'시설':0x7f6a4c};
 for(const feature of buildingData.features){
  let x,y;
  if(feature.source_position){
   if(feature.source_position.source_sha256!==exp.input_sha256)throw Error('문 위치 판독 원본이 현재 원도와 다릅니다.');
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
   if(feature.road_axis.source_sha256!==exp.input_sha256)throw Error('문 진입로 판독 원본이 현재 원도와 다릅니다.');
   const [a,b]=feature.road_axis.pixel_points.map(p=>warp(...p));
   // Local +z is the open passage; world +z points south.
   yaw=Math.atan2(b[0]-a[0],-(b[1]-a[1]));
  }
  const support=TerrainSupport.footprintRange(supportSurfaces,[wx-w/2,wz-d/2,wx+w/2,wz+d/2],yaw);
  const z=support.max+.5,bottom=support.min-.25;
  const foundation=new THREE.Mesh(new THREE.BoxGeometry(w,z-bottom,d),new THREE.MeshStandardMaterial({color:0x8a8273,roughness:1}));
  foundation.rotation.y=yaw;foundation.position.set(wx,(z+bottom)/2,wz);foundation.userData={top:z,bottom,featureId:feature.id};foundations.add(foundation);
  const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color:colors[feature.category]??0x856549,roughness:.8}));
  box.position.set(...world(x,y,z));box.position.y+=h/2;
  box.rotation.y=yaw;box.userData={feature,x,y,z,boxHeight:h,support};
  if(feature.category==='성문'){box.material.visible=false;box.add(gateModel(feature,w,h,d))}
  if(feature.display_model==='palace_compound'){box.material.visible=false;box.add(createPalace(feature,w,h,d))}
  if(feature.display_model==='palace_gate'){box.material.visible=false;box.add(createPalaceGate(feature,w,h,d))}
  if(feature.display_model==='training_ground'){box.material.visible=false;foundation.visible=false;box.add(createTrainingGround(feature,w,h,d))}
  if(feature.display_model==='bell_tower'){box.material.visible=false;box.add(createBellTower(feature,w,h,d))}
  if(feature.display_model==='house_site'){box.material.visible=false;foundation.visible=false;box.add(createHouseSite(feature,w,h,d));siteMarkers.push({box,foundation})}
  if(feature.id==='jongmyo'){box.material.visible=false;box.add(createJongmyo(w,h,d))}
  if(feature.display_model==='yukjo_compound'){box.material.visible=false;foundation.visible=false;box.add(createYukjo(feature,w,h,d))}
  buildings.add(box);
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
 const nameTags=buildings.children.map(building=>{
  const name=building.userData.feature.name.split(' · ')[0],{tag,aspect}=nameSprite(name);
  tag.renderOrder=5;tag.userData={name,featureId:building.userData.feature.id};buildingNames.add(tag);
  return {building,tag,aspect};
 });
 const mountainNames=new THREE.Group();mountainNames.name='mountain-name-labels';scene.add(mountainNames);
 const districtNames=new THREE.Group();districtNames.name='district-name-labels';scene.add(districtNames);
 function placeTag(name,x,y,group){
  const {tag,aspect}=nameSprite(name);
  tag.userData={name,x,y,z:height(x,y)+20};tag.renderOrder=6;group.add(tag);
  return {tag,aspect};
 }
 const mountainTags=exp.terrain_alignment.anchors.map(p=>{
  const name=p.name.startsWith('백악')?'북악산':p.name.replace(' 능선','');
  const [x,y]=alignTerrain?project(p.lon,p.lat):warp(...p.pixel);return placeTag(name,x,y,mountainNames);
 });
 // Approximate area labels, not surveyed points or historical administrative boundaries.
 // Seochon follows the drawn palace wall and upstream channel, not a historical center.
 // Area descriptions: hanok.seoul.go.kr/front/kor/town/town01.do and town02.do.
 const districtTags=[{name:'북촌',pixel:[1445,965]},{name:'서촌',pixel:[1042,1085]}].map(p=>{
  const [x,y]=warp(...p.pixel);return placeTag(p.name,x,y,districtNames);
 });
 function updateBuildingNames(){
  buildingNames.visible=buildings.visible&&el('names3d').checked;
  mountainNames.visible=el('names3d').checked;districtNames.visible=el('names3d').checked;
  const scale=24*2*Math.tan(camera.fov*Math.PI/360)/Math.max(1,el('scene').clientHeight); // 24px font on a 36px canvas yields ~16px text.
  for(const {building,tag,aspect} of nameTags){
   tag.visible=building.visible;
   tag.position.copy(building.position);tag.position.y+=building.userData.boxHeight/2+4;
   tag.scale.set(scale*aspect,scale,1);
  }
  for(const {tag,aspect} of [...mountainTags,...districtTags]){const p=tag.userData;tag.position.set(...world(p.x,p.y,p.z));tag.scale.set(scale*aspect,scale,1)}
 }
 frameUpdate=()=>updateBuildingNames();
 await stage(3,'주요 건물·문 표시 완료 · 물길을 준비합니다');
 const waterData=JSON.parse(el('water').textContent),waterLayer=new THREE.Group(),bridges=new THREE.Group();scene.add(waterLayer);scene.add(bridges);
 if(waterData.source_sha256!==exp.input_sha256)throw Error('물길 판독 원본이 현재 원도와 다릅니다.');
 function sourceSurface(px,py){
  const cols=128,rows=112,u=px/iw*cols,v=py/ih*rows,i=Math.min(cols-1,Math.floor(u)),j=Math.min(rows-1,Math.floor(v)),a=u-i,b=v-j;
  if(i<0||j<0||u>cols||v>rows)throw Error('물길 판독점이 원도 밖에 있습니다.');
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
 const selectable=()=>[...(buildings.visible?buildings.children:[]),...(bridges.visible?bridges.children:[])];
 el('water3d').onchange=()=>{waterLayer.visible=el('water3d').checked;bridges.visible=waterLayer.visible;selected=null;clearHover()};
 el('water-focus').onclick=()=>{const target=sourceSurface(1523,1554);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(0,900,1300));controls.update()};
 el('namsan-focus').onclick=()=>{const target=sourceSurface(...exp.terrain_alignment.anchors[0].pixel);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(400,1200,1700));controls.update()};
 el('upstream-focus').onclick=()=>{const target=sourceSurface(990,1160);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(500,1700,2000));controls.update()};
 const tooltip=document.createElement('div');tooltip.id='building-tooltip';tooltip.hidden=true;
 Object.assign(tooltip.style,{position:'absolute',pointerEvents:'none',background:'#fffdf2',color:'#24372e',padding:'6px 10px',border:'1px solid #829783',borderRadius:'4px',maxWidth:'250px',zIndex:'20'});el('scene').append(tooltip);
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let hovered=null,selected=null,press=null;
 function showBuilding(box){
  const f=box?.userData.feature;
  el('building-name').textContent=f?f.name+' · '+f.category:'박스에 커서를 올리거나 클릭하면 이름을 볼 수 있습니다.';
  el('building-name').style.fontWeight=f?'bold':'';
  el('building-note').textContent=f?' — '+f.note+' · 개략 크기 '+f.symbol_size_m[0]+' × '+f.symbol_size_m[2]+' m / 높이 '+f.symbol_size_m[1]+' m · '+(f.category==='교량'?'다리 구조는 개념 모형':'지형 받침은 개관용 가정'):'';
  el('building-reference').hidden=!f;
  if(f)el('building-reference').href=f.reference;else el('building-reference').removeAttribute('href');
  el('clear-building').hidden=!selected;
  el('focus-building').hidden=!selected;
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
  hovered=hit(event);renderer.domElement.style.cursor=hovered?'pointer':'';
  tooltip.hidden=!hovered;
  if(hovered){const r=renderer.domElement.getBoundingClientRect();tooltip.textContent=hovered.userData.feature.name;tooltip.style.left=Math.max(0,Math.min(event.clientX-r.left+14,r.width-260))+'px';tooltip.style.top=Math.max(0,Math.min(event.clientY-r.top+12,r.height-50))+'px'}
  showBuilding(selected??hovered);
 });
 renderer.domElement.addEventListener('pointerdown',event=>{if(firstPerson?.active)return;press={x:event.clientX,y:event.clientY,id:event.pointerId};tooltip.hidden=true});
 renderer.domElement.addEventListener('pointerup',event=>{
  if(firstPerson?.active)return;
  if(press&&press.id===event.pointerId&&Math.hypot(event.clientX-press.x,event.clientY-press.y)<6){selected=hit(event);hovered=null;tooltip.hidden=true;showBuilding(selected)}
  press=null;
 });
 renderer.domElement.addEventListener('pointercancel',()=>{press=null;clearHover()});
 renderer.domElement.addEventListener('pointerleave',clearHover);
 controls.addEventListener('change',()=>{if(hovered)clearHover()});
 el('clear-building').onclick=()=>{selected=null;clearHover()};
 el('focus-building').onclick=()=>{
  if(!selected)return;
  const target=selected.position.clone();controls.target.copy(target);
  const distance=Math.max(120,...selected.userData.feature.symbol_size_m.map(v=>v*4));
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
  buildings.children.forEach(b=>{const u=b.userData;b.position.set(...world(u.x,u.y,u.z));b.position.y+=u.boxHeight/2;heightYukjo(b,exaggeration)});
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
 await stage(4,'물길 표시 완료 · 하천 주변 지형을 계산합니다');
 const surfaceBaselines=[];
 for(const mesh of [terrain]){
  const old=mesh.geometry,refined=await refineTerrain({positions:old.attributes.position.array,index:old.index.array,uv:old.attributes.uv.array,colors:old.attributes.color.array},channelPath);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(refined.positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(refined.uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(refined.colors,3));g.setIndex(new THREE.BufferAttribute(refined.index,1));
  const original=Array.from({length:g.attributes.position.count},(_,i)=>g.attributes.position.getY(i));
  const matches=refined.matches;
  g.userData.heights=[...original];g.computeVertexNormals();mesh.geometry=g;old.dispose();surfaceBaselines.push({mesh,original,matches,offset:0});
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
 if(!overlayIndex.length)throw Error('지형 위의 지도 좌표를 계산하지 못했습니다.');
 const overlayGeometry=new THREE.BufferGeometry();
 for(const name of ['position','normal','color'])overlayGeometry.setAttribute(name,canonical.attributes[name]);
 overlayGeometry.setAttribute('uv',new THREE.BufferAttribute(overlayUV,2));overlayGeometry.setIndex(overlayIndex);overlayGeometry.userData.heights=canonical.userData.heights;
 historical.geometry.dispose();historical.geometry=overlayGeometry;
 const roadRecord=await (await fetch('/gis/roads/doseong_road_mask.json')).json();
 if(roadRecord.source_sha256!==exp.input_sha256)throw Error('길 판독 원본이 현재 원도와 다릅니다.');
 const roadTexture=await new THREE.TextureLoader().loadAsync(roadRecord.mask_url);roadTexture.colorSpace=THREE.SRGBColorSpace;
 const roadLayer=new THREE.Mesh(historical.geometry.clone(),new THREE.MeshBasicMaterial({map:roadTexture,color:roadRecord.display_color,transparent:true,opacity:.8,alphaTest:.04,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}));
 roadLayer.geometry.userData={heights:[...historical.geometry.userData.heights]};
 roadLayer.name='source-road-overlay';roadLayer.renderOrder=2;scene.add(roadLayer);
 el('roads3d').onchange=()=>{roadLayer.visible=el('roads3d').checked;pedestrians?.setRoadVisible(roadLayer.visible)};
 const waterBaselines=waterLayer.children.map(m=>[...m.geometry.userData.heights]);
 const channelState={enabled:true,depth:2,maxCut:0,path:channelPath,mainPath,northPath,joinIndex};
 const wallData=JSON.parse(el('wall').textContent);
 if(wallData.source_sha256!==exp.input_sha256)throw Error('성벽 판독 원본이 현재 원도와 다릅니다.');
 const cityWall=createCityWall(wallData,sourceSurface,buildings);scene.add(cityWall.group);
 const palaceResponse=await fetch('/gis/walls/gyeongbokgung_wall.json');
 if(!palaceResponse.ok)throw Error('경복궁 담장 자료를 불러오지 못했습니다.');
 const palaceData=await palaceResponse.json();
 if(palaceData.source_sha256!==exp.input_sha256)throw Error('경복궁 담장 판독 원본이 현재 원도와 다릅니다.');
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
  const surfaces=[terrain,historical].map(m=>({positions:m.geometry.attributes.position.array,index:m.geometry.index.array}));
  buildings.children.forEach((box,i)=>{
   const u=box.userData,[w,,d]=u.feature.symbol_size_m;
   const range=TerrainSupport.footprintRange(surfaces,[box.position.x-w/2,box.position.z-d/2,box.position.x+w/2,box.position.z+d/2],box.rotation.y);
   u.support=range;u.z=range.max+.5;
   const f=foundations.children[i];f.geometry.dispose();f.geometry=new THREE.BoxGeometry(w,u.z-range.min+.25,d);f.userData.top=u.z;f.userData.bottom=range.min-.25;
  });
  waterLayer.children.forEach((mesh,layer)=>{
   mesh.geometry.userData.heights=waterBaselines[layer].map((h,i)=>{
    if(!enabled)return h;
    const centre=mesh.userData.centres[Math.floor(i/2)],match=ChannelTerrain.nearest(centre.x,centre.z,channelPath);
    return match.level+.35+(mesh.userData.bank?(i%2)*.65:0);
   });
  });
  roadLayer.geometry.userData.heights=[...terrain.geometry.userData.heights];
  updateBridgeGround(surfaces);
  cityWall.updateGround(surfaces,roadLayer.geometry.userData.heights);palaceWall.updateGroundFrom(cityWall.supportAt);sijeon?.updateGround(cityWall.supportAt);settlement?.updateGround(cityWall.supportAt);pedestrians?.updateGround(cityWall.supportAt);trees?.updateGround(cityWall.supportAt);
  buildings.children.forEach(b=>groundYukjo(b,cityWall.supportAt));
  Object.assign(channelState,{enabled,depth,maxCut});
  el('channel-depth').disabled=!enabled;
  el('channel-status').textContent=enabled?`개념 하도 보정 · 수면 아래 ${depth} m · 현대 지형 대비 최대 낮춤 ${maxCut.toFixed(1)} m · 역사적 깊이 미확정`:'원래 고도 표시 · 청계천은 원도 위치의 지형 표면을 따릅니다.';
  el('height3d').onchange();
 }
 el('carve3d').onchange=applyChannel;
 el('channel-depth').oninput=()=>{el('channel-depth-value').textContent=el('channel-depth').value+' m'};
 el('channel-depth').onchange=applyChannel;
 applyChannel();
 await stage(5,'하천·성벽·길 표시 완료 · 주택과 상가를 배치합니다');
 const sijeonData=await(await fetch('/gis/buildings/doseong_sijeon.json')).json();
 if(sijeonData.source_sha256!==exp.input_sha256)throw Error('시전 배치의 길 판독 원본이 현재 원도와 다릅니다.');
 sijeon=createSijeon(sijeonData,sourceSurface,buildings);sijeon.updateGround(cityWall.supportAt);sijeon.updateHeights(exaggeration);scene.add(sijeon.group);
 const sijeonBlockers=sijeon.records.map(r=>({x:r.x,z:r.z,radius:Math.hypot(r.length,sijeonData.placement.depth_m)/2+2}));
 const settlementData=await(await fetch('/gis/buildings/doseong_settlement.json')).json();
 if(settlementData.source_sha256!==exp.input_sha256)throw Error('추정 건물 배치 원본이 현재 원도와 다릅니다.');
 settlement=createSettlement(settlementData,sourceSurface,(x,z)=>height(cx+x/ground,cy-z/ground),buildings,channelPath,sijeonBlockers);settlement.updateGround(cityWall.supportAt);settlement.updateHeights(exaggeration);scene.add(settlement.group);
 await stage(6,'주택·상가 표시 완료 · 숲과 걷는 사람을 준비합니다');
 const treeResponse=await fetch('/gis/vegetation/doseong_trees.json');
 if(!treeResponse.ok)throw Error('수목 배치 자료를 불러오지 못했습니다.');
 const treeData=await treeResponse.json();
 if(treeData.source_sha256!==exp.input_sha256)throw Error('수목 배치 원도가 현재 지도와 다릅니다.');
 trees=createTrees(treeData,sourceSurface,buildings,settlement,channelPath,{segments:[...cityWall.segments,...palaceWall.segments]},granite);trees.updateGround(cityWall.supportAt);trees.updateHeights(exaggeration);scene.add(trees.group);
 const groundColors=createGroundColors(surfaceMaterial,terrain.geometry,trees.records);
 await yieldPaint();
 el('trees-focus').onclick=()=>{const r=trees.records.find(r=>r.region==='gyeongbok');if(!r)return;controls.target.set(r.x,r.floor,r.z);camera.position.copy(controls.target).add(new THREE.Vector3(120,240,320));controls.update()};
 const walkingData=await(await fetch('/gis/roads/doseong_walking_routes.json')).json();
 if(walkingData.source_sha256!==exp.input_sha256)throw Error('보행 경로 원도가 현재 지도와 다릅니다.');
 pedestrians=createPedestrians(walkingData,sourceSurface);pedestrians.updateGround(cityWall.supportAt);pedestrians.setHeight(exaggeration);scene.add(pedestrians.group);
 frameUpdate=dt=>{pedestrians.update(dt);updateBuildingNames()};
 await stage(7,'숲·사람 표시 완료 · 마무리합니다');
 el('people-focus').onclick=()=>{const p=pedestrians.walkers[20].position;controls.target.copy(p);camera.position.copy(p).add(new THREE.Vector3(18,28,45));controls.update()};
 el('settlement-focus').onclick=()=>{const r=settlement.records.filter(r=>r.shop&&r.displayed).sort((a,b)=>Math.hypot(a.pixel[0]-1520,a.pixel[1]-1440)-Math.hypot(b.pixel[0]-1520,b.pixel[1]-1440))[0];if(!r)return;const target=new THREE.Vector3(r.x,r.floor,r.z);controls.target.copy(target);camera.position.copy(target).add(new THREE.Vector3(100,220,300));controls.update()};
 let osmTexture=null;
 async function osm(){
  const zoom=12,span=2*H/2**zoom,tx0=Math.floor((xmin+H)/span),tx1=Math.floor((xmax+H)/span),ty0=Math.floor((H-ymax)/span),ty1=Math.floor((H-ymin)/span);
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=2048;const ctx=canvas.getContext('2d');
  await Promise.all(Array.from({length:ty1-ty0+1},(_,j)=>Array.from({length:tx1-tx0+1},(_,i)=>[tx0+i,ty0+j])).flat().map(async([x,y])=>{
   const img=new Image();img.crossOrigin='anonymous';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('OSM 타일을 불러오지 못했습니다. 고도 지형으로 표시합니다.'));img.src=`https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`});
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
  return {show(yaw,at){bake();panel.hidden=false;update(yaw,at)},hide(){panel.hidden=true},update};
 })();
 // Ground-following first-person exploration; drag works over plain Tailscale HTTP too.
 firstPerson=(()=>{
  let active=false,saved=null,yaw=0,pitch=0,drag=null,lastGround=null,walked=0,view=4.5,walker=null;
  const eye=new THREE.Vector3(),boom=new THREE.Vector3();
  const keys=new Set(),touchKeys=new Map(),canvas=renderer.domElement,hud=el('first-person-help');canvas.tabIndex=0;
  const joystick=createWalkJoystick(el('walk-joystick'),()=>active);
  const held=code=>keys.has(code)||[...touchKeys.values()].some(button=>button.dataset.walk===code);
  function clearInput(){joystick.reset();keys.clear();touchKeys.clear();hud.querySelectorAll('[data-walk]').forEach(b=>b.classList.remove('pressed'));drag=null}
  function groundAt(x,z){
   // Clamp exploration to the prepared map; support queries outside it have no triangles.
   // Terrain/map positions are already scaled; road support stores unscaled heights.
   // Include the raised road overlay so eye height matches the surface walkers stand on.
   try{const s=cityWall.supportAt(x,z,.3,.3,0,roadLayer.visible);return Math.max(s.max,roadLayer.visible&&s.road?s.road.max*exaggeration:-Infinity)}catch{return null}
  }
  function place(){
   // Third-person boom: the eye stays at walking height and the camera pulls back along the view.
   boom.set(0,0,1).applyEuler(camera.rotation).multiplyScalar(view);
   // Lift with the boom so the character sits low in frame instead of blocking the view.
   camera.position.copy(eye).add(boom);camera.position.y+=view*.22;
   const ground=groundAt(camera.position.x,camera.position.z);
   if(ground!==null)camera.position.y=Math.max(camera.position.y,ground+.6);
   if(walker){
    walker.group.visible=view>=.8;
    walker.group.position.set(eye.x,eye.y-1.65,eye.z);walker.group.rotation.y=yaw+Math.PI;
   }
  }
  function look(){camera.rotation.set(pitch,yaw,0,'YXZ');place();if(active)navigation.update(yaw,eye)}
  function enter(){
   if(active)return;clearHover();press=null;
   saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:controls.target.clone(),fov:camera.fov,near:camera.near};
   const path=pedestrians.routes[0].points,index=Math.floor(path.length*.42),p=path[index],q=path[index+1];
   yaw=Math.atan2(-(q.x-p.x),-(q.z-p.z));pitch=0;
   const ground=groundAt(p.x,p.z);if(ground===null)return;
   controls.enabled=false;active=true;clearInput();lastGround=ground;
   camera.near=.08;camera.fov=70;camera.updateProjectionMatrix();eye.set(p.x,ground+1.65,p.z);
   if(!walker){walker=createWalker();scene.add(walker.group)}
   walked=0;walker.update(0,false);look();
   navigation.show(yaw,eye);hud.hidden=false;el('first-person3d').textContent='전체 지도 시점';el('first-person3d').setAttribute('aria-pressed','true');canvas.focus({preventScroll:true});
  }
  function exit(){
   if(!active)return;active=false;clearInput();hud.hidden=true;navigation.hide();if(walker)walker.group.visible=false;
   camera.near=saved.near;camera.fov=saved.fov;camera.updateProjectionMatrix();camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);controls.target.copy(saved.target);controls.enabled=true;controls.update();
   el('first-person3d').textContent='1인칭으로 걷기';el('first-person3d').setAttribute('aria-pressed','false');
  }
  function update(dt){
   if(!active)return;
   const forward=Number(held('KeyW')||held('ArrowUp'))-Number(held('KeyS')||held('ArrowDown'))-joystick.value.y;
   const side=Number(held('KeyD')||held('ArrowRight'))-Number(held('KeyA')||held('ArrowLeft'))+joystick.value.x;
   const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?8:3)*Math.min(dt,.1),norm=Math.max(1,Math.hypot(forward,side));
   const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)/norm*speed,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)/norm*speed;
   let moved=false;
   if(dx||dz){
    const x=eye.x+dx,z=eye.z+dz,ground=groundAt(x,z);
    // Avoid walking off abrupt terrain steps or out of the prepared region.
    if(ground!==null&&Math.abs(ground-lastGround)<.7){eye.x=x;eye.z=z;lastGround=ground;walked+=Math.hypot(dx,dz);moved=true}
   }
   const ground=groundAt(eye.x,eye.z);if(ground!==null){lastGround=ground;eye.y=ground+1.65}
   walker?.update(walked,moved);
   look();
  }
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
  document.addEventListener('keydown',event=>{
   if(!active)return;if(event.code==='Escape'){event.preventDefault();exit();return}
   if(event.target.matches('input,select,textarea,button'))return;
   if(movement.has(event.code)){event.preventDefault();keys.add(event.code)}
  });
  document.addEventListener('keyup',event=>keys.delete(event.code));
  // Moving focus to a touch control must not cancel a held direction.
  canvas.addEventListener('blur',()=>{keys.clear();drag=null});window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInput()});
  canvas.addEventListener('pointerdown',event=>{if(!active||drag)return;canvas.focus({preventScroll:true});drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId)});
  canvas.addEventListener('pointermove',event=>{if(!active||!drag||drag.id!==event.pointerId)return;yaw-=(event.clientX-drag.x)*.003;pitch=Math.max(-Math.PI*.47,Math.min(Math.PI*.47,pitch-(event.clientY-drag.y)*.003));drag.x=event.clientX;drag.y=event.clientY;look()});
  canvas.addEventListener('wheel',event=>{
   if(!active)return;event.preventDefault();
   view=Math.max(0,Math.min(12,view+Math.sign(event.deltaY)*.6));look();
  },{passive:false});
  const release=event=>{if(drag?.id===event.pointerId)drag=null};for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,release);
  el('first-person3d').onclick=()=>{active?exit():enter();el('map-options').classList.remove('open');el('map-options-toggle').setAttribute('aria-expanded','false')};
  el('first-person-exit').onclick=exit;
  document.querySelector('.toolbar').addEventListener('click',event=>{if(active&&event.target.closest('button')&&!['first-person3d','map-options-toggle'].includes(event.target.id))exit()},true);
  el('focus-building').addEventListener('click',()=>{if(active)exit()},true);
  // Touch buttons allow the same walk controls without a hardware keyboard.
  for(const button of hud.querySelectorAll('[data-walk]')){
   button.addEventListener('pointerdown',event=>{if(!active)return;event.preventDefault();button.setPointerCapture(event.pointerId);touchKeys.set(event.pointerId,button);button.classList.add('pressed')});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{touchKeys.delete(event.pointerId);if(![...touchKeys.values()].includes(button))button.classList.remove('pressed')});
   button.addEventListener('contextmenu',event=>event.preventDefault());
  }
  return {get active(){return active},get ground(){return lastGround},get eye(){return eye.clone()},get view(){return view},get walker(){return walker},enter,exit,update};
 })();
 const orbitNavigation=setupOrbitNavigation(camera,controls,renderer.domElement,ray=>cityWall.raycastGround(ray,true),()=>!!firstPerson?.active,(x,z)=>{
  try{const s=cityWall.supportAt(x,z,.2,.2,0,roadLayer.visible);return Math.max(s.max,roadLayer.visible?s.road.max*exaggeration:-Infinity)}catch{return null}
 });
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();el('error').textContent='3D 그래픽 연결이 끊겼습니다. 페이지를 새로 고쳐 주세요.'});
 frameUpdate=dt=>{firstPerson?.update(dt);pedestrians?.update(dt);updateBuildingNames()};
 toolbarControls.forEach(c=>c.disabled=false);el('channel-depth').disabled=!channelState.enabled;
 await stage(8,'모든 요소를 불러왔습니다');loading.ready=true;el('scene-loading').hidden=true;
 el('status').textContent='3D 지형 로드 완료 · 기존 TPS 5점 · 높이 기본 1배 · 북쪽은 초기 화면 위쪽';
 // Read-only diagnostics for browser verification; no point coordinates are modified here.
 window.terrain3d={ready:true,anchorCount:points.length,anchorError:Math.max(...points.map(p=>{const a=warp(...p.pixel),b=project(p.lon,p.lat);return Math.hypot(a[0]-b[0],a[1]-b[1])})),elevationRange:[dem.elevations.reduce((a,b)=>Math.min(a,b),Infinity),dem.elevations.reduce((a,b)=>Math.max(a,b),-Infinity)],renderer,scene,camera,controls,historical,terrain,mapGround,labels,buildings,foundations,waterLayer,bridges,river,channelState,surfaceBaselines,cityWall,palaceWall,alignTerrain,warp,roadLayer,roadRecord,settlement,sijeon,buildingNames,nameTags,mountainNames,districtNames,updateBuildingNames,pedestrians,trees,granite,firstPerson,orbitNavigation,updateCompass,compass,groundColors};
}
main().catch(error=>{el('error').textContent='일부 요소를 불러오지 못했습니다: '+(error.message||'지도 또는 화면 자료 요청에 실패했습니다.');el('status').textContent='현재까지 준비된 화면을 유지합니다.';el('loading-message').textContent='불러오기가 중단되었습니다. 새로고침해서 다시 시도해 주세요.';el('loading-retry').hidden=false;console.error(error)});
