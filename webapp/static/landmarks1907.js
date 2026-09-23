import * as THREE from 'three';
import {hipGableRoof,createThroneHall} from './throne_hall.js';
import {createCityGate} from './gate.js';
import {createPalaceGate,createGardenPavilion} from './palace.js';
import {createPagoda} from './pagoda.js';
import {createBookshop1907} from './bookshop1907.js';
import {createCathedral1907} from './cathedral1907.js';

// Project-authored, deliberately simplified period models. Dimensions are seed estimates.
// All models share the existing renderer convention: ground is local y = -h/2.
export function createLandmark1907(f,w,h,d){
 const kind=f.landmark_kind;
 if(kind==='bookshop')return createBookshop1907(f,w,h,d);
 if(f.id==='myeongdong-cathedral-1907')return createCathedral1907(f,w,h,d);
 if(f.display_model==='throne_hall')return createThroneHall(f,w,h,d);
 if(kind==='city_gate')return createCityGate({...f,id:f.gate_identity},w,h,d);
 if(kind==='palace_gate')return createPalaceGate(f,w,h,d);
 if(kind==='pagoda')return createPagoda(f,w,h,d);
 if(kind==='garden_pavilion')return createGardenPavilion(f,w,h,d);
 const group=new THREE.Group();group.name='landmark-1907-'+kind;
 const colors={stone:0xbdb6a5,wood:0x873b2d,door:0x583c30,roof:0x3e484c,trim:0x39716b,water:0x688d86,bank:0x939777,brick:0x965a44,glass:0x455d66,cream:0xd5c8ae,gold:0xb2934b};
 const mats=Object.fromEntries(Object.entries(colors).map(([k,color])=>[k,new THREE.MeshStandardMaterial({color,roughness:.9,side:THREE.DoubleSide})]));
 const parts=[];
 const add=(name,geo,x,y,z,mat,ry=0)=>{const m=new THREE.Mesh(geo,mats[mat]);m.name=name;m.position.set(x,y-h/2,z);m.rotation.y=ry;group.add(m);parts.push(name);return m};
 const box=(name,x,y,z,a,b,c,mat)=>add(name,new THREE.BoxGeometry(a,b,c),x,y,z,mat);
 const cylinder=(name,x,y,z,r1,r2,height,mat,n=16)=>add(name,new THREE.CylinderGeometry(r1,r2,height,n),x,y,z,mat);
 const roof=(x,y,z,a,b,rise,hip=.55)=>add('roof',hipGableRoof(a,b,rise,.45,hip),x,y,z,'roof');
 const post=(x,z,y,height,mat='wood')=>cylinder('column',x,y+height/2,z,.25,.3,height,mat,8);
 const cross=(x,y,z,size)=>{box('cross',x,y,z,.2,size,.2,'cream');box('cross',x,y+size*.15,z,size*.6,.2,.2,'cream')};
 const gable=(x,y,z,a,b,rise)=>{const shape=new THREE.Shape();shape.moveTo(-a/2,0);shape.lineTo(0,rise);shape.lineTo(a/2,0);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:b,bevelEnabled:false});return add('gable-roof',g,x,y,z-b/2,'roof')};
 const smallHall=(x,z,hw,hd,eave=5)=>{
  box('hall-base',x,.3,z,hw+1,.6,hd+1,'stone');box('hall-wall',x,eave/2+.5,z,hw,eave-1,hd,'cream');
  for(let i=0;i<=4;i++)for(const side of [-1,1])post(x+(i/4-.5)*hw,z+side*hd/2,.6,eave-.6);
  for(let i=0;i<4;i++)box('hall-door',x+(i/4-.375)*hw,eave*.43,z+hd/2+.06,hw/5,eave*.65,.15,'door');
  roof(x,eave,z,hw+2,hd+2,2.5);
 };
 if(kind==='ewha_school'){
  // Documented two-storey brick Main Hall; details are conceptual, not measured.
  const front=d*.4,eave=9.4;
  box('ewha-base',0,.35,0,w,.7,d,'stone');
  box('ewha-main-hall',0,5,0,w*.94,8.7,d*.8,'brick');
  for(const y of [.8,4.9,9.2])box('ewha-course',0,y,0,w*.97,.2,d*.83,'cream');
  roof(0,eave,0,w*1.03,d*.94,2.9,1);
  for(const side of [-1,1])for(const y of [2.9,7.1])for(let i=-4;i<=4;i++){
   if(side===1&&i===0&&y<4)continue;
   const x=i*w*.092,z=side*(front+.04);
   box('ewha-window-frame',x,y,z,1.65,2.5,.14,'cream');
   box('ewha-window',x,y,z+side*.09,1.35,2.22,.08,'glass');
   box('ewha-window-mullion',x,y,z+side*.14,.08,2.22,.08,'cream');
   box('ewha-window-transom',x,y,z+side*.14,1.35,.08,.08,'cream');
  }
  for(const side of [-1,1])for(const y of [2.9,7.1])for(const z of [-d*.23,0,d*.23]){
   box('ewha-side-frame',side*w*.472,y,z,.14,2.5,1.65,'cream');
   box('ewha-side-window',side*w*.476,y,z,.14,2.2,1.35,'glass');
  }
  box('ewha-door',0,2.2,front+.1,2.1,3,.18,'door');
  box('ewha-porch',0,.4,front+1.1,5,.8,2.6,'stone');
  for(const x of [-2.1,2.1])box('ewha-porch-column',x,2.6,front+2,.26,3.6,.26,'cream');
  gable(0,4.5,front+1,5.3,3.2,1.4);
  for(const x of [-w*.3,w*.3]){box('ewha-chimney',x,10.6,-d*.14,.75,3.1,.85,'brick');box('ewha-chimney-cap',x,12.2,-d*.14,1,.22,1.1,'cream')}
  group.userData.blockingRects=[{x:0,z:0,hw:w*.47,hd:d*.4}];
  group.userData.accessFront=front+2.4;group.userData.accessHeight=.8;
  group.userData.plan='circa-1900-two-storey-main-hall';
 }else if(kind==='paichai_school'){
  // 1887 main hall: a single storey, tiled hip roof and projecting central arcade.
  const eave=6.2,front=d*.38;
  box('school-base',0,.25,0,w,.5,d,'stone');
  box('school-brick-hall',0,3.35,0,w*.95,5.7,d*.76,'brick');
  for(const y of [.7,5.9,6.2])box('school-stone-course',0,y,0,w*.98,.22,d*.80,'cream');
  roof(0,eave,0,w*1.04,d*.9,2.7,1);
  const window=(x,z,side=0)=>{
   const a=add('school-window',new THREE.PlaneGeometry(1.3,2.75),x,2.8,z,'glass',side);
   const shape=new THREE.Shape();shape.absarc(0,0,.65,0,Math.PI,false);shape.closePath();
   add('school-window-arch',new THREE.ShapeGeometry(shape),x,4.175,z,'glass',side);
   if(!side){for(const dx of [-.78,.78])box('school-window-jamb',x+dx,2.8,z+.03,.18,2.85,.16,'cream');
    add('school-arch-trim',new THREE.TorusGeometry(.73,.09,5,18,Math.PI),x,4.175,z+.05,'cream');
    box('school-window-mullion',x,2.8,z+.04,.075,2.75,.1,'cream');box('school-window-transom',x,3.15,z+.04,1.3,.08,.1,'cream');
    box('school-window-sill',x,1.36,z+.04,1.8,.2,.3,'cream');}
  };
  for(const side of [-1,1])for(let i=0;i<3;i++)window(side*(w*.18+i*w*.105),front+.03);
  for(let i=0;i<7;i++)window((i-3)*w*.12,-front-.03,Math.PI);
  // Open central three-arch porch. The actual entrance door is recessed behind it.
  box('school-porch-floor',0,.35,front+.9,w*.25,.7,2.2,'stone');
  for(const x of [-w*.115,-w*.038,w*.038,w*.115])box('school-porch-pier',x,2.8,front+1.8,.35,4.9,.4,'cream');
  for(const x of [-w*.077,0,w*.077])add('school-porch-arch',new THREE.TorusGeometry(w*.038,.14,6,18,Math.PI),x,4.65,front+1.8,'cream');
  box('school-porch-cornice',0,6.1,front+1,w*.27,.4,2.8,'cream');
  const pediment=new THREE.Shape();pediment.moveTo(-w*.14,0);pediment.lineTo(0,1.7);pediment.lineTo(w*.14,0);pediment.closePath();
  add('school-pediment',new THREE.ExtrudeGeometry(pediment,{depth:.3,bevelEnabled:false}),0,6.3,front+2,'cream');
  add('school-pediment-roundel',new THREE.CircleGeometry(.38,16),0,6.95,front+2.32,'glass');
  box('school-door',0,2.2,front+.04,1.8,3.2,.12,'door');
  for(const x of [-w*.29,w*.29]){box('school-chimney',x,8.35,-d*.16,.8,2.8,.9,'brick');box('school-chimney-cap',x,9.8,-d*.16,1,.25,1.1,'cream')}
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext('2d');ctx.fillStyle='#292923';ctx.fillRect(0,0,768,160);ctx.fillStyle='#e4ca84';ctx.font='bold 115px serif';ctx.textAlign='center';ctx.fillText('堂學材培',384,122);
  const sign=box('school-name',0,5.85,front+2.23,4.1,.85,.14,'door');sign.material=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas)});
  group.userData.blockingRects=[{x:0,z:0,hw:w*.475,hd:d*.38}];
  group.userData.accessFront=front+2;group.userData.accessHeight=.7;
  group.userData.plan='1887-single-storey-main-hall';
 }else if(kind==='tram_depot'){
  // Long, open-sided shed and adjacent generating house, suggested by the 1899 photograph.
  const shedW=w*.64,shedD=d*.48,sx=-w*.15,sz=-d*.12;
  box('depot-yard',0,.08,0,w,.16,d,'bank');
  for(let i=0;i<=9;i++)for(const side of [-1,1])post(sx+(i/9-.5)*shedW,sz+side*shedD*.46,.16,5,'door');
  gable(sx,5.3,sz,shedW+2,shedD+2,2.3);
  box('shed-rear-wall',sx,2.5,sz-shedD*.47,shedW,4.7,.35,'cream');
  const px=w*.34,pz=-d*.1;
  box('powerhouse',px,3.2,pz,w*.25,6.4,d*.56,'brick');gable(px,6.4,pz,w*.28,d*.61,2.4);
  for(let i=0;i<3;i++)box('powerhouse-window',px+(i-1)*w*.06,3.4,pz+d*.285,2,2.8,.12,'glass');
  box('chimney-foot',w*.43,1.1,-d*.38,3.6,2.2,3.6,'brick');
  cylinder('powerhouse-chimney',w*.43,11.4,-d*.38,.8,1.35,20.5,'brick',12);
  cylinder('chimney-rim',w*.43,21.7,-d*.38,1.05,1.05,.55,'brick',12);
  for(const track of [-1,1])for(const side of [-1,1])box('yard-rail',sx+track*8+side*.5335,.2,d*.06,.07,.08,d*.83,'roof');
  for(const track of [-1,1])for(let i=0;i<20;i++)box('yard-sleeper',sx+track*8,.17,-d*.34+i*d*.04,1.85,.08,.18,'door');
  group.userData.plan='long-open-shed-powerhouse-chimney';group.userData.yardTracks=2;
 }else if(kind==='early_theatre'){
  box('theatre-base',0,.2,0,w,.4,d,'stone');box('timber-theatre',0,3.8,0,w*.86,7.2,d*.84,'cream');
  for(let i=0;i<=6;i++)box('timber-frame',(i/6-.5)*w*.86,3.8,d*.425,.22,7.2,.24,'door');
  for(const y of [.7,3.8,7.3])box('cross-beam',0,y,d*.43,w*.9,.25,.24,'door');
  for(let i=0;i<6;i++){
   const x=(i-2.5)*w*.143;
   box('upper-shutter',x,5.7,d*.43,w*.105,1.8,.2,'door');
   box('ground-door',x,1.8,d*.43,w*.105,2.4,.2,'door');
  }
  gable(0,7.5,0,w*.98,d*.96,3.2);box('entry-awning',0,3.1,d*.48,w*.38,.18,d*.15,'roof');
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#d7c5a0';ctx.fillRect(0,0,512,128);ctx.fillStyle='#342b20';ctx.font='bold 80px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('團成社',256,68);
  const sign=box('theatre-name',0,7,d*.445,w*.4,.9,.14,'door');sign.material=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas),roughness:1});
  group.userData.plan='estimated-two-storey-timber-performance-hall';
 }else if(kind==='sontag_hotel'){
  box('hotel-platform',0,.4,0,w,.8,d,'stone');
  box('grey-brick-hotel',0,5,-d*.05,w*.9,9.2,d*.73,'stone');
  for(const y of [.8,5,9.7])box('facade-course',0,y,-d*.05,w*.94,.24,d*.76,'cream');
  for(let floor=0;floor<2;floor++)for(let i=0;i<7;i++){
   const x=(i-3)*w*.123,y=2.7+floor*4.5,z=d*.323,r=w*.046;
   box('window',x,y,z,r*1.7,2.1,.16,'glass');
   add('arched-window-head',new THREE.CircleGeometry(r*.85,12,0,Math.PI),x,y+1.05,z+.09,'glass');
   for(const side of [-1,1])box('window-jamb',x+side*r,y,z+.13,.15,2.2,.2,'cream');
   const arch=new THREE.Shape();arch.absarc(0,0,r+.1,0,Math.PI,false);arch.lineTo(-r+.06,0);arch.absarc(0,0,r-.06,Math.PI,0,true);arch.closePath();
   add('arched-window-trim',new THREE.ExtrudeGeometry(arch,{depth:.16,bevelEnabled:false}),x,y+1.05,z+.1,'cream');
  }
  roof(0,10,0,w,d*.88,2.3,1);gable(0,10,0,w*.3,d*.9,2.8);
  box('entrance-door',0,2.2,d*.335,3,3,.2,'door');box('entry-balcony',0,5.05,d*.4,w*.24,.25,d*.17,'stone');
  for(const side of [-1,1]){post(side*w*.11,d*.45,.8,4.2,'cream');box('chimney',side*w*.28,11.4,-d*.13,.85,3.5,.85,'brick')}
  box('balcony-rail',0,6,d*.475,w*.24,.16,.12,'door');for(let i=0;i<9;i++)box('balcony-baluster',(i/8-.5)*w*.24,5.55,d*.475,.1,.9,.1,'door');
  for(let i=0;i<4;i++)box('hotel-step',0,.12+i*.1,d*.49-i*.4,4,.24+i*.2,.5,'stone');
  group.userData.plan='grey-brick-hotel-arched-windows-central-balcony';
 }else if(kind==='commemorative_pavilion'){
  box('terrace',0,.45,0,w*.86,.9,d*.72,'stone');
  // Open three-by-two-bay pavilion; the monument remains visible between posts.
  for(let i=0;i<=3;i++)for(let j=0;j<=2;j++)if(i===0||i===3||j===0||j===2)post((i/3-.5)*w*.65,(j/2-.5)*d*.5,.9,4.7);
  box('painted-beam',0,5.5,0,w*.74,.45,d*.6,'trim');roof(0,5.75,0,w*.94,d*.8,2.1);
  const turtle=add('turtle-base',new THREE.SphereGeometry(1,12,8),0,1.28,0,'stone');turtle.scale.set(1.5,.48,1.8);
  cylinder('stele-plinth',0,1.7,0,1,1.1,.4,'stone',8);
  box('memorial-stele',0,2.9,0,1.5,2.1,.55,'stone');roof(0,4,0,2.1,1.1,.65);
  for(const side of [-1,1])box('stone-gate-post',side*1.65,1.45,d*.43,.5,2.9,.5,'stone');
  box('manse-gate-lintel',0,2.85,d*.43,4.1,.55,.65,'stone');
  for(let i=0;i<3;i++)box('entry-step',0,.12+i*.12,d*.34-i*.45,3.1,.24+i*.24,.55,'stone');
  group.userData.plan='open-pavilion-stele-manse-gate';
 }else if(kind==='octagonal_bandstand'){
  const r=w*.39;
  cylinder('octagonal-terrace',0,.45,0,r+.6,r+.9,.9,'stone',8);
  for(let i=0;i<8;i++){
   const a=i*Math.PI/4,x=Math.sin(a)*r*.82,z=Math.cos(a)*r*.82;post(x,z,.9,4.4);
   const beam=box('octagonal-beam',Math.sin(a+Math.PI/8)*r*.76,5.25,Math.cos(a+Math.PI/8)*r*.76,r*.66,.45,.4,'trim');beam.rotation.y=a+Math.PI/8;
  }
  cylinder('octagonal-eaves',0,5.6,0,r*.91,r*1.23,.65,'roof',8);
  cylinder('octagonal-roof',0,6.7,0,.45,r*1.19,1.65,'roof',8);
  cylinder('finial',0,7.8,0,.08,.32,.65,'gold',8);
  for(let i=0;i<3;i++)box('entry-step',0,.12+i*.12,r+1-i*.5,2.8,.24+i*.24,.65,'stone');
  group.userData.sides=8;group.userData.plan='open-octagonal-bandstand';
 }else if(kind==='jeonggwanheon'){
  box('stone-platform',0,.35,0,w,.7,d,'stone');
  box('inner-grey-brick-hall',0,2.6,-d*.1,w*.63,3.8,d*.56,'stone');
  for(let i=0;i<=7;i++)for(const side of [-1,1])post((i/7-.5)*w*.88,side*d*.4,.7,4.5,'cream');
  for(let j=1;j<5;j++)for(const side of [-1,1])post(side*w*.44,(j/5-.5)*d*.8,.7,4.5,'cream');
  for(let i=0;i<7;i++){
   const x=(i/7-3/7)*w*.88;
   box('inner-window',x,2.8,d*.18,w*.065,2,.13,'glass');
   if(i!==3){box('veranda-railing',x,1.65,d*.4,w*.1,.15,.15,'gold');for(let k=-1;k<=1;k++)box('baluster',x+k*w*.03,1.25,d*.4,.08,.85,.08,'trim')}
  }
  roof(0,5.3,0,w,d,2.5);group.userData.bays=[7,5];group.userData.plan='inner-hall-open-veranda';
 }else if(kind==='dondeokjeon'){
  box('platform',0,.35,0,w,.7,d,'stone');
  box('guest-hall',0,5.3,-d*.06,w*.84,9.6,d*.7,'brick');
  for(const y of [.9,5.3,10.1])box('stone-belt',0,y,-d*.06,w*.88,.35,d*.74,'stone');
  for(let floor=0;floor<2;floor++)for(let i=0;i<7;i++)for(const side of [-1,1]){
   const x=(i-3)*w*.113,z=-d*.06+side*d*.357,y=2.8+floor*4.55;
   box('window-surround',x,y,z,w*.075,2.8,.24,'cream');box('blue-window-frame',x,y,z+side*.14,w*.058,2.5,.1,'trim');box('window',x,y,z+side*.2,w*.044,2.15,.08,'glass');
  }
  // Repeated open arches on both storeys of the front veranda.
  for(let floor=0;floor<2;floor++){
   const base=.7+floor*4.6;box('veranda-floor',0,base,d*.36,w*.9,.3,d*.2,'stone');
   for(let i=0;i<=7;i++)post((i/7-.5)*w*.86,d*.43,base,4.4,'stone');
   for(let i=0;i<7;i++){
    const radius=w*.86/14,shape=new THREE.Shape();shape.absarc(0,0,radius,0,Math.PI,false);shape.lineTo(-radius+.22,0);shape.absarc(0,0,radius-.22,Math.PI,0,true);shape.closePath();
    add('veranda-arch',new THREE.ExtrudeGeometry(shape,{depth:.25,bevelEnabled:false}),((i+.5)/7-.5)*w*.86,base+3.2,d*.43,'stone');
   }
  }
  roof(0,10.4,-d*.06,w*.94,d*.86,3.4,1);
  for(const side of [-1,1]){box('front-end-bay',side*w*.39,10.9,d*.29,w*.13,2,d*.28,'brick');gable(side*w*.39,11.9,d*.29,w*.18,d*.32,1.9)}
  group.userData.plan='two-storey-guest-hall-arched-veranda';
 }else if(kind==='bukmyo'){
  // Photo: raised main hall, three front bays, broad stair and side ranges.
  const hw=w*.4,hd=d*.32,hz=-d*.2;
  box('raised-stone-terrace',0,.95,hz,hw+3,1.9,hd+3,'stone');box('main-hall',0,4.3,hz,hw,4.8,hd,'door');
  for(let i=0;i<=3;i++)post((i/3-.5)*hw,hz+hd/2,1.9,4.9,'door');
  for(let i=0;i<3;i++){
   const x=(i-1)*hw/3;box('paper-door',x,4,hz+hd/2+.1,hw*.27,3.4,.16,'cream');
   for(let j=-1;j<=1;j++)box('door-lattice',x+j*hw*.075,4,hz+hd/2+.2,.09,3.4,.06,'door');
   for(const y of [3.1,4,4.9])box('door-lattice',x,y,hz+hd/2+.2,hw*.27,.09,.06,'door');
   box('transom',x,6.1,hz+hd/2+.14,hw*.27,.7,.15,'trim');
  }
  // Turn the gable end toward the court, as visible in the supplied photograph.
  const r=roof(0,6.9,hz,hd+3,hw+3,3.2,.6);r.rotation.y=Math.PI/2;
  for(let i=0;i<8;i++)box('broad-stair',0,.12+i*.12,hz+hd/2+6-i*.55,hw*.75,.24+i*.24,.6,'stone');
  for(const side of [-1,1]){smallHall(side*w*.36,d*.1,w*.16,d*.55,3.8);box('side-wall',side*w*.48,1.1,0,.65,2.2,d*.94,'brick')}
  box('rear-wall',0,1.1,-d*.48,w*.96,2.2,.65,'brick');
  for(const side of [-1,1])box('front-wall',side*(w*.25+1.7),1.1,d*.46,w*.5-3.4,2.2,.65,'brick');
  for(const side of [-1,1])post(side*2.9,d*.46,0,3.5,'door');roof(0,3.5,d*.46,8,4.5,1.3,.01);
  group.userData.plan='raised-three-bay-hall-side-ranges';group.userData.frontBays=3;
 }else if(kind==='shop_row'){
  // A streetscape estimate, not named individual historic businesses.
  const count=f.shop_units??10,bay=w/count;group.userData.shopUnits=count;
  for(let i=0;i<count;i++){
   const x=-w/2+(i+.5)*bay,two=(i+f.variant)%7===3,top=two?6.7:3.3+(i%3)*.25,depth=d*(.82+(i%3)*.06);
   box('shop-wall',x,top/2,0,bay-.25,top,depth,two?'brick':'cream');
   box('shop-open-front',x,1.45,depth/2+.05,bay*.79,2.65,.12,'door');
   for(const side of [-1,1])box('shop-front-post',x+side*bay*.42,1.7,depth/2+.15,.18,3.4,.22,'door');
   box('shop-counter',x,.65,depth/2+.4,bay*.7,.5,1,'wood');
   for(let j=0;j<3;j++)box('goods-bundle',x+(j-1)*bay*.2,1.02,depth/2+.4,bay*.14,.25,.5,j%2?'cream':'bank');
   if(two)for(const side of [-1,1]){box('upper-window',x+side*bay*.23,4.9,depth/2+.08,bay*.25,1.65,.15,'glass');box('window-lintel',x+side*bay*.23,5.8,depth/2+.12,bay*.29,.15,.22,'cream')}
   roof(x,top,0,bay+.35,depth+1.2,two?1.4:1.1,.01);
  }
  group.userData.plan='mixed-shop-frontages';
 }else if(kind==='government_compound'){
  // Street-facing outer ranges with an open gate and a court behind them.
  box('earth-court',0,.04,0,w,.08,d,'bank');
  const gateW=8,front=d*.42,wing=(w-gateW)/2;
  for(const sign of [-1,1]){
   const x=sign*(gateW/2+wing/2);box('outer-range',x,1.8,front,wing,3.6,d*.12,'cream');roof(x,3.6,front,wing+.7,d*.12+1.4,1.2,.01);
   const bays=Math.max(3,Math.floor(wing/3.5));for(let j=0;j<=bays;j++)box('range-post',x-wing/2+j*wing/bays,1.8,front+d*.06+.08,.18,3.6,.18,'door');
   for(let j=0;j<bays;j++)box('range-window',x-wing/2+(j+.5)*wing/bays,2,front+d*.06+.1,1.25,1.1,.1,'door');
   box('side-enclosure',sign*(w/2-.3),1.2,0,.6,2.4,d*.8,'cream');
   smallHall(sign*w*.36,-d*.02,w*.13,d*.42,3.4);
   post(sign*gateW*.42,front,0,4.4,'door');
  }
  roof(0,4.4,front,gateW+1.5,d*.15+1.6,1.6,.01);
  smallHall(0,-d*.24,w*.46,d*.23,5.5);
  if(f.variant%2===0)smallHall(-w*.2,-d*.42,w*.24,d*.1,3.6);
  // Collision follows solid ranges, halls and posts; the gate and courtyard remain open.
  group.userData.blockingRects=group.children.filter(m=>['outer-range','side-enclosure','hall-base','column'].includes(m.name)).map(m=>{
   const p=m.geometry.parameters;return {x:m.position.x,z:m.position.z,hw:(p.width??.6)/2,hd:(p.depth??.6)/2};
  });
  group.userData.walkSurfaces=group.children.filter(m=>m.name==='earth-court');
  group.userData.plan='street-range-gate-court-hall';group.userData.openGateWidth=gateW;
 }else if(kind==='electric_office'){
  box('office',0,4.5,0,w*.92,9,d*.88,'brick');
  for(const y of [.4,4.4,9])box('cornice',0,y,0,w,.4,d,'cream');
  for(let floor=0;floor<2;floor++)for(let i=0;i<6;i++)for(const side of [-1,1]){
   const x=(i-2.5)*w*.145,z=side*d*.445;box('window-frame',x,2.2+floor*4.3,z,2.2,2.8,.24,'cream');box('window',x,2.2+floor*4.3,z+side*.14,1.6,2.3,.12,'glass');
  }
  roof(0,9.3,0,w,d,1.7,1);box('clock-tower',w*.25,11.7,0,4.5,4.8,4.5,'cream');
  for(const side of [-1,1]){add('clock-face',new THREE.CircleGeometry(1.2,16),w*.25,12,side*2.27,'cream',side===1?0:Math.PI);box('clock-hand',w*.25,12.35,side*2.3,.1,.8,.06,'door');box('clock-hand',w*.25+.35,12,side*2.3,.8,.1,.06,'door')}
  cylinder('tower-cap',w*.25,14.7,0,.5,3,1.7,'roof',8);group.userData.plan='two-storey-office-clock-tower';
 }else if(kind==='sajik'){
  for(const x of [-w*.21,w*.21]){box('square-altar',x,.8,0,w*.27,1.6,d*.38,'stone');box('altar-earth',x,1.63,0,w*.25,.08,d*.35,'bank')}
  for(const side of [-1,1]){box('enclosure',side*w*.46,.8,0,1,1.6,d*.92,'stone');box('enclosure',0,.8,side*d*.46,w*.92,1.6,1,'stone')}
  for(const z of [-d*.46,d*.46]){for(const x of [-3,3])post(x,z,0,5.2);box('red-gate-beam',0,4.8,z,8,.35,.35,'wood');for(let i=-4;i<=4;i++)box('red-gate-spike',i*.7,5.2,z,.13,1.1,.13,'wood')}
  group.userData.squareAltars=2;
 }else if(kind==='munmyo'){
  // Front ritual court and rear educational court; subsidiary dimensions are estimates.
  smallHall(0,d*.2,w*.36,d*.18,7);smallHall(0,-d*.3,w*.45,d*.14,6);
  for(const side of [-1,1]){smallHall(side*w*.35,d*.18,w*.12,d*.42,3.5);smallHall(side*w*.32,-d*.25,w*.12,d*.26,3.5)}
  smallHall(0,d*.44,w*.22,d*.06,3.5);group.userData.plan='front-shrine-rear-school';
 }else if(kind==='dongmyo'){
  // Front/rear transverse halls joined by a longitudinal roof, with brick side walls.
  smallHall(0,-d*.23,w*.64,d*.23,6.5);smallHall(0,0,w*.58,d*.16,6);
  box('brick-connecting-hall',0,3,-d*.12,w*.3,6,d*.28,'brick');roof(0,6.5,-d*.12,w*.34,d*.3,2.5);
  for(const side of [-1,1])smallHall(side*w*.36,d*.25,w*.16,d*.22,3.5);
  smallHall(0,d*.43,w*.35,d*.09,4);group.userData.plan='joined-halls-brick-sides';
 }else if(kind==='small_shrine'){
  smallHall(0,-d*.15,w*.65,d*.35,5);smallHall(0,d*.35,w*.28,d*.13,3);
  for(const side of [-1,1])box('enclosure',side*w*.46,.8,0,.6,1.6,d,'stone');
 }else if(kind==='residence'){
  const [bx,bz]=f.bays??[5,3];box('terrace',0,.45,0,w,.9,d,'stone');
  box('hall',0,3.3,0,w-5,5,d-6,'cream');
  for(let i=0;i<=bx;i++)for(const side of [-1,1])post((i-bx/2)*(w-5)/bx,side*(d-6)/2,.9,5.6);
  for(let i=0;i<bx;i++)for(const side of [-1,1])box('lattice-panel',(i-(bx-1)/2)*(w-5)/bx,3.2,side*(d-6)/2,(w-5)/bx*.7,3,.12,'trim');
  box('beam',0,6.5,0,w-3,.5,d-4,'wood');roof(0,6.8,0,w,d,2.6);
  for(let i=0;i<4;i++)box('stairs',0,.15+i*.12,d/2+1-i*.45,5,.3+i*.24,.8,'stone');group.userData.bays=[bx,bz];
 }else if(kind==='hex_pavilion'){
  box('pond-bank',0,.12,0,w,.24,d,'bank');box('pond',0,.26,0,w-3,.08,d-3,'water');cylinder('island',0,.6,0,9,10,1,'stone',24);
  for(let tier=0;tier<2;tier++){
   const base=1+tier*4.5;cylinder('hex-floor',0,base,0,5,5,.4,'wood',6);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;post(Math.sin(a)*4.7,Math.cos(a)*4.7,base,3.7)}
   cylinder('hex-roof',0,base+4.5,0,1.2,7-tier*.6,2.4,'roof',6);
  }
  box('north-bridge',0,1.1,-d*.28,2,.4,d*.42,'wood');for(const side of [-1,1])box('bridge-rail',side*.9,1.8,-d*.28,.15,.25,d*.42,'wood');group.userData.roofTiers=2;group.userData.sides=6;
 }else if(kind==='library'){
  box('platform',0,.4,0,w,.8,d,'stone');box('library',0,4,0,20,7,14,'wood');
  for(const side of [-1,1])box('brick-gable-wall',side*10,4,0,.8,7,14,'stone');roof(0,7.7,0,24,18,3.5,.01);
  for(let i=-2;i<=2;i++)box('lattice-panel',i*3.5,3.6,7.1,2.5,4,.15,'trim');
  box('eastern-wing',17,3,0,10,5,12,'wood');roof(17,5.8,0,13,15,2.4);
  for(let tier=0;tier<2;tier++){cylinder('octagonal-pavilion',-17,2.5+tier*4,0,4,4,3,'wood',8);cylinder('pavilion-roof',-17,4.8+tier*4,0,1,5.5,2,'roof',8)}
 }else if(kind==='western_library'){
  box('platform',0,.5,0,w,1,d,'stone');box('brick-library',0,5.2,0,w-3,9,d-5,'brick');roof(0,9.8,0,w,d,2.7,1);
  for(let floor=0;floor<2;floor++)for(let i=-3;i<=3;i++)for(const side of [-1,1]){
   box('window-frame',i*3.4,3+floor*4.1,side*(d-5)/2,1.7,2.7,.2,'cream');box('window',i*3.4,3+floor*4.1,side*((d-5)/2+.13),1.3,2.3,.12,'glass');
  }
  box('upper-veranda',0,5.6,d*.44,w-2,.4,3,'stone');
  for(let i=-3;i<=3;i++)post(i*4,d*.48,.8,9,'cream');box('veranda-railing',0,6.6,d*.49,w-2,.25,.2,'cream');
  box('entry',0,2.2,d*.5,4,3,.4,'door');roof(0,4.5,d*.48,6,4,1.5);
 }else if(kind==='bell_pavilion'){
  box('platform',0,.4,0,w,.8,d,'stone');
  for(let i=0;i<=3;i++)for(let j=0;j<=2;j++)post((i-1.5)*(w-4)/3,(j-1)*(d-4)/2,.8,5.5);
  box('beam',0,6.3,0,w-2,.5,d-2,'trim');roof(0,6.6,0,w,d,3);
  cylinder('bronze-bell',0,3.6,0,1,1.4,2.8,'gold',16);
  group.userData.bays=[3,2];group.userData.roofTiers=1;
 }else if(kind==='gyeonghoeru'){
  box('pond-bank',0,.15,0,w,.3,d,'bank');box('pond',0,.32,0,w-5,.08,d-5,'water');
  const [px,pz]=f.pavilion_offset_m??[w*.24,d*.19];group.userData.anchorOffset=[px,pz];
  box('island',px,.6,pz,55,1.2,41,'stone');
  const start=px+27.5,end=w/2-2.4;box('bridge',(start+end)/2,1,pz,end-start+.1,.7,5,'stone');
  for(let i=0;i<3;i++){const top=.3+(i+1)*.35;box('pond-entry-step',w/2-(i+.5)*.8,top/2,pz,.82,top,5,'stone')}
  for(let i=0;i<=7;i++)for(let j=0;j<=5;j++){
   const x=px-21+i*6,z=pz-15+j*6;
   if(i===0||i===7||j===0||j===5)box('square-stone-column',x,3.3,z,.8,5.4,.8,'stone');
   else cylinder('round-stone-column',x,3.3,z,.5,.5,5.4,'stone');
   post(x,z,6,5.5);
  }
  box('upper-floor',px,6,pz,45,.6,33,'wood');
  for(const side of [-1,1]){box('balustrade',px,7,pz+side*16,45,.25,.25,'wood');box('balustrade',px+side*22,7,pz,.25,.25,32,'wood')}
  for(let i=0;i<=14;i++)for(const side of [-1,1])box('baluster',px-21+i*3,6.65,pz+side*16,.15,1,.15,'wood');
  box('painted-beam',px,11.5,pz,46,.5,34,'trim');roof(px,12,pz,52,40,5);
  group.userData.stoneColumns=48;
  const blocks=[],rect=(x0,x1,z0,z1)=>{if(x1>x0&&z1>z0)blocks.push({x:(x0+x1)/2,z:(z0+z1)/2,hw:(x1-x0)/2,hd:(z1-z0)/2})};
  rect(-w/2+2.5,px-27.5,-d/2+2.5,d/2-2.5);
  rect(px-27.5,w/2-2.5,-d/2+2.5,pz-20.5);rect(px-27.5,w/2-2.5,pz+20.5,d/2-2.5);
  rect(px+27.5,w/2-2.5,pz-20.5,pz-2.5);rect(px+27.5,w/2-2.5,pz+2.5,pz+20.5);
  for(const m of group.children.filter(m=>m.name.includes('stone-column')))blocks.push({x:m.position.x,z:m.position.z,hw:.5,hd:.5});
  Object.assign(group.userData,{blockingRects:blocks,walkSurfaces:group.children.filter(m=>['pond-bank','island','bridge','pond-entry-step'].includes(m.name)),accessYaw:Math.PI/2,accessOffset:[0,pz],accessFront:w/2,accessHeight:.3});
 }else if(kind==='shrine'){
  const count=f.shrine_chambers,bay=(w-12)/count,hz=-d*.28;group.userData.anchorOffset=[0,hz];
  box('terrace',0,.5,0,w,1,d,'stone');
  for(let i=0;i<count;i++){
   const x=(i-(count-1)/2)*bay,raised=f.raised_center&&i>=6&&i<10,top=raised?9:7;
   box('shrine-room',x,4,hz,bay-.12,6,9,'wood');box('shrine-door',x,3.6,hz+4.6,bay*.72,4.8,.18,'door');
   post(x-bay/2,hz+6,1,top-1);
  }
  if(f.raised_center){roof(0,9,hz,4*bay+.2,14,3,.01);for(const side of [-1,1])roof(side*5*bay,7,hz,6*bay+.2,14,2.4,.01)}else roof(0,7,hz,count*bay+.2,14,2.4,.01);
  for(const side of [-1,1]){box('wing',side*(w/2-3),2.9,hz+9,4,4,12,'wood');const r=roof(side*(w/2-3),5,hz+9,15,7,1.6,.01);r.rotation.y=Math.PI/2}
  for(let i=0;i<5;i++)box('steps',0,.1+i*.1,d/2+2-i*.4,9,.2+i*.2,.8,'stone');
  group.userData.chambers=count;
 }else if(kind==='altar'){
  for(let tier=0;tier<3;tier++){
   const r=w/2-tier*5,top=(tier+1)*1.1;cylinder('circular-terrace',0,top-.55,0,r,r,1.1,'stone',64);
   for(let i=0;i<48;i++){const a=i*Math.PI/24;if(Math.abs(Math.sin(a))<.14||Math.abs(Math.cos(a))<.14)continue;post(Math.sin(a)*(r-.5),Math.cos(a)*(r-.5),top,.85,'cream')}
  }
  // Each flight reaches its terrace top with risers below the walking step limit.
  for(let dir=0;dir<4;dir++)for(let tier=0;tier<3;tier++)for(let i=0;i<4;i++){
   const a=dir*Math.PI/2,r=w/2-tier*5+2.4-i*.8,top=tier*1.1+(i+1)*.275;
   box('altar-step',Math.sin(a)*r,top/2,Math.cos(a)*r,dir%2?.82:5,top,dir%2?5:.82,'stone');
  }
  group.userData.blockingRects=[];
  group.userData.accessFront=w/2+2.81;
  group.userData.walkSurfaces=group.children.filter(m=>['circular-terrace','altar-step'].includes(m.name));
  for(const m of group.userData.walkSurfaces){m.userData.walkable=true;m.userData.solidSupport=true;group.remove(m)}
 }else if(kind==='hwanggungu'){
  cylinder('octagonal-platform',0,.7,0,12,12,1.4,'stone',8);
  for(let tier=0;tier<3;tier++){
   const base=1.4+tier*5,r=8-tier*1.25;
   cylinder('octagonal-hall',0,base+1.7,0,r,r,3.4,'wood',8);
   for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/4,x=Math.sin(a)*r,z=Math.cos(a)*r;post(x,z,base,3.7);const m=box('lattice-panel',x*.98,base+1.7,z*.98,2,2,.15,'trim');m.rotation.y=a}
   cylinder('octagonal-roof',0,base+4.5,0,r*.24,r+2.4,2.8,'roof',8);
  }
  cylinder('finial',0,18,0,0,.5,2,'gold');
 }else if(kind==='geoncheonggung'){
  // Geoncheonggung (1873–1909): a residence built in the manner of a gentry house, unpainted, behind plain walls.
  // Western range Jangandang (the king's quarters), eastern range Gonnyeonghap (the queen's) with the projecting
  // Okhoru, and the Western-style Gwanmungak (1891) in the north-west as on the 1907 map. Layout is conceptual.
  const t=.8,wallH=3,gateX=f.gate_x??11,gateW=6,hw=w/2,hd=d/2,rects=[];
  const wall=(x,z,a,c)=>{box('compound-wall',x,wallH/2,z,a,wallH,c,'cream');box('wall-cap',x,wallH+.15,z,a+.3,.3,c+.5,'roof');rects.push({x,z,hw:a/2,hd:c/2})};
  wall(0,-hd,w,t);wall(-hw,0,t,d);wall(hw,0,t,d);
  const westRun=gateX-gateW/2+hw,eastRun=hw-(gateX+gateW/2);
  wall(-hw+westRun/2,hd,westRun,t);wall(hw-eastRun/2,hd,eastRun,t);
  // Inner wall between the two ranges, with an opening in the middle.
  wall(2,-hd+10,t,20);wall(2,hd-12,t,16);
  // Main gate: a plain roofed gateway.
  for(const side of [-1,1])post(gateX+side*gateW/2,hd,0,3.4,'door');box('gate-lintel',gateX,3.5,hd,gateW+1,.4,1,'door');roof(gateX,3.7,hd,gateW+2,3,1.2);
  const hall=(name,x,z,a,c,eave=4.2,floor=.7)=>{
   box(name+'-base',x,floor/2,z,a+1.2,floor,c+1.2,'stone');rects.push({x,z,hw:(a+1.2)/2,hd:(c+1.2)/2});
   box(name+'-wall',x,floor+eave/2,z,a-.6,eave,c-.6,'cream');
   const bays=Math.max(3,Math.round(a/3.2));for(let i=0;i<=bays;i++)for(const side of [-1,1])post(x+(i/bays-.5)*a,z+side*c/2,floor,eave,'door');
   for(let i=0;i<bays;i++)box(name+'-door',x+((i+.5)/bays-.5)*a,floor+eave*.45,z+c/2+.05,a/bays*.7,eave*.7,.12,'door');
   roof(x,floor+eave,z,a+2.4,c+2.4,2.4);
  };
  hall('jangandang',-18,-8,22,10);
  hall('gonnyeonghap',20,-10,18,9);
  hall('gonnyeonghap-wing',27,3,8,14);
  // Okhoru: a raised corner room at the south end of the queen's range.
  box('okhoru-base',27,.9,13,7.5,1.8,7.5,'stone');rects.push({x:27,z:13,hw:3.75,hd:3.75});
  for(const sx of [-1,1])for(const sz of [-1,1])post(27+sx*3,13+sz*3,1.8,3.6,'door');
  box('okhoru-room',27,3.6,13,5.4,3,5.4,'cream');roof(27,5.4,13,8.5,8.5,2.2);
  hall('boksudang',-20,20,12,7,3.6);
  // Gwanmungak: Western-style two storeys, brick and cream.
  box('gwanmungak',-31,4,-22,10,8,9,'brick');rects.push({x:-31,z:-22,hw:5,hd:4.5});
  for(const y of [2.5,6])for(let i=-1;i<=1;i++)box('gwanmungak-window',-31+i*3,y,-17.4,1.2,1.8,.1,'glass');
  roof(-31,8,-22,11,10,2.2,1);
  group.userData.blockingRects=rects;group.userData.gate=[gateX,hd];
 }else if(kind==='legation'){
  if(f.eventEntrance){
   // Interpretive entrance for the private arrival scene; an actual opening, not actors crossing a wall.
   const front=d*.275,half=w*.4,door=1.7;
   box('rear-wall',0,5,-front,w*.8,10,.5,'cream');
   for(const side of [-1,1]){
    box('side-wall',side*(half-.25),5,0,.5,10,d*.55,'cream');
    box('front-wall',side*(half+door)/2,5,front-.25,half-door,10,.5,'cream');
   }
   box('door-lintel',0,6.6,front-.25,door*2,6.8,.5,'cream');
   box('entrance-floor',0,.02,0,w*.8,.04,d*.55,'wood');
   for(const side of [-1,1])box('open-door-leaf',side*1.65,1.6,front-.8,.12,3.2,1.6,'door');
  }else box('main-masonry-hall',0,5,0,w*.8,10,d*.55,'cream');
  roof(0,10,0,w*.85,d*.62,3,1);
  box('side-wing',-w*.26,4,-d*.28,w*.28,8,d*.45,'cream');roof(-w*.26,8,-d*.28,w*.34,d*.5,2,1);
  const tx=w*.32,tz=d*.12;box('side-tower',tx,9,tz,7,18,7,'cream');roof(tx,18,tz,9,9,2,1);
  for(let floor=0;floor<2;floor++)for(let i=0;i<8;i++)for(const side of [-1,1]){
   const x=-w*.34+i*w*.68/7,z=side*(d*.275+.03);box('window-surround',x,3+floor*4.5,z,2.2,3.4,.18,'stone');
   for(const dx of [-.5,.5])box('paired-window',x+dx,3+floor*4.5,z+side*.12,.7,2.8,.1,'glass');
  }
  for(let floor=0;floor<3;floor++)box('tower-window',tx,3+floor*5,tz+3.55,2,3,.12,'glass');
  box('cornice',0,9.9,0,w*.83,.4,d*.59,'stone');
 }else if(kind==='cathedral'||kind==='church'){
  const cathedral=kind==='cathedral',naveW=w*.46,naveD=d*.85,eave=cathedral?17:8;
  box('nave',0,eave/2,0,naveW,eave,naveD,'brick');gable(0,eave,0,naveW+1,naveD+1,cathedral?7:4);
  box('transept',0,eave*.42,-d*.12,w,eave*.84,d*.22,'brick');const wing=new THREE.Group();
  const r=gable(0,eave*.84,0,d*.24,w+1,4);group.remove(r);wing.add(r);wing.rotation.y=Math.PI/2;wing.position.z=-d*.12;group.add(wing);
  const towerX=cathedral?0:-naveW*.6,towerZ=naveD/2-3,towerW=cathedral?9:5,towerH=cathedral?30:13;
  box('bell-tower',towerX,towerH/2,towerZ,towerW,towerH,towerW,'brick');
  cylinder('spire',towerX,towerH+(cathedral?6:2),towerZ,0,towerW*.75,cathedral?12:4,'roof',4).rotation.y=Math.PI/4;
  cross(towerX,towerH+(cathedral?13:5),towerZ,cathedral?2:1.2);
  box('entry',towerX,2.6,towerZ+towerW/2+.04,towerW*.5,5,.12,'door');
  for(const side of [-1,1])box('bell-opening',towerX+side*towerW*.18,towerH*.8,towerZ+towerW/2+.06,towerW*.22,towerH*.17,.15,'glass');
  add('round-window',new THREE.CircleGeometry(towerW*.18,24),towerX,towerH*.42,towerZ+towerW/2+.09,'glass');
  add('window-ring',new THREE.TorusGeometry(towerW*.18,.14,6,24),towerX,towerH*.42,towerZ+towerW/2+.15,'cream');
  for(let i=0;i<7;i++)for(const side of [-1,1]){
   const zz=-naveD/2+4+i*(naveD-8)/6;box('buttress',side*(naveW/2+.3),eave*.4,zz,.8,eave*.8,1,'cream');
   const shape=new THREE.Shape();shape.moveTo(-.8,0);shape.lineTo(-.8,4);shape.lineTo(0,5.4);shape.lineTo(.8,4);shape.lineTo(.8,0);shape.closePath();add('pointed-window',new THREE.ShapeGeometry(shape),side*(naveW/2+.03),eave*.25,zz+1.6,'glass',Math.PI/2);
  }
  group.userData.plan='pre-extension-cross';
  group.userData.blockingRects=[{x:0,z:0,hw:naveW/2+.7,hd:naveD/2},{x:0,z:-d*.12,hw:w/2,hd:d*.11},{x:towerX,z:towerZ,hw:towerW/2,hd:towerW/2}];
  group.userData.accessX=towerX;
 }else throw Error('Unknown 1907 landmark kind: '+kind);
 // Batch static geometry by material: one draw call per palette colour.
 const textured=group.children.filter(m=>m.isMesh&&m.material.map);
 for(const mesh of textured)group.remove(mesh);
 group.updateMatrixWorld(true);const buckets=new Map(),v=new THREE.Vector3();
 group.traverse(m=>{if(!m.isMesh)return;const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry,p=g.attributes.position;if(!buckets.has(m.material))buckets.set(m.material,[]);const data=buckets.get(m.material);for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld);data.push(v.x,v.y,v.z)}if(g!==m.geometry)g.dispose();m.geometry.dispose()});
 group.clear();for(const [mat,data] of buckets){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();group.add(new THREE.Mesh(g,mat))}
 // Object3D.add() with no arguments logs an error, so only add when there is something to add.
 if(textured.length)group.add(...textured);
 if(group.userData.walkSurfaces?.length)group.add(...group.userData.walkSurfaces);
 Object.assign(group.userData,{conceptual:true,kind,parts,period:f.temporal});return group;
}
