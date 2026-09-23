"""Eulmi visit: keepsake gate, night talk, shadowing the group (too close / gate), hiding in Geoncheonggung
(stray and pulled back), the next-day market, the epilogue and the pointer on to Agwanpacheon."""
import os,subprocess,tempfile,time,sys,json,base64
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];os.chdir(root)
CSRF="document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10)"
def shot(page,name):
 data=page.evaluate("()=>{const s=seoul1907;s.renderer.render(s.scene,s.camera);return s.renderer.domElement.toDataURL()}")
 Path(f'/tmp/eulmi-{name}.png').write_bytes(base64.b64decode(data.split(',')[1]))
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18140','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18140/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    page=browser.new_page(viewport={'width':1280,'height':900});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'favicon' not in m.text else None)
    page.goto('http://127.0.0.1:18140/events/eulmi/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    gate=page.evaluate(f"""async()=>{{const s=seoul1907,e=s.historicalEvent,csrf={CSRF},post=(u,b)=>fetch(u,{{method:'POST',headers:{{'Content-Type':'application/json','X-CSRFToken':csrf}},body:JSON.stringify(b)}});
     await s.walking.shop.whenReady;await post('/api/account/register',{{name:'을미검사',password:'test-secret'}});await s.walking.shop.refresh();
     await e.begin(true);const refused=document.querySelector('#historical-event-panel p').textContent;
     await post('/api/events/eulmi/',{{action:'keepsake'}});await e.begin(true);s.renderer.setAnimationLoop(null);
     return {{refused,msg:document.querySelector('#historical-event-panel p').textContent,phase:e.phase,active:e.active,last:e.lastCheckpoint,contact:e.contacts.night?.p.group.visible,visible:s.buildings.filter(b=>b.visible).length,trams:s.trams.group.visible}}}}""")
    print('START',gate,flush=True);assert '노리개' in gate['refused'] and gate['phase']=='night' and gate['active'] and gate['last']==17 and gate['contact'] and not gate['trams'],gate
    shot(page,'night')
    night=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,d=s.walking.dialogue,spot=e.spots.night;s.firstPerson.placeAt(spot.x+1.5,spot.z+1.5,0);e.update(.1);
     const name=document.querySelector('#npc-dialog .npc-plate strong')?.textContent;let n=0;while(d.current&&n++<6){d.finishTyping();[...document.querySelectorAll('#npc-dialog .npc-options button')].at(-1).click();await new Promise(r=>setTimeout(r,30))}
     for(let i=0;i<20&&e.saving;i++)await new Promise(r=>setTimeout(r,100));e.update(.1);return {name,phase:e.phase,checkpoint:e.checkpoint}}""")
    print('NIGHT',night,flush=True);assert night['name']=='야경꾼' and night['phase']=='shadow' and night['checkpoint']>=1,night
    nan=page.evaluate("""()=>{const out=[];seoul1907.scene.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position?.array;if(a&&a.some(v=>!Number.isFinite(v))){let n=o,path=[];while(n){path.push(n.name||n.type);n=n.parent}out.push(path.join('<'))}});return out.slice(0,5)}""")
    print('NAN',nan,flush=True)
    info=page.evaluate("""()=>{const m=seoul1907.historicalEvent.module('shadow');return {points:m.route.path.length,total:Math.round(m.route.total),members:m.members.length}}""")
    print('ROUTE',info,flush=True);assert not page.evaluate('''(()=>{let bad=false;seoul1907.scene.traverse(o=>{const a=o.isMesh&&o.geometry.attributes.position?.array;if(a&&a.some(v=>!Number.isFinite(v)))bad=true});return bad})()'''),'NaN geometry'
    # The group waits unseen outside Donuimun until the walker comes near the gate, then walks in through it.
    appear=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson;e.update(.1);
     const before={waiting:m.waiting,shown:m.members[0].group.visible,hint:document.querySelector('#historical-event-panel p').textContent,distance:m.distance};
     const a=m.appearAt;fp.placeAt(a.x+8,a.z-4,0);for(let i=0;i<40;i++)e.update(.1);
     const lead=m.members[0].group.position,start=m.route.path[0];
     return {before,waiting:m.waiting,shown:m.members[0].group.visible,text:document.querySelector('#historical-event-panel p').textContent,moved:+(m.distance-before.distance).toFixed(1),outsideFirst:start.distanceTo(m.route.sample(0).p)<.1}}""")
    print('APPEAR',{k:v for k,v in appear.items() if k!='text'},appear['text'][:30],flush=True);assert appear['before']['waiting'] and not appear['before']['shown'] and '새문고개' in appear['before']['hint'] and not appear['waiting'] and appear['shown'] and appear['moved']>8 and '새문고개를 넘어' in appear['text'],appear
    # Too close: stand among the group for a few seconds and the walker is put back into the dark.
    close=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson;for(let i=0;i<60;i++){const t=m.members.at(-1).group.position;fp.placeAt(t.x+10,t.z+10,0);e.update(.1)}
     const lead=m.members[0].group.position;fp.placeAt(lead.x+.5,lead.z+.5,0);for(let i=0;i<30;i++)e.update(.1);const near=Math.min(...m.members.map(x=>Math.hypot(fp.eye.x-x.group.position.x,fp.eye.z-x.group.position.z)));
     return {near:Math.round(near),text:document.querySelector('#historical-event-panel p').textContent,moved:m.distance>5}}""")
    print('TOO CLOSE',close,flush=True);assert close['near']>=7 and '물러났' in close['text'] and close['moved'],close
    # Follow to the end at a steady distance behind the last lantern; the gate halts the group, flashes and the defender falls.
    run=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson;let fell=false,halt=0,gateText='',i=0;
     for(;i<30000&&e.phase==='shadow';i++){const {p,yaw}=m.route.sample(Math.max(0,m.distance-2.3*11-18));fp.placeAt(p.x,p.z,yaw+Math.PI);e.update(.1);
      if(m.gateState==='running'){halt++;if(!gateText)gateText='';const t=document.querySelector('#historical-event-panel p').textContent;if(t.includes('홍계훈'))gateText=t;if(m.gateGuard.group.rotation.x<-1.4)fell=true;
       if(halt===40){s.renderer.render(s.scene,s.camera);window.gateShot=s.renderer.domElement.toDataURL()}}
      if(!window.palaceShot&&m.distance>m.route.milestones[11]){s.renderer.render(s.scene,s.camera);window.palaceShot=s.renderer.domElement.toDataURL()}
      if(i%200===0)await new Promise(r=>setTimeout(r,0))}
     for(let k=0;k<30&&e.saving;k++)await new Promise(r=>setTimeout(r,100));
     return {frames:i,phase:e.phase,checkpoint:e.checkpoint,halt,fell,gateText:gateText.slice(0,40),minutes:+(i/600).toFixed(1),routeM:Math.round(m.route.total)}}""")
    print('SHADOW',run,flush=True);assert run['phase']=='hide' and run['checkpoint']==15 and run['halt']>50 and run['fell'] and '홍계훈' in run['gateText'],run
    for name in ['gate','palace']:Path(f'/tmp/eulmi-{name}.png').write_bytes(base64.b64decode(page.evaluate(name+'Shot').split(',')[1]))
    # Hiding: approach the corner, stray out and get pulled back, then sit out the timeline to first light.
    hide=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,h=e.module('hide'),fp=s.firstPerson,spot=h.spot;
     const approach=document.querySelector('#historical-event-panel p').textContent;fp.placeAt(spot.x,spot.z,0);e.update(.1);const settled=h.state;
     fp.placeAt(spot.x+8,spot.z+8,0);for(let i=0;i<50;i++)e.update(.1);const back=Math.hypot(fp.eye.x-spot.x,fp.eye.z-spot.z);const pulled=document.querySelector('#historical-event-panel p').textContent;
     const texts=[];let last='',i=0;for(;i<2000&&e.phase==='hide';i++){e.update(.1);const t=document.querySelector('#historical-event-panel p').textContent;if(t!==last){texts.push(t.slice(0,24));last=t}
      if(!window.hideShot&&h.clock>34){const cam=s.camera;s.renderer.render(s.scene,cam);window.hideShot=s.renderer.domElement.toDataURL()}if(i%100===0)await new Promise(r=>setTimeout(r,0))}
     return {approach:approach.slice(0,30),settled,back:+back.toFixed(1),pulled:pulled.slice(0,60),texts,lighting:e.lighting,phase:e.phase,smoke:h.smoke.visible}}""")
    print('HIDE',{k:v for k,v in hide.items() if k!='texts'},hide['texts'][-3:],flush=True);assert hide['settled']=='watch' and hide['back']<1 and '물러났' in hide['pulled'] and len(hide['texts'])>=6 and hide['phase']=='market',hide
    Path('/tmp/eulmi-hide.png').write_bytes(base64.b64decode(page.evaluate('hideShot').split(',')[1]))
    # The next day: the curtain moves the walker to Jongno in daylight; four people are walked up to in turn.
    page.wait_for_function('!seoul1907.walking.curtain.holding && !document.getElementById("scene-curtain")?.classList.contains("opaque")',timeout=15000)
    market=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,d=s.walking.dialogue,fp=s.firstPerson,names=[];const sky=s.scene.background.getHexString();
     for(let k=0;k<4;k++){let spot=null;for(let i=0;i<20&&!d.current;i++){e.update(.1);const q=e.quest.sprite;if(q.visible){spot=q.position;fp.placeAt(spot.x+1.2,spot.z+1.2,0)}}
      e.update(.1);if(!d.current)return {failed:k,names};names.push(document.querySelector('#npc-dialog .npc-plate strong').textContent);
      if(k===0){s.renderer.render(s.scene,s.camera);window.marketShot=s.renderer.domElement.toDataURL()}
      let n=0;while(d.current&&n++<5){d.finishTyping();[...document.querySelectorAll('#npc-dialog .npc-options button')].at(-1).click();await new Promise(r=>setTimeout(r,30))}}
     for(let i=0;i<30&&e.saving;i++)await new Promise(r=>setTimeout(r,100));await new Promise(r=>setTimeout(r,400));
     return {sky,names,phase:e.phase,checkpoint:e.checkpoint,epilogue:[...document.querySelectorAll('#historical-event-epilogue a')].map(a=>a.textContent),next:document.getElementById('historical-event-next')?.textContent}}""")
    print('MARKET',market,flush=True)
    assert market['names']==['포목전 상인','지게꾼','장 보러 나온 아낙','늙은 선비'] and market['checkpoint']==17 and market['epilogue']==['1895-10-08','1895-12-30','1896-02-11'] and '러시아공사관' in (market['next'] or ''),market
    Path('/tmp/eulmi-market.png').write_bytes(base64.b64decode(page.evaluate('marketShot').split(',')[1]))
    assert not errors,errors
    print('PASS EULMI',flush=True)
    # Entry from 1907: the Gyeongbokgung caretaker at Gwanghwamun gives the norigae; using it opens the visit.
    second=browser.new_page(viewport={'width':1280,'height':900});second.goto('http://127.0.0.1:18140/1907/');second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    entry=second.evaluate(f"""async()=>{{const s=seoul1907,w=s.walking,d=w.dialogue,csrf={CSRF};await w.shop.whenReady;
     await fetch('/api/account/register',{{method:'POST',headers:{{'Content-Type':'application/json','X-CSRFToken':csrf}},body:JSON.stringify({{name:'노리개검사',password:'test-secret'}})}});await w.shop.refresh();
     const r=w.stationary.records.find(r=>r.owner.userData.feature.id==='gwanghwamun-1907');s.firstPerson.enter();d.start(w.npcFor(r));d.finishTyping();
     const labels=[...document.querySelectorAll('#npc-dialog .npc-options button')].map(b=>b.textContent);
     [...document.querySelectorAll('#npc-dialog .npc-options button')].find(b=>b.textContent.includes('을미년')).click();await new Promise(r=>setTimeout(r,30));d.finishTyping();
     const rumour=document.querySelector('#npc-dialog .npc-line').textContent;[...document.querySelectorAll('#npc-dialog .npc-options button')].find(b=>b.textContent.includes('받아')).click();
     for(let i=0;i<40&&!(w.shop.state.items.eulmi_keepsake>0);i++)await new Promise(r=>setTimeout(r,100));
     w.shop.openPack();document.querySelector('.pack-items .shop-slot[data-item="eulmi_keepsake"]').dispatchEvent(new MouseEvent('contextmenu',{{bubbles:true,cancelable:true,button:2}}));
     return {{labels,rumour:rumour.slice(0,30),owned:w.shop.state.items.eulmi_keepsake}}}}""")
    print('ENTRY',entry,flush=True);assert any('을미년' in l for l in entry['labels']) and entry['owned']==1,entry
    second.wait_for_url('**/events/eulmi/',timeout=20000)
    caption=second.evaluate("document.querySelector('#scene-curtain .curtain-caption')?.textContent")
    second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    second.wait_for_function('!seoul1907.walking.curtain.holding',timeout=60000)
    arrived=second.evaluate("({phase:seoul1907.historicalEvent.phase,walking:seoul1907.firstPerson.active})")
    print('ARRIVAL',caption,arrived,flush=True);assert '새문안' in (caption or '') and arrived=={'phase':'night','walking':True},arrived
    print('PASS ENTRY FROM 1907',flush=True)
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
  print(open(tmp+'/web.log').read()[-600:] if errors else '')
  print('ERRORS',errors[:5])
