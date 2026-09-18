"""PC/mobile bookshop entry, sourced dialogue navigation and narrator placement."""
import os,subprocess,tempfile,time,json
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];os.chdir(root)
with tempfile.TemporaryDirectory(prefix='bookshop-check-') as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 log=open(tmp+'/server.log','w');server=subprocess.Popen([str(root/'.venv/bin/python'),'manage.py','runserver','127.0.0.1:18089','--noreload'],env=env,stdout=log,stderr=log)
 try:
  for _ in range(100):
   try:urlopen('http://127.0.0.1:18089/1907/');break
   except OSError:time.sleep(.1)
  with sync_playwright() as p:
   browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
   for mobile in [False,True]:
    ctx=browser.new_context(viewport={'width':390 if mobile else 1100,'height':844 if mobile else 800},is_mobile=mobile,has_touch=mobile)
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:18089/1907/');page.wait_for_function('window.seoul1907?.ready',timeout=120000)
    page.evaluate('window.renderScene=seoul1907.renderer.render.bind(seoul1907.renderer);seoul1907.renderer.render=()=>{}')
    page.locator('#menu').click();page.locator('#landmark').select_option('hoedong-seogwan-1907')
    page.locator('#bookshop-talk').click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
    assert page.locator('#npc-overlay').is_visible();assert page.locator('.npc-plate strong').inner_text()=='책방 주인'
    for title in ['전차와 새 문물','궁궐과 나라의 소식','종로 사람들의 생활']:
     page.get_by_role('button',name=title,exact=False).click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
     page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
     assert page.locator('.npc-sources a').count()>0
     assert page.locator('.npc-chapter').inner_text().endswith('1 / 4')
     for part in [2,3,4]:
      page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
      assert page.locator('.npc-chapter').inner_text().endswith(f'{part} / 4')
      assert page.locator('.npc-sources a').count()>0
     page.get_by_role('button',name='앞 이야기로 돌아가시오.',exact=False).click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
     assert page.locator('.npc-chapter').inner_text().endswith('3 / 4')
     page.locator('.npc-options button').first.click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
     assert page.locator('.npc-chapter').inner_text().endswith('4 / 4')
     page.get_by_role('button',name='다른 이야기를 들려주시오.',exact=False).click();page.evaluate('seoul1907.walking.dialogue.finishTyping()')
     assert page.locator('.npc-chapter').is_hidden()
    page.screenshot(path=f'/tmp/bookshop-dialogue-{mobile}.png')
    page.locator('.npc-close').click();page.evaluate('renderScene(seoul1907.scene,seoul1907.camera)')
    page.screenshot(path=f'/tmp/bookshop-model-{mobile}.png')
    result=page.evaluate('''()=>{const s=seoul1907,r=s.walking.stationary.records.find(r=>r.role==='storyteller');return {collision:!!s.walking.collision.hit(r.position.x,r.position.z,.4),model:!!r.owner.getObjectByName('bookshop-sign'),visible:r.person.group.visible}}''')
    assert result==dict(collision=False,model=True,visible=True),result
    assert not errors,errors
    print('PASS', 'mobile' if mobile else 'desktop',result,flush=True);ctx.close()
   browser.close()
 finally:server.terminate();server.wait();log.close()
