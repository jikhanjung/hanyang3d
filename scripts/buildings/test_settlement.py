"""Data exclusions and assumptions remain explicit, separately from rendering."""
import json,hashlib,unittest,math
from PIL import Image
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def inside(x,y,polygon):
 result=False
 for a,b in zip(polygon,polygon[1:]+polygon[:1]):
  if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:result=not result
 return result
class SettlementTest(unittest.TestCase):
 def test_precincts_and_city_extent(self):
  data=json.loads((ROOT/'gis/buildings/doseong_settlement.json').read_text());wall=json.loads((ROOT/'gis/walls/doseong_city_wall.json').read_text())
  for x,y,*_ in data['features']:
   self.assertTrue(inside(x,y,wall['centerline']))
   self.assertFalse(any(inside(x,y,p['polygon']) for p in data['precinct_exclusions']))
 def test_provenance_and_small_scale(self):
  d=json.loads((ROOT/'gis/buildings/doseong_settlement.json').read_text())
  self.assertEqual(d['road_mask_sha256'],hashlib.sha256((ROOT/'gis/roads/doseong_road_mask.png').read_bytes()).hexdigest())
  self.assertEqual(d['historical_reference']['registered_households'],38742)
  for f in d['features']:
   self.assertLessEqual(f[3],8);self.assertLessEqual(f[4],6);self.assertLessEqual(f[5]+1.5,5)
 def test_road_frontage_references(self):
  data=json.loads((ROOT/'gis/buildings/doseong_settlement.json').read_text())
  alpha=Image.open(ROOT/'gis/roads/doseong_road_mask.png').getchannel('A')
  self.assertEqual(data['placement']['mode'],'street_frontage')
  self.assertEqual(data['placement']['roof_edge_setback_m'],[2,9])
  for f in data['features']:
   x,y,*_=f;rx,ry=f[8:10]
   self.assertGreater(alpha.getpixel((rx,ry)),0)
   self.assertEqual(alpha.getpixel((round(x),round(y))),0)
   self.assertLess(math.hypot(x-rx,y-ry),18)
if __name__=='__main__':unittest.main()
