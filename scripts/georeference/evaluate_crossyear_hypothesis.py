"""Reproduce a two-branch placement hypothesis, explicitly not an accepted registration."""
import csv
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]


def main():
    pairs = [
        {'id': 'h01', 'source': [958, 1036], 'target': [930, 322],
         'assumption': '1908 서측 하수구 분기 부근과 1912 제6호 북쪽 서향 분기 부근을 같은 위치라고 임시 가정. 도로와 하수구의 동일 선 여부 미검증.'},
        {'id': 'h02', 'source': [1124, 1224], 'target': [1155, 590],
         'assumption': '1908 동쪽 골목 입구 부근과 1912 제6호 동향 분기를 같은 위치라고 임시 가정. 양측 필지 변화·존속 근거 미확보.'},
    ]
    source = np.array([p['source'] for p in pairs], dtype=float)
    target = np.array([p['target'] for p in pairs], dtype=float)
    u, v = source[1] - source[0], target[1] - target[0]
    a = float(u @ v / (u @ u))
    b = float((u[0] * v[1] - u[1] * v[0]) / (u @ u))
    linear = np.array([[a, -b], [b, a]])
    offset = target[0] - linear @ source[0]
    matrix = np.vstack([np.column_stack([linear, offset]), [0, 0, 1]])
    with (ROOT / 'data/catalog/assets.csv').open() as f:
        assets = {a['id']: a for a in csv.DictReader(f)}
    inputs = {}
    for side, asset_id in [('source', 'asset-0012'), ('target', 'asset-0010')]:
        asset = assets[asset_id]
        checksum = hashlib.sha256((ROOT / asset['local_path']).read_bytes()).hexdigest()
        if checksum != asset['sha256']:
            raise ValueError(f'Checksum mismatch: {asset_id}')
        inputs[side] = {'asset_id': asset_id, 'path': asset['local_path'], 'sha256': checksum}
    record = {
        'hypothesis_id': 'gyeonghaeng-sheet6-two-branches-001', 'date': '2026-09-08',
        'status': 'not_accepted_insufficient_correspondence_evidence',
        'model': 'two-point similarity; no shear; no TPS',
        'coordinate_space': 'source and target image pixels; upper-left origin',
        'geographic_crs': None, 'inputs': inputs, 'hypothetical_pairs': pairs,
        'matrix_source_to_target': matrix.tolist(),
        'scale_target_px_per_source_px': float(np.hypot(a, b)),
        'rotation_degrees_in_image_coordinates': float(np.degrees(np.arctan2(b, a))),
        'accepted_controls': 0, 'independent_checks': 0, 'check_rmse_px': None,
        'inspection_window_target': [550, 150, 2100, 1200],
        'findings_ko': [
            '두 점으로 유사변환을 정했으므로 선택점이 맞는 것은 정확도 검증이 아니다.',
            '서쪽 원도 분기는 하수구와 골목이 나란한 구조인데 목표 도면의 분기와 동일한 기준선을 골랐는지 확인되지 않았다.',
            '동쪽 분기와 붉은 구획의 상대 위치를 포함해 인접 필지 경계를 함께 대응시키는 근거를 확보하지 못했다.',
            '이 특정 배치를 기준점으로 채택하지 않는다. 두 도엽이 지리적으로 겹치지 않는다는 결론은 아니다.',
        ],
        'next_requirement': '도로·하수구 구분과 인접 필지 연결을 확인한 별도 대응점. 현 배치에 맞춰 TPS로 필지를 강제로 맞추지 않음.',
    }
    path = ROOT / 'gis/control_points/1908_1912_branch_hypothesis.json'
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(path)


if __name__ == '__main__':
    main()
