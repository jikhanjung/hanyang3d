"""Merge place-name readings of 도성대지도 into gis/placenames/doseong_placenames.json.

Inputs are per-sheet reading files (sheet pixel, hanja, reading, kind, ward mark, confidence).
Sheet pixels are mapped to full-map pixels with gis/control_points/detail_sheet_fits.json,
labels repeated on overlapping sheets are merged, each 契 is attached to the nearest 坊 whose
name starts with its circled ward character, and short descriptions are composed only from
the reading itself, the cited references and the landmarks already on the map.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'gis/placenames/doseong_placenames.json'
MX, MY = 2.0838, 1.8092
SOURCE_SHA = 'f5b791653d008346d9eaa5dc612e498175f28f6ecf579d1c56c7082df36267f0'

# 5부 방 목록 (위키백과 방 (행정 구역)); 지도 표기와 한자가 다른 이체는 hangul reading으로 맞춘다.
WARDS = {
    '동부': '연희 숭교 천달 창선 건덕 덕성 서운 연화 숭신 인창 관덕 흥성',
    '남부': '광통 호현 명례 태평 대평 훈도 성명 낙선 정심 명철 성신 예성',
    '서부': '영견 인달 적선 여경 인지 황화 취현 양생 신화 반석 반송',
    '북부': '광화 양덕 가회 안국 관광 진정 진장 순화 명통 준수 의통',
    '중부': '정선 경행 관인 수진 징청 장통 서린 견평',
}
WARD_OF = {name + '방': ward for ward, names in WARDS.items() for name in names.split()}
REFS = {
    'bang': {'title': '위키백과 방 (행정 구역)', 'url': 'https://ko.wikipedia.org/wiki/%EB%B0%A9_(%ED%96%89%EC%A0%95_%EA%B5%AC%EC%97%AD)'},
    'hanseong': {'title': '한국민족문화대백과사전 한성부', 'url': 'https://encykorea.aks.ac.kr/Article/E0061730'},
    'sheets': {'title': '서울역사아카이브 도성대지도 부분도', 'url': 'https://museum.seoul.go.kr/archive/archiveNew/NR_archiveList.do?ctgryId=CTGRY780&type=C'},
}


def to_full(fits, asset, x, y):
    if asset == 'asset-0001':
        return [float(x), float(y)]
    v = np.array(fits[asset]['affine_to_full']) @ [x, y, 1]
    return [float(v[0]), float(v[1])]


def metres(a, b):
    return math.hypot((a[0] - b[0]) * MX, (a[1] - b[1]) * MY)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('readings', nargs='+')
    args = parser.parse_args()
    fits = json.loads((ROOT / 'gis/control_points/detail_sheet_fits.json').read_text())['sheets']
    landmarks = [f for f in json.loads((ROOT / 'gis/buildings/1750_landmarks.json').read_text())['features'] if (f.get('source_position') or {}).get('pixel')]
    raw = []
    for path in args.readings:
        for r in json.loads(Path(path).read_text()):
            text = (r.get('text') or '').strip()
            if not text or '?' in text or r.get('kind') not in {'bang', 'gye', 'dong', 'other'}:
                continue
            raw.append({**r, 'text': text, 'pixel': to_full(fits, r['asset'], *r['sheet_pixel']), 'source_file': Path(path).name})
    # Overlapping sheets repeat labels: same text within 40 m is one place; keep the high-confidence reading.
    raw.sort(key=lambda r: r.get('confidence') != 'high')
    places = []
    for r in raw:
        twin = next((p for p in places if p['text'] == r['text'] and metres(p['pixel'], r['pixel']) < 40), None)
        if twin:
            twin['sightings'].append({'asset': r['asset'], 'sheet_pixel': r['sheet_pixel']})
            continue
        places.append({'text': r['text'], 'reading': (r.get('reading') or '').strip(), 'kind': r['kind'], 'ward_mark': r.get('ward_mark'),
                       'confidence': r.get('confidence', 'low'), 'pixel': r['pixel'],
                       'sightings': [{'asset': r['asset'], 'sheet_pixel': r['sheet_pixel']}]})
    bangs = [p for p in places if p['kind'] == 'bang']
    for p in places:
        if p['kind'] == 'gye' and p.get('ward_mark'):
            candidates = [b for b in bangs if b['text'].startswith(p['ward_mark'])]
            if candidates:
                owner = min(candidates, key=lambda b: metres(b['pixel'], p['pixel']))
                p['bang'] = owner['reading'] or owner['text']
    features = []
    for n, p in enumerate(sorted(places, key=lambda p: ({'bang': 0, 'gye': 1, 'dong': 2, 'other': 3}[p['kind']], p['pixel'][1], p['pixel'][0]))):
        name = p['reading'] or p['text']
        # Numbered or two-character 契 such as 一契 only make sense with their ward: show 연화방 일계.
        if p['kind'] == 'gye' and p.get('bang') and len(p['text']) <= 3:
            name = f"{p['bang']} {name}"
        near = sorted((metres(f['source_position']['pixel'], p['pixel']), f['name'].split(' · ')[0]) for f in landmarks)
        near = [nm for d, nm in near if d < 250][:5]
        summary, in_1750 = [], f'도성대지도에 {p["text"]}(으)로 적혀 있다.'
        if p['kind'] == 'bang':
            ward = WARD_OF.get(name)
            summary.append(f'{ward + " " if ward else ""}{name}. 한성부는 5부 아래 방을 두었고, 영조 때 5부 46방 아래 328계가 있었다.')
            members = sorted({q['reading'] or q['text'] for q in places if q.get('bang') == name})
            if members:
                summary.append('이 지도에서 이 방에 속한 계로 읽은 이름: ' + ', '.join(members) + '.')
            category, period = '방', '조선 초 5부 52방에서 비롯해 영조 때 46방으로 정리됐다. 1894년 갑오개혁 때 5서 288계 775동으로 개편됐다.'
            sources = [REFS['bang'], REFS['hanseong'], REFS['sheets']]
        elif p['kind'] == 'gye':
            owner = p.get('bang')
            lead = f'{owner}에 속한 계로 보인다(이름 앞 동그라미 안 글자 ‘{p["ward_mark"]}’). ' if owner else ''
            summary.append(f'{lead}계는 방 아래 주민 편성 단위로, 영조 때 한성부에는 328계가 있었다.')
            category, period = '계', '영조 때 46방 아래 328계, 1867년 『육전조례』에는 340계가 있었다. 1894년 갑오개혁 때 288계로 줄었다. 이 계가 생기고 없어진 해는 확인하지 못했다.'
            sources = [REFS['bang'], REFS['hanseong'], REFS['sheets']]
        elif p['kind'] == 'dong':
            summary.append('골목이나 동네를 부르던 이름이다. 동은 조선 후기에 골목을 단위로 한 생활공간을 가리켰고, 1894년 갑오개혁 때 행정 단위가 됐다.')
            category, period = '동', '이 동네 이름이 쓰인 시기는 확인하지 못했다.'
            sources = [REFS['bang'], REFS['hanseong'], REFS['sheets']]
        else:
            summary.append('도성대지도에 적힌 마을·땅 이름이다.')
            category, period = '마을', '이 이름이 쓰인 시기는 확인하지 못했다.'
            sources = [REFS['sheets']]
        if near:
            summary.append('근처에 표시한 건물: ' + ', '.join(near) + '.')
        if p['confidence'] != 'high':
            in_1750 += ' 글자 일부가 흐려 판독이 확실하지 않다.'
        ident = f'place-{n:04d}'
        features.append({'id': ident, 'name': name, 'hanja': p['text'], 'kind': p['kind'], 'category': category,
                         'bang': p.get('bang'), 'ward_mark': p.get('ward_mark'), 'confidence': p['confidence'],
                         'pixel': [round(p['pixel'][0], 1), round(p['pixel'][1], 1)], 'sightings': p['sightings'],
                         'info': {'summary': ' '.join(summary), 'period': period, 'in_1750': in_1750, 'sources': sources}})
    record = {'schema_version': 1, 'name': '도성대지도 동네 이름', 'source_sha256': SOURCE_SHA, 'coordinate_space': 'asset-0001 pixels',
              'method': 'labels read by eye on the 12 partial sheets and the full map; sheet pixels mapped with detail_sheet_fits affine; duplicates within 40 m merged',
              'limitations': ['판독은 눈으로 한 것이며 흐린 글자는 confidence low로 표시했다. 물음표가 남은 이름은 넣지 않았다.',
                              '계의 소속 방은 이름 앞 동그라미 글자와 가장 가까운 방 이름으로 추정했다.',
                              '위치는 글씨가 적힌 자리이며 동네의 경계나 중심이 아니다.'],
              'counts': {k: sum(f['kind'] == k for f in features) for k in ('bang', 'gye', 'dong', 'other')},
              'readings_sha256': {Path(p).name: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in args.readings},
              'features': features}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(record, ensure_ascii=False, indent=1) + '\n')
    print(json.dumps({'out': str(OUT.relative_to(ROOT)), 'raw': len(raw), 'features': len(features), 'counts': record['counts']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
