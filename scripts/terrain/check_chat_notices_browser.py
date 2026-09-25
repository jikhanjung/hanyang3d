"""Mount notices go to the chat log only (not over the action bar); the chat log fades out after a quiet spell and
comes back with the next message. 1750 and 1907 scenes, desktop, walking alone."""
import os,subprocess,tempfile,time,sys
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
os.chdir(Path(__file__).resolve().parents[2]);sys.path.insert(0,'scripts/terrain')
from account_login import LOGIN_JS
BUY="""async()=>{const csrf=document.cookie.split('; ').find(x=>x.startsWith('csrftoken='))?.slice(10);await fetch('/api/shop/trade',{method:'POST',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({action:'buy',shop:'말 장수',item:'horse_reins',quantity:1})})}"""
STATE="""()=>({bar:document.getElementById('action-message').textContent,log:document.getElementById('walk-chat-messages').textContent,shown:!document.getElementById('walk-chat').hidden,faded:document.getElementById('walk-chat').classList.contains('faded'),opacity:getComputedStyle(document.getElementById('walk-chat')).opacity})"""
with tempfile.TemporaryDirectory() as tmp:
 env={**os.environ,'HANYANG_DB_PATH':tmp+'/db.sqlite3','HANYANG_CONTENT_SOURCE':'files'}
 subprocess.run([sys.executable,'manage.py','migrate','--noinput'],env=env,check=True,stdout=subprocess.DEVNULL)
 with open(tmp+'/web.log','w') as log:
  server=subprocess.Popen([sys.executable,'manage.py','runserver','127.0.0.1:18146','--noreload'],env=env,stdout=log,stderr=log)
  try:
   for _ in range(100):
    try:urlopen('http://127.0.0.1:18146/');break
    except OSError:time.sleep(.1)
   with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    for path,app,shop,user in [('/','terrain3d','terrain3d.shop','채팅검사가'),('/1907/','seoul1907','seoul1907.walking.shop','채팅검사나')]:
     page=b.new_page(viewport={'width':1100,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.goto('http://127.0.0.1:18146'+path);page.wait_for_function(f'window.{app}?.ready',timeout=180000)
     page.evaluate(LOGIN_JS.replace('terrain3d.shop',shop),[user,'chat-notice-check'])
     page.evaluate(BUY);page.evaluate(f'{shop}.refresh()')
     page.evaluate(f'{app}.firstPerson?.enter?.()??{app}.walking?.firstPerson?.enter?.()')
     page.wait_for_function(f"{shop}.state.items.horse_reins>0")
     page.evaluate(f"""(()=>{{const s={shop};s.openPack();document.querySelector('.pack-use[data-item=horse_reins]').click();s.closePack()}})()""")
     first=page.evaluate(STATE);print(path,'MOUNT',first,flush=True)
     assert '말에 올랐소' in first['log'] and first['shown'] and not first['faded'] and '말에 올랐' not in first['bar'],first
     page.wait_for_timeout(10000);later=page.evaluate(STATE);print(path,'LATER',later,flush=True)
     assert later['faded'] and float(later['opacity'])<.05,later
     page.evaluate(f"""(()=>{{const s={shop};s.openPack();document.querySelector('.pack-use[data-item=horse_reins]').click();s.closePack()}})()""")
     again=page.evaluate(STATE);print(path,'AGAIN',again,flush=True)
     assert '말에서 내렸소' in again['log'] and not again['faded'] and '내렸' not in again['bar'],again
     assert not errors,errors;page.close()
    b.close();print('PASS')
  finally:server.terminate();server.wait(timeout=10)
