"""Private historical visit: route, scene isolation and procession."""
import os,subprocess,tempfile,time,sys,json,base64
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18110','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18110/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda error: print('JS ERROR',error,flush=True));page.on('console',lambda msg: print('CONSOLE',msg.text,flush=True) if msg.type=='error' else None);page.goto('http://127.0.0.1:18110/events/agwanpacheon/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    page.evaluate("""async()=>{await seoul1907.walking.shop.whenReady;const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({name:'가마검사',password:'test-secret'})});await seoul1907.walking.shop.refresh();await seoul1907.historicalEvent.begin(true)}""")
    print('PANEL',page.locator('#historical-event-panel').inner_text(),flush=True)
    result=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent;return {active:e.active,points:e.path.length,milestones:e.milestones,visible:s.buildings.filter(b=>b.visible).map(b=>b.userData.feature.id),connected:s.walking.together.connected,trams:s.trams.group.visible,chairCount:e.chairs.length}}""")
    print(result,flush=True);assert result['active'] and result['points']>20 and result['chairCount']==2 and not result['trams'] and not result['connected'],result
    page.screenshot(path='/tmp/agwanpacheon-start.png')
    check=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,C=globalThis.ChannelTerrain;let wet=0,blocked=0,crossing=0;for(let i=1;i<e.path.length;i++){const a=e.path[i-1],b=e.path[i],steps=Math.ceil(a.distanceTo(b)/.5);for(let j=0;j<=steps;j++){const p=a.clone().lerp(b,j/steps),m=C.nearest(p.x,p.z,s.channel.path),y=s.firstPerson.groundAt(p.x,p.z);if(m.distance<m.width){crossing++;if(y<m.level+.15)wet++}if(s.walking.collision.hit(p.x,p.z,1.35))blocked++}}return {houses:e.neighborhood.visibleCount,wet,blocked,crossing}}""")
    print('SCENERY AND CROSSING',check,flush=True);assert check['houses']>80 and check['crossing']>0 and check['wet']==0 and check['blocked']==0,check
    result=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent;s.renderer.setAnimationLoop(null);for(let i=0;i<300;i++){e.regroup();e.update(.1)}await new Promise(r=>setTimeout(r,200));const reached=e.checkpoint;s.firstPerson.exit();e.update(.1);const paused=!e.active;await e.begin();const resumed=e.checkpoint===reached&&e.active;for(let i=0;i<10000&&e.active;i++){if(!e.arrival)e.regroup();e.update(.1);if(!window.middleShot&&e.distance>700){s.renderer.render(s.scene,s.camera);window.middleShot=s.renderer.domElement.toDataURL()}if(!window.arrivalShot&&e.arrival?.time>6){s.renderer.render(s.scene,s.camera);window.arrivalShot=s.renderer.domElement.toDataURL();window.arrivalText=document.getElementById('royal-arrival-bubble').textContent}if(i%50===0)await new Promise(r=>setTimeout(r,0))}await new Promise(r=>setTimeout(r,300));e.update(.1);await new Promise(r=>setTimeout(r,300));return {reached,paused,resumed,checkpoint:e.checkpoint,text:document.querySelector('#historical-event-panel').textContent,active:e.active}}""")
    for name in ['middle','arrival']:
     shot=page.evaluate(name+'Shot');Path('/tmp/agwanpacheon-'+name+'.png').write_bytes(base64.b64decode(shot.split(',')[1]))
    assert page.evaluate("seoul1907.historicalEvent.arrival.done && seoul1907.historicalEvent.guard.guards.length===4 && arrivalText.includes('폐하')")
    print('COMPLETE',result,flush=True);assert result['reached']>=1 and result['paused'] and result['resumed'] and result['checkpoint']==9 and '회상 완료가 계정에 기록' in result['text'],result
    # A clean browser profile sees the account's server layout; legacy import runs only for null.
    layout=page.evaluate("""async()=>{const slots=['horse_reins',...Array(9).fill(null)],csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);const r=await fetch('/api/player/action-bar/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({slots,revision:0})});return r.status}""")
    assert layout==200,layout
    second=browser.new_page();second.goto('http://127.0.0.1:18110/1907/');second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    second.evaluate("""async()=>{const s=seoul1907.walking.shop;await s.whenReady;const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({name:'가마검사',password:'test-secret'})});await s.refresh();s.showHud(true)}""")
    assert '말고삐' in second.locator('.action-slot').first.get_attribute('title')
    assert second.evaluate("localStorage.getItem('hanyang3d-actions:가마검사')") is None
    print('PASS CROSS-BROWSER ACTION BAR',flush=True)
    second.evaluate("""async()=>{const s=seoul1907;s.firstPerson.enter();window.returnPose={x:s.firstPerson.eye.x,z:s.firstPerson.eye.z};sessionStorage.setItem('test-return-pose',JSON.stringify(returnPose));await s.walking.startHistoricalVisit()}""")
    second.wait_for_url('**/events/agwanpacheon/');second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    second.get_by_role('button',name='1907년으로 돌아가기',exact=True).click();second.wait_for_url('**/1907/?returnFromAgwan=1');second.wait_for_function('window.seoul1907?.firstPerson.active',timeout=180000)
    assert second.evaluate("(()=>{const p=JSON.parse(sessionStorage.getItem('test-return-pose')),e=seoul1907.firstPerson.eye;return Math.hypot(p.x-e.x,p.z-e.z)<.1})()")
    print('PASS RETURN TO ORIGINAL POSITION',flush=True)
    second.evaluate("""async()=>{const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10),post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(b)});await post('/api/account/logout',{});await seoul1907.walking.shop.refresh();await post('/api/account/register',{name:'옛액션',password:'test-secret'});localStorage.setItem('hanyang3d-actions:옛액션',JSON.stringify(['fishing_rod',...Array(9).fill(null)]));await seoul1907.walking.shop.refresh()}""")
    second.wait_for_function("async()=>{const r=await(await fetch('/api/player/')).json();return r.action_bar?.[0]==='fishing_rod'}")
    print('PASS LEGACY ACTION MIGRATION',flush=True)
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
