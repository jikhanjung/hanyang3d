from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 page.evaluate('terrain3d.renderer.setAnimationLoop(null)');saved=page.evaluate('terrain3d.camera.position.toArray()')
 page.locator('#first-person3d').click()
 assert page.evaluate('terrain3d.firstPerson.active&&!terrain3d.controls.enabled&&terrain3d.camera.near===.08&&Math.abs(terrain3d.camera.position.y-terrain3d.firstPerson.ground-1.65)<1e-6')
 assert page.locator('#first-person-map').is_visible() and page.locator('#first-person-compass').is_visible()
 before=page.evaluate('terrain3d.camera.position.toArray()');page.keyboard.down('w');page.evaluate('for(let i=0;i<120;i++)terrain3d.firstPerson.update(1/60)');page.keyboard.up('w')
 assert page.evaluate('Math.abs(Number(document.getElementById("walking-minimap").dataset.worldX)-terrain3d.camera.position.x)<1e-6')
 after=page.evaluate('terrain3d.camera.position.toArray()');distance=sum((after[i]-before[i])**2 for i in [0,2])**.5;assert 2.5<distance<3.1,distance
 box=page.locator('#scene > canvas').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
 bearing=page.locator('#compass-bearing').inner_text()
 before_angle=page.evaluate('terrain3d.camera.quaternion.toArray()');page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+100,y-20);page.mouse.up();assert page.evaluate('terrain3d.camera.quaternion.toArray()')!=before_angle
 assert page.locator('#compass-bearing').inner_text()!=bearing
 page.evaluate('terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)');page.screenshot(path='/tmp/hanyang-first-person.png')
 page.keyboard.press('Escape');assert not page.evaluate('terrain3d.firstPerson.active');assert page.evaluate('terrain3d.controls.enabled&&terrain3d.camera.near===10')
 assert not page.locator('#first-person-map').is_visible() and not page.locator('#first-person-compass').is_visible()
 restored=page.evaluate('terrain3d.camera.position.toArray()');assert max(abs(a-b) for a,b in zip(saved,restored))<1e-5
 # Compare with an independent ray intersection of the displayed geometry.
 # Comparing camera.y with firstPerson.ground alone cannot detect double scaling.
 def check_eye_height():
  result=page.evaluate("""async()=>{const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d,origin=t.camera.position.clone();origin.y=10000;const ray=new T.Raycaster(origin,new T.Vector3(0,-1,0)),meshes=[t.terrain,t.mapGround];if(t.roadLayer.visible)meshes.push(t.roadLayer);for(const mesh of meshes)mesh.updateMatrixWorld(true);const hits=ray.intersectObjects(meshes,false);if(!hits.length)throw Error('No visible ground beneath camera');return {scale:Number(document.getElementById('height3d').value),map:t.historical.material.opacity,eye:t.camera.position.y-hits[0].point.y}}""")
  assert abs(result['eye']-1.65)<.08,result
  print(result,flush=True)
 page.locator('#first-person3d').click()
 for scale in ['1','1.5','2','1']:
  page.locator('#height3d').select_option(scale);check_eye_height()
 page.locator('#height3d').select_option('2')
 page.locator('#opacity3d').fill('0');check_eye_height()
 page.locator('#carve3d').uncheck();check_eye_height()
 page.locator('#carve3d').check();check_eye_height()
 page.locator('#opacity3d').fill('90');check_eye_height()
 # Re-enter while height exaggeration is already enabled.
 page.keyboard.press('Escape');page.locator('#first-person3d').click();check_eye_height()
 page.locator('#home3d').click();assert not page.evaluate('terrain3d.firstPerson.active')
 assert not errors,errors
 print({'walk_metres_in_2_seconds':distance,'restored_orbit':True,'drag_look':True,'height_and_map_switch':True,'errors':errors},flush=True);b.close()
