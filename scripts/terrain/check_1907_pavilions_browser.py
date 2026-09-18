"""Render new landmarks, exercise LOD/picking and check placement on PC/mobile."""
import json, os, subprocess, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
os.chdir(root)
ids=os.environ.get('HANYANG_TEST_BUILDINGS','gyeonggi-monument-1907,tapgol-palgakjeong-1907,dondeokjeon-1907,jeonggwanheon-1907,dongdaemun-depot-1907,dansungsa-1907,sontag-hotel-1907').split(',')
with tempfile.TemporaryDirectory(prefix='pavilion-check-') as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([str(root/'.venv/bin/python'),'manage.py','runserver','127.0.0.1:18090','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18090/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for mobile in [False,True]:
     context=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile)
     page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18090/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=120000)
     for id in ids:
      result=page.evaluate('''async id=>{
       const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id===id),THREE=await import('/webapp/static/vendor/three/three.module.js'),{updateLandmarkLod}=await import('/webapp/static/lod1907.js');
       if(!b)throw Error('Missing '+id);
       s.controls.target.copy(b.userData.hallPosition);s.camera.position.copy(b.userData.hallPosition).add(new THREE.Vector3(25,35,45));s.controls.update();
       for(let i=0;i<100;i++)s.controls.update();
       updateLandmarkLod(b,s.camera);const near=b.userData.lod.detail.visible;
       s.camera.position.copy(b.position).add(new THREE.Vector3(0,4000,0));updateLandmarkLod(b,s.camera);
       const far=b.userData.lod.proxy.visible&&b.userData.lod.proxy.children.length<=5;
       s.camera.position.copy(b.userData.hallPosition).add(new THREE.Vector3(25,35,45));s.controls.update();updateLandmarkLod(b,s.camera);
       for(let i=0;i<100;i++)s.controls.update();s.scene.updateMatrixWorld(true);s.renderer.render(s.scene,s.camera);
       const box=new THREE.Box3().setFromObject(b),overlap=s.buildings.filter(o=>o!==b&&new THREE.Box3().setFromObject(o).intersectsBox(box)).map(o=>o.userData.feature.id);
       const y=b.position.y;document.getElementById('opacity').value=0;document.getElementById('opacity').dispatchEvent(new Event('input'));const stable=y===b.position.y;
       document.getElementById('labels').hidden=true;document.getElementById('building-info').hidden=true;
       // Find an exposed triangle on the real model, then click its screen position.
       let hitPoint=null;const ray=new THREE.Raycaster();
       for(const mesh of b.userData.lod.detail.children){
        if(!mesh.isMesh)continue;const pos=mesh.geometry.attributes.position;
        for(let i=0;i<pos.count;i+=3){
         const center=new THREE.Vector3();for(let k=0;k<3;k++)center.add(new THREE.Vector3().fromBufferAttribute(pos,i+k));center.multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
         const ndc=center.clone().project(s.camera);if(Math.abs(ndc.x)>.8||Math.abs(ndc.y)>.65)continue;
         ray.setFromCamera(ndc,s.camera);const hit=ray.intersectObjects(s.buildings,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent}return true});
         if(hit){let o=hit.object;while(o&&o!==b)o=o.parent;if(o===b){hitPoint={x:(ndc.x+1)*innerWidth/2,y:(1-ndc.y)*innerHeight/2};break}}
        }if(hitPoint)break;
       }
       return {near,far,stable,overlap,hitPoint,parts:b.userData.parts.length};
      }''',id)
      assert result['near'] and result['far'] and result['stable'] and result['hitPoint'],(id,result)
      assert not result['overlap'],(id,result)
      point=result['hitPoint'];before=page.evaluate('seoul1907.camera.position.toArray()')
      if mobile:page.touchscreen.tap(point['x'],point['y'])
      else:page.mouse.click(point['x'],point['y'])
      page.locator('#building-info').wait_for(state='visible')
      assert page.locator('#building-info').get_attribute('data-kind')=='building'
      assert page.locator('#building-info a').count()>=2
      after=page.evaluate('seoul1907.camera.position.toArray()')
      assert max(abs(a-b) for a,b in zip(before,after))<1e-6,(id,before,after)
      page.locator('#building-info button').click()
      page.screenshot(path=f'/tmp/{id}-{mobile}.png')
      print(mobile,id,json.dumps(result),flush=True)
     assert not errors,errors
     context.close()
    browser.close()
  finally:
   server.terminate();server.wait(timeout=15)
