import * as THREE from 'three';
import {OrbitControls} from './vendor/three/OrbitControls.js';

const el=id=>document.getElementById(id),R=6378137,H=Math.PI*R;
const project=(lon,lat)=>[R*lon*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))];
async function main(){
 const response=await fetch('/gis/georeferenced/terrain3d/dem.json');
 if(!response.ok)throw Error('고도 자료를 불러오지 못했습니다.');
 const dem=await response.json(),exp=JSON.parse(el('experiment').textContent);
 const points=[...exp.landmarks,...exp.suggested_anchors];
 const warp=DoseongWarp.fitTPS(points.map(p=>p.pixel),points.map(p=>project(p.lon,p.lat)));
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
 const scene=new THREE.Scene();scene.background=new THREE.Color('#dce5e4');
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.outputColorSpace=THREE.SRGBColorSpace;el('scene').append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(43,1,10,60000);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=500;controls.maxDistance=21000;controls.maxPolarAngle=Math.PI*.47;
 scene.add(new THREE.HemisphereLight(0xffffff,0x6a7864,1.6));const light=new THREE.DirectionalLight(0xfff5db,1.5);light.position.set(-4000,9000,3500);scene.add(light);
 const surfaceMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,side:THREE.DoubleSide});
 function grid(cols,rows,location,textured=false){
  const positions=[],uv=[],indices=[],heights=[],colors=[];let folded=0;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const [x,y]=location(i/cols,j/rows),z=height(x,y)+(textured?4:0);positions.push(...world(x,y,z));heights.push(z);uv.push(i/cols,1-j/rows);
   const color=new THREE.Color().setHSL(.25-Math.min(z/1000,.12),.13, .64-Math.min(z/2200,.25));colors.push(color.r,color.g,color.b);
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
 const texture=await new THREE.TextureLoader().loadAsync(exp.image_url);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 const [iw,ih]=exp.image_size;
 const historical=new THREE.Mesh(grid(128,112,(u,v)=>warp(u*iw,v*ih),true),new THREE.MeshStandardMaterial({map:texture,transparent:true,opacity:.9,roughness:1,side:THREE.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));historical.renderOrder=1;scene.add(historical);
 const labels=new THREE.Group();scene.add(labels);
 for(const p of points){
  const [x,y]=project(p.lon,p.lat),z=height(x,y)+100;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='#fffdf2';ctx.fillRect(0,0,384,80);ctx.fillStyle='#174837';ctx.font='bold 35px system-ui';ctx.textAlign='center';ctx.fillText(p.name,192,52);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas),depthTest:false}));label.renderOrder=10;label.position.set(...world(x,y,z));label.scale.set(550,115,1);label.userData={x,y,z};labels.add(label);
 }
 function home(){controls.target.set(0,150,0);camera.position.set(0,6200,7600);controls.update()}
 home();
 el('home3d').onclick=home;
 el('top3d').onclick=()=>{controls.target.set(0,0,0);camera.position.set(0,11000,1);controls.update()};
 el('opacity3d').oninput=()=>{historical.material.opacity=Number(el('opacity3d').value)/100;el('opacity-value').textContent=el('opacity3d').value+'%'};
 el('anchors3d').onchange=()=>{labels.visible=el('anchors3d').checked};
 el('height3d').onchange=()=>{
  exaggeration=Number(el('height3d').value);
  for(const mesh of [terrain,historical]){const pos=mesh.geometry.attributes.position;mesh.geometry.userData.heights.forEach((h,i)=>pos.setY(i,h*exaggeration));pos.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()}
  labels.children.forEach(l=>l.position.set(...world(l.userData.x,l.userData.y,l.userData.z)));
 };
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
 const resize=()=>{const box=el('scene');renderer.setSize(box.clientWidth,box.clientHeight);camera.aspect=box.clientWidth/box.clientHeight;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(el('scene'));resize();
 renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();el('error').textContent='3D 그래픽 연결이 끊겼습니다. 페이지를 새로 고쳐 주세요.'});
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
 el('status').textContent='3D 지형 로드 완료 · 기존 TPS 5점 · 높이 기본 1배 · 북쪽은 초기 화면 위쪽';
 // Read-only diagnostics for browser verification; no point coordinates are modified here.
 window.terrain3d={ready:true,anchorCount:points.length,anchorError:Math.max(...points.map(p=>{const a=warp(...p.pixel),b=project(p.lon,p.lat);return Math.hypot(a[0]-b[0],a[1]-b[1])})),elevationRange:[Math.min(...dem.elevations),Math.max(...dem.elevations)],renderer,scene,camera,controls,historical,terrain,labels};
}
main().catch(error=>{el('error').textContent='3D 화면을 시작하지 못했습니다: '+error.message;el('status').textContent='평면 TPS 화면에서 원도를 계속 확인할 수 있습니다.';console.error(error)});
