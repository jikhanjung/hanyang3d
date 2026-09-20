"""HUD restoration, typing guard, touch escape and an actual nonempty PNG download."""
import os,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image
os.chdir(Path(__file__).resolve().parents[2])
server=subprocess.Popen(['python3','-m','http.server','18106','--bind','127.0.0.1'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 time.sleep(.4)
 with sync_playwright() as p:
  browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
  page=browser.new_page(viewport={'width':800,'height':600});page.goto('http://127.0.0.1:18106/')
  page.set_content('<script type="importmap">{"imports":{"three":"/webapp/static/vendor/three/three.module.js"}}</script><div id="scene"><div id="hud">HUD</div></div><div id="options"></div><input id="chat"><div id="closed" hidden>Closed</div>')
  page.evaluate('''async()=>{const T=await import('three'),{createScreenshotMode}=await import('/webapp/static/screenshot_mode.js');const scene=new T.Scene(),camera=new T.PerspectiveCamera(50,4/3,.1,100),renderer=new T.WebGLRenderer();renderer.setSize(800,600);document.getElementById('scene').append(renderer.domElement);camera.position.z=5;scene.background=new T.Color('#768caa');const cube=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({color:'red'}));scene.add(cube);const labels=new T.Group();labels.name='building-name-labels';scene.add(labels);window.labelStates=[];cube.onAfterRender=()=>labelStates.push(labels.visible);window.photo=createScreenshotMode({renderer,scene,camera,menu:document.getElementById('options'),era:1907});window.testLabels=labels;renderer.render(scene,camera)}''')
  page.keyboard.press('Alt+z');assert page.evaluate('photo.hidden')
  assert page.locator('#hud').evaluate("e=>getComputedStyle(e).visibility")=='hidden'
  assert page.locator('#options').evaluate("e=>getComputedStyle(e).visibility")=='hidden'
  assert page.evaluate('testLabels.visible && labelStates.at(-1)===false')
  with page.expect_download() as download:page.keyboard.press('Alt+p')
  download.value.save_as('/tmp/hanyang3d-photo.png')
  im=Image.open('/tmp/hanyang3d-photo.png');assert im.size==(800,600);assert len(im.getcolors(1000000))>1
  assert page.evaluate('photo.hidden && testLabels.visible')
  page.keyboard.press('Escape');assert not page.evaluate('photo.hidden')
  assert page.locator('#hud').is_visible();assert page.locator('#closed').is_hidden()
  page.locator('#chat').focus();page.keyboard.press('Alt+z');assert not page.evaluate('photo.hidden')
  page.locator('.scene-capture-canvas').focus();page.keyboard.press('Alt+z')
  page.evaluate("()=>{const c=document.querySelector('.scene-capture-canvas');for(const pointerId of [1,2])c.dispatchEvent(new PointerEvent('pointerdown',{pointerId,pointerType:'touch',bubbles:true}))}")
  assert not page.evaluate('photo.hidden')
  print('PASS HUD hide/restore, text-input guard, touch restore, label render suppression and 800x600 PNG')
  browser.close()
finally:server.terminate();server.wait()
