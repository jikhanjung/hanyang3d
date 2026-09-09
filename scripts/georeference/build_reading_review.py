"""Build a source-linked, pixel-coordinate reading view (not geographic data)."""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def hypothesis_view():
    record_path = ROOT / 'gis/control_points/1908_1912_branch_hypothesis.json'
    hypothesis = json.loads(record_path.read_text())
    for asset in hypothesis['inputs'].values():
        if hashlib.sha256((ROOT / asset['path']).read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError('Hypothesis image checksum mismatch')
    m = hypothesis['matrix_source_to_target']
    transform = f'matrix({m[0][0]} {m[1][0]} {m[0][1]} {m[1][1]} {m[0][2]} {m[1][2]})'
    x0, y0, x1, y1 = hypothesis['inspection_window_target']
    marks = []
    for pair in hypothesis['hypothetical_pairs']:
        x, y = pair['target']
        marks.append(f'<circle cx="{x}" cy="{y}" r="9" fill="none" stroke="#a00070" stroke-width="3"/><text x="{x+14}" y="{y}" fill="#a00070" stroke="white" stroke-width="3" paint-order="stroke" font-size="22">{html.escape(pair["id"])}</text>')
    findings = ''.join(f'<li>{html.escape(s)}</li>' for s in hypothesis['findings_ko'])
    assumptions = ''.join(f'<li>{html.escape(p["id"])}: {html.escape(p["assumption"])}</li>' for p in hypothesis['hypothetical_pairs'])
    return f'''<article id="branch-hypothesis"><h2>두 분기점 가정 배치 검토</h2>
<p><strong>검토 결과: 대응 근거 부족으로 미채택 · 확정 기준점 0개</strong></p>
<label for="hypothesis-opacity">1908 원도 불투명도</label>
<input id="hypothesis-opacity" type="range" min="0" max="100" value="50" oninput="document.getElementById('hypothesis-source').setAttribute('opacity',this.value/100);document.getElementById('hypothesis-percent').textContent=this.value+'%'">
<output id="hypothesis-percent" for="hypothesis-opacity">50%</output>
<p>0%: 1912 제6호 · 100%: 가정한 위치에 놓은 1908 경행방도. 자주색 원은 검증된 기준점이 아닌 가정점입니다.</p>
<svg id="hypothesis-map" viewBox="{x0} {y0} {x1-x0} {y1-y0}" xmlns="http://www.w3.org/2000/svg">
<image href="/{html.escape(hypothesis['inputs']['target']['path'])}" width="2380" height="1938"/>
<image id="hypothesis-source" href="/{html.escape(hypothesis['inputs']['source']['path'])}" width="3000" height="2201" transform="{transform}" opacity="0.5"/>
{''.join(marks)}</svg><details><summary>가정점과 검토 결과</summary><ul>{assumptions}</ul><ul>{findings}</ul>
<p>독립 검사점 0개 · 검사 RMSE 없음 · 확대·회전·이동만 적용. 추가 대응 근거를 확보하기 전에는 이 배치를 정합 결과로 사용하지 않습니다.</p>
<details><summary>재현용 좌표·변환 기록</summary><pre style="overflow:auto">{html.escape(record_path.read_text())}</pre></details></details></article>'''


def main():
    record = json.loads((ROOT / 'gis/roads/1908_gyeonghaeng_reading.json').read_text())
    source = ROOT / 'data/cadastral/src-0017/asset-0012.jpg'
    if hashlib.sha256(source.read_bytes()).hexdigest() != record['source_sha256']:
        raise ValueError('Source checksum mismatch')
    lines, notes = [], []
    for feature in record['features']:
        coords = feature['geometry']['coordinates']
        if any(not (0 <= x < 3000 and 0 <= y < 2201) for x, y in coords):
            raise ValueError('Reading coordinates outside source image')
        color = '#d65d00' if feature['kind'].startswith('road') else '#007fbd'
        points = ' '.join(f'{x},{y}' for x, y in coords)
        lines.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="3"/>')
        x, y = coords[len(coords) // 2]
        lines.append(f'<text x="{x+8}" y="{y}" font-size="18" fill="{color}" stroke="white" stroke-width="3" paint-order="stroke">{feature["id"]}</text>')
        notes.append(f'<li><b>{feature["id"]} {html.escape(feature["label"])}</b>: {html.escape(feature["evidence_note"])}</li>')
    page = '''<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1908 도로·하수로 판독</title>
<style>body{max-width:1150px;margin:24px auto;padding:0 16px;font:16px/1.7 system-ui;color:#24372e;background:#f4f1ea}svg{width:100%;height:75vh;background:#eee;border:1px solid #ccc}button{padding:9px;margin:4px}a{color:#165d46}li{margin:8px 0}</style>
<a href="/">← GIS 작업 현황</a><h1>1908 경행방도 · 도로와 하수구 판독</h1>
<p>황토색 도로와 푸른색 하수구를 구분한 첫 판독선입니다. 원본 이미지 좌표의 검토용 선이며, 지리 좌표 정합·도로 폭·1912년 존속 여부는 미확정입니다.</p>
<button id="toggle">판독선 숨기기</button><button id="extent">전체 원본 보기</button>
<svg id="map" viewBox="650 700 850 860" xmlns="http://www.w3.org/2000/svg"><image href="/data/cadastral/src-0017/asset-0012.jpg" width="3000" height="2201"/><g id="lines">__LINES__</g></svg>
<p>주황: 도로 중앙의 대략적 판독선 · 파랑: 하수구의 대략적 선형. 선 끝은 판독 구간의 끝이며 실제 길의 종점으로 해석하지 않습니다.</p>
<ul>__NOTES__</ul><p><a href="/gis/roads/1908_gyeonghaeng_reading.json">판독 데이터 JSON</a> · <a href="/gis/georeferenced/review/index.html">1912 자료와 나란히 비교</a></p>
<p>출처: 서울역사박물관 서울역사아카이브, 한성부 중서 경행방도 오매지내 제3호. 공공누리 제1유형. 기호 해석은 『1908 한성부지적도』(2015) 192쪽. 판독선은 Hanyang 3D의 가공이며 원본은 수정하지 않았습니다.</p>
<script>let visible=true,full=false;document.getElementById('toggle').onclick=function(){visible=!visible;document.getElementById('lines').style.display=visible?'':'none';this.textContent=visible?'판독선 숨기기':'판독선 보이기'};document.getElementById('extent').onclick=function(){full=!full;document.getElementById('map').setAttribute('viewBox',full?'0 0 3000 2201':'650 700 850 860');this.textContent=full?'판독 구간 확대':'전체 원본 보기'};</script></html>'''
    output = ROOT / 'gis/georeferenced/readings/index.html'
    packet = json.loads((ROOT / 'gis/control_points/1908_1912_comparison_cases.json').read_text())
    if packet['source_sha256'] != record['source_sha256']:
        raise ValueError('Comparison packet source checksum mismatch')
    cards = ['<h2>1912 비교를 위한 원본 후보 구간</h2><p>아래 구간은 1908 원본에서 찾은 특징입니다. 1912 대응점은 아직 없습니다.</p>']
    for case in packet['cases']:
        x0, y0, x1, y1 = case['source_window']
        if not (0 <= x0 < x1 <= 3000 and 0 <= y0 < y1 <= 2201):
            raise ValueError('Comparison window outside image')
        cards.append(f'<section style="border:1px solid #ccc;padding:16px;margin:16px 0"><h3>{html.escape(case["title"])}</h3>')
        cards.append(f'<svg style="height:260px" viewBox="{x0} {y0} {x1-x0} {y1-y0}" xmlns="http://www.w3.org/2000/svg"><image href="/data/cadastral/src-0017/asset-0012.jpg" width="3000" height="2201"/></svg>')
        cards.append('<ul>' + ''.join(f'<li>{html.escape(s)}</li>' for s in case['required_checks']) + '</ul>')
        for asset, title in [('asset-0010', '1912 제6호'), ('asset-0008', '1912 제12호'), ('asset-0009', '1912 제5호'), ('asset-0011', '1912 제13호')]:
            url = f'/gis/georeferenced/review/index.html?left=asset-0012&amp;right={asset}&amp;case={case["id"]}'
            cards.append(f'<a style="display:inline-block;margin:6px 12px 6px 0" href="{url}">{title}와 비교 →</a>')
        cards.append('</section>')
    page = page.replace('<script>', hypothesis_view() + ''.join(cards) + '<script>')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page.replace('__LINES__', ''.join(lines)).replace('__NOTES__', ''.join(notes)))
    print(output)


if __name__ == '__main__':
    main()
