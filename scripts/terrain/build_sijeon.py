"""Derive the shop-row layout along Unjongga from the road reading.

The rows themselves are not drawn on the old map. This script only records where
the read street runs and how wide it is, so the display model can line both sides
of it; the shop sizes are stated assumptions, not measured buildings.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ROUTES = ROOT / 'gis/roads/doseong_walking_routes.json'
MASK = ROOT / 'gis/roads/doseong_road_mask.png'
OUT = ROOT / 'gis/buildings/doseong_sijeon.json'
# Metres per source pixel, from the georeference matrix at the Jongno crossing.
MX, MY = 2.0838, 1.8092
# The shop-row stretch: from the Yukjo street junction east to the Jongmyo approach.
START_X, END_X = 1200, 1860
STEP = 4


def half_width_px(alpha, x, y):
    x, y = int(round(x)), int(round(y))
    up = down = 0
    while up < 30 and alpha[y - up - 1, x]:
        up += 1
    while down < 30 and alpha[y + down + 1, x]:
        down += 1
    return (up + down + 1) / 2


def main():
    routes = json.loads(ROUTES.read_text())
    jongno = next(r for r in routes['routes'] if r['id'] == 'jongno')
    alpha = np.asarray(Image.open(MASK))[..., 3] > 100
    points = []
    for i, (x, y) in enumerate(jongno['pixel_points']):
        if i % STEP or not START_X <= x <= END_X:
            continue
        half = half_width_px(alpha, x, y)
        points.append([x, y, round(half * MY, 2)])
    data = {
        'schema_version': 1,
        'name': '운종가 시전 행랑 배치',
        'coordinate_space': 'asset-0001 pixels',
        'source_asset_id': 'asset-0001',
        'source_sha256': routes['source_sha256'],
        'road_mask_sha256': hashlib.sha256(MASK.read_bytes()).hexdigest(),
        'route_id': 'jongno',
        'method': 'rows_lined_along_read_street_centreline',
        'street_points': points,
        'placement': {
            'bay_m': 2.7,
            'depth_m': 5.5,
            'height_m': 3.4,
            'setback_m': 2.5,
            'block_bays': [8, 18],
            'gap_m': [5, 9],
        },
        'limitations': [
            '행랑 한 채 한 채의 위치는 원도에 그려져 있지 않다. 판독한 길 선형과 폭만 원도에서 왔고 나머지는 표시용 가정이다.',
            '칸 크기 2.7 m와 깊이 5.5 m, 높이 3.4 m는 시각화 가정이며 실측값이 아니다.',
            '태종대 행랑 2,027칸 가운데 운종가-종묘 앞 누문, 종루-광통교 구간이 시전 전용이었다는 기록을 구간 근거로 삼았다. 남북 대로 구간은 이번 판독 선형에 없어 넣지 않았다.',
        ],
        'references': [
            'https://contents.history.go.kr/front/km/view.do?levelId=km_003_0040_0020_0010',
            'https://contents.history.go.kr/mobile/km/view.do?levelId=km_003_0040_0040_0050_0010',
        ],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(points)} street points -> {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
