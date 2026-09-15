"""Verify NPC conversations and the shop by clicking people on the map.

The keeper and a gate officer open the adventure-style overlay (portrait, name plate, typed text, sourced choices),
a shopkeeper's 거래하기 opens the shop where buying and selling go through the server API (the page shows the
server's coins and pack), and a passer-by and a
soldier only greet in a speech bubble.
"""
import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014')
parser.add_argument('--shots', default='')
args = parser.parse_args()

AIM = '''([kind, id]) => {
  const t = terrain3d, T = t.camera.position.constructor;
  let feet;
  if (kind === 'keeper' || kind === 'officer' || kind === 'soldier') {
    const model = t.guardModels.find(m => m.parent.userData.feature.id === id);
    const role = kind === 'keeper' ? 'keeper' : kind;
    const person = model.children.find(c => c.userData.role === role);
    feet = person.getWorldPosition(new T());
  } else if (kind === 'merchant') {
    feet = t.sijeon.keepers()[id].position.clone();
  } else {
    feet = t.pedestrians.walkers[id].position.clone();
  }
  t.controls.target.copy(feet).add(new T(0, 1, 0));
  t.camera.position.copy(feet).add(new T(4, 3, 7));
  t.controls.update(); t.updateBuildingNames(); t.renderer.render(t.scene, t.camera);
  const r = t.renderer.domElement.getBoundingClientRect(), v = feet.clone().add(new T(0, 1, 0)).project(t.camera);
  return {x: r.left + (v.x + 1) * r.width / 2, y: r.top + (1 - v.y) * r.height / 2};
}'''

with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = b.new_page(viewport={'width': 1100, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(args.url, wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=450000)
    # Coins and the pack live on the server; the page shows them in the coin display.
    page.wait_for_function("terrain3d.shop?.state.ready")
    hud = page.evaluate("document.getElementById('money-hud').textContent")
    assert hud.startswith('엽전 ') and '냥' in hud, hud
    page.evaluate('terrain3d.renderer.setAnimationLoop(null)')

    def click(kind, ident):
        point = page.evaluate(AIM, [kind, ident])
        page.mouse.move(point['x'], point['y'])
        page.mouse.down()
        page.mouse.up()

    state = "()=>({overlay:!document.getElementById('npc-overlay').hidden,bubble:!document.getElementById('npc-bubble').hidden,name:document.querySelector('.npc-plate strong')?.textContent,text:document.querySelector('.npc-line')?.textContent,bubbleText:document.getElementById('npc-bubble').textContent,options:[...document.querySelectorAll('.npc-options button')].map(b=>b.textContent),sources:[...document.querySelectorAll('.npc-sources a')].map(a=>a.href)})"

    # Keeper: overlay, typed text can be finished, a sourced story, Esc closes and the keeper resumes walking.
    click('keeper', 'gwanghwamun')
    keeper = page.evaluate(state)
    assert keeper['overlay'] and keeper['name'] == '경복궁 궁감' and not keeper['bubble'], keeper
    assert page.evaluate("terrain3d.guardModels.find(m=>m.userData.keeper).userData.talk.active")
    page.click('.npc-line')
    page.keyboard.press('1')
    page.click('.npc-line')
    story = page.evaluate(state)
    assert '1395' in story['text'] and any('royal.khs.go.kr' in s for s in story['sources']), story
    if args.shots:
        Path(args.shots).mkdir(parents=True, exist_ok=True)
        page.screenshot(path=f'{args.shots}/npc_keeper.png')
    page.keyboard.press('Escape')
    closed = page.evaluate(state)
    assert not closed['overlay'] and not page.evaluate("terrain3d.guardModels.find(m=>m.userData.keeper).userData.talk.active"), closed

    # Gate officer: overlay with gate-specific name and sourced answers; soldier: greeting bubble only.
    click('officer', 'donhwamun')
    officer = page.evaluate(state)
    assert officer['overlay'] and officer['name'] == '돈화문 수문장' and len(officer['options']) == 4, officer
    page.keyboard.press('Escape')
    click('soldier', 'sungnyemun')
    soldier = page.evaluate(state)
    assert soldier['bubble'] and not soldier['overlay'] and soldier['bubbleText'], soldier

    # Shopkeeper: overlay, then 거래하기 opens the shop; buy one item and sell it back.
    merchant_index = page.evaluate("terrain3d.sijeon.keepers().findIndex(k=>k.trade==='면포전')")
    assert merchant_index >= 0
    click('merchant', merchant_index)
    merchant = page.evaluate(state)
    assert merchant['overlay'] and merchant['name'] == '면포전 상인' and any('거래하기' in o for o in merchant['options']), merchant
    page.click('.npc-line')
    page.locator('.npc-options button', has_text='거래하기').click()
    page.wait_for_function("terrain3d.shop.state.ready && !terrain3d.shop.busy")
    shop = page.evaluate("()=>({open:!document.getElementById('shop-window').hidden,title:document.querySelector('.shop-title').textContent,goods:document.querySelectorAll('.shop-goods .shop-slot').length,money:terrain3d.shop.state.money,items:{...terrain3d.shop.state.items}})")
    assert shop['open'] and shop['title'].startswith('면포전') and shop['goods'] >= 1, shop
    owned = sum(shop['items'].values())
    page.locator('.shop-goods .shop-slot').first.click()
    page.wait_for_function(f"terrain3d.shop.state.money < {shop['money']} && !terrain3d.shop.busy")
    bought = page.evaluate("async()=>({money:terrain3d.shop.state.money,items:{...terrain3d.shop.state.items},pack:document.querySelectorAll('.shop-pack .shop-slot').length,hud:document.getElementById('money-hud').textContent,server:await (await fetch('/api/player/')).json(),stored:localStorage.getItem('hanyang3d-pack')})")
    assert sum(bought['items'].values()) == owned + 1 and bought['pack'] >= 1 and bought['stored'] is None, bought
    assert bought['server'] == {'money': bought['money'], 'items': bought['items']}, bought
    if args.shots:
        page.screenshot(path=f'{args.shots}/npc_shop.png')
    page.locator('.shop-pack .shop-slot').first.click()
    page.wait_for_function(f"terrain3d.shop.state.money > {bought['money']} && !terrain3d.shop.busy")
    sold = page.evaluate("async()=>({money:terrain3d.shop.state.money,items:{...terrain3d.shop.state.items},server:await (await fetch('/api/player/')).json()})")
    assert bought['money'] < sold['money'] < shop['money'] and sum(sold['items'].values()) == owned, sold
    assert sold['server']['money'] == sold['money'], sold
    page.keyboard.press('Escape')
    assert page.evaluate("document.getElementById('shop-window').hidden")

    # Passer-by: greeting bubble only.
    click('walker', 5)
    walker = page.evaluate(state)
    assert walker['bubble'] and not walker['overlay'] and walker['bubbleText'], walker
    assert not errors, errors
    print('PASS: NPC dialogue', {'keeper': story['text'][:20], 'officer': officer['name'], 'soldier': soldier['bubbleText'],
                                 'merchant': merchant['name'], 'shop': [shop['money'], bought['money'], sold['money']], 'walker': walker['bubbleText']}, flush=True)
    b.close()
