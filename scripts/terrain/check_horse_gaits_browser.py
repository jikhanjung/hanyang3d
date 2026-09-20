"""Shared horse: four-beat gallop, diagonal trot and Shift-controlled movement on flat ground."""
import os,subprocess,time,json
from pathlib import Path
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2])
server=subprocess.Popen(['python3','-m','http.server','18105','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(.4)
 with sync_playwright() as p:
  browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
  page=browser.new_page(viewport={'width':1400,'height':760});page.goto('http://127.0.0.1:18105/')
  page.set_content('<script type="importmap">{"imports":{"three":"/webapp/static/vendor/three/three.module.js"}}</script><body style="margin:0"></body>')
  result=page.evaluate('''async()=>{const T=await import('three'),{createHorse}=await import('/webapp/static/horse_dealer.js');
   const h=createHorse(),legs=['hind-left','hind-right','front-left','front-right'].map(n=>h.group.getObjectByName('horse-'+n)),rows=[];
   for(let i=0;i<560;i+=5){h.update(i,true,false,true);h.group.updateMatrixWorld(true);rows.push({time:i,feet:legs.map(l=>l.getObjectByName('horse-knee').localToWorld(new T.Vector3(0,-.425,0)).y),fore:legs.slice(2).map(l=>({bend:l.getObjectByName('horse-knee').rotation.x,reach:l.getObjectByName('horse-knee').localToWorld(new T.Vector3(0,-.425,0)).z-l.getWorldPosition(new T.Vector3()).z}))});}
   const low=Math.min(...rows.flatMap(r=>r.feet)),air=rows.filter(r=>r.feet.every(y=>y>.025)).length,contacts=legs.map((_,j)=>rows.filter(r=>r.feet[j]<.005).map(r=>r.time));
   h.update(0,true,true);const jump=legs.map(l=>[l.rotation.x,l.children[1].rotation.x]);h.update(432,true,true);const jumpStable=JSON.stringify(jump)===JSON.stringify(legs.map(l=>[l.rotation.x,l.children[1].rotation.x]));
   const scene=new T.Scene();scene.background=new T.Color('#dedbd3');scene.add(new T.HemisphereLight(0xffffff,0x74685a,3));const sun=new T.DirectionalLight(0xffffff,3);sun.position.set(6,8,5);scene.add(sun);
   const ground=new T.Mesh(new T.PlaneGeometry(15,8),new T.MeshStandardMaterial({color:0xc1b795}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
   for(let i=0;i<8;i++){const horse=createHorse();horse.update(i*70,true,false,true);horse.group.position.set((i%4-1.5)*3.5,0,(Math.floor(i/4)-.5)*3.6);horse.group.rotation.y=Math.PI/2;scene.add(horse.group);}
   const camera=new T.PerspectiveCamera(35,1400/760,.1,100);camera.position.set(0,8,14);camera.lookAt(0,.4,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,760);document.body.append(renderer.domElement);renderer.render(scene,camera);
   const extensions=[0,1].map(j=>rows.filter(r=>r.fore[j].bend<.30&&r.fore[j].reach>.43).length);
   return {extensions,low,air,contacts:contacts.map(a=>[a[0],a.at(-1),a.length]),jumpStable};}''')
  print(result,flush=True);assert result['low']>-.005,result;assert result['air']>10,result;assert result['jumpStable'];assert min(result['extensions'])>=8,result;assert all(c[2]>10 for c in result['contacts'])
  page.screenshot(path='/tmp/horse-gallop-phases.png')
  motion=browser.new_page();motion.goto('http://127.0.0.1:18105/')
  motion.set_content('<script type="importmap">{"imports":{"three":"/webapp/static/vendor/three/three.module.js"}}</script><div id="scene"></div><div id="walk-joystick"><div class="joystick-knob"></div></div><button id="walk-jump"></button>')
  result=motion.evaluate('''async()=>{const T=await import('three'),{createFirstPerson}=await import('/webapp/static/first_person.js'),{createHorse}=await import('/webapp/static/horse_dealer.js');
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(),canvas=document.createElement('canvas');document.body.append(canvas);
   const fp=createFirstPerson({scene,camera,renderer:{domElement:canvas},controls:{target:new T.Vector3(),enabled:true,update(){}},pedestrians:{routes:[{points:[new T.Vector3(),new T.Vector3(0,0,-10)]}]},shop:{state:{items:{reins:1}},showHud(){}},npcData:{items:{reins:{use:'mount'}}},walkProfile:{name:'test',readPosition:()=>null,savePosition(){}},navigation:{largeMapSource:{flatMap:{}},show(){},hide(){},update(){}},positionWorld:{},terrainGround:()=>0,getWalkables:()=>[]});
   fp.enter();fp.setMounted(true);const key=(type,code)=>canvas.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
   key('keydown','KeyW');const travel=()=>{const p=fp.eye;for(let i=0;i<10;i++)fp.update(.1);return p.distanceTo(fp.eye)};
   const trot=travel();key('keydown','ShiftLeft');const gallop=travel(),fast=fp.galloping;key('keyup','ShiftLeft');const released=travel(),slow=!fp.galloping;
   key('keydown','ShiftRight');const right=travel();key('keyup','ShiftRight');key('keyup','KeyW');const stopped=travel();fp.jump();fp.update(.1);const jumping=fp.air>0;fp.exit();
   const horse=createHorse(),front=horse.group.getObjectByName('horse-front-left'),rear=horse.group.getObjectByName('horse-hind-right');let diagonal=true,trotExtended=0;
   const feet=l=>l.getObjectByName('horse-knee').localToWorld(new T.Vector3(0,-.425,0));
   for(let t=0;t<720;t+=30){horse.update(t,true,false,false);horse.group.updateMatrixWorld(true);const a=feet(front),b=feet(rear);if(front.getObjectByName('horse-knee').rotation.x<.30&&a.z-front.getWorldPosition(new T.Vector3()).z>.27)trotExtended++;diagonal&&=Math.abs(a.y-b.y)<1e-6&&Math.abs((a.z-front.position.z)-(b.z-rear.position.z))<1e-6;}
   return {trot,gallop,released,right,stopped,fast,slow,jumping,diagonal,trotExtended};}''')
  print('CONTROLS',result,flush=True)
  for name,value in [('trot',12),('gallop',24),('released',12),('right',24),('stopped',0)]:assert abs(result[name]-value)<.001,result
  assert result['trotExtended']>=2,result
  assert all(result[k] for k in ['fast','slow','jumping','diagonal']),result
  browser.close()
finally:server.terminate();server.wait()
