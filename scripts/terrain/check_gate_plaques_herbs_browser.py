"""Shared gate inscriptions and padded herb picking, with reach/cooldown guards."""
import os, subprocess, time, json
from pathlib import Path
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2])
server=subprocess.Popen(['python3','-m','http.server','18109','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(.4)
 with sync_playwright() as p:
  browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
  page=browser.new_page(viewport={'width':1400,'height':800});page.goto('http://127.0.0.1:18109/')
  page.set_content('<script type="importmap">{"imports":{"three":"/webapp/static/vendor/three/three.module.js"}}</script><div id="scene"></div>')
  result=page.evaluate('''async()=>{const T=await import('three'),{createCityGate}=await import('/webapp/static/gate.js');
   const scene=new T.Scene();scene.background=new T.Color('#cccccc');scene.add(new T.HemisphereLight(0xffffff,0x777777,3));
   const ids=['gwanghwamun','sungnyemun','heunginjimun','donuimun','sukjeongmun'],results=[];
   for(const [j,year] of [1750,1907].entries()){
    const data=await (await fetch('/gis/buildings/'+year+'_landmarks.json')).json();
    for(const [i,id] of ids.entries()){const f=data.features.find(f=>(f.gate_identity??f.id)===id),[w,h,d]=f.symbol_size_m;
     const model=createCityGate({...f,id,outer_side:1},w,h,d),plaque=model.getObjectByName('gate-plaque');model.position.set((i-2)*52,h/2,j*50);scene.add(model);
     const arch=model.getObjectByName('stone-arch');model.updateMatrixWorld(true);
     results.push({year,id,...plaque.userData,finite:Number.isFinite(plaque.position.y),doors:model.userData.doors,arch:!!arch});
    }
   }
   const camera=new T.PerspectiveCamera(40,1400/800,.1,1000);camera.position.set(0,82,240);camera.lookAt(0,8,20);
   const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,800);document.body.append(renderer.domElement);renderer.render(scene,camera);
   return results;}''')
  assert len(result)==10 and all(r['finite'] and r['arch'] for r in result),result
  assert all(r['vertical']==(r['id']=='sungnyemun') for r in result)
  print('PASS PLAQUES',result,flush=True);page.screenshot(path='/tmp/gate-plaques.png')
  page.route('**/api/herbs',lambda route:route.fulfill(json={'cooldown_ms':300000,'message':'채집 성공'}))
  result=page.evaluate('''async()=>{const T=await import('three'),{createHerbs}=await import('/webapp/static/herbs.js');
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,1,.1,100);camera.position.set(0,102,4);camera.lookAt(0,101,.0);camera.updateMatrixWorld(true);
   const canvas=document.createElement('canvas');canvas.style.cssText='position:fixed;left:0;top:0;width:600px;height:600px';document.body.append(canvas);
   let clears=0,refreshes=0;const fp={active:true,eye:new T.Vector3(0,102,4),clearInput(){clears++}};
   const herbs=createHerbs({scene,camera,canvas,firstPerson:fp,shop:{state:{loggedIn:false},async refresh(){refreshes++}},dialogue:{},data:{herbs:{nodes:[{id:'test',pixel:[0,0],item:'herb'}]},items:{herb:{name:'약초'}}},source:()=>new T.Vector3(),groundAt:()=>101,collision:()=>null,era:1907});
   const target=new T.Vector3(0,101.4,0).project(camera),x=(target.x+1)*300+23,y=(1-target.y)*300;
   const event=type=>canvas.dispatchEvent(new PointerEvent(type,{clientX:x,clientY:y,button:2,pointerId:1,bubbles:true}));
   event('pointermove');const padded=canvas.style.cursor==='grab';event('pointerdown');event('pointerup');await new Promise(r=>setTimeout(r,150));event('pointermove');
   const hidden=canvas.style.cursor!=='grab'&&herbs.cooldowns.has('test');herbs.cooldowns.clear();fp.eye.z=6;event('pointermove');const beyondReach=canvas.style.cursor!=='grab';fp.eye.z=4;fp.active=false;event('pointermove');
   return {padded,hidden,beyondReach,inactive:canvas.style.cursor!=='grab',clears,refreshes};}''')
  assert all(result[k] for k in ['padded','hidden','beyondReach','inactive']),result
  assert result['clears']==result['refreshes']==1,result
  print('PASS HERBS',result,flush=True);browser.close()
finally:server.terminate();server.wait()
