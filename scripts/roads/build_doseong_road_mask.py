"""Extract the red road ink as a reviewable, approximate raster overlay."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
ROOT=Path(__file__).resolve().parents[2]
source=ROOT/'data/maps/src-0001/asset-0001.jpg'
sha=hashlib.sha256(source.read_bytes()).hexdigest()
assert sha=='f5b791653d008346d9eaa5dc612e498175f28f6ecf579d1c56c7082df36267f0'
im=Image.open(source).convert('RGB');a=np.asarray(im).astype(float);r,g,b=a.transpose(2,0,1)
score=(r-g)-.8*(g-b)
background=np.asarray(Image.fromarray(np.clip(score+128,0,255).astype('uint8')).filter(ImageFilter.GaussianBlur(5))).astype(float)-128
mask=((score>7)|((score>-4)&(score-background>3)))&(r-g>23)&(r>95)&(g>45)
mask[:125]=False;mask[2590:]=False;mask[:,:135]=False;mask[:,2975:]=False
# Close tiny photographic breaks, then remove isolated red specks/short labels.
mask=np.asarray(Image.fromarray(mask.astype('uint8')*255).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3)))>0
h,w=mask.shape;seen=np.zeros(mask.shape,dtype=bool);clean=np.zeros(mask.shape,dtype=bool);components=0
for y,x in zip(*np.nonzero(mask)):
 if seen[y,x]:continue
 todo=[(y,x)];seen[y,x]=True;region=[]
 while todo:
  yy,xx=todo.pop();region.append((yy,xx))
  for dy,dx in [(0,1),(0,-1),(1,0),(-1,0),(1,1),(-1,-1),(1,-1),(-1,1)]:
   ny,nx=yy+dy,xx+dx
   if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not seen[ny,nx]:seen[ny,nx]=True;todo.append((ny,nx))
 ys,xs=zip(*region)
 if len(region)>=40 and max(max(ys)-min(ys),max(xs)-min(xs))>=30:
  clean[ys,xs]=True;components+=1
rgba=np.full((h,w,4),255,dtype='uint8');rgba[:,:,3]=clean*255
out=ROOT/'gis/roads/doseong_road_mask.png';Image.fromarray(rgba).save(out)
record={'schema_version':1,'source_asset_id':'asset-0001','source_sha256':sha,'image_size':[w,h],'mask_url':'/gis/roads/doseong_road_mask.png','mask_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'method':'Red-ink colour contrast with local background correction, 3px closing and short-component removal. Visual review of source overlay.','masked_pixels':int(clean.sum()),'components':components,'display_color':'#8b6179','limitations':['붉은 길 표시의 색상 기반 추출이며 모든 골목의 완전한 판독이 아님.','희미하거나 접힌 부분은 끊길 수 있고 작은 붉은 기호가 일부 포함될 수 있음.','원도의 선폭을 사용하며 실측 도로 폭이 아님.']}
(ROOT/'gis/roads/doseong_road_mask.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pixels':record['masked_pixels'],'components':components,'mask':str(out)}))
