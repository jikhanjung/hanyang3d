import * as THREE from 'three';

// Gate guards around 1750. Records name who guarded which gate (훈련도감 at 돈화문, 어영청 at 홍화문, a 수문장 in
// charge of opening and closing each palace gate), but not how many stood outside at once: the head counts here are
// display estimates. The officer wears the military dress (구군복: 전립 with a plume, blue 전복 over red-sleeved
// 동달이, sword); soldiers wear dark coats and 전립 and hold spears. Palace gates face local +Z; city gates are
// guarded on the side outside the city (feature.outer_side).
const COLORS={keeperRobe:0xcfd2c8,skin:0xc5a17e,hat:0x1f1d1c,trousers:0xd9d2c0,boots:0x2a2522,officerCoat:0x3a5b8c,officerSleeve:0xa8342a,soldierCoat:0x2e3440,soldierSleeve:0x3b4250,belt:0x8e2f22,shaft:0x6b4a2e,metal:0xb9bec2,plume:0x2f7c7a};
export function materials(){return Object.fromEntries(Object.entries(COLORS).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,roughness:k==='metal'?.4:1,metalness:k==='metal'?.6:0})]))}

export function figure(parts,mats,x,z,y,{officer=false,keeper=false,spear=true,archer=false,yaw=0}={}){
 const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=yaw;
 // Role for NPC conversations: the keeper and gate officers talk at length, soldiers only greet.
 group.userData.role=keeper?'keeper':officer?'officer':'soldier';
 const add=(geometry,material,px,py,pz)=>{const m=new THREE.Mesh(geometry,mats[material]);m.position.set(px,py,pz);group.add(m);return m};
 for(const side of [-1,1]){add(new THREE.BoxGeometry(.16,.72,.18),'trousers',side*.11,.5,0);add(new THREE.BoxGeometry(.18,.16,.28),'boots',side*.11,.08,.04)}
 const coat=keeper?'keeperRobe':officer?'officerCoat':'soldierCoat',sleeve=keeper?'keeperRobe':officer?'officerSleeve':'soldierSleeve';
 add(new THREE.CylinderGeometry(.2,.3,.78,8),coat,0,1.2,0);
 add(new THREE.BoxGeometry(.46,.07,.3),'belt',0,1.3,0);
 for(const side of [-1,1])add(new THREE.BoxGeometry(.12,.6,.14),sleeve,side*.28,1.25,0);
 add(new THREE.SphereGeometry(.13,10,8),'skin',0,1.73,0);
 add(new THREE.CylinderGeometry(.3,.3,.03,14),'hat',0,1.83,0);
 // 전립 has a low domed crown; the keeper's 갓 (흑립) a tall straight one.
 if(keeper)add(new THREE.CylinderGeometry(.1,.12,.2,12),'hat',0,1.94,0);
 else add(new THREE.SphereGeometry(.14,10,6,0,Math.PI*2,0,Math.PI/2),'hat',0,1.84,0);
 if(keeper){
  // A long robe (도포) reaching below the knees instead of a short military coat.
  add(new THREE.CylinderGeometry(.24,.36,.6,10),'keeperRobe',0,.65,0);
 }else if(officer){
  add(new THREE.ConeGeometry(.04,.26,6),'plume',0,2.05,-.03);
  const sword=add(new THREE.BoxGeometry(.05,.75,.06),'shaft',-.26,1.05,.12);sword.rotation.z=.35;
 }else if(spear){
  // Spear held upright at the right hand.
  add(new THREE.CylinderGeometry(.025,.025,2.5,6),'shaft',.34,1.25,.08);
  add(new THREE.ConeGeometry(.05,.24,6),'metal',.34,2.6,.08);
 }
 if(archer){
  // A drawn bow held out in the left hand toward the target (local +z), the right hand at the string.
  const bow=add(new THREE.TorusGeometry(.62,.025,4,14,Math.PI*.8),'shaft',-.05,1.45,.55);bow.rotation.set(0,Math.PI/2,Math.PI*.6);
  add(new THREE.BoxGeometry(.1,.1,.55),sleeve,-.05,1.45,.3);
 }
 parts.push(group);return group;
}

// Guard posts per gate id: unit name, officer present, soldier count, and where they stand.
export const GUARD_POSTS={
 donhwamun:{unit:'훈련도감',officer:true,soldiers:4,kind:'palace'},
 honghwamun:{unit:'어영청',officer:true,soldiers:2,kind:'palace'},
 geumhomun:{unit:'금위영',officer:true,soldiers:2,kind:'palace'},
 heunghwamun:{unit:'경덕궁 궁문 파수',officer:true,soldiers:2,kind:'palace'},
 sungnyemun:{unit:'도성 문 파수',officer:false,soldiers:2,kind:'city'},
 heunginjimun:{unit:'도성 문 파수',officer:false,soldiers:2,kind:'city'},
 donuimun:{unit:'도성 문 파수',officer:false,soldiers:2,kind:'city'},
 // The ruined Gyeongbokgung had a palace keeper (궁감) from Yeongjo's reign; one stands at the Gwanghwamun base.
 gwanghwamun:{unit:'경복궁 궁감',officer:false,soldiers:0,keeper:true,kind:'keeper'},
};

