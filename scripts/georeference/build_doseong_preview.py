"""Build an explicitly unvalidated three-landmark placement for visual exploration."""
import hashlib
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def project(lon, lat):
    return [6378137 * math.radians(lon),
            6378137 * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))]


def main():
    landmarks = [
        dict(name='숭례문', pixel=[998, 2004], lat=37.56000, lon=126.97528,
             reference='https://en.wikipedia.org/wiki/Sungnyemun',
             note='성벽과 남향 도로 교차부의 문 기호를 육안 판독. 재건 이력이 있어 정밀 고정점으로 검증하지 않음.'),
        dict(name='흥인지문', pixel=[2495, 1408], lat=37.5711528, lon=127.0096389,
             reference='https://en.wikipedia.org/wiki/Heunginjimun',
             note='동향 대로 끝의 옹성 안 문 기호를 육안 판독. 기호 중심과 실측 문 중심의 동일성 미검증.'),
        dict(name='돈의문 터', pixel=[766, 1481], lat=37.5682444, lon=126.9689750,
             reference='https://en.wikipedia.org/wiki/Donuimun',
             note='2026-09-10 재판독: 숭례문에서 이어지는 성벽과 대로 교차부 문 기호 (766, 1481). 기존 (703, 1493)은 문 서쪽의 잘못된 판독점으로 교정. 철거된 문의 터이며 현대 기준점의 정확도 미검증.'),
    ]
    for point in landmarks:
        point['status'] = 'proposed_visual_anchor'
        point['target_3857'] = project(point['lon'], point['lat'])
    design = np.array([p['pixel'] + [1] for p in landmarks], dtype=float)
    matrix = np.linalg.solve(design, np.array([p['target_3857'] for p in landmarks])).T
    original = ROOT / 'data/maps/src-0001/asset-0001.jpg'
    sha = hashlib.sha256(original.read_bytes()).hexdigest()
    assert sha == 'f5b791653d008346d9eaa5dc612e498175f28f6ecf579d1c56c7082df36267f0'
    result = dict(asset_id='asset-0001', source_id='src-0001', date='2026-09-10',
                  image_url='/data/maps/src-0001/asset-0001.jpg', image_size=[3124, 2743],
                  input_sha256=sha, status='unvalidated_visual_preview',
                  method='affine through three approximate landmarks; no independent checks',
                  target_crs='EPSG:3857', reference_coordinate_crs='EPSG:4326',
                  pixel_axes='origin upper-left; x right; y down',
                  matrix_pixel_to_3857=matrix.tolist(), landmarks=landmarks,
                  check_count=0, check_rmse_m=None, metric_accuracy_verified=False,
                  suggested_anchors=[
                      dict(name='광화문', pixel=[1156, 1150], lat=37.5760444, lon=126.9770194,
                           status='proposed_visual_anchor', reference='https://www.wikidata.org/wiki/Q485034',
                           note='경복궁 남쪽 담장 중앙의 문 기호. 재건 이력·원도 기호 중심의 동일성 미검증.'),
                      dict(name='광화문사거리', pixel=[1155, 1441], lat=37.5702093, lon=126.9771452,
                           status='proposed_visual_anchor', reference='https://www.openstreetmap.org/#map=19/37.5702093/126.9771452',
                           note='원도 육조거리 남단과 동서 대로의 교차. 현대 세종대로·종로·새문안로 교차부 4개 OSM 차로 결절점의 평균 위치; 역사적 교차 중심 동일성 미검증.',
                           reference_nodes=[414683338, 1945254921, 2697100729, 1553878346]),
                  ],
                  limitations=['Reference coordinates are location hints, not survey control.',
                               'Three points determine the affine exactly; fit residuals cannot validate accuracy.',
                               'Northern mountains lie outside the anchor triangle; extrapolation is unverified.',
                               'This does not replace the staged cadastral/geographic registration workflow.'])
    result['terrain_alignment'] = json.loads((ROOT / 'gis/control_points/doseong_mountain_alignment.json').read_text())
    path = ROOT / 'gis/control_points/doseong_modern_preview.json'
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(path)


if __name__ == '__main__':
    main()
