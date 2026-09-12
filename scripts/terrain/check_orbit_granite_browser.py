"""Regress close orbit zoom, live terrain picking, granite and mountain labels."""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
        headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1440, 'height': 1080})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' and 'favicon' not in msg.text and '404' not in msg.text else None)
    page.goto('http://127.0.0.1:8000/gis/terrain/3d/', wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready || !document.getElementById("loading-retry").hidden', timeout=300000)
    assert page.evaluate('!!window.terrain3d?.ready'), page.locator('#error').inner_text()
    page.evaluate('terrain3d.renderer.setAnimationLoop(null);terrain3d.controls.enableDamping=false')
    labels = page.evaluate('''()=>{const t=terrain3d;t.updateBuildingNames();return {dots:t.labels.children.length,names:t.mountainNames.children.map(m=>m.userData.name)}}''')
    assert labels == {'dots': 5, 'names': ['남산', '인왕산', '북악산']}, labels
    page.locator('#anchors3d').uncheck()
    assert page.evaluate('terrain3d.mountainNames.visible && !terrain3d.labels.visible')

    def check_pick():
        result = page.evaluate('''async()=>{
          const T=await import('/webapp/static/vendor/three/three.module.js'),t=terrain3d;
          const meshes=t.historical.material.opacity>0?[t.terrain,t.historical]:[t.terrain];meshes.forEach(m=>m.updateMatrixWorld(true));
          let error=0,ms=0;
          for(const centre of [t.pedestrians.walkers[20].position,t.granite.patches[0].centre,t.granite.patches[1].centre]){
            const origin=centre.clone().add(new T.Vector3(50,1200,70)),direction=centre.clone().sub(origin).normalize(),ray=new T.Ray(origin,direction);
            const start=performance.now(),hit=t.cityWall.raycastGround(ray,t.historical.material.opacity>0);ms+=performance.now()-start;
            const expected=new T.Raycaster(origin,direction).intersectObjects(meshes,false)[0];
            if(!hit||!expected)throw Error('Missing terrain hit');error=Math.max(error,hit.distanceTo(expected.point));
          }
          return {error,pickingMs:ms};
        }''')
        assert result['error'] < .001, result
        print(result, flush=True)

    check_pick()
    zoom = page.evaluate('''()=>{
      const t=terrain3d,c=t.camera,o=t.controls,canvas=t.renderer.domElement,box=canvas.getBoundingClientRect(),results=[];
      for(const centre of [t.pedestrians.walkers[20].position,t.granite.patches[0].centre]){
        c.position.copy(centre).add({x:0,y:120,z:180});o.target.copy(c.position).lerp(centre,.15);o.update();
        const before=c.position.clone(),start=performance.now();
        for(let i=0;i<24;i++)canvas.dispatchEvent(new WheelEvent('wheel',{clientX:box.left+box.width/2,clientY:box.top+box.height/2,deltaY:-300,bubbles:true,cancelable:true}));
        const close=c.position.distanceTo(centre),near=c.near;
        results.push({close,near,moved:before.distanceTo(c.position),zoomMs:performance.now()-start});
      }
      return results;
    }''')
    for result in zoom:
        assert result['close'] < 25 and result['near'] < .3 and result['moved'] > 180, result
    print({'zoom': zoom}, flush=True)
    box = page.locator('#scene > canvas').bounding_box()
    before_pan = page.evaluate('terrain3d.camera.position.toArray()')
    page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    page.mouse.down(button='left')
    page.mouse.move(box['x']+box['width']/2+60,box['y']+box['height']/2,steps=3)
    page.mouse.up(button='left')
    after_pan = page.evaluate('terrain3d.camera.position.toArray()')
    assert sum((a-b)**2 for a,b in zip(before_pan,after_pan)) > .001

    page.locator('#height3d').select_option('2')
    check_pick()
    page.locator('#opacity3d').fill('0')
    check_pick()
    page.locator('#carve3d').uncheck()
    check_pick()
    page.locator('#carve3d').check()
    page.locator('#height3d').select_option('1')
    page.locator('#opacity3d').fill('90')
    page.locator('#granite-focus').click()
    page.evaluate('terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
    page.locator('#scene').screenshot(path='/tmp/hanyang-granite-inwang.png')
    enabled = page.locator('#scene').screenshot()
    page.locator('#granite3d').uncheck()
    page.evaluate('terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
    disabled = page.locator('#scene').screenshot()
    assert enabled != disabled and not page.evaluate('terrain3d.granite.enabled')
    page.locator('#granite3d').check()
    page.locator('#home3d').click()
    page.evaluate('terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)')
    page.locator('#scene').screenshot(path='/tmp/hanyang-mountain-names.png')
    saved = page.evaluate('({position:terrain3d.camera.position.toArray(),near:terrain3d.camera.near})')
    page.locator('#first-person3d').click()
    assert page.evaluate('terrain3d.firstPerson.active && terrain3d.camera.near===.08')
    page.keyboard.press('Escape')
    restored = page.evaluate('({position:terrain3d.camera.position.toArray(),near:terrain3d.camera.near})')
    assert max(abs(a-b) for a,b in zip(saved['position'],restored['position'])) < .001
    assert abs(saved['near']-restored['near']) < .001
    assert not errors, errors
    print('Passed: close zoom, live picking, granite toggle, mountain names, first-person restore', flush=True)
    browser.close()
