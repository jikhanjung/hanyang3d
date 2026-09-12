"""Inspect ground coloring, granite tree thinning and opacity-independent placement."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1100,'height':800});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:errors.append(m.text) if m.type=='error' and ('Shader' in m.text or 'VALIDATE_STATUS' in m.text) else None)
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 result=page.evaluate('''()=>{const t=terrain3d;t.renderer.setAnimationLoop(null);const before=t.buildings.children.map(b=>b.position.toArray());const vertices=Array.from(t.terrain.geometry.attributes.position.array);const mask=t.groundColors,ctx=mask.canvas.getContext('2d');let green=0;for(const r of t.trees.records.slice(0,100)){const x=Math.floor((r.x-mask.min.x)/mask.size.x*2048),y=Math.floor((r.z-mask.min.y)/mask.size.y*2048);if(ctx.getImageData(x,y,1,1).data[0]>100)green++}if(green<90)throw Error('green mask misses trees');const retained=t.trees.records.filter(r=>t.granite.treeProbability({x:r.x,y:r.support.max,z:r.z})<.5).length;if(!t.trees.rockThinned||!retained)throw Error('rock trees should be sparse but present');for(const v of [0,50,0]){const e=document.getElementById('opacity3d');e.value=v;e.oninput();if(JSON.stringify(before)!==JSON.stringify(t.buildings.children.map(b=>b.position.toArray())))throw Error('building moved');if(vertices.some((v,i)=>v!==t.terrain.geometry.attributes.position.array[i]))throw Error('terrain moved')}t.renderer.render(t.scene,t.camera);return {trees:t.trees.records.length,rockThinned:t.trees.rockThinned,retainedRockTrees:retained,greenSamples:green,maskTreeCount:mask.treeCount}}''')
 assert result['trees']==result['maskTreeCount']
 print(result,flush=True)
 page.screenshot(path='/tmp/ochre-ground.png',timeout=120000)
 page.evaluate("document.getElementById('granite-focus').onclick();terrain3d.controls.update();terrain3d.updateBuildingNames();terrain3d.renderer.render(terrain3d.scene,terrain3d.camera)")
 page.screenshot(path='/tmp/sparse-granite-trees.png',timeout=120000)
 assert not errors,errors
 print('PASS: woodland mask follows remaining trees, rock trees sparse but present, map opacity does not move terrain or buildings, shaders render',flush=True)
 b.close()
