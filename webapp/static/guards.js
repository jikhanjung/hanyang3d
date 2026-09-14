import * as THREE from 'three';

// Gate guards around 1750. Records name who guarded which gate (훈련도감 at 돈화문, 어영청 at 홍화문, a 수문장 in
// charge of opening and closing each palace gate), but not how many stood outside at once: the head counts here are
// display estimates. The officer wears the military dress (구군복: 전립 with a plume, blue 전복 over red-sleeved
// 동달이, sword); soldiers wear dark coats and 전립 and hold spears. Local +Z is the outer side of the gate.
const COLORS={skin:0xc5a17e,hat:0x1f1d1c,trousers:0xd9d2c0,boots:0x2a2522,officerCoat:0x3a5b8c,officerSleeve:0xa8342a,soldierCoat:0x2e3440,soldierSleeve:0x3b4250,belt:0x8e2f22,shaft:0x6b4a2e,metal:0xb9bec2,plume:0x2f7c7a};
function materials(){return Object.fromEntries(Object.entries(COLORS).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,roughness:k==='metal'?.4:1,metalness:k==='metal'?.6:0})]))}

function figure(parts,mats,x,z,y,{officer=false,yaw=0}={}){
 const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=yaw;
 const add=(geometry,material,px,py,pz)=>{const m=new THREE.Mesh(geometry,mats[material]);m.position.set(px,py,pz);group.add(m);return m};
 for(const side of [-1,1]){add(new THREE.BoxGeometry(.16,.72,.18),'trousers',side*.11,.5,0);add(new THREE.BoxGeometry(.18,.16,.28),'boots',side*.11,.08,.04)}
 const coat=officer?'officerCoat':'soldierCoat',sleeve=officer?'officerSleeve':'soldierSleeve';
 add(new THREE.CylinderGeometry(.2,.3,.78,8),coat,0,1.2,0);
 add(new THREE.BoxGeometry(.46,.07,.3),'belt',0,1.3,0);
 for(const side of [-1,1])add(new THREE.BoxGeometry(.12,.6,.14),sleeve,side*.28,1.25,0);
 add(new THREE.SphereGeometry(.13,10,8),'skin',0,1.73,0);
 // 전립: a wide round brim and a low domed crown.
 add(new THREE.CylinderGeometry(.3,.3,.03,14),'hat',0,1.83,0);
 add(new THREE.SphereGeometry(.14,10,6,0,Math.PI*2,0,Math.PI/2),'hat',0,1.84,0);
 if(officer){
  add(new THREE.ConeGeometry(.04,.26,6),'plume',0,2.05,-.03);
  const sword=add(new THREE.BoxGeometry(.05,.75,.06),'shaft',-.26,1.05,.12);sword.rotation.z=.35;
 }else{
  // Spear held upright at the right hand.
  add(new THREE.CylinderGeometry(.025,.025,2.5,6),'shaft',.34,1.25,.08);
  add(new THREE.ConeGeometry(.05,.24,6),'metal',.34,2.6,.08);
 }
 parts.push(group);return group;
}

// Guard posts per gate id: unit name, officer present, soldier count, and where they stand.
export const GUARD_POSTS={
 donhwamun:{unit:'훈련도감',officer:true,soldiers:4,kind:'palace'},
 honghwamun:{unit:'어영청',officer:true,soldiers:2,kind:'palace'},
 sungnyemun:{unit:'도성 문 파수',officer:false,soldiers:2,kind:'city'},
 heunginjimun:{unit:'도성 문 파수',officer:false,soldiers:2,kind:'city'},
 donuimun:{unit:'도성 문 파수',officer:false,soldiers:2,kind:'city'},
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
 }else{
  // One soldier either side of the passage mouth on the outer face.
  const half=(gateModel?.userData.doorWidth??w*.25)/2,front=d/2+1.2;
  for(let i=0;i<post.soldiers;i++)figure(figures,mats,(i%2?1:-1)*(half+.9),front,y);
 }
 for(const f of figures)model.add(f);
 model.userData={unit:post.unit,officer:post.officer,soldiers:post.soldiers,figures:figures.length,estimate:true};
 return model;
}
