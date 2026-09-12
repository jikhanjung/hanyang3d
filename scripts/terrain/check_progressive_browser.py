"""Hold later assets to prove early frames and navigation do not wait for them."""
import asyncio,json
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/home/jikhanjung/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  image_gate=asyncio.Event();houses_gate=asyncio.Event()
  async def hold_image(route):await image_gate.wait();await route.continue_()
  async def hold_houses(route):await houses_gate.wait();await route.continue_()
  await page.route('**/asset-0001.jpg',hold_image);await page.route('**/doseong_settlement.json',hold_houses)
  await page.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded')
  await page.wait_for_function('window.terrainLoading?.stage===1',timeout=90000)
  assert await page.evaluate('!window.terrain3d?.ready && terrainLoading.scene.children.some(m=>m.isMesh)')
  await page.screenshot(path='/tmp/hanyang-loading-terrain.png')
  before=await page.evaluate('terrainLoading.camera.position.toArray()')
  rect=await page.locator('#scene > canvas').bounding_box();x=rect['x']+rect['width']/2;y=rect['y']+rect['height']/2
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+80,y+20,steps=5);await page.mouse.up();await page.wait_for_timeout(200)
  assert await page.evaluate('terrainLoading.camera.position.toArray()')!=before
  image_gate.set()
  await page.wait_for_function('terrainLoading.stage===5 || !document.getElementById("loading-retry").hidden',timeout=300000)
  assert await page.evaluate('terrainLoading.stage===5'),await page.locator('#error').inner_text()
  assert await page.evaluate('!window.terrain3d?.ready && !terrainLoading.scene.getObjectByName("speculative-roadside-buildings")')
  await page.screenshot(path='/tmp/hanyang-loading-before-houses.png')
  houses_gate.set();await page.wait_for_function('window.terrain3d?.ready',timeout=300000)
  result=await page.evaluate('''()=>({stages:terrainLoading.history.map(s=>s.stage),times:terrainLoading.history.map(s=>Math.round(s.time)),vertices:terrain3d.terrain.geometry.attributes.position.count,maxCut:terrain3d.channelState.maxCut,houses:terrain3d.settlement.visibleCount,people:terrain3d.pedestrians.walkers.length,anchorError:terrain3d.anchorError})''');print(result,flush=True)
  assert result['stages']==list(range(9)) and result['houses']==2540 and result['people']==130 and result['anchorError']==0
  assert result['vertices']==2013324 and abs(result['maxCut']-77.3865082930418)<.0001
  assert await page.locator('#scene-loading').is_hidden()
  assert await page.locator('#people3d').is_enabled()
  await page.evaluate('terrain3d.renderer.setAnimationLoop(null)')
  await page.locator('#carve3d').uncheck()
  assert await page.evaluate('terrain3d.surfaceBaselines.every(b=>b.original.every((h,i)=>h===b.mesh.geometry.userData.heights[i]))')
  await page.locator('#carve3d').check();assert not errors,errors
  await page.close()
  # A failed map request must keep the terrain visible and provide a retry.
  failed=await browser.new_page();await failed.route('**/asset-0001.jpg',lambda route:route.abort())
  await failed.goto('http://127.0.0.1:8000/gis/terrain/3d/',wait_until='domcontentloaded')
  await failed.wait_for_function('!document.getElementById("loading-retry").hidden',timeout=90000)
  assert await failed.evaluate('terrainLoading.scene.children.some(m=>m.isMesh)&&terrainLoading.stage===1')
  print('Passed: terrain before map, orbit during load, core scene before houses, ordered stages, unchanged geometry, restoration and partial-load retry',flush=True)
  await browser.close()
asyncio.run(main())
