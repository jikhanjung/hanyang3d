import * as THREE from 'three';
import {hipGableRoof} from './throne_hall.js';

// Deliberately small, repeated concept models; positions are speculative.
export function createSettlement(data,sourceSurface,heightAt,landmarks,channelPath,blockers=[],options={}){
 const group=new THREE.Group();group.name='speculative-roadside-buildings';
 const records=options.records??[],cells=new Map(),cellSize=14;
 for(const row of data.features){
  const [px,py,angle,w,d,h,shop,rank,roadPx,roadPy]=row,p=sourceSurface(px,py),q=sourceSurface(px+Math.cos(angle)*3,py+Math.sin(angle)*3);
  let yaw=Math.atan2(-(q.z-p.z),q.x-p.x);
  const road=sourceSurface(roadPx,roadPy),dx=road.x-p.x,dz=road.z-p.z,roadDistance=Math.hypot(dx,dz);
  // The roof ridge follows the road; local +Z is the doorway/awning side.
  if(dx*Math.sin(yaw)+dz*Math.cos(yaw)<0)yaw+=Math.PI;
  const frontageDistance=dx*Math.sin(yaw)+dz*Math.cos(yaw),setback=frontageDistance-(d+1)/2;
  // Limit placement in world metres after warping, not in stretched map pixels.
  if(setback<data.placement.roof_edge_setback_m[0]||roadDistance-(d+1)/2>data.placement.roof_edge_setback_m[1])continue;
  const radius=Math.hypot(w+1,d+1)/2;
  const hs=[heightAt(p.x,p.z),heightAt(p.x-6,p.z),heightAt(p.x+6,p.z),heightAt(p.x,p.z-6),heightAt(p.x,p.z+6)];
  if(Math.max(...hs)>140||Math.max(...hs)-Math.min(...hs)>2.8)continue;
  const water=ChannelTerrain.nearest(p.x,p.z,channelPath);if(water.distance<water.width+25+radius)continue;
  if(landmarks.children.some(b=>Math.hypot(p.x-b.position.x,p.z-b.position.z)<Math.hypot(b.userData.feature.symbol_size_m[0],b.userData.feature.symbol_size_m[2])/2+radius+14))continue;
  // Keep the speculative houses out of the shop rows lining Unjongga.
  if(blockers.some(b=>Math.hypot(p.x-b.x,p.z-b.z)<b.radius+radius))continue;
  const ix=Math.floor(p.x/cellSize),iz=Math.floor(p.z/cellSize);let clash=false;
  for(let x=ix-1;x<=ix+1;x++)for(let z=iz-1;z<=iz+1;z++)for(const other of cells.get(x+','+z)??[])if(Math.hypot(other.x-p.x,other.z-p.z)<other.radius+radius+1)clash=true;
  if(clash)continue;
  const record={x:p.x,z:p.z,w,d,h,yaw,shop:!!shop,rank,style:((Math.round(px)*73+Math.round(py)*197)%1000)/1000,radius,roadDistance,setback,road:{x:road.x,z:road.z},pixel:[px,py]};records.push(record);
  const key=ix+','+iz;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(record);
 }
 // Unit-sized wall panels and exposed timber share one instanced geometry.
 const wallPositions=[],wallColors=[];
 function wallBox(x,y,z,w,h,d,color){
  const g=new THREE.BoxGeometry(w,h,d).toNonIndexed(),a=g.attributes.position,c=new THREE.Color(color);
  for(let i=0;i<a.count;i++){wallPositions.push(a.getX(i)+x,a.getY(i)+y,a.getZ(i)+z);wallColors.push(c.r,c.g,c.b)}g.dispose();
 }
 wallBox(0,0,0,.96,1,.94,'#ffffff');
 for(const x of [-.465,.465])for(const z of [-.46,.46])wallBox(x,0,z,.055,1.02,.065,'#69503a');
 for(const z of [-.475,.475]){
  for(const y of [-.45,.455])wallBox(0,y,z,1,.07,.055,'#69503a');
  for(const x of [-.28,.28]){
   wallBox(x,.05,z*1.013,.21,.35,.02,'#e6dcc1');
   for(const offset of [-.105,0,.105])wallBox(x+offset,.05,z*1.04,.012,.37,.02,'#69503a');
   for(const offset of [-.175,0,.175])wallBox(x,.05+offset,z*1.04,.22,.018,.02,'#69503a');
  }
 }
 // Front door (local +Z, the road side): a plank door with a lattice upper panel between the two windows.
 wallBox(0,-.1,.49,.2,.72,.02,'#5b4431');
 for(const offset of [-.05,.05])wallBox(offset,.08,.505,.012,.3,.015,'#e6dcc1');
 wallBox(0,-.47,.49,.24,.05,.05,'#8f8574');
 const wallGeo=new THREE.BufferGeometry();wallGeo.setAttribute('position',new THREE.Float32BufferAttribute(wallPositions,3));wallGeo.setAttribute('color',new THREE.Float32BufferAttribute(wallColors,3));wallGeo.computeVertexNormals();
 function hanokRoof(thatch){
  const positions=[],colors=[],baseColor=new THREE.Color('#ffffff');
  function tri(a,b,c,shade=1){for(const p of [a,b,c]){positions.push(...p);colors.push(baseColor.r*shade,baseColor.g*shade,baseColor.b*shade)}}
  if(thatch){
   // Rounded, thick hipped straw roof with a short ridge and broad overhang.
   const outline=[[-.5,-.34],[-.38,-.5],[.38,-.5],[.5,-.34],[.5,.34],[.38,.5],[-.38,.5],[-.5,.34]];
   const rings=[[1,1,.06],[1,.99,.23],[.9,.8,.6],[.72,.27,.94],[.65,.04,1]].map(([sx,sz,y])=>outline.map(([x,z])=>[x*sx,y,z*sz]));
   for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const k=(i+1)%8,a=rings[j][i],b=rings[j][k],c=rings[j+1][k],d=rings[j+1][i];tri(a,b,c,.92+j*.025);tri(a,c,d,.92+j*.025)}
   for(let i=0;i<8;i++){tri([0,1,0],rings.at(-1)[i],rings.at(-1)[(i+1)%8]);tri([0,.06,0],rings[0][(i+1)%8],rings[0][i],.72)}
  }else{
   // A gabled tile roof: low curved eaves, raised ridge, narrow tile courses.
   const cross=[[-.5,.13],[-.42,.08],[-.25,.35],[0,1],[.25,.35],[.42,.08],[.5,.13]],strips=24;
   for(let i=0;i<strips;i++)for(let j=0;j<cross.length-1;j++){
    const x0=-.5+i/strips,x1=x0+1/strips,[z0,y0]=cross[j],[z1,y1]=cross[j+1],shade=i%2?.88:1;
    tri([x0,y0,z0],[x1,y0,z0],[x1,y1,z1],shade);tri([x0,y0,z0],[x1,y1,z1],[x0,y1,z1],shade);
   }
   for(const x of [-.5,.5])for(let j=0;j<cross.length-1;j++)tri([x,0,0],[x,cross[j][1],cross[j][0]],[x,cross[j+1][1],cross[j+1][0]],.68);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
 }
 const mesh=(geometry,color)=>{const m=new THREE.InstancedMesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide,vertexColors:!!geometry.attributes.color}),records.length);group.add(m);return m};
 const body=mesh(wallGeo,0xffffff),roof=mesh(hanokRoof(false),0xffffff),base=mesh(new THREE.BoxGeometry(1,1,1),0x938471),front=mesh(new THREE.BoxGeometry(1,1,1),0x68523a);
 const strawRoof=mesh(hanokRoof(true),0xffffff);strawRoof.name='thatched-roofs';
 // Larger tile houses of the well-off get a hip-and-gable roof (팔작) instead of the plain gable (맞배).
 const hipRoof=mesh(hipGableRoof(1,1,1,.12,.5),0xffffff);hipRoof.name='house-roofs-hip';
 const ridge=mesh(new THREE.BoxGeometry(1,1,1),0x8b908f);ridge.name='house-ridges';
 // A low chimney (굴뚝) stands behind every house by the kitchen end, clear of the back eave.
 const chimney=mesh(new THREE.BoxGeometry(1,1,1),0x8a7a66);chimney.name='house-chimneys';
 // Far level of detail: a plain block and a two-slope prism (about 20 triangles) replace the lattice walls and roof courses.
 const farPrism=new THREE.BufferGeometry();
 farPrism.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,-.5, .5,0,-.5, .5,0,.5, -.5,0,.5, -.5,1,0, .5,1,0],3));
 farPrism.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);farPrism.computeVertexNormals();
 const farBody=mesh(new THREE.BoxGeometry(1,1,1),0xffffff),farRoof=mesh(farPrism,0xffffff);farBody.name='house-walls-far';farRoof.name='house-roofs-far';
 body.name='house-walls';roof.name='house-roofs';base.name='house-footings';front.name='shop-awnings';
 const tileColor=new THREE.Color('#515957');
 records.forEach(r=>{
  r.roofType=r.shop||r.style<.38?'tile':'thatch';
  // Tile houses have lime-plastered walls; thatched houses keep earthen walls.
  r.wallColor=new THREE.Color(r.shop?'#c7b28f':r.roofType==='tile'?(r.style<.2?'#ddd3bd':'#d2c6ad'):(r.style<.7?'#b9a585':'#ae9a7b'));
  r.hip=r.roofType==='tile'&&!r.shop&&r.w*r.d>=30&&r.style<.2;
  r.strawColor=new THREE.Color(r.style<.72?'#b6a070':'#c3ad7d');
 });
 let density=options.density??.7,exaggeration=1,visibleCount=0,shopCount=0,mapVisible=true,lod=null,nearCount=0;const LOD_M=options.lodDistance??1400;
 const dummy=new THREE.Object3D();
 // Each instanced mesh packs only the houses it draws at the front and sets its count, so hidden or far houses cost the
 // GPU nothing: near houses fill the detailed meshes, far houses the simple ones.
 function updateHeights(ex){
  exaggeration=ex;visibleCount=0;shopCount=0;nearCount=0;
  const slots=new Map(group.children.map(m=>[m,0]));
  for(const r of records){
   const surface=r.support&&(mapVisible?r.support:r.support.terrain);
   const show=r.rank<=density&&surface&&(surface.max-surface.min)*ex<=1.2;
   r.displaySurface=surface;r.displayed=!!show;
   if(!show)continue;
   visibleCount++;if(r.shop)shopCount++;
   // Tile houses stand on a knee-high stone plinth (기단); thatched houses on a low earth step.
   const plinth=r.roofType==='tile'?.4:.15,floor=surface.min*ex+.08+plinth,low=surface.min*ex-.1;
   r.floor=floor;
   const place=(m,x,y,z,sx,sy,sz,color)=>{const i=slots.get(m);slots.set(m,i+1);dummy.position.set(x,y,z);dummy.rotation.set(0,r.yaw,0);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(color)m.setColorAt(i,color)};
   place(base,r.x,(floor+low)/2,r.z,r.w,floor-low,r.d);
   const near=!lod||Math.hypot(r.x-lod.x,floor-lod.y,r.z-lod.z)<LOD_M,thatch=r.roofType==='thatch';
   if(near){
    nearCount++;
    place(body,r.x,floor+r.h/2,r.z,r.w,r.h,r.d,r.wallColor);
    if(r.hip){place(hipRoof,r.x,floor+r.h,r.z,r.w+1.4,1.8,r.d+1.4,tileColor);place(ridge,r.x,floor+r.h+1.85,r.z,Math.max(.5,r.w+1.4-(r.d+1.4)*.5),.16,.22)}
    else{place(thatch?strawRoof:roof,r.x,floor+r.h,r.z,r.w+1,1.5,r.d+1,thatch?r.strawColor:tileColor);if(!thatch)place(ridge,r.x,floor+r.h+1.52,r.z,r.w+1,.16,.22)}
    // The chimney sits behind the back eave at the kitchen end.
    const side=r.style<.5?1:-1,cx=side*(r.w/2-.5),cz=-(r.d/2+.75);
    place(chimney,r.x+Math.cos(r.yaw)*cx+Math.sin(r.yaw)*cz,floor+.6,r.z-Math.sin(r.yaw)*cx+Math.cos(r.yaw)*cz,.45,1.8,.45);
    // A shallow shop eave over the street front; it does not represent a named business.
    if(r.shop)place(front,r.x+Math.sin(r.yaw)*r.d*.5,floor+2.1,r.z+Math.cos(r.yaw)*r.d*.5,r.w*.9,.18,1.6);
   }else{
    place(farBody,r.x,floor+r.h/2,r.z,r.w,r.h,r.d,r.wallColor);
    place(farRoof,r.x,floor+r.h,r.z,r.w+1,1.5,r.d+1,thatch?r.strawColor:tileColor);
   }
  }
  for(const m of group.children){m.count=slots.get(m);m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.computeBoundingSphere()}
  const status=document.getElementById('settlement-status');if(status)status.textContent=`추정 배치 ${visibleCount.toLocaleString()}동 · 주택 ${(visibleCount-shopCount).toLocaleString()} · 상가 ${shopCount.toLocaleString()} — 도성 안 길 주변 일부, 개별 건물 위치 미확인`;
 }
 function updateGround(supportAt){for(const r of records)r.support=supportAt(r.x,r.z,r.w+1,r.d+1,r.yaw)}
 const toggle=document.getElementById('settlement3d');if(toggle)toggle.onchange=e=>{group.visible=e.target.checked};
 const densityControl=document.getElementById('settlement-density');if(densityControl)densityControl.onchange=e=>{density=Number(e.target.value);updateHeights(exaggeration)};
 const setMapVisible=value=>{mapVisible=value;updateHeights(exaggeration)};
 // Recompute the detail split only after the camera has moved far enough to matter.
 function setLod(position){
  if(lod&&Math.hypot(position.x-lod.x,position.y-lod.y,position.z-lod.z)<60)return;
  lod={x:position.x,y:position.y,z:position.z};updateHeights(exaggeration);
 }
 return {group,records,updateGround,updateHeights,setMapVisible,setLod,get visibleCount(){return visibleCount},get shopCount(){return shopCount},get nearCount(){return nearCount}};
}
