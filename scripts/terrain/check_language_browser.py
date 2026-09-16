"""The KO | EN switch: English renders the settings panel, about panel, account dialog, shop and popup in English,
and switching back restores Korean. Content (building names, dialogue) is checked in a later step."""
import argparse

from playwright.sync_api import sync_playwright

from account_login import login

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
parser.add_argument('--shots', default='')
args = parser.parse_args()

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800}, locale='en-US')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # An English browser still gets Korean until the switch is used.
    page.goto(args.url, wait_until='domcontentloaded')
    assert page.evaluate("document.documentElement.lang") == 'ko'
    assert page.locator('#walk-together').inner_text() == '1인칭'
    page.click('#map-options-toggle')
    page.click('.lang-switch a[hreflang=en]')
    page.wait_for_function("document.documentElement.lang === 'en'")
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    assert page.locator('#walk-together').inner_text() == 'First person'
    page.click('#map-options-toggle')
    labels = page.locator('#map-options').inner_text()
    assert 'Old map' in labels and '옛지도' not in labels, labels
    page.click('#about-open')
    about = page.locator('#about-panel').inner_text()
    assert 'Hanyang 3D' in about and '한양3D는' not in about, about[:200]
    page.click('#about-panel header button')
    # Account dialog and shop window come from shop.js through the same dictionary.
    page.evaluate('terrain3d.renderer.setAnimationLoop(null);terrain3d.firstPerson.enter()')
    dialog = page.locator('#account-dialog').inner_text()
    assert 'Password' in dialog or 'password' in dialog, dialog
    page.click('#account-dialog .account-cancel')
    login(page)
    page.evaluate("terrain3d.shop.open({trade:'면포전',sells:'무명'})")
    page.wait_for_function("!terrain3d.shop.busy && terrain3d.shop.state.ready")
    shop = page.locator('#shop-window').inner_text()
    assert 'Quantity' in shop and 'Close' in shop and '수량' not in shop, shop[:300]
    page.keyboard.press('Escape')
    # Building popup labels and category.
    page.evaluate("()=>{const t=terrain3d,b=t.buildings.children.find(x=>x.userData.feature.id==='sungnyemun');t.showBuilding?.(b)}")
    if args.shots:
        page.screenshot(path=f'{args.shots}/language_en.png')
    # Content: building names and dialogue come translated from the server; the guide keeps Korean anchors.
    content = page.evaluate('''()=>{const t=terrain3d,b=t.buildings.children.find(x=>x.userData.feature.id==='sungnyemun').userData.feature;
      const n=JSON.parse(document.getElementById('npcs').textContent);const s=JSON.parse(document.getElementById('stories').textContent).stories[0];
      return {name:b.name,summary:b.info.summary.slice(0,40),keeper:n.keeper.name,hello:n.keeper.nodes.hello.text.slice(0,30),story:s.title,label:[...t.buildingNames.children].map(o=>o.userData?.name).find(x=>x&&/Sungnyemun/.test(x))||null}}''')
    hangul = lambda text: any('\uac00' <= ch <= '\ud7a3' for ch in text)
    assert content['name'].startswith('Sungnyemun') and not hangul(content['summary']) and not hangul(content['keeper']) and not hangul(content['hello']) and not hangul(content['story']), content
    guide = page.request.get(args.url + '/guide/')
    assert 'id="숭례문"' in guide.text() and 'Sungnyemun' in guide.text()
    # Server error message in English: a bad name on register.
    err = page.evaluate('''async()=>{const csrf=document.cookie.match(/csrftoken=([^;]+)/)?.[1];
      const r=await fetch('/api/account/register',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRFToken':csrf},body:JSON.stringify({name:'<bad>',password:'abcdefgh'})});return (await r.json()).error}''')
    assert err and not any('가' <= ch <= '힣' for ch in err), err
    # Back to Korean.
    page.click('#map-options-toggle')
    page.click('.lang-switch a[hreflang=ko]')
    page.wait_for_function("document.documentElement.lang === 'ko'")
    assert page.locator('#walk-together').inner_text() == '1인칭'
    assert not errors, errors
    print('PASS: language switch', {'first_person': 'First person', 'building': content['name'], 'keeper': content['keeper'], 'error_en': err[:40]}, flush=True)
    b.close()
