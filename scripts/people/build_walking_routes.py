"""Read three visible road corridors; snap samples to their red ink where clear."""
import json,math,hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2];mask_path=root/'gis/roads/doseong_road_mask.png';mask=np.asarray(Image.open(mask_path).getchannel('A'))>0
roads=[('jongno','종로',[[1200,1446],[1510,1437],[1620,1427],[1990,1417],[2445,1410]],90),('yukjo','육조거리',[[1157,1220],[1156,1320],[1155,1400]],20),('west','돈의문 안쪽 길',[[810,1480],[920,1490],[925,1460],[970,1445],[1080,1448]],20)]
routes=[]
for id,name,guide,count in roads:
 points=[];gaps=0
 for a,b in zip(guide,guide[1:]):
  steps=math.ceil(math.dist(a,b)/4)
  for i in range(steps):
   t=i/steps;x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t;ix,iy=round(x),round(y)
   yy,xx=np.nonzero(mask[iy-12:iy+13,ix-12:ix+13]);xx=xx+ix-12;yy=yy+iy-12
   if len(xx):
    k=np.argmin((xx-x)**2+(yy-y)**2);p=[int(xx[k]),int(yy[k])]
   else:p=[round(x,2),round(y,2)];gaps+=1
   if not points or math.dist(points[-1],p)>1:points.append(p)
 routes.append({'id':id,'name':name,'pixel_points':points,'count':count,'manual_gap_samples':gaps})
record={'source_sha256':json.loads((root/'gis/roads/doseong_road_mask.json').read_text())['source_sha256'],'road_mask_sha256':hashlib.sha256(mask_path.read_bytes()).hexdigest(),'method':'원도 주요 길을 수동으로 읽은 통로 안에서 붉은 길 픽셀에 맞춤. 희미한 부분은 수동 선을 연결. 실제 18세기 보행량·행태의 복원이 아님.','routes':routes}
(root/'gis/roads/doseong_walking_routes.json').write_text(json.dumps(record,ensure_ascii=False,separators=(',',':'))+'\n')
im=Image.open(root/'data/maps/src-0001/asset-0001.jpg');d=ImageDraw.Draw(im)
for r in routes:d.line([tuple(p) for p in r['pixel_points']],fill='#00b6ff',width=3)
im.crop((740,1120,2530,1550)).resize((1432,344)).save('/tmp/walking-route-review.jpg')
print([(r['id'],len(r['pixel_points']),r['manual_gap_samples']) for r in routes])
