"""Verify the bell tower, offices and shrine added from the general survey."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
EXPECTED={
 'jongru':('종루','bell-tower'),
 'uigeumbu':('의금부','yukjo-compound'),
 'jwaporocheong':('좌포도청','yukjo-compound'),
 'uporocheong':('우포도청','yukjo-compound'),
 'hullyeonwon':('훈련원','yukjo-compound'),
 'gyeongmogung':('경모궁','palace-compound'),
}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=args.chromium_path,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1000,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded');page.wait_for_function('window.terrain3d?.ready',timeout=300000)
 rows=page.evaluate('''ids=>{const t=terrain3d;t.renderer.setAnimationLoop(null);return ids.map(id=>{
  const b=t.buildings.children.find(b=>b.userData.feature.id===id);if(!b)throw Error('missing landmark: '+id);
  const model=b.children.find(c=>c.name),tag=t.nameTags.find(n=>n.tag.userData.featureId===id),f=b.userData.feature;
  return {id,name:f.name,model:model&&model.name,label:tag.tag.userData.name,boxHidden:!b.material.visible,
   grounded:b.userData.z>b.userData.support.max,x:b.position.x,z:b.position.z,
   modern:!!f.modern_position,pixel:f.source_position&&f.source_position.pixel};
 })}''',list(EXPECTED))
 for row in rows:
  name,model=EXPECTED[row['id']]
  assert row['name']==name and row['label']==name,row
  # Every added landmark is a modern-sourced position, so the record must say so.
  assert row['model']==model and row['boxHidden'] and row['grounded'] and row['modern'],row
 print(rows,flush=True)
 place=page.evaluate('''async()=>{const t=terrain3d;
  const wall=await (await fetch('/gis/walls/doseong_city_wall.json')).json(),poly=wall.centerline;
  const inside=(x,y)=>{let c=false;for(let i=0,n=poly.length;i<n;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n];
   if((y1>y)!==(y2>y)&&x<x1+(y-y1)*(x2-x1)/(y2-y1))c=!c}return c};
  const at=id=>t.buildings.children.find(b=>b.userData.feature.id===id);
  const belfry=at('jongru').userData.feature.source_position.pixel;
  return {jongruPixel:belfry,jongruInside:inside(...belfry),
   uigeumbuNorthWest:[at('uigeumbu').position.x<at('jongru').position.x,at('uigeumbu').position.z<at('jongru').position.z],
   leftOfficeEast:at('jwaporocheong').position.x-at('jongru').position.x,
   rightOfficeWest:at('jongru').position.x-at('uporocheong').position.x,
   allInside:['uigeumbu','jwaporocheong','uporocheong','hullyeonwon','gyeongmogung'].every(id=>{
    const f=at(id).userData.feature;return f.source_position?inside(...f.source_position.pixel):true})}}''')
 print(place,flush=True)
 assert place['jongruPixel']==[1417,1442] and place['jongruInside'],place
 assert all(place['uigeumbuNorthWest']),place
 # The two police offices flank the bell tower along Unjongga.
 assert place['leftOfficeEast']>300 and place['rightOfficeWest']>200,place
 assert place['allInside'],place
 assert not errors,errors
 print('PASS: bell tower at the drawn crossing, offices and shrine placed, grounded and labelled',flush=True);b.close()
