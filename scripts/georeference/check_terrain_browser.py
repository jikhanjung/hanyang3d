import json
from pathlib import Path
from playwright.sync_api import sync_playwright
import argparse
parser=argparse.ArgumentParser(description="Live browser checks for the Django TPS review; requires local original and internet tiles.")
parser.add_argument("--url",default="http://127.0.0.1:8000/gis/terrain/")
parser.add_argument("--browser",help="Optional installed Chromium executable")
args=parser.parse_args()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000})
 errors=[];page.on('pageerror',lambda e:(errors.append(str(e)),print('JS ERROR:',e,flush=True)))
 page.goto(args.url,wait_until='domcontentloaded')
 page.wait_for_function('picture.complete && picture.naturalWidth===3124')
 page.wait_for_function('!bases.topo.isLoading()',timeout=45000)
 page.wait_for_timeout(500)
 assert page.evaluate('points.length')==5
 assert page.evaluate('folds')==0
 print('Initial TPS loaded; no folds')
 page.screenshot(path='/tmp/doseong-tps-initial.png')
 initial=page.locator('.doseong-canvas').evaluate('(c)=>c.toDataURL()')
 page.locator('#method').select_option('affine')
 assert page.locator('.doseong-canvas').evaluate('(c)=>c.toDataURL()')!=initial
 page.locator('#method').select_option('tps')
 before=page.evaluate('points[4].lon')
 box=page.locator('.warp-point').nth(4).bounding_box()
 page.mouse.move(box['x']+12,box['y']+12);page.mouse.down();page.mouse.move(box['x']+62,box['y']+12,steps=8);page.mouse.up()
 assert page.evaluate('points[4].lon')!=before
 page.locator('#pointName').fill('추가점')
 page.locator('#addPoint').click()
 xy=page.evaluate('map.latLngToContainerPoint(position(1500,1800))')
 page.locator('#map').click(position=xy)
 assert page.evaluate('pending.stage')=='target'
 page.locator('#map').click(position={'x':xy['x']+15,'y':xy['y']+10})
 assert page.evaluate('points.length')==6
 page.locator('#grid').check()
 with page.expect_download() as item:page.locator('#save').click()
 path=Path(item.value.path());record=json.loads(path.read_text());assert len(record['points'])==6
 page.locator('#resetPoints').click();assert page.evaluate('points.length')==5
 page.locator('#load').set_input_files(str(path));page.wait_for_function('points.length===6')
 # Invalid imports leave the last good deformation unchanged.
 bad=dict(record);bad['points']=[dict(x) for x in record['points']];bad['points'][0]['pixel']=[-1,0]
 page.locator('#load').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
 page.wait_for_function("document.getElementById('status').textContent.startsWith('불러오기 실패')")
 assert page.evaluate('points[0].pixel[0]')==998
 page.locator('#resetPoints').click();page.locator('#grid').uncheck()
 page.locator('#base').select_option('osm');page.wait_for_function('!bases.osm.isLoading()',timeout=45000);page.wait_for_timeout(500)
 page.evaluate('map.setView([37.573,126.984],15)');page.wait_for_timeout(1000)
 page.screenshot(path='/tmp/doseong-tps-jongno.png')
 print('Segment length ratios:',page.evaluate('''()=>{const west=points.find(p=>p.name==='돈의문 터').pixel,mid=[1155,1441],east=[2495,1408];return {west:projected(...west).distanceTo(projected(...mid))/raw(...west).distanceTo(raw(...mid)),east:projected(...east).distanceTo(projected(...mid))/raw(...east).distanceTo(raw(...mid))}}'''))
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/doseong-tps-mobile.png')
 assert not errors,errors
 print('TPS browser checks passed: render, affine comparison, point drag, point add, grid, export/import, invalid input, mobile')
 browser.close()
