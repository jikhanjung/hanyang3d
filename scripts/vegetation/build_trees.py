"""Read broad woodland areas on the source map; seed illustrative trees reproducibly."""
import hashlib
import json
import random
from collections import Counter
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]


def build():
    source = ROOT / 'data/maps/src-0001/asset-0001.jpg'
    image = Image.open(source).convert('RGB')
    # Hand-read woodland envelopes, not surveyed forest or palace boundaries.
    regions = [
        ('gyeongbok', '경복궁 안 수목', [[1070,820],[1218,818],[1250,1115],[1080,1132]], 6, .25),
        ('east_palaces', '창덕궁·창경궁 후원', [[1650,700],[1900,705],[2005,800],[1950,950],[1840,1020],[1815,1180],[1700,1130]], 7, .35),
        ('jongmyo', '종묘와 동궐 사이 수목', [[1790,1015],[1905,1010],[1900,1335],[1790,1350]], 6, .3),
        ('inwang', '인왕산과 서쪽 산기슭', [[460,785],[690,680],[835,760],[795,990],[875,1140],[845,1380],[710,1430],[640,1230],[470,1150]], 10, .72),
        ('baegak', '백악과 북쪽 산기슭', [[815,695],[970,540],[1165,430],[1300,570],[1430,385],[1560,520],[1530,740],[1340,860],[1250,755],[1070,760],[975,860]], 11, .75),
        ('north_east', '동북쪽 산지', [[1600,520],[1810,520],[1970,640],[2180,690],[2300,820],[2110,850],[1980,750],[1770,715],[1620,720]], 12, .7),
        ('naksan', '낙산과 동쪽 산기슭', [[2300,855],[2450,900],[2510,1070],[2590,1190],[2570,1350],[2460,1320],[2390,1100]], 10, .65),
        ('namsan', '남산과 남쪽 산기슭', [[1150,2070],[1360,2160],[1530,2180],[1710,2160],[1880,2040],[2130,2000],[2350,1890],[2580,1660],[2570,1850],[2420,2050],[2180,2200],[1850,2280],[1600,2380],[1400,2310],[1280,2200]], 11, .72),
    ]
    roads = Image.open(ROOT / 'gis/roads/doseong_road_mask.png').getchannel('A')
    blocked = roads.filter(ImageFilter.MaxFilter(13))
    draw = ImageDraw.Draw(blocked)
    wall = json.loads((ROOT / 'gis/walls/doseong_city_wall.json').read_text())
    water = json.loads((ROOT / 'gis/waterways/doseong_cheonggyecheon.json').read_text())
    draw.line([tuple(p) for p in wall['centerline']], fill=255, width=19)
    for i, (a, b) in enumerate(zip(water['centerline'], water['centerline'][1:])):
        draw.line([tuple(a), tuple(b)], fill=255,
                  width=int(2 * max(water['half_widths_px'][i:i+2]) + 20))
    ink = image.convert('L').filter(ImageFilter.GaussianBlur(2))
    rng = random.Random(1750040)
    features = []
    for region_id, name, polygon, step, pine_fraction in regions:
        mask = Image.new('1', image.size)
        ImageDraw.Draw(mask).polygon([tuple(p) for p in polygon], fill=1)
        xs, ys = zip(*polygon)
        for y in range(min(ys), max(ys), step):
            for x in range(min(xs), max(xs), step):
                px, py = round(x + rng.uniform(-step*.4, step*.4)), round(y + rng.uniform(-step*.4, step*.4))
                if not mask.getpixel((px, py)) or blocked.getpixel((px, py)):
                    continue
                # Prefer the map's darker wooded patches; faint spaces remain open.
                if ink.getpixel((px, py)) > 130 or rng.random() > .8:
                    continue
                height = rng.uniform(5, 9) if region_id in ('gyeongbok','east_palaces','jongmyo') else rng.uniform(6, 12)
                features.append([px, py, round(height, 2), round(rng.uniform(2, 3.8), 2),
                                 int(rng.random() < pine_fraction), round(rng.random(), 4), region_id])
    record = {
        'schema_version': 1, 'source_asset_id': 'asset-0001',
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'road_mask_sha256': hashlib.sha256((ROOT / 'gis/roads/doseong_road_mask.png').read_bytes()).hexdigest(),
        'seed': 1750040, 'coordinate_space': 'source image pixels, upper-left origin',
        'method': '원도에서 수목·산기슭 구역을 수동 지정하고 어두운 부분에 재현 가능한 후보를 배치. 길·수계·성벽 제외 후 화면에서 시설·주택·나무 사이 간격을 추가 검사.',
        'limitations': ['개별 나무 위치·수종·높이·밀도는 개관용 추정.', '산지 음영과 문자도 어두운 부분에 포함될 수 있음. 식생 자동 판독 결과가 아님.'],
        'regions': [{'id': i, 'name': n, 'polygon': p} for i,n,p,*_ in regions],
        'columns': ['pixel_x','pixel_y','height_m','crown_radius_m','pine_style','color_rank','region'],
        'features': features,
    }
    output = ROOT / 'gis/vegetation/doseong_trees.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(dict(Counter(row[-1] for row in features)), 'total', len(features))


if __name__ == '__main__':
    build()
