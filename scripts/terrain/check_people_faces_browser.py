from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 result=page.evaluate('''()=>{const t=terrain3d,p=t.pedestrians;t.renderer.setAnimationLoop(null);const matrix=t.camera.matrix.clone(),v=t.camera.position.clone();let forward=Infinity;
 for(const name of ['pedestrian-hair','pedestrian-eye-0','pedestrian-eye-1','pedestrian-noses']){const mesh=p.group.getObjectByName(name);if(!mesh||mesh.count!==130)throw Error('Missing face detail: '+name);for(let i=0;i<130;i++){mesh.getMatrixAt(i,matrix);if(!matrix.elements.every(Number.isFinite))throw Error('Invalid face placement');if(name==='pedestrian-noses'){v.setFromMatrixPosition(matrix).sub(p.walkers[i].position);forward=Math.min(forward,v.x*Math.sin(p.walkers[i].yaw)+v.z*Math.cos(p.walkers[i].yaw))}}}
 const w=p.walkers[20],target=w.position.clone();target.y+=1.55;t.camera.position.copy(target);t.camera.position.x+=Math.sin(w.yaw)*2;t.camera.position.z+=Math.cos(w.yaw)*2;t.camera.position.y+=.25;t.camera.near=.05;t.camera.fov=50;t.camera.updateProjectionMatrix();t.camera.lookAt(target);t.updateBuildingNames();t.renderer.render(t.scene,t.camera);return {count:p.walkers.length,nose_forward_m:forward}}''')
 assert result['nose_forward_m']>.14,result
 costumes=page.evaluate('''()=>{const p=terrain3d.pedestrians,m=terrain3d.camera.matrix.clone(),counts={male:0,female:0};for(const [i,w] of p.walkers.entries()){counts[w.costume]++;for(const [name,visible] of [['pedestrian-chima',w.costume==='female'],['pedestrian-topknot',w.costume==='male'],['pedestrian-hair-bun',w.costume==='female']]){const mesh=p.group.getObjectByName(name);mesh.getMatrixAt(i,m);if(!m.elements.every(Number.isFinite)||(Math.abs(m.determinant())>1e-8)!==visible)throw Error('Incorrect costume '+name+' '+i)}}return counts}''')
 assert costumes=={'male':65,'female':65},costumes
 print(costumes,flush=True)
 page.locator('#scene').screenshot(path='/tmp/hanyang-pedestrian-face.png');assert not errors,errors
 page.evaluate('''()=>{const t=terrain3d,w=t.pedestrians.walkers[21],target=w.position.clone();target.y+=.9;t.camera.position.copy(target);t.camera.position.x+=Math.sin(w.yaw+.35)*2.7;t.camera.position.z+=Math.cos(w.yaw+.35)*2.7;t.camera.position.y+=.2;t.camera.lookAt(target);t.updateBuildingNames();t.renderer.render(t.scene,t.camera)}''')
 page.locator('#scene').screenshot(path='/tmp/hanyang-pedestrian-female.png')
 page.evaluate('''()=>{const t=terrain3d,w=t.pedestrians.walkers[20],target=w.position.clone();target.y+=.9;t.camera.position.copy(target);t.camera.position.x+=Math.sin(w.yaw+.35)*2.7;t.camera.position.z+=Math.cos(w.yaw+.35)*2.7;t.camera.position.y+=.2;t.camera.lookAt(target);t.updateBuildingNames();t.renderer.render(t.scene,t.camera)}''')
 page.locator('#scene').screenshot(path='/tmp/hanyang-pedestrian-male.png')
 assert not errors,errors
 print(result,flush=True);b.close()
