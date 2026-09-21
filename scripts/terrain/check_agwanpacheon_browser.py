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
    page.evaluate("""async()=>{await seoul1907.walking.shop.whenReady;const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);await fetch('/api/account/register',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({name:'가마검사',password:'test-secret'})});await seoul1907.walking.shop.refresh();await seoul1907.historicalEvent.begin(true);window.refused=document.querySelector('#historical-event-panel p').textContent;const r=await fetch('/api/events/agwanpacheon/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({action:'keepsake'})});window.keepsake=await r.json();await seoul1907.walking.shop.refresh();await seoul1907.historicalEvent.begin(true)}""")
    gate=page.evaluate("({refused,keepsake,owned:seoul1907.walking.shop.state.items.legation_keepsake})");print('KEEPSAKE',gate,flush=True)
    assert '꾸러미' in gate['refused'] and gate['keepsake']['received'] and gate['owned']==1,gate
    print('PANEL',page.locator('#historical-event-panel').inner_text(),flush=True)
    assert '꾸러미가 봉인된 밀서로' in page.locator('#historical-event-task').inner_text()
    result=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent;return {active:e.active,phase:e.phase,points:e.path.length,milestones:e.milestones,visible:s.buildings.filter(b=>b.visible).map(b=>b.userData.feature.id),connected:s.walking.together.connected,trams:s.trams.group.visible,chairCount:e.chairs.length,chairsShown:e.root.visible,contact:e.contacts.letter.p.group.visible,task:document.getElementById('historical-event-task').textContent}}""")
    quest=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent;e.update(.1);const c=e.contacts.letter.p.group.position,q=e.quest.sprite;return {shown:q.visible,above:q.position.y-c.y,offset:Math.hypot(q.position.x-c.x,q.position.z-c.z),mapMarks:s.walking.navigation.questMarkers.length,minimapDrawn:!!document.getElementById('walking-minimap')}}""")
    print('QUEST',quest,flush=True);assert quest['shown'] and 2<quest['above']<3 and quest['offset']<.01 and quest['mapMarks']==1,quest
    print(result,flush=True);assert result['active'] and result['phase']=='letter' and result['points']>20 and result['chairCount']==2 and not result['chairsShown'] and result['contact'] and '밀서' in result['task'] and not result['trams'] and not result['connected'],result
    page.screenshot(path='/tmp/agwanpacheon-start.png')
    # Stage dialogues: walk up to each contact, read through, and take the final option. Closing early must not advance.
    TALK="""async([who,expectPhase])=>{const s=seoul1907,e=s.historicalEvent,d=s.walking.dialogue,spot=e.spots[who];s.renderer.setAnimationLoop(null);
     s.firstPerson.placeAt(spot.x+1.5,spot.z+1.5,0);e.update(.1);if(!d.current)throw Error('dialogue did not open at '+who);
     const name=document.querySelector('#npc-dialog .npc-plate strong').textContent;d.end();e.update(.1);const reopened=!!d.current;
     await new Promise(r=>setTimeout(r,3100));e.update(.1);if(!d.current)throw Error('dialogue did not reopen after the pause');
     let steps=0;while(d.current&&steps++<8){d.finishTyping();const buttons=[...document.querySelectorAll('#npc-dialog .npc-options button')];buttons.at(-1).click();await new Promise(r=>setTimeout(r,30))}
     for(let i=0;i<20&&e.saving;i++)await new Promise(r=>setTimeout(r,100));
     return {name,reopened,phase:e.phase,checkpoint:e.checkpoint,expected:e.phase===expectPhase}}"""
    letter=page.evaluate(TALK,['letter','gate']);print('LETTER',letter,flush=True);assert letter['expected'] and not letter['reopened'] and letter['checkpoint']==1 and letter['name']=='정동의 연락책',letter
    # After the letter the mark moves to the gate contact, 1.3 km away: off the maps until the walker gets close.
    moved=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent;e.update(.1);const g=e.contacts.gate.p.group.position,q=e.quest.sprite;return {gate:q.visible&&Math.hypot(q.position.x-g.x,q.position.z-g.z)<.01,farMarks:s.walking.navigation.questMarkers.length}}""")
    assert moved['gate'] and moved['farMarks']==0,moved
    page.screenshot(path='/tmp/agwanpacheon-letter.png')
    gate=page.evaluate(TALK,['gate','procession']);print('GATE',gate,flush=True);assert gate['expected'] and gate['checkpoint']==3 and gate['name']=='영추문 밖 연락책',gate
    assert page.evaluate("seoul1907.historicalEvent.root.visible && !seoul1907.historicalEvent.contacts.gate.p.group.visible")
    saved=page.evaluate("""async()=>(await(await fetch('/api/events/agwanpacheon/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10)},body:JSON.stringify({action:'status'})})).json()).checkpoint""")
    assert saved==3,saved
    check=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,C=globalThis.ChannelTerrain;let wet=0,blocked=0,crossing=0;for(let i=1;i<e.path.length;i++){const a=e.path[i-1],b=e.path[i],steps=Math.ceil(a.distanceTo(b)/.5);for(let j=0;j<=steps;j++){const p=a.clone().lerp(b,j/steps),m=C.nearest(p.x,p.z,s.channel.path),y=s.firstPerson.groundAt(p.x,p.z);if(m.distance<m.width){crossing++;if(y<m.level+.15)wet++}if(s.walking.collision.hit(p.x,p.z,1.35))blocked++}}return {houses:e.neighborhood.visibleCount,wet,blocked,crossing}}""")
    print('SCENERY AND CROSSING',check,flush=True);assert check['houses']>80 and check['crossing']>0 and check['wet']==0 and check['blocked']==0,check
    # The invented patrol: scout ahead, spot the soldiers, run back and warn; the chairs leave the road and come back after.
    patrol=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,p=e.patrol,fp=s.firstPerson;s.renderer.setAnimationLoop(null);
     let i=0;for(;i<6000&&p.state==='pending';i++){e.regroup();e.update(.1)}
     const out={reached:p.state,after:i,soldiers:p.soldiers.length,visible:p.group.visible,spotOffRoad:Math.hypot(p.spot.x-e.chairs[0].group.position.x,p.spot.z-e.chairs[0].group.position.z)>4};
     const sp=p.soldiers[0].group.position;fp.placeAt(sp.x+20,sp.z,0);e.update(.1);out.seenFar=e.warnButton.hidden&&document.querySelector('#historical-event-panel p').textContent.includes('순찰');
     const lead=e.chairs[0].group.position;fp.placeAt(lead.x+4,lead.z+4,0);e.update(.1);out.button=!e.warnButton.hidden;e.warnButton.click();out.warned=p.state==='hiding'&&p.warned;
     let hid=0,maxOff=0;for(i=0;i<3000&&p.state!=='done';i++){e.update(.1);if(p.state==='hidden'){hid++;maxOff=Math.max(maxOff,Math.hypot(e.chairs[0].group.position.x-p.spot.x,e.chairs[0].group.position.z-p.spot.z));if(hid===20){const c=e.chairs[0].group.position,sp=p.soldiers[0].group.position,px=c.x+(sp.x-c.x)*.12,pz=c.z+(sp.z-c.z)*.12;fp.placeAt(px,pz,Math.atan2(-(c.x-px),-(c.z-pz)));e.update(.05);s.renderer.render(s.scene,s.camera);window.patrolShot=s.renderer.domElement.toDataURL()}}}
     out.hiddenFrames=hid;out.stayedAtSpot=maxOff<1;out.done=p.state==='done';out.gone=!p.group.visible;out.text=document.querySelector('#historical-event-panel p').textContent;return out}""")
    print('PATROL',patrol,flush=True);assert patrol['reached']=='approaching' and patrol['soldiers']==3 and patrol['visible'] and patrol['spotOffRoad'] and patrol['seenFar'] and patrol['button'] and patrol['warned'] and patrol['hiddenFrames']>30 and patrol['stayedAtSpot'] and patrol['done'] and patrol['gone'],patrol
    Path('/tmp/agwanpacheon-patrol.png').write_bytes(base64.b64decode(page.evaluate('patrolShot').split(',')[1]))
    assert patrol['hiddenFrames']<700,('hidden wait too long',patrol['hiddenFrames'])
    result=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent;s.renderer.setAnimationLoop(null);for(let i=0;i<300;i++){e.regroup();e.update(.1)}await new Promise(r=>setTimeout(r,200));const reached=e.checkpoint;s.firstPerson.exit();e.update(.1);const paused=!e.active;await e.begin();const resumed=e.checkpoint===reached&&e.active&&e.phase==='procession';for(let i=0;i<10000&&!(e.phase==='aftermath'&&e.arrival?.done);i++){if(!e.arrival)e.regroup();e.update(.1);if(!window.middleShot&&e.distance>700){s.renderer.render(s.scene,s.camera);window.middleShot=s.renderer.domElement.toDataURL()}if(!window.arrivalShot&&e.arrival?.time>6){s.renderer.render(s.scene,s.camera);window.arrivalShot=s.renderer.domElement.toDataURL();window.arrivalText=document.getElementById('royal-arrival-bubble').textContent}if(i%50===0)await new Promise(r=>setTimeout(r,0))}await new Promise(r=>setTimeout(r,300));e.update(.1);return {reached,paused,resumed,checkpoint:e.checkpoint,phase:e.phase,active:e.active}}""")
    for name in ['middle','arrival']:
     shot=page.evaluate(name+'Shot');Path('/tmp/agwanpacheon-'+name+'.png').write_bytes(base64.b64decode(shot.split(',')[1]))
    assert page.evaluate("seoul1907.historicalEvent.arrival.done && seoul1907.historicalEvent.guard.guards.length===4 && arrivalText.includes('폐하')")
    # Guards and the interpreter stand on the plinth top, never inside the foundation block.
    plinth=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,b=s.buildings.find(b=>b.userData.feature.id==='russian-legation-1907'),floor=b.userData.groundFloor;const feet=[...e.guard.guards.map(g=>g.group.position),e.arrival.host.group.position];return {floor,feet:feet.map(p=>+(p.y-floor).toFixed(2)),ground:feet.map(p=>+(s.firstPerson.groundAt(p.x,p.z)-floor).toFixed(2))}}""")
    # The two guards by the door and the interpreter stand on the plinth (0); the outer pair stand on the terrain beyond its edge.
    print('PLINTH',plinth,flush=True);assert all(f>=g-.1 for f,g in zip(plinth['feet'],plinth['ground'])) and [plinth['feet'][i] for i in (0,1,4)]==[0,0,0],plinth
    assert page.evaluate("!seoul1907.historicalEvent.quest.sprite.visible")
    print('ARRIVED',result,flush=True);assert result['reached']>=4 and result['paused'] and result['resumed'] and result['checkpoint']==12 and result['phase']=='aftermath',result
    AFTER="""async expectName=>{const s=seoul1907,e=s.historicalEvent,d=s.walking.dialogue;for(let i=0;i<20&&!d.current;i++){e.update(.1);await new Promise(r=>setTimeout(r,50))}if(!d.current)throw Error('aftermath dialogue did not open');
     const plate=()=>document.querySelector('#npc-dialog .npc-plate strong').textContent,name=plate(),sources=[];let steps=0;while(d.current&&plate()===name&&steps++<8){d.finishTyping();sources.push(document.querySelector('#npc-dialog .npc-sources').textContent);[...document.querySelectorAll('#npc-dialog .npc-options button')].at(-1).click();await new Promise(r=>setTimeout(r,30))}
     for(let i=0;i<30&&e.saving;i++)await new Promise(r=>setTimeout(r,100));await new Promise(r=>setTimeout(r,300));e.update(.1);
     return {name,sources:sources.filter(Boolean),checkpoint:e.checkpoint,phase:e.phase,text:document.querySelector('#historical-event-panel').textContent,epilogue:[...document.querySelectorAll('#historical-event-epilogue a')].map(a=>a.textContent)}}"""
    interp=page.evaluate(AFTER,'');print('INTERPRETER',{k:v for k,v in interp.items() if k!='text'},flush=True);assert interp['name']=='공사관의 통역' and any('1896' in x for x in interp['sources']) and interp['phase']=='aftermath',interp
    page.screenshot(path='/tmp/agwanpacheon-neighbour.png')
    result=page.evaluate(AFTER,'');print('COMPLETE',{k:v for k,v in result.items() if k!='text'},flush=True)
    assert page.evaluate("seoul1907.historicalEvent.dawn>0"),'dawn did not begin'
    page.screenshot(path='/tmp/agwanpacheon-epilogue.png')
    assert result['name']=='정동 골목의 이웃' and result['checkpoint']==13 and result['phase']=='done' and '회상 완료가 계정에 기록' in result['text'] and result['epilogue']==['1897-02-20','1897-10-12'],result
    # A clean browser profile sees the account's server layout; legacy import runs only for null.
    layout=page.evaluate("""async()=>{const slots=['horse_reins',...Array(9).fill(null)],csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);const r=await fetch('/api/player/action-bar/',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({slots,revision:0})});return r.status}""")
    assert layout==200,layout
    second=browser.new_page();second.goto('http://127.0.0.1:18110/1907/');second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    second.evaluate("""async()=>{const s=seoul1907.walking.shop;await s.whenReady;const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);await fetch('/api/account/login',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({name:'가마검사',password:'test-secret'})});await s.refresh();s.showHud(true)}""")
    assert '말고삐' in second.locator('.action-slot').first.get_attribute('title')
    assert second.evaluate("localStorage.getItem('hanyang3d-actions:가마검사')") is None
    print('PASS CROSS-BROWSER ACTION BAR',flush=True)
    # A second account meets the caretaker: the rumour node hands over the bundle, the pack use opens the visit.
    second.evaluate("""async()=>{const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10),post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(b)});await post('/api/account/logout',{});await post('/api/account/register',{name:'꾸러미검사',password:'test-secret'});await seoul1907.walking.shop.refresh()}""")
    talk=second.evaluate("""async()=>{const s=seoul1907,w=s.walking,d=w.dialogue,r=w.stationary.records.find(r=>r.owner.userData.feature.id==='russian-legation-1907');s.firstPerson.enter();
     d.start(w.npcFor(r));d.finishTyping();const labels=[...document.querySelectorAll('#npc-dialog .npc-options button')].map(b=>b.textContent);
     [...document.querySelectorAll('#npc-dialog .npc-options button')].find(b=>b.textContent.includes('아관파천')).click();await new Promise(r=>setTimeout(r,30));d.finishTyping();
     const rumour=document.querySelector('#npc-dialog .npc-line').textContent;[...document.querySelectorAll('#npc-dialog .npc-options button')].find(b=>b.textContent.includes('받아')).click();
     for(let i=0;i<40&&!(w.shop.state.items.legation_keepsake>0);i++)await new Promise(r=>setTimeout(r,100));
     d.start(w.npcFor(r));d.finishTyping();[...document.querySelectorAll('#npc-dialog .npc-options button')].find(b=>b.textContent.includes('아관파천')).click();await new Promise(r=>setTimeout(r,30));d.finishTyping();const hint=document.querySelector('#npc-dialog .npc-line').textContent;d.end();
     const sell=await (await fetch('/api/shop/trade',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10)},body:JSON.stringify({action:'sell',shop:Object.keys(JSON.parse(document.getElementById('npcs').textContent).shops)[0],item:'legation_keepsake',quantity:1})})).status;
     return {labels,rumour,owned:w.shop.state.items.legation_keepsake,hint,sell,message:document.getElementById('action-message').textContent}}""")
    print('CARETAKER',talk,flush=True);assert '꾸러미' in talk['rumour'] and talk['owned']==1 and '이미' in talk['hint'] and talk['sell']==400 and '봇짐' in talk['message'],talk
    second.evaluate("""async()=>{const s=seoul1907;window.returnPose={x:s.firstPerson.eye.x,z:s.firstPerson.eye.z};sessionStorage.setItem('test-return-pose',JSON.stringify(returnPose));s.walking.shop.openPack();document.querySelector('.pack-items .shop-slot[data-item="legation_keepsake"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}))}""")
    second.wait_for_url('**/events/agwanpacheon/');second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    second.get_by_role('button',name='1907년으로 돌아가기',exact=True).click();second.wait_for_url('**/1907/?returnFromAgwan=1');second.wait_for_function('window.seoul1907?.firstPerson.active',timeout=180000)
    assert second.evaluate("(()=>{const p=JSON.parse(sessionStorage.getItem('test-return-pose')),e=seoul1907.firstPerson.eye;return Math.hypot(p.x-e.x,p.z-e.z)<.1})()")
    print('PASS RETURN TO ORIGINAL POSITION',flush=True)
    second.evaluate("""async()=>{const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10),post=(u,b)=>fetch(u,{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify(b)});await post('/api/account/logout',{});await seoul1907.walking.shop.refresh();await post('/api/account/register',{name:'옛액션',password:'test-secret'});localStorage.setItem('hanyang3d-actions:옛액션',JSON.stringify(['fishing_rod',...Array(9).fill(null)]));await seoul1907.walking.shop.refresh()}""")
    second.wait_for_function("async()=>{const r=await(await fetch('/api/player/')).json();return r.action_bar?.[0]==='fishing_rod'}")
    print('PASS LEGACY ACTION MIGRATION',flush=True)
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
