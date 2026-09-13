"""Verify the bell tower, offices and shrine added from the general survey."""
import argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:18014');parser.add_argument('--chromium-path');args=parser.parse_args()
EXPECTED={
 'jongru':('종루','bell-tower'),
 'uigeumbu':('의금부','yukjo-compound'),
 'jwaporocheong':('좌포도청','yukjo-compound'),
 'uporocheong':('우포도청','yukjo-compound'),
 'hullyeonwon':('훈련원','training-ground'),
 'gyeongmogung':('경모궁','palace-compound'),
 'wongaksa_pagoda':('원각사지 십층석탑','wongaksa-pagoda'),
 'geumwiyeong':('금위영','yukjo-compound'),
 'eoyeongcheong':('어영청','yukjo-compound'),
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
 # The belfry is the single-storey 1619 pavilion, with the 1468 bell hung in the open hall.
 belfry=page.evaluate('''()=>{const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id==='jongru');
  const m=b.getObjectByName('bell-tower'),u=m.userData;
  return {storeys:u.storeys,bays:u.bays,bellHeightM:u.bellHeightM,bellMouthM:u.bellMouthM,meshes:m.children.length,bellInsideHall:u.bellBottom>0&&u.bellBottom+u.bellHeightM<u.hallTop,
   parts:['great-bell','bell-hook','hall-column','gable-panel','tile-roof','footing-stone'].filter(p=>u.parts.includes(p)),upper:u.parts.includes('upper-column')}}''')
 print(belfry,flush=True)
 # Around 1750 the pagoda stood seven storeys high with its top three lying beside it.
 pagoda=page.evaluate('''()=>{const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id==='wongaksa_pagoda');
  const u=b.getObjectByName('wongaksa-pagoda').userData;return {standing:u.standingStoreys,fallen:u.fallenStoreys,height:u.standingHeightM,
   parts:['pagoda-base','pagoda-storey','pagoda-roof','fallen-storey'].filter(p=>u.parts.includes(p))}}''')
 print(pagoda,flush=True)
 assert pagoda['standing']==7 and pagoda['fallen']==3 and 7<pagoda['height']<12 and len(pagoda['parts'])==4,pagoda
 # The pagoda stands north of Unjongga between the drawn Jangtonggyo and Supyogyo, west of Supyogyo.
 order=page.evaluate('''()=>{const t=terrain3d,pg=t.buildings.children.find(b=>b.userData.feature.id==='wongaksa_pagoda').position;
  const bridge=name=>t.bridges.children.find(b=>b.userData.feature.name.startsWith(name)).position;
  const j=bridge('장통교'),s=bridge('수표교');return {westOfSupyo:s.x-pg.x,eastOfJangtong:pg.x-j.x,northOfSupyo:s.z-pg.z}}''')
 print(order,flush=True)
 assert order['westOfSupyo']>20 and order['eastOfJangtong']>20 and order['northOfSupyo']>100,order
 # The Geumwiyeong camp sits just west of the drawn Donhwamun without touching it.
 camp=page.evaluate('''()=>{const t=terrain3d,at=id=>t.buildings.children.find(b=>b.userData.feature.id===id);
  const c=at('geumwiyeong'),g=at('donhwamun'),[cw,,cd]=c.userData.feature.symbol_size_m,[gw,,gd]=g.userData.feature.symbol_size_m;
  return {west:g.position.x-c.position.x,north:Math.abs(g.position.z-c.position.z),gapM:(g.position.x-gw/2)-(c.position.x+cw/2)}}''')
 print(camp,flush=True)
 assert 25<camp['west']<60 and camp['north']<15 and camp['gapM']>0,camp
 # Eoyeongcheong stands east of Jongmyo, clear of the shrine's footprint.
 camp2=page.evaluate('''()=>{const t=terrain3d,at=id=>t.buildings.children.find(b=>b.userData.feature.id===id);
  const e=at('eoyeongcheong'),j=at('jongmyo'),[ew,,ed]=e.userData.feature.symbol_size_m,[jw,,jd]=j.userData.feature.symbol_size_m;
  return {eastOfJongmyo:e.position.x-j.position.x,gapM:(e.position.x-ew/2)-(j.position.x+jw/2)}}''')
 print(camp2,flush=True)
 assert camp2['eastOfJongmyo']>60 and camp2['gapM']>0,camp2
 # The drill ground keeps an open field south of its offices.
 field=page.evaluate('''()=>{const t=terrain3d,b=t.buildings.children.find(b=>b.userData.feature.id==='hullyeonwon');
  const m=b.getObjectByName('training-ground'),[w,,d]=b.userData.feature.symbol_size_m;
  return {widthM:w,depthM:d,fieldDepthM:m.userData.fieldDepthM,
   parts:['field','sacheong-roof','target','flag-post','gate-roof'].filter(p=>m.userData.parts.includes(p))}}''')
 print(field,flush=True)
 assert field['widthM']>=120 and field['depthM']>=170 and field['fieldDepthM']>100,field
 assert len(field['parts'])==5,field
 assert belfry['bays']==[5,4] and belfry['bellHeightM']==3.18 and belfry['bellMouthM']==2.28,belfry
 assert belfry['storeys']==1 and not belfry['upper'] and belfry['bellInsideHall'],belfry
 assert len(belfry['parts'])==6 and belfry['meshes']<=8,belfry
 place=page.evaluate('''async()=>{const t=terrain3d;
  const wall=await (await fetch('/gis/walls/doseong_city_wall.json')).json(),poly=wall.centerline;
  const inside=(x,y)=>{let c=false;for(let i=0,n=poly.length;i<n;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%n];
   if((y1>y)!==(y2>y)&&x<x1+(y-y1)*(x2-x1)/(y2-y1))c=!c}return c};
  const at=id=>t.buildings.children.find(b=>b.userData.feature.id===id);
  const belfry=at('jongru').userData.feature.source_position.pixel,office=at('uigeumbu').userData.feature.source_position.pixel;
  return {jongruPixel:belfry,uigeumbuPixel:office,jongruInside:inside(...belfry),
   uigeumbuNorthWest:[at('uigeumbu').position.x<at('jongru').position.x,at('uigeumbu').position.z<at('jongru').position.z],
   leftOfficeEast:at('jwaporocheong').position.x-at('jongru').position.x,
   rightOfficeWest:at('jongru').position.x-at('uporocheong').position.x,
   allInside:['uigeumbu','jwaporocheong','uporocheong','hullyeonwon','gyeongmogung','wongaksa_pagoda','geumwiyeong','eoyeongcheong'].every(id=>{
    const f=at(id).userData.feature;return f.source_position?inside(...f.source_position.pixel):true})}}''')
 print(place,flush=True)
 # Both sit in the blocks either side of the drawn Jongno crossing, not on the streets.
 assert place['jongruPixel']==[1444,1451] and place['uigeumbuPixel']==[1400,1408] and place['jongruInside'],place
 assert all(place['uigeumbuNorthWest']),place
 # The two police offices flank the bell tower along Unjongga.
 assert place['leftOfficeEast']>300 and place['rightOfficeWest']>200,place
 assert place['allInside'],place
 # None of the added landmarks may sit on a street read from the old map.
 roads=page.evaluate('''async(ids)=>{const t=terrain3d;
  const img=new Image();img.src='/gis/roads/doseong_road_mask.png';await img.decode();
  const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
  const MX=2.0838,MY=1.8092,out={};
  for(const b of t.buildings.children){
   const f=b.userData.feature;if(!ids.includes(f.id)||!f.source_position)continue;
   const [px,py]=f.source_position.pixel,[w,,d]=f.symbol_size_m;
   const hw=Math.round(w/2/MX),hd=Math.round(d/2/MY);
   const data=ctx.getImageData(px-hw,py-hd,hw*2+1,hd*2+1).data;
   let hits=0;for(let i=3;i<data.length;i+=4)if(data[i]>100)hits++;
   out[f.id]=hits;
  }
  return out}''',list(EXPECTED))
 print(roads,flush=True)
 assert all(v==0 for v in roads.values()),roads
 # The shop rows: open fronts, a clear avenue between them, and no Jongmyo stretch.
 shops=page.evaluate('''()=>{const t=terrain3d,s=t.sijeon;
  const jongmyo=t.buildings.children.find(b=>b.userData.feature.id==='jongmyo');
  const east=Math.max(...s.records.map(r=>r.x));
  return {blocks:s.records.length,bays:s.bayCount,visible:s.visibleCount,
   meshNames:[...s.group.children,...s.group.getObjectByName('shop-keepers-and-signs').children].map(m=>m.name),
   keepers:s.keeperCount,signs:s.signs.map(b=>b.userData.hangul),goods:s.goodsMeshes.map(m=>[m.userData.trade,m.count]),
   metresShortOfJongmyo:jongmyo.position.x-east,
   minPairGap:Math.min(...s.records.filter(r=>r.side<0).map(a=>Math.min(...s.records.filter(b=>b.side>0&&Math.abs(b.x-a.x)<12).map(b=>Math.hypot(b.x-a.x,b.z-a.z)))))}}''')
 print(shops,flush=True)
 assert shops['blocks']>60 and shops['bays']>400,shops
 for name in ['shop-counters','shop-awnings','awning-post-left','shopkeepers','shop-sign']:
  assert name in shops['meshNames'],shops
 # The dark interior boxes are gone; keepers stand behind most counters, signs appear here and there.
 assert 'shop-interiors' not in shops['meshNames'],shops
 assert shops['keepers']>shops['blocks'] and 5<=len(shops['signs'])<=shops['blocks']//3,shops
 assert set(shops['signs'])<={'선전','면포전','면주전','내어물전','저포전'},shops
 # Every trade zone has painted goods cards, at least one per shop.
 assert {g[0] for g in shops['goods']}=={'선전','면포전','면주전','내어물전','저포전'},shops
 assert sum(g[1] for g in shops['goods'])>=shops['blocks'],shops
 # Rows face each other across a street at least 17 m wide, and stop before Jongmyo.
 assert shops['minPairGap']>17,shops
 assert shops['metresShortOfJongmyo']>150,shops
 assert not errors,errors
 print('PASS: bell tower at the drawn crossing, offices and shrine placed, grounded and labelled',flush=True);b.close()
