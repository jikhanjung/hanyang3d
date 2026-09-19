"""Isolated rendering checks for 1907 road infill, placement determinism and collision visibility."""
import os,subprocess,tempfile,time,json,sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2])
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/server.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18098','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18098/1907/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    previous=None
    for width,height in [(1100,900),(390,844)]:
     page=browser.new_page(viewport={'width':width,'height':height},is_mobile=width<600,has_touch=width<600);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18098/1907/');page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=180000)
     assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
     result=page.evaluate("""()=>{const s=seoul1907,h=s.settlement;return {stats:h.stats,roads:s.infrastructure.roads.children.length,records:h.records.map(r=>[r.x,r.z,r.w,r.d,r.yaw]),meshes:h.group.children.length}}""")
     print('SETTLEMENT',width,{k:v for k,v in result.items() if k!='records'},flush=True)
     assert result['stats']['accepted']>200 and result['stats']['mapped']>=10 and result['roads']>=20 and result['meshes']<=12,result['stats']
     if previous is not None:assert result['records']==previous,'Non-deterministic placement'
     previous=result['records']
     for ident in ['dansungsa-1907','sungnyemun-1907']:
      page.evaluate("""id=>{const s=seoul1907,b=s.buildings.find(b=>b.userData.feature.id===id);s.camera.position.copy(b.position).add({x:120,y:160,z:200});s.controls.target.copy(b.position);s.controls.update()}""",ident)
      page.wait_for_timeout(1000);page.screenshot(path=f'/tmp/settlement-{ident}-{width}.png')
     checks=page.evaluate("""()=>{const s=seoul1907,h=s.settlement;s.renderer.setAnimationLoop(null);const r=h.records[0],collision=s.walking.collision,shown=collision.hit(r.x,r.z,.3);document.getElementById('settlement3d').checked=false;document.getElementById('settlement3d').onchange();const hidden=collision.hit(r.x,r.z,.3);document.getElementById('settlement3d').checked=true;document.getElementById('settlement3d').onchange();h.setLod({x:r.x,y:r.floor+4,z:r.z});const near=h.nearCount;h.setLod({x:100000,y:100000,z:100000});const far=h.nearCount;return {shown:!!shown,hidden:!!hidden,near,far}}""")
     assert checks['shown'] and not checks['hidden'] and checks['near']>0 and checks['far']==0,checks
     assert not errors,errors;page.close()
    page=browser.new_page();page.goto('http://127.0.0.1:18098/');page.wait_for_function('window.terrain3d?.ready',timeout=180000);assert page.evaluate('terrain3d.settlement.visibleCount>0');print('PASS 1750 shared house renderer',flush=True)
    browser.close()
  finally:server.terminate();server.wait(timeout=15)
