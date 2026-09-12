"""Check real mouse input against the production orbit-navigation module."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://127.0.0.1:18014')
parser.add_argument('--chromium-path')
args=parser.parse_args()
html='''<style>body{margin:0}canvas{width:800px;height:600px;touch-action:none}</style><canvas width="800" height="600"></canvas>
<script type="importmap">{"imports":{"three":"/webapp/static/vendor/three/three.module.js"}}</script>
<script type="module">
import * as T from 'three';
import {OrbitControls} from '/webapp/static/vendor/three/OrbitControls.js';
import {setupOrbitNavigation} from '/webapp/static/orbit_navigation.js';
const camera=new T.PerspectiveCamera(43,800/600,.1,10000),canvas=document.querySelector('canvas');
camera.position.set(0,600,800);const controls=new OrbitControls(camera,canvas);controls.update();
const plane=new T.Plane(new T.Vector3(0,1,0),0);
setupOrbitNavigation(camera,controls,canvas,ray=>ray.intersectPlane(plane,new T.Vector3()),()=>false,()=>0);
window.pose=()=>({p:camera.position.toArray(),q:camera.quaternion.toArray(),t:controls.target.toArray(),d:controls.getDistance()});
window.ready=true;
</script>'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':800,'height':600});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/__mouse_check',lambda route:route.fulfill(content_type='text/html',body=html))
 page.goto(args.url+'/__mouse_check');page.wait_for_function('window.ready')
 def drag(button,dx,dy):
  page.mouse.move(400,300);page.mouse.down(button=button)
  before=page.evaluate('pose()')
  page.mouse.move(400+dx,300+dy,steps=8);page.mouse.up(button=button)
  return before,page.evaluate('pose()')
 def delta(a,b):return sum((x-y)**2 for x,y in zip(a,b))**.5
 a,c=drag('left',80,45)
 assert delta(a['p'],c['p'])>10 and delta(a['q'],c['q'])<1e-7
 assert abs(a['p'][1]-c['p'][1])<1e-7
 assert delta([c['p'][i]-a['p'][i] for i in range(3)],[c['t'][i]-a['t'][i] for i in range(3)])<1e-7
 a,c=drag('middle',70,40)
 assert delta(a['q'],c['q'])>.01 and abs(a['d']-c['d'])<1e-6
 a,c=drag('right',0,-50)
 assert abs(a['d']-c['d'])>1
 page.mouse.move(400,300);a=page.evaluate('pose()');page.mouse.wheel(0,-120);page.wait_for_timeout(100);c=page.evaluate('pose()')
 assert abs(a['d']-c['d'])>1 and not errors,errors
 print('PASS: left horizontal pan preserves view; middle rotates at fixed distance; right drag and scroll zoom')
 b.close()