export function createGuards(feature,w,h,d,gateModel){
 const post=GUARD_POSTS[feature.id];if(!post)return null;
 const mats=materials(),figures=[],y=-h/2;
 const model=new THREE.Group();model.name='gate-guards';
 if(post.kind==='palace'){
  // Pairs flank the central door in front of the stairs; the gate officer stands to one side, a step forward.
  const front=d/2+2.6;
  for(let i=0;i<post.soldiers;i++){const pair=Math.floor(i/2),side=i%2?1:-1;figure(figures,mats,side*(2.2+pair*1.5),front,y)}
  if(post.officer)figure(figures,mats,-(3.8+Math.ceil(post.soldiers/2)*1.5),front+1,y,{officer:true});
 }else if(post.kind==='keeper'){
  // The keeper rests by the pier between the west and middle arches, then walks in through the middle arch, looks
  // round the ruined grounds and comes back out. Local +z is the road side (south) of the Gwanghwamun base.
  const c=gateModel?.userData.centres??[-w*.27,0,w*.27],rest=[(c[0]+c[1])/2,d/2+1.2],mid=c[1]??0;
  const keeper=figure(figures,mats,rest[0],rest[1],y,{keeper:true});keeper.name='palace-keeper';
  const stops=[[...rest,5],[mid,d/2+4,0],[mid,-d/2-4,0],[mid-14,-d/2-28,4],[mid+12,-d/2-46,6],[mid+2,-d/2-20,0],[mid,-d/2-4,0],[mid,d/2+4,0]];
  // Precompute the timed route: walk at 1.1 m/s between stops, pausing where a stop asks for it.
  const route=[];let t=0;
  stops.forEach((s,i)=>{const n=stops[(i+1)%stops.length];if(s[2]){route.push({t0:t,t1:t+s[2],a:s,b:s});t+=s[2]}const len=Math.hypot(n[0]-s[0],n[1]-s[1]);route.push({t0:t,t1:t+len/1.1,a:s,b:n});t+=len/1.1});
  const loop=t;
  model.userData.route={stops,loop};
  // While the keeper talks to the viewer he stands still and turns toward them; his route clock is shifted by the
  // time spent talking, so he resumes where he stopped (this pause is local to this browser).
  const talk={active:false,since:0,offset:0,face:null};
  model.userData.keeperFigure=keeper;
  model.userData.talk=talk;
  // Pause bookkeeping uses the same clock as update() (server time while walking together), taken from the last frame.
  model.userData.startTalk=()=>{if(!talk.active){talk.active=true;talk.since=talk.lastTime??0}};
  model.userData.stopTalk=()=>{if(talk.active){talk.active=false;talk.offset+=(talk.lastTime??talk.since)-talk.since;talk.face=null}};
  model.userData.update=(time,groundAt)=>{
   talk.lastTime=time;
   if(talk.active){
    if(talk.face)keeper.rotation.y=Math.atan2(talk.face.x-keeper.position.x,talk.face.z-keeper.position.z);
    return;
   }
   const now=((time-talk.offset)/1000)%loop,leg=route.find(r=>now>=r.t0&&now<r.t1)??route[0],k=(now-leg.t0)/Math.max(1e-6,leg.t1-leg.t0);
   const x=leg.a[0]+(leg.b[0]-leg.a[0])*k,z=leg.a[1]+(leg.b[1]-leg.a[1])*k;
   keeper.position.set(x,groundAt?groundAt(x,z):y,z);
   // Pauses also need a deterministic heading for clients joining mid-route.
   const heading=leg.a!==leg.b?leg:route[(route.indexOf(leg)-1+route.length)%route.length];
   keeper.rotation.y=Math.atan2(heading.b[0]-heading.a[0],heading.b[1]-heading.a[1]);
  };
 }else{
  // One soldier either side of the passage mouth on the face outside the city, looking out along the road.
  const out=feature.outer_side??1,half=(gateModel?.userData.doorWidth??w*.25)/2,front=out*(d/2+1.2);
  for(let i=0;i<post.soldiers;i++)figure(figures,mats,(i%2?1:-1)*(half+.9),front,y,{yaw:out>0?0:Math.PI});
 }
 for(const f of figures)model.add(f);
 Object.assign(model.userData,{unit:post.unit,kind:post.kind,officer:post.officer,keeper:!!post.keeper,soldiers:post.soldiers,figures:figures.length,estimate:true});
 return model;
}
