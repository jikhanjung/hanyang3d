import * as THREE from 'three';

// Project-authored interpretation of the 1898 cathedral, not a measured interior survey.
// Local +Z is the entrance. Shell dimensions retain the map's estimated footprint.
export function createCathedral1907(feature,w,h,d){
 const model=new THREE.Group(),close=new THREE.Group();model.name='myeongdong-cathedral';close.name='cathedral-close-detail';
 const colors={brick:0x955d49,trim:0xaaa798,plaster:0xd3cbb6,roof:0x4d5757,stone:0xbab3a4,wood:0x684934,glass:0x446f88,gold:0xb99b5c,floor:0xc7bda6};
 const mats=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.92,side:THREE.DoubleSide,...(key==='glass'?{emissive:0x355775,emissiveIntensity:.35}:{})})]));
 for(const [i,color] of [0x87514c,0xc1a063,0x426d94,0x718466,0x9e745d].entries())mats['pane'+i]=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.28,roughness:.6,side:THREE.DoubleSide});
 // Filtered procedural mortar: no downloaded textures, and no distant brick noise.
 mats.brick.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 masonryP;varying vec3 masonryN;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nmasonryP=position;masonryN=normal;');
  shader.fragmentShader='varying vec3 masonryP;varying vec3 masonryN;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 q=vec2(abs(masonryN.x)>.5?masonryP.z:masonryP.x,masonryP.y)/vec2(.42,.18);
   q.x+=mod(floor(q.y),2.)*.5;
   vec2 fw=max(fwidth(q),vec2(.001)),edge=min(fract(q),1.-fract(q));
   float mortar=1.-min(smoothstep(.025,.025+fw.x,edge.x),smoothstep(.035,.035+fw.y,edge.y));
   float detail=1.-smoothstep(.15,.8,max(fw.x,fw.y));
   diffuseColor.rgb*=mix(1.,mix(1.05,.68,mortar),detail);`);
 };
 const blocks=[],walkSurfaces=[],parts=[],seats=[];
 const add=(target,name,geometry,x,y,z,material,ry=0)=>{const m=new THREE.Mesh(geometry,mats[material]);m.name=name;m.position.set(x,y-h/2,z);m.rotation.y=ry;target.add(m);parts.push(name);return m};
 const box=(target,name,x,y,z,sx,sy,sz,material,solid=false)=>{
  const m=add(target,name,new THREE.BoxGeometry(sx,sy,sz),x,y,z,material);
  if(solid)blocks.push({x,z,hw:sx/2,hd:sz/2});return m;
 };
 const core=(name,x,y,z,sx,sy,sz,mat,solid=false)=>box(model,name,x,y,z,sx,sy,sz,mat,solid);
 const fine=(name,x,y,z,sx,sy,sz,mat)=>box(close,name,x,y,z,sx,sy,sz,mat);
 const nw=w*.64,cw=w*.32,front=d*.40,back=-d*.44,crossZ=-d*.20,crossD=d*.16,wall=.55;
 const eave=17,aisleEave=9,spring=12,apex=19,base=.12;
 function archPoints(width,stem,rise){
  const a=width/2,points=[];
  for(let i=0;i<=12;i++){const t=i/12;points.push(new THREE.Vector2(-a*(1-t*t),stem+rise*(2*t-t*t)))}
  for(let i=1;i<=12;i++){const t=i/12;points.push(new THREE.Vector2(a*(2*t-t*t),stem+rise*(1-t*t)))}
  return points;
 }
 function arch(target,name,x,y,z,width,stem,rise,thickness,mat,ry=0){
  const p=archPoints(width,stem,rise),shape=new THREE.Shape();shape.moveTo(-width/2-thickness,0);shape.lineTo(-width/2-thickness,stem);
  for(const v of p)shape.lineTo(v.x*(1+2*thickness/width),v.y+thickness);shape.lineTo(width/2+thickness,0);shape.lineTo(width/2,0);
  for(const v of [...p].reverse())shape.lineTo(v.x,v.y);shape.lineTo(-width/2,0);shape.closePath();
  return add(target,name,new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:8}),x,y,z,mat,ry);
 }
 function windowAt(x,y,z,width,height,ry=0){
  const stem=height*.66,rise=height-stem,shape=new THREE.Shape();shape.moveTo(-width/2,0);for(const p of archPoints(width,stem,rise))shape.lineTo(p.x,p.y);shape.lineTo(width/2,0);shape.closePath();
  add(model,'pointed-glass',new THREE.ShapeGeometry(shape),x,y,z,'glass',ry);
  arch(model,'window-surround',x,y,z,width,stem,rise,.16,'trim',ry);
  const q=new THREE.Group();q.position.set(x,0,z);q.rotation.y=ry;close.add(q);
  box(q,'window-mullion',0,y+height*.43,0,.075,height*.86,.09,'trim');
  for(const t of [.27,.53])box(q,'window-transom',0,y+height*t,0,width,.06,.08,'trim');
  for(const side of [-1,1])arch(q,'window-tracery',side*width*.24,y+height*.55,0,width*.42,height*.06,height*.21,.04,'trim');
  const cell=width/5;
  for(let row=0;row<Math.ceil(height/cell);row++)for(let col=0;col<5;col++){
   const px=-width/2+(col+.5)*cell,py=(row+.5)*cell,t=Math.sqrt(Math.max(0,1-Math.abs(px)/(width/2))),limit=stem+rise*(2*t-t*t);
   if(py+cell/2>limit||py+cell/2>height)continue;
   const shape=new THREE.Shape();shape.moveTo(px,py-cell*.44);shape.lineTo(px+cell*.44,py);shape.lineTo(px,py+cell*.44);shape.lineTo(px-cell*.44,py);shape.closePath();
   // Two faces keep geometric panes visible from either side of the glass.
   for(const offset of [-.018,.018])add(q,'stained-glass-pane',new THREE.ShapeGeometry(shape),0,y,offset,'pane'+((row+col*2)%5));
  }
 }
 function gable(x,z,width,depth,y,rise){
  for(const side of [-1,1]){const m=core('gable-roof',x+side*width/4,y+rise/2,z,Math.hypot(width/2,rise),.22,depth,'roof');m.rotation.z=-side*Math.atan2(rise,width/2)}
  const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(0,rise);shape.lineTo(width/2,0);shape.closePath();
  for(const side of [-1,1])add(model,'gable-end',new THREE.ShapeGeometry(shape),x,y,z+side*depth/2,'brick');
 }
 // Continuous floor is separate from roofs/walls in the walking raycast.
 for(const [x,z,sx,sz] of [[0,(front+back)/2,nw,front-back],[0,crossZ,w,crossD],[0,front+2.3,9,5]]){
  const floor=core('interior-floor',x,base/2,z,sx,base,sz,'floor');floor.userData.walkable=true;walkSurfaces.push(floor);
 }
 // Side aisles and the open transept. Windows are recessed above the low solid wall.
 const runs=[[back,crossZ-crossD/2],[crossZ+crossD/2,front]];
 for(const side of [-1,1]){
  for(const [a,b] of runs){
   core('aisle-wall-base',side*nw/2,1,(a+b)/2,wall,2,b-a,'brick',true);
   core('aisle-wall-head',side*nw/2,8.25,(a+b)/2,wall,1.5,b-a,'brick');
   const count=Math.max(1,Math.round((b-a)/5.7)),bay=(b-a)/count;
   for(let i=0;i<count;i++){
    const z=a+(i+.5)*bay,opening=2.2;
    for(const sign of [-1,1])core('window-pier',side*nw/2,4.8,z+sign*(opening/2+(bay-opening)/4),wall,5.6,(bay-opening)/2,'brick');
    windowAt(side*(nw/2+.015),2,z,opening,5.5,Math.PI/2);
   }
   for(let i=0;i<=count;i++){
    const z=a+i*bay;core('buttress',side*(nw/2+.35),4.2,z,1.1,8.4,.65,'brick',true);
    fine('buttress-cap',side*(nw/2+.35),8.5,z,1.25,.3,.85,'trim');
   }
  }
  // Transept end and its two return walls leave the nave crossing open.
  core('transept-end',side*(w/2-wall/2),5,crossZ,wall,10,crossD,'brick',true);
  for(const sign of [-1,1])core('transept-return',side*(nw+w)/4,5,crossZ+sign*crossD/2,(w-nw)/2,10,wall,'brick',true);
  windowAt(side*(w/2+.015),3,crossZ,3,6,Math.PI/2);
  // Upper nave walls and paired clerestory windows.
  core('clerestory',side*cw/2,14,(front+back)/2,wall,6,front-back,'brick');
  for(let z=back+4;z<front-1;z+=5.8)for(const face of [-1,1])windowAt(side*(cw/2+face*.30),12,z,1.65,3.8,Math.PI/2);
  // Lean-to aisle roof; a thin sloped slab avoids filling the interior.
  const run=(nw-cw)/2+.6,slope=Math.atan2(2.3,run),roof=core('aisle-roof',side*(nw+cw)/4,10.25,(front+back)/2,Math.hypot(run,2.3),.22,front-back+.8,'roof');roof.rotation.z=-side*slope;
  const ceiling=core('aisle-ceiling',side*(nw+cw)/4,10.05,(front+back)/2,Math.hypot(run,2.3),.10,front-back+.8,'plaster');ceiling.rotation.z=-side*slope;
 }
 core('rear-wall',0,4.5,back,nw,9,wall,'brick',true);
 core('rear-upper-wall',0,13,back,cw,8,wall,'brick');
 for(const face of [-1,1])windowAt(0,5,back+face*.30,3.6,8,0);
 // Front wall: a 3.2 m clear doorway, not a door painted on a solid box.
 for(const side of [-1,1])core('front-wall',side*(nw+3.2)/4,4.5,front,(nw-3.2)/2,9,wall,'brick',true);
 core('front-lintel',0,7,front,3.2,4,wall,'brick');
 core('front-upper-wall',0,13,front,cw,8,wall,'brick');
 for(const side of [-1,1])windowAt(side*nw*.36,2.5,front+.30,2,4.8);
 gable(0,(front+back)/2,cw+1,front-back+1,eave,6);
 // Transept roof is a pitched slab pair; it meets, rather than fills, the central nave.
 for(const side of [-1,1])for(const sign of [-1,1]){
  const roof=core('transept-roof',side*(w+cw)/4,11.2,crossZ+sign*crossD/4,(w-cw)/2+.8,.24,Math.hypot(crossD/2,3),'roof');roof.rotation.x=sign*Math.atan2(3,crossD/2);
  const ceiling=core('transept-ceiling',side*(w+cw)/4,11,crossZ+sign*crossD/4,(w-cw)/2+.8,.1,Math.hypot(crossD/2,3),'plaster');ceiling.rotation.x=roof.rotation.x;
 }
 const endGable=new THREE.Shape();endGable.moveTo(-crossD/2,0);endGable.lineTo(0,3);endGable.lineTo(crossD/2,0);endGable.closePath();
 for(const side of [-1,1])add(model,'transept-gable',new THREE.ShapeGeometry(endGable),side*w/2,9.7,crossZ,'brick',Math.PI/2);
 // Open tower porch with layered portal, octagonal stair turrets, belfry and spire.
 const tz=front+1,tw=8.6,td=7;
 for(const side of [-1,1]){
  core('tower-side',side*(tw-wall)/2,15.5,tz,wall,31,td,'brick',true);
  core('portal-jamb',side*(tw+3.2)/4,2.5,tz+td/2,(tw-3.2)/2,5,wall,'brick',true);
 }
 core('tower-front-upper',0,18,tz+td/2,tw,26,wall,'brick');
 core('tower-rear-upper',0,18,tz-td/2,tw,26,wall,'brick');
 for(let i=0;i<3;i++)arch(close,'portal-moulding',0,0,tz+td/2+.15+i*.16,3.2+i*.35,3.4,1.6,.12,'trim');
 for(const side of [-1,1]){
  const door=fine('open-door-leaf',side*1.85,2,tz+td/2-.8,.14,4,1.65,'wood');blocks.push({x:door.position.x,z:door.position.z,hw:.1,hd:.85});
  const tx=side*6.4;
  add(model,'octagonal-stair-turret',new THREE.CylinderGeometry(1.25,1.35,14,8),tx,7,front,'brick');
  add(model,'turret-cap',new THREE.ConeGeometry(1.7,3.4,8),tx,15.7,front,'roof');blocks.push({x:tx,z:front,hw:1.35,hd:1.35});
  for(const level of [10,23])windowAt(side*2.05,level,tz+td/2+.30,2,5.4);
 }
 for(const y of [7,19,30.8])core('tower-stringcourse',0,y,tz,tw+.5,.32,td+.45,'trim');
 add(model,'spire',new THREE.ConeGeometry(6.05,13,4),0,37.5,tz,'roof',Math.PI/4);
 core('spire-cross',0,44.7,tz,.16,1.8,.16,'gold');core('spire-cross-arm',0,45,tz,.95,.15,.16,'gold');
 // Nave arcade: compound piers and pointed arches dividing three aisles.
 const pierZ=[back+3,-20,-14,-8,-2,4,10,16,22].filter(z=>z<front-1);
 for(const side of [-1,1]){
  for(const z of pierZ){
   core('arcade-pier',side*cw/2,4.25,z,.85,8.5,.85,'trim',true);
   for(const dx of [-.27,.27])add(close,'clustered-column',new THREE.CylinderGeometry(.13,.15,8.5,8),side*cw/2+dx,4.25,z+.4,'brick');
   fine('column-capital',side*cw/2,8.4,z,1.18,.28,1.18,'trim');
  }
  for(let i=1;i<pierZ.length;i++){const a=pierZ[i-1],b=pierZ[i];arch(model,'nave-arcade',side*cw/2,0,(a+b)/2,b-a-.85,8.2,3.1,.34,'trim',Math.PI/2)}
 }
 // Pointed barrel vault and transverse ribs. Ornament is geometric, without modern iconography.
 const profile=archPoints(cw-.5,spring,apex-spring),vertices=[];
 for(let i=1;i<profile.length;i++){
  const a=profile[i-1],b=profile[i];vertices.push(a.x,a.y-h/2,back+.4,b.x,b.y-h/2,back+.4,b.x,b.y-h/2,front-.4,a.x,a.y-h/2,back+.4,b.x,b.y-h/2,front-.4,a.x,a.y-h/2,front-.4);
 }
 const vault=new THREE.BufferGeometry();vault.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));vault.computeVertexNormals();add(model,'vault',vault,0,h/2,0,'plaster');
 for(const z of pierZ)arch(close,'vault-rib',0,0,z,cw-.5,spring,apex-spring,.16,'trim');
 for(let i=1;i<pierZ.length;i++)for(const side of [-1,1]){
  const a=pierZ[i-1],b=pierZ[i],curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*(cw-.5)/2,spring-h/2,a),new THREE.Vector3(0,apex-h/2,(a+b)/2),new THREE.Vector3(-side*(cw-.5)/2,spring-h/2,b)]);
  add(close,'diagonal-vault-rib',new THREE.TubeGeometry(curve,20,.095,6,false),0,h/2,0,'trim');
 }
 // Suggested furnishings leave central/side aisles and transept open.
 for(let z=front-7;z>crossZ+crossD/2+1;z-=2.1)for(const side of [-1,1]){
  const x=side*2.8;fine('pew-seat',x,.5,z,2.6,.16,.68,'wood');fine('pew-back',x,.95,z+.28,2.6,.95,.13,'wood');
  for(const dx of [-1,1])fine('pew-leg',x+dx,.24,z,.12,.48,.5,'wood');
  blocks.push({x,z,hw:1.3,hd:.43});
  seats.push({id:`pew-${seats.length}`,x,z,y:.58});
 }
 const altarZ=back+3.5;
 fine('altar-table',0,1.15,altarZ,3.4,.3,1.1,'stone');fine('altar-base',0,.55,altarZ,2.7,1.1,.8,'stone');blocks.push({x:0,z:altarZ,hw:1.7,hd:.6});
 fine('altar-cross',0,3.7,altarZ-.4,.12,2,.12,'gold');fine('altar-cross-arm',0,4,altarZ-.4,.95,.12,.12,'gold');
 // An understated, interpretive tiled aisle, drawn only at close range.
 for(let row=0;back+1+row*.55<front;row++)for(let col=0;col<4;col++)if((row+col)%2===0)
  fine('aisle-tile',-.825+col*.55,base+.008,back+1+row*.55,.54,.012,.54,'stone');
 function batch(group,label){
  const buckets=new Map(),v=new THREE.Vector3();group.updateMatrixWorld(true);
  group.traverse(m=>{if(!m.isMesh||walkSurfaces.includes(m))return;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=g.attributes.position;if(!buckets.has(m.material))buckets.set(m.material,[]);const values=buckets.get(m.material);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);values.push(v.x,v.y,v.z)}if(g!==m.geometry)g.dispose();m.geometry.dispose()});
  group.clear();const meshes=[];for(const [mat,values] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));g.computeVertexNormals();const m=new THREE.Mesh(g,mat);m.name=label;group.add(m);meshes.push(m)}return meshes;
 }
 // Camera clipping tests the unmerged shell parts kept in a hidden group: each has its own bounding sphere, so the
 // boom ray checks a few walls rather than every triangle of the merged shell. Floors stay dedicated walking targets.
 const clip=new THREE.Group();clip.name='cathedral-camera-clip';clip.visible=false;
 model.traverse(m=>{if(!m.isMesh||walkSurfaces.includes(m))return;const c=new THREE.Mesh(m.geometry,m.material);c.position.copy(m.position);c.rotation.copy(m.rotation);clip.add(c)});
 batch(model,'cathedral-shell');model.add(...walkSurfaces,clip);batch(close,'cathedral-fine');model.add(close);const cameraShell=[clip];
 Object.assign(model.userData,{conceptual:true,kind:'cathedral',period:feature.temporal,parts,blockingRects:blocks,walkSurfaces,seats,closeDetail:close,closeDistance:260,cameraShell,
  // A short, slightly lowered orbit target keeps the preview at eye level within the map's pitch limit.
  interior:{entry:[0,front+td/2+2],view:[0,2.0,front-4],target:[0,1.65,front-7],bounds:[-nw/2,back,nw/2,front+td/2],estimated:true,
   // Floor-relative indoor volumes; separate nave, aisles, transept and enclosed entrance porch.
   volumes:[[-cw/2,0,back,cw/2,spring,front],[-nw/2,0,back,-cw/2,9,front],[cw/2,0,back,nw/2,9,front],[-w/2,0,crossZ-crossD/2,w/2,10,crossZ+crossD/2],[-tw/2,0,front,tw/2,6,tz+td/2]]},accessFront:Math.max(d/2,front+td/2+1),accessHeight:base});
 return model;
}
