"""Sungnyemun plaque stays visible below the roof in both eras."""
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
  result=page.evaluate('''async()=>{const T=await import('three'),{createCityGate}=await import('/webapp/static/gate.js');const results=[];for(const year of [1750,1907]){const data=await(await fetch('/gis/buildings/'+year+'_landmarks.json')).json(),f=data.features.find(f=>(f.gate_identity??f.id)==='sungnyemun'),[w,h,d]=f.symbol_size_m,g=createCityGate({...f,id:'sungnyemun',outer_side:1},w,h,d);g.position.y=h/2;g.updateMatrixWorld(true);const plaque=g.getObjectByName('gate-plaque'),letters=plaque.children[1],ph=letters.geometry.parameters.height;const targets=[.35,.277,.20,0,-.277].map(y=>letters.localToWorld(new T.Vector3(0,ph*y,0)));const checks=[];for(const distance of [30,60])for(const y of [1.7,12]){const eye=new T.Vector3(0,y,d/2+distance);for(const target of targets){const ray=new T.Raycaster(eye,target.clone().sub(eye).normalize());checks.push(ray.intersectObject(g,true)[0]?.object===letters)}}results.push({year,checks});if(year===1907){const scene=new T.Scene();scene.background=new T.Color('#cbd4dc');scene.add(g,new T.HemisphereLight(0xffffff,0x888888,3));const camera=new T.PerspectiveCamera(40,1400/800,.1,1000);camera.position.set(0,8,65);camera.lookAt(0,13,0);const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,800);document.body.append(renderer.domElement);renderer.render(scene,camera)}}return results;}''')
  print(result,flush=True);page.screenshot(path='/tmp/sungnyemun-plaque.png')
  assert all(all(r['checks']) for r in result),result
  browser.close()
finally:server.terminate();server.wait()
