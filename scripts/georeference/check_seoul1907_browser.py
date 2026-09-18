"""Check the 1907 view, original-map toggle, opacity and mobile controls."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18027');parser.add_argument('--serve',action='store_true');args=parser.parse_args()
if args.serve:
    import atexit, subprocess, sys, time
    from urllib.parse import urlsplit
    from urllib.request import urlopen
    address=urlsplit(args.url)
    assert address.hostname=='127.0.0.1' and address.port
    server=subprocess.Popen([sys.executable,'manage.py','runserver',f'127.0.0.1:{address.port}','--noreload'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    def stop():
        server.terminate()
        server.wait(timeout=10)
    atexit.register(stop)
    for attempt in range(100):
        if server.poll() is not None:
            raise RuntimeError('Test server failed to start')
        try:
            with urlopen(args.url+'/1907/',timeout=1):
                break
        except OSError:
            time.sleep(.1)
    else:
        raise RuntimeError('Test server did not become ready')
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1200,'height':850})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(args.url+'/1907/',wait_until='domcontentloaded')
    page.wait_for_function('window.seoul1907?.ready',timeout=90000)
    before=page.evaluate('()=>{const s=seoul1907;return {vertices:s.terrain.geometry.attributes.position.count,same:s.terrain.geometry===s.historical.geometry,target:s.controls.target.toArray(),models:s.scene.children.filter(x=>x.userData.feature).length}}')
    assert before['same'] and before['models']==65,before
    calibration=page.evaluate("""()=>{
      const s=seoul1907,c=s.config.coefficients,base=(x,y)=>[c[0][0]+x*c[1][0]+y*c[2][0],c[0][1]+x*c[1][1]+y*c[2][1]],det=c[1][0]*c[2][1]-c[2][0]*c[1][1];
      let roundtrip=0,minJacobian=Infinity,anchorError=0,controlShift=0;
      for(let y=560;y<=3530;y+=15)for(let x=115;x<=2580;x+=15){const p=s.project(x,y),q=s.inverse(...p),a=s.project(x+.1,y),b=s.project(x,y+.1);roundtrip=Math.max(roundtrip,Math.hypot(q[0]-x,q[1]-y));minJacobian=Math.min(minJacobian,((a[0]-p[0])*(b[1]-p[1])-(a[1]-p[1])*(b[0]-p[0]))/(.01*det))}
      for(const a of s.config.local_calibration.anchors){const p=s.project(...a.pixel),q=base(...a.target_affine_pixel);anchorError=Math.max(anchorError,Math.hypot(p[0]-q[0],p[1]-q[1]))}
      for(const a of [...s.config.controls,...s.config.checks]){const p=s.project(...a.pixel),q=base(...a.pixel);controlShift=Math.max(controlShift,Math.hypot(p[0]-q[0],p[1]-q[1]))}
      return {roundtrip,minJacobian,anchorError,controlShift};
    }""")
    assert calibration['roundtrip']<1e-5 and calibration['minJacobian']>.2,calibration
    assert calibration['anchorError']<1e-5 and calibration['controlShift']<1e-5,calibration
    print('Mountain calibration:',calibration)
    facts=page.evaluate("""()=>{
      const byId=Object.fromEntries(seoul1907.buildings.map(m=>[m.userData.feature.id,m.userData]));
      let finite=true;for(const model of seoul1907.buildings){model.traverse(m=>{if(m.isMesh)finite &&= Array.from(m.geometry.attributes.position.array).every(Number.isFinite)})}
      return {finite,columns:byId['gyeonghoeru-1907'].stoneColumns,shrines:[byId['jongmyo-jeongjeon-1907'].chambers,byId['yeongnyeongjeon-1907'].chambers],arches:byId['gwanghwamun-1907'].doors,barbican:byId['heunginjimun-1907'].parts.includes('barbican-wall')};
    }""")
    assert facts=={'finite':True,'columns':48,'shrines':[19,16],'arches':3,'barbican':True},facts
    assert page.locator('#landmark option').count()==66
    page.locator('#menu').click()
    page.locator('#buildings3d').uncheck()
    assert page.evaluate('seoul1907.buildings.every(m=>!m.visible)')
    page.locator('#names3d').uncheck()
    assert page.locator('#labels').is_hidden()
    page.locator('#water3d').uncheck();page.locator('#walls3d').uncheck()
    assert page.evaluate('!seoul1907.infrastructure.water.visible&&!seoul1907.infrastructure.bridges.visible&&!seoul1907.infrastructure.wall.group.visible')
    page.locator('#view').click();page.locator('#view').click()
    assert page.locator('#labels').is_hidden() and page.locator('#landmark').is_disabled()
    for selector in ['#buildings3d','#names3d','#walls3d','#water3d','#roads3d']:page.locator(selector).check()
    page.locator('#menu').click()
    assert page.evaluate('seoul1907.infrastructure.bridges.children.length')==7
    assert page.evaluate('seoul1907.infrastructure.roads.children.length')==8
    page.locator('#menu').click();page.locator('#roads3d').uncheck()
    assert page.evaluate('!seoul1907.infrastructure.roads.visible')
    page.locator('#roads3d').check();page.locator('#menu').click()
    assert page.evaluate("""()=>{const s=seoul1907;return s.infrastructure.roads.children.every(m=>{const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++){if(Math.abs(a.getY(i)-s.groundAt(a.getX(i),a.getZ(i))-.025)>.01)return false;}return true})}""")
    assert page.evaluate('seoul1907.buildings.find(m=>m.userData.feature.id==="sajik-1907").userData.squareAltars')==2
    assert page.evaluate('seoul1907.buildings.find(m=>m.userData.feature.id==="wongaksa_pagoda-1907").userData.standingStoreys')==7

    assert page.evaluate('seoul1907.infrastructure.wall.segments.every(s=>Number.isFinite(s.support.min)&&Number.isFinite(s.support.max))')
    assert page.evaluate("""()=>{const w=seoul1907.infrastructure.wall,ids=['donuimun-1907','changuimun-1907','sukjeongmun-1907','souimun-1907'],gaps=w.gaps.filter(g=>ids.includes(g.id));return gaps.length===4&&gaps.every(g=>[-1,1].every(sign=>{const x=g.x+Math.cos(g.yaw)*g.w/2*sign,z=g.z-Math.sin(g.yaw)*g.w/2*sign;return Math.min(...w.segments.flatMap(s=>[s.a,s.b]).map(p=>Math.hypot(p.x-x,p.z-z)))<.1}))}""")
    assert page.evaluate('seoul1907.buildings.find(m=>m.userData.feature.id==="donhwamun-1907").userData.feature.source_position.pixel')==[1325,1859]
    assert page.evaluate('seoul1907.buildings.find(m=>m.userData.feature.id==="sukjeongmun-1907").userData.feature.gate_tiers')==0
    assert page.evaluate('seoul1907.buildings.find(m=>m.userData.feature.id==="hyangwonjeong-1907").userData.sides')==6
    assert page.evaluate('seoul1907.buildings.find(m=>m.userData.feature.id==="bosingak-1907").userData.roofTiers')==1
    assert page.locator('.building-label').first.evaluate('(e)=>getComputedStyle(e).fontSize')=='16px'
    assert page.locator('.building-label').first.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
    page.wait_for_function('seoul1907.buildings.some(m=>!m.userData.lod.near)')
    page.evaluate('seoul1907.showBuilding(seoul1907.buildings[0])')
    page.wait_for_function('seoul1907.buildings[0].userData.lod.near')
    page.locator('#menu').click();page.locator('#reset').click();page.locator('#menu').click()
    locations=page.evaluate('seoul1907.buildings.map(m=>m.position.toArray())')
    page.locator('#menu').click()
    for key in ['gyeonghoeru-1907','myeongdong-cathedral-1907']:
        page.locator('#landmark').select_option(key)
        assert page.locator('#building-info').is_visible()
        page.wait_for_timeout(350)
        page.screenshot(path='/tmp/'+key+'.png')
    detail=page.evaluate('seoul1907.buildings.map(m=>({bays:m.userData.bays,tiers:m.userData.roofTiers,anchor:m.userData.hallPosition.toArray()}))')
    assert [m.get('tiers') for m in detail[:3]]==[2,1,2],detail
    assert detail[0]['bays']==[5,5],detail
    page.locator('#reset').click()
    page.locator('#building-info button').click()
    page.locator('#opacity').fill('0');page.locator('#opacity').dispatch_event('input')
    assert page.evaluate('seoul1907.historical.material.opacity')==0
    assert page.evaluate('seoul1907.buildings.map(m=>m.position.toArray())')==locations
    assert page.evaluate('seoul1907.controls.target.toArray()')==before['target']
    page.locator('#opacity').fill('100');page.locator('#opacity').dispatch_event('input')
    page.locator('#menu').click();page.screenshot(path='/tmp/seoul1907-desktop.png')
    page.locator('#menu').click();page.locator('#view').click()
    assert page.locator('#original').is_visible() and page.locator('#opacity').is_disabled()
    page.wait_for_function("document.querySelector('.leaflet-image-layer')?.complete")
    page.screenshot(path='/tmp/seoul1907-original.png')
    page.locator('#view').click();assert page.locator('#scene').is_visible()
    page.set_viewport_size({'width':390,'height':844})
    page.locator('#reset').click();page.locator('#menu').click();page.screenshot(path='/tmp/seoul1907-mobile.png')
    page.locator('#menu').click();assert page.locator('#era').is_visible()
    page.locator('#landmark').select_option('myeongdong-cathedral-1907')
    assert page.locator('#building-info').is_visible()
    page.screenshot(path='/tmp/seoul1907-building-mobile.png')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.locator('#menu').click();page.locator('#water3d').uncheck()
    assert page.evaluate('!seoul1907.infrastructure.bridges.visible')
    page.locator('#water3d').check();page.locator('#menu').click()
    page.locator('#menu').click()
    page.locator('#era').select_option('/')
    page.wait_for_url(args.url+'/',wait_until='domcontentloaded')
    assert page.locator('#era-select').count()==1
    assert not errors,errors
    print('PASS: 1907 terrain, original view, opacity stability, mobile menu and period navigation',before)
    browser.close()
