"""Temporary accounts/server: desktop action slots, 16-cell bag, HUD layout and real peer chat."""
import os,subprocess,tempfile,time,sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
from account_login import LOGIN_JS
os.chdir(Path(__file__).resolve().parents[2])
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files','HANYANG_MULTIPLAYER_URL':'http://127.0.0.1:18100'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as web_log,open(tmp+'/mp.log','w') as mp_log:
  web=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18099','--noreload'],env=env,stdout=web_log,stderr=web_log)
  mp=subprocess.Popen(['node','multiplayer/server.js'],env={**os.environ,'WALK_PORT':'18100','WALK_ORIGINS':'http://127.0.0.1:18099'},stdout=mp_log,stderr=mp_log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18099/1907/');urlopen('http://127.0.0.1:18100/healthz');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    browser=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    pages=[]
    for i in range(2):
     page=browser.new_page(viewport={'width':1280,'height':900});pages.append(page)
     page.goto('http://127.0.0.1:18099/1907/');page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=180000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error')
     page.evaluate(LOGIN_JS.replace('terrain3d.shop','seoul1907.walking.shop'),['액션검사'+str(i),'hud-check-1907'])
     page.evaluate("document.getElementById('walk-together').click()")
     page.wait_for_function('seoul1907.walking.together.connected',timeout=30000)
    page=pages[0];page.wait_for_function("document.getElementById('walk-together-status').textContent.includes('2')")
    page.evaluate("()=>{const s=seoul1907.walking.shop,n=JSON.parse(document.getElementById('npcs').textContent);window.reins=Object.keys(n.items).find(k=>n.items[k].use==='mount');s.state.items[reins]=1;s.openPack()}")
    assert page.locator('#pack-window .pack-items > *').count()==16
    data=page.evaluate_handle('new DataTransfer()');reins=page.evaluate('reins')
    page.locator(f'#pack-window .shop-slot[data-item="{reins}"]').dispatch_event('dragstart',{'dataTransfer':data})
    page.locator('.action-slot[data-slot="0"]').dispatch_event('drop',{'dataTransfer':data})
    page.locator('#pack-window .pack-close').click();page.locator('#scene > canvas').focus();page.keyboard.press('1')
    assert page.evaluate('seoul1907.firstPerson.mounted')
    page.keyboard.press('1');assert page.evaluate('!seoul1907.firstPerson.mounted')
    page.keyboard.press('Enter');assert page.locator('#walk-chat-input').evaluate('(e)=>e===document.activeElement')
    # Opening the chat shows it at once, even after it faded out while quiet.
    assert page.evaluate("getComputedStyle(document.getElementById('walk-chat')).opacity")=='1'
    page.keyboard.type('123 채팅 검사');assert page.evaluate('!seoul1907.firstPerson.mounted')
    page.keyboard.press('Enter');pages[1].wait_for_function("document.getElementById('walk-chat-messages').textContent.includes('123 채팅 검사')")
    assert page.locator('#walk-chat').is_visible() and not page.locator('#walk-chat-input').is_visible()
    page.keyboard.press('Enter');page.keyboard.press('Escape');assert page.evaluate('seoul1907.firstPerson.active')
    page.locator('#scene > canvas').focus()
    page.keyboard.down('w')
    page.evaluate("window.dispatchEvent(new Event('blur'))")
    movement=page.evaluate("()=>{const f=seoul1907.firstPerson,p=f.eye;for(let i=0;i<10;i++)f.update(.03);return f.eye.distanceTo(p)}")
    assert movement>.1,movement
    page.keyboard.press('Enter')
    assert page.evaluate("()=>{const f=seoul1907.firstPerson,p=f.eye;for(let i=0;i<10;i++)f.update(.03);return f.eye.distanceTo(p)<.01}")
    page.keyboard.up('w');page.keyboard.press('Escape')
    print('PASS movement survives blur and chat stops movement',flush=True)
    boxes=page.evaluate("""()=>{const r=id=>{const b=document.getElementById(id).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};return {name:r('player-hud'),status:r('walk-together-status'),money:r('money-hud'),compass:r('compass'),mini:r('first-person-map'),bar:r('action-bar'),chat:r('walk-chat')}}""")
    assert boxes['name']['y']>=boxes['status']['bottom'] and boxes['money']['y']>=boxes['compass']['bottom'],boxes
    assert boxes['mini']['w']>=240 and boxes['chat']['bottom']<=boxes['bar']['y'],boxes
    page.screenshot(path='/tmp/game-hud-desktop.png');print('PASS desktop HUD, actions, bag and peer chat',boxes,flush=True)
    page.reload();page.wait_for_function('window.seoul1907?.ready || window.seoul1907?.error',timeout=180000);assert page.evaluate('seoul1907.ready'),page.evaluate('seoul1907.error');page.evaluate("document.getElementById('walk-together').click()");page.wait_for_function('seoul1907.firstPerson.active');assert '말고삐' in page.locator('.action-slot[data-slot="0"]').get_attribute('aria-label')
    page.set_viewport_size({'width':390,'height':844});assert not page.locator('#action-bar').is_visible();page.evaluate('seoul1907.walking.shop.openPack()');assert page.locator('#pack-window .pack-items > *').count()==16;page.screenshot(path='/tmp/game-hud-mobile.png');print('PASS saved bindings and mobile bag',flush=True)
    browser.close()
  finally:
   web.terminate();mp.terminate();web.wait(timeout=15);mp.wait(timeout=15)
