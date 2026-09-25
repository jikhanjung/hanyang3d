"""Eulmi visit: keepsake gate, night talk, shadowing the group (too close / gate), hiding in Geoncheonggung
(stray and pulled back), the next-day market crowd, the epilogue and the pointer on to Agwanpacheon."""
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
    print('START',gate,flush=True);assert '노리개' in gate['refused'] and gate['phase']=='night' and gate['active'] and gate['last']==18 and gate['contact'] and not gate['trams'],gate
    shot(page,'night')
    night=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,d=s.walking.dialogue,spot=e.spots.night;s.firstPerson.placeAt(spot.x+1.5,spot.z+1.5,0);e.update(.1);
     const name=document.querySelector('#npc-dialog .npc-plate strong')?.textContent;let n=0;while(d.current&&n++<6){d.finishTyping();[...document.querySelectorAll('#npc-dialog .npc-options button')].at(-1).click();await new Promise(r=>setTimeout(r,30))}
     for(let i=0;i<20&&e.saving;i++)await new Promise(r=>setTimeout(r,100));e.update(.1);return {name,phase:e.phase,checkpoint:e.checkpoint}}""")
    print('NIGHT',night,flush=True);assert night['name']=='야경꾼' and night['phase']=='shadow' and night['checkpoint']>=1,night
    nan=page.evaluate("""()=>{const out=[];seoul1907.scene.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position?.array;if(a&&a.some(v=>!Number.isFinite(v))){let n=o,path=[];while(n){path.push(n.name||n.type);n=n.parent}out.push(path.join('<'))}});return out.slice(0,5)}""")
    print('NAN',nan,flush=True)
    info=page.evaluate("""()=>{const m=seoul1907.historicalEvent.module('shadow');return {points:m.route.path.length,total:Math.round(m.route.total),members:m.members.length}}""")
    shape=page.evaluate("""()=>{const r=seoul1907.historicalEvent.module('shadow').route,P=r.path;let maxTurn=0,back=0;for(let i=2;i<P.length;i++){const a=Math.atan2(P[i-1].x-P[i-2].x,P[i-1].z-P[i-2].z),b=Math.atan2(P[i].x-P[i-1].x,P[i].z-P[i-1].z);let d=Math.abs(b-a);if(d>Math.PI)d=2*Math.PI-d;maxTurn=Math.max(maxTurn,d);if(d>2.5)back++}
     const kinds={};for(const m of seoul1907.historicalEvent.module('shadow').members)kinds[m.kind]=(kinds[m.kind]??0)+1;return {maxTurnDeg:Math.round(maxTurn*180/Math.PI),reversals:back,kinds}}""")
    print('SHAPE',shape,flush=True);assert shape['reversals']==0 and shape['maxTurnDeg']<75 and sum(shape['kinds'].values())==24,shape
    print('ROUTE',info,flush=True)
    # The 1907 streets stay: houses shown, no estimated houses along the route, buildings standing by 1895 kept (so the
    # 1873 Geoncheonggung is there, the 1899 tram depot is not), and the group is armed.
    scene=page.evaluate("""()=>{const s=seoul1907,m=s.historicalEvent.module('shadow'),on=k=>s.buildings.find(b=>b.userData.feature.id===k||b.userData.feature.landmark_kind===k)?.visible;let lane=false;s.scene.traverse(o=>{if(o.name==='estimated-escape-lane')lane=true});
     return {houses:s.settlement.group.visible,lane,geoncheonggung:on('geoncheonggung-1907'),depot:on('tram_depot')??'absent',visible:s.buildings.filter(b=>b.visible).length,rifles:m.members.filter(x=>x.rifle).length,swords:m.members.filter(x=>x.sword).length}}""")
    print('SCENE',scene,flush=True);assert scene['houses'] and not scene['lane'] and scene['geoncheonggung'] and scene['depot'] is not True and scene['visible']>40 and scene['rifles']>=3 and scene['swords']>=6,scene;assert not page.evaluate('''(()=>{let bad=false;seoul1907.scene.traverse(o=>{const a=o.isMesh&&o.geometry.attributes.position?.array;if(a&&a.some(v=>!Number.isFinite(v)))bad=true});return bad})()'''),'NaN geometry'
    # After the watchman's talk in the alley south of the main road, a short pause (the group unseen), then the group
    # comes into view far to the west (the Donuimun side) and walks along the main road past the alley mouth, where the
    # walker stands still. It must not be caught there.
    appear=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson,P=()=>document.querySelector('#historical-event-panel p').textContent;
     const c=fp.eye.clone();let near=m.route.path[0],nd=Infinity;for(const p of m.route.path){const d=Math.hypot(p.x-c.x,p.z-c.z);if(d<nd){nd=d;near=p}}
     const k=Math.max(0,(nd-12)/nd),at={x:c.x+(near.x-c.x)*k,z:c.z+(near.z-c.z)*k};fp.placeAt(at.x,at.z,Math.atan2(-(near.x-at.x),-(near.z-at.z)));
     const pause=[];for(let i=0;i<65;i++){e.update(.1);if(i%10===0)pause.push(m.members.some(x=>x.group.visible))}const pauseText=P();
     for(let i=0;i<10&&!m.members[0].group.visible;i++)e.update(.1);const lead=m.members[0].group.position,first={shown:m.members[0].group.visible,text:P().slice(0,30),away:Math.round(Math.hypot(lead.x-at.x,lead.z-at.z)),west:lead.x<at.x};
     const d0=m.distance;let nearest=Infinity,caught=false,t10=null;for(let i=0;i<900;i++){fp.placeAt(at.x,at.z,fp.yaw);e.update(.1);if(i===99)t10=m.distance-d0;for(const x of m.members)nearest=Math.min(nearest,Math.hypot(x.group.position.x-at.x,x.group.position.z-at.z));if(P().includes('물러났'))caught=true}
     s.renderer.render(s.scene,s.camera);window.passShot=s.renderer.domElement.toDataURL();
     return {alleyToRoad:+nd.toFixed(1),pause,pauseText:pauseText.slice(0,20),...first,speed:+(t10/10).toFixed(2),nearest:Math.round(nearest),caught,after:Math.round(m.distance)}}""")
    print('APPEAR',appear,flush=True)
    assert appear['alleyToRoad']>12 and not any(appear['pause']) and '골목 어귀' in appear['pauseText'] and '서대문' in appear['text'],appear
    assert appear['shown'] and appear['west'] and appear['away']>100 and 4.0<appear['speed']<4.3 and appear['nearest']<25 and not appear['caught'],appear
    Path('/tmp/eulmi-pass.png').write_bytes(base64.b64decode(page.evaluate('passShot').split(',')[1]))
    # Remarks: close by someone suspects a follower (Japanese with a translation); later idle small talk.
    remark=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson;for(let i=0;i<80&&m.remark;i++)e.update(.1);const t=m.members.at(-1).group.position;fp.placeAt(t.x+6,t.z+6,0);e.update(.1);const near=m.remark;
     const b=m.route.sample(Math.max(0,m.distance-m.members.at(-1).back-40)).p;fp.placeAt(b.x,b.z,0);let idle=null;for(let i=0;i<300&&!idle;i++){e.update(.1);const r=m.remark;if(r&&r!==near)idle=r}return {near,idle}}""")
    print('REMARK',remark,flush=True);assert remark['near'] and any(l['ja'] in remark['near'] for l in json.load(open('gis/events/eulmi.json'))['stages'][1]['chatter']['suspicious']) and remark['idle'],remark
    # Too close: stand among the group for a few seconds and the walker is put back into the dark.
    close=page.evaluate("""()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson;for(let i=0;i<60;i++){const t=m.members.at(-1).group.position;fp.placeAt(t.x+10,t.z+10,0);e.update(.1)}
     const lead=m.members[0].group.position;fp.placeAt(lead.x+.5,lead.z+.5,0);for(let i=0;i<30;i++)e.update(.1);const near=Math.min(...m.members.map(x=>Math.hypot(fp.eye.x-x.group.position.x,fp.eye.z-x.group.position.z)));
     return {near:Math.round(near),text:document.querySelector('#historical-event-panel p').textContent,moved:m.distance>5}}""")
    print('TOO CLOSE',close,flush=True);assert close['near']>=7 and '물러났' in close['text'] and close['moved'],close
    # Follow to the end at a steady distance behind the last lantern; the gate halts the group, flashes and the defender falls.
    run=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,m=e.module('shadow'),fp=s.firstPerson;let fell=false,halt=0,gateText='',i=0;
     for(;i<30000&&e.phase==='shadow';i++){const {p,yaw}=m.route.sample(Math.max(0,m.distance-m.members.at(-1).back-16));fp.placeAt(p.x,p.z,yaw+Math.PI);e.update(.1);
      if(m.stops.some(st=>st.state==='running')){if(m.members.some(x=>x.aiming))window.aimed=true;if(m.members.some(x=>x.muzzle?.visible))window.fired=true}
      if(m.gateState==='running'){halt++;if(!gateText)gateText='';const t=document.querySelector('#historical-event-panel p').textContent;if(t.includes('홍계훈'))gateText=t;if(m.gateGuard.group.rotation.x<-1.4)fell=true;
       if(halt===40){s.renderer.render(s.scene,s.camera);window.gateShot=s.renderer.domElement.toDataURL()}}
      if(!window.palaceShot&&m.stops[1].state==='running'&&m.stops[1].t>2.1){s.renderer.render(s.scene,s.camera);window.palaceShot=s.renderer.domElement.toDataURL()}
      if(m.remark)(window.lines??=new Set()).add(m.remark);
      if(i%200===0)await new Promise(r=>setTimeout(r,0))}
     for(let k=0;k<30&&e.saving;k++)await new Promise(r=>setTimeout(r,100));
     window.stopsDone=m.stops.map(st=>({state:st.state,fallen:st.defenders.filter(d=>d.fate==='fall').every(d=>d.group.rotation.x<-1.4),down:st.defenders.filter(d=>d.group.rotation.x<-1.4).length,fled:st.defenders.filter(d=>d.fate==='flee'&&!d.group.visible).length,n:st.defenders.length}));
     return {frames:i,phase:e.phase,checkpoint:e.checkpoint,halt,fell,gateText:gateText.slice(0,40),minutes:+(i/600).toFixed(1),routeM:Math.round(m.route.total)}}""")
    print('SHADOW',run,flush=True);assert run['phase']=='hide' and run['checkpoint']==16 and run['halt']>50 and run['fell'] and '홍계훈' in run['gateText'],run
    lines=page.evaluate('[...(window.lines??[])]');print('LINES',len(lines),lines[:6],flush=True);assert len(lines)>=12,lines
    stops=page.evaluate('window.stopsDone');print('STOPS',stops,'aimed',page.evaluate('window.aimed'),'fired',page.evaluate('window.fired'),flush=True)
    assert [x['n'] for x in stops]==[9,3,2] and all(x['state']=='done' and x['fallen'] for x in stops) and stops[0]['down']==3 and stops[0]['fled']==6 and page.evaluate('window.aimed') and page.evaluate('window.fired'),stops
    for name in ['gate','palace']:Path(f'/tmp/eulmi-{name}.png').write_bytes(base64.b64decode(page.evaluate(name+'Shot').split(',')[1]))
    # Hiding in the far corner: approach, stray out and get pulled back. The crowd (as many as the group) searches the
    # compound, keeps clear of the corner, storms the east door of Gonnyeonghap with a shout, comes back out, gathers
    # and leaves by the gate. At first light the walker goes to the smoke and finds the matching strand.
    hide=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,h=e.module('hide'),fp=s.firstPerson,spot=h.spot,P=()=>document.querySelector('#historical-event-panel p').textContent;
     const b=s.buildings.find(b=>b.userData.feature.id==='geoncheonggung-1907'),sl=b.worldToLocal(spot.clone().setY(b.position.y));
     const approach=P();fp.placeAt(spot.x,spot.z,0);e.update(.1);const settled=h.state;
     fp.placeAt(spot.x-8,spot.z-8,0);for(let i=0;i<50;i++)e.update(.1);const back=Math.hypot(fp.eye.x-spot.x,fp.eye.z-spot.z);const pulled=P();
     const seen={wander:0,storm:0,emerge:0,gather:0,leave:0};let nearest=Infinity,shout='',maxInside=0,broke=false;const texts=[];let last='',i=0;
     for(;i<2400&&h.state==='watch';i++){e.update(.1);const t=P();if(t!==last){texts.push(t.slice(0,24));last=t}
      const vis=h.men.filter(m=>m.p.group.visible);seen[h.mode]=Math.max(seen[h.mode],vis.length);for(const m of vis)nearest=Math.min(nearest,Math.hypot(m.p.group.position.x-spot.x,m.p.group.position.z-spot.z));
      if(h.shout&&h.shout.includes('狐'))shout=h.shout;maxInside=Math.max(maxInside,h.men.filter(m=>m.state==='inside').length);if(h.doorBroken)broke=true;
      if(!window.hideShot&&h.mode==='storm'&&h.clock>24){s.renderer.render(s.scene,s.camera);window.hideShot=s.renderer.domElement.toDataURL()}
      if(i%100===0)await new Promise(r=>setTimeout(r,0))}
     e.update(.1);const gone=h.men.filter(m=>m.state==='gone').length,smoke=h.smoke.visible,hint=P();
     const q=h.smokeAt;fp.placeAt(q.x+2.5,q.z+1,0);const found=[];for(let k=0;k<400&&e.phase==='hide';k++){e.update(.1);const t=P();if(!found.includes(t))found.push(t)}
     for(let k=0;k<30&&e.saving;k++)await new Promise(r=>setTimeout(r,100));
     return {corner:[+sl.x.toFixed(1),+sl.z.toFixed(1)],approach:approach.slice(0,30),settled,back:+back.toFixed(1),pulled:pulled.slice(0,40),seen,nearest:+nearest.toFixed(1),shout,maxInside,broke,gone,smoke,hint:hint.slice(0,24),found:found.map(x=>x.slice(0,30)),texts,phase:e.phase,nodes:h.nodes.length}}""")
    print('HIDE',{k:v for k,v in hide.items() if k not in('texts','found','approach','pulled')},flush=True);print('FOUND',hide['found'],flush=True)
    assert hide['settled']=='watch' and hide['back']<1 and '물러났' in hide['pulled'] and abs(hide['corner'][0])>38 and hide['corner'][1]>29,hide
    assert hide['seen']['wander']>=20 and hide['nearest']>7 and '狐' in hide['shout'] and hide['broke'] and hide['maxInside']>=15 and hide['gone']==24 and hide['smoke'],hide
    assert '연기가 오르는' in hide['hint'] and any('나란히' in f for f in hide['found']) and hide['phase']=='market',hide
    Path('/tmp/eulmi-hide.png').write_bytes(base64.b64decode(page.evaluate('hideShot').split(',')[1]))
    # The next day: the curtain moves the walker to Jongno in daylight; a knot of people murmurs by the road. The walker
    # squeezes in among them and overhears the talk; stepping out pauses it; at the end the crowd breaks up.
    page.wait_for_function('!seoul1907.walking.curtain.holding && !document.getElementById("scene-curtain")?.classList.contains("opaque")',timeout=15000)
    market=page.evaluate("""async()=>{const s=seoul1907,e=s.historicalEvent,c=e.module('market'),fp=s.firstPerson,P=()=>document.querySelector('#historical-event-panel p').textContent;const sky=s.scene.background.getHexString();
     const q=c.centre,start=Math.round(Math.hypot(fp.eye.x-q.x,fp.eye.z-q.z)),quest=e.quest.sprite.visible;
     fp.placeAt(q.x+9,q.z+9,Math.atan2(9,9));let murmurs=new Set();for(let i=0;i<60;i++){e.update(.1);for(const b of c.bubbles)murmurs.add(b)}
     const approach=P();fp.placeAt(q.x+2,q.z+2,0);e.update(.1);const joined=c.state;
     const heard=[];let last='',strayed=null;for(let i=0;i<3000&&e.phase==='market';i++){
      if(c.line===3&&strayed===null){fp.placeAt(q.x+14,q.z+14,0);for(let k=0;k<60;k++)e.update(.1);strayed={line:c.line,text:P().slice(0,20)};fp.placeAt(q.x+2,q.z+2,0)}
      e.update(.1);const t=P();if(t!==last&&c.state==='joined'){heard.push(t.split(':')[0]);last=t}
      if(c.state==='joined'&&c.line>=0){(window.lineBubbles??={})[c.line]||=c.bubbles.length>0}
      if(c.line===2&&!window.marketShot){s.renderer.render(s.scene,s.camera);window.marketShot=s.renderer.domElement.toDataURL()}
      if(i%100===0)await new Promise(r=>setTimeout(r,0))}
     for(let i=0;i<30&&e.saving;i++)await new Promise(r=>setTimeout(r,100));await new Promise(r=>setTimeout(r,400));
     return {sky,start,quest,murmurs:[...murmurs].slice(0,4),approach:approach.slice(0,20),joined,strayed,heard,bubbles:Object.values(window.lineBubbles??{}).filter(Boolean).length,phase:e.phase,checkpoint:e.checkpoint,epilogue:[...document.querySelectorAll('#historical-event-epilogue a')].map(a=>a.textContent),next:document.getElementById('historical-event-next')?.textContent}}""")
    print('MARKET',{k:v for k,v in market.items() if k not in('heard','murmurs')},flush=True);print('HEARD',market['heard'],flush=True)
    speakers=[h for h in market['heard'] if h in ('포목전 상인','젊은 사내','지게꾼','장 보러 나온 아낙','늙은 선비','댕기머리 아이','갓 쓴 중인')]
    assert market['quest'] and market['start']<80 and market['murmurs'] and market['joined']=='joined' and market['strayed']['line']==3 and '멀어' in market['strayed']['text'],market
    assert len(speakers)>=9 and speakers[:3]==['포목전 상인','젊은 사내','지게꾼'] and market['bubbles']>=6 and market['checkpoint']==18 and market['epilogue']==['1895-10-08','1895-12-30','1896-02-11'] and '러시아공사관' in (market['next'] or ''),market
    Path('/tmp/eulmi-market.png').write_bytes(base64.b64decode(page.evaluate('marketShot').split(',')[1]))
    assert not errors,errors
    print('PASS EULMI',flush=True)
    # Using the norigae again after finishing: back in 1907, use it from the pack; the visit restarts at the alley.
    page.goto('http://127.0.0.1:18140/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=180000)
    page.evaluate("""async()=>{const w=seoul1907.walking;await w.shop.whenReady;await w.shop.refresh();seoul1907.firstPerson.enter();w.shop.openPack();document.querySelector('.pack-items .shop-slot[data-item="eulmi_keepsake"]').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}))}""")
    page.wait_for_url('**/events/eulmi/',timeout=30000);page.wait_for_function('window.seoul1907?.ready',timeout=180000);page.wait_for_function('!seoul1907.walking.curtain.holding',timeout=60000)
    again=page.evaluate("({phase:seoul1907.historicalEvent.phase,checkpoint:seoul1907.historicalEvent.checkpoint,active:seoul1907.historicalEvent.active,contact:seoul1907.historicalEvent.contacts.night?.p.group.visible})")
    print('REPLAY',again,flush=True);assert again=={'phase':'night','checkpoint':0,'active':True,'contact':True},again
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
    second.wait_for_function("document.querySelector('#scene-curtain .curtain-bar')?.value>0",timeout=120000)
    bar=second.evaluate("(()=>{const b=document.querySelector('#scene-curtain .curtain-bar');return {hidden:b.hidden,value:b.value,max:b.max,text:document.querySelector('#scene-curtain .curtain-progress').textContent}})()")
    print('CURTAIN BAR',bar,flush=True);assert not bar['hidden'] and 0<bar['value']<=bar['max'],bar
    second.wait_for_function('window.seoul1907?.ready',timeout=180000)
    second.wait_for_function('!seoul1907.walking.curtain.holding',timeout=60000)
    arrived=second.evaluate("({phase:seoul1907.historicalEvent.phase,walking:seoul1907.firstPerson.active})")
    print('ARRIVAL',caption,arrived,flush=True);assert '새문안' in (caption or '') and arrived=={'phase':'night','walking':True},arrived
    print('PASS ENTRY FROM 1907',flush=True)
    browser.close()
  finally:server.terminate();server.wait(timeout=10)
  print(open(tmp+'/web.log').read()[-600:] if errors else '')
  print('ERRORS',errors[:5])
