# 옛길 표시·하류 연장·성문 보완

2026-09-11. `/gis/terrain/3d/`에서 도성대지도의 길을 자주색으로 표시하고 청계천 하류를 중랑천 합류점부터 한강 방향까지 연결한다. ‘옛길’과 원도 불투명도는 독립이며 ‘중랑천 합류부 확대’로 하류를 볼 수 있다.

## 길

`build_doseong_road_mask.py`가 원도 붉은 안료의 색상과 주변 대비로 길 마스크를 만든다. 작은 성분과 테두리는 제거한다. 현재 188,550 픽셀·322개 성분이며 희미한 길의 누락이나 붉은 기호의 혼입 가능성이 있다. 의미를 확정한 도로 벡터나 역사적 도로 폭이 아니다. 원도와 같은 TPS·삼각형 분할·하도 보정·높이 배율을 적용한다.

## 하류와 합류점

원도에서 판독한 서촌–청계천 75점은 보존했다. 그 끝부터 현대 OSM 청계천 중심선에 추정 연결하고 중랑천과 한강 방향 하류를 덧붙였다. 중랑천 북쪽 지류는 합류부 인접 구간만 포함한다. 현대 선형은 당시 하천 위치의 증거가 아니다.

- [청계천 way 769631455](https://www.openstreetmap.org/way/769631455)
- [중랑천 way 26084930](https://www.openstreetmap.org/way/26084930)
- [중랑천 하구 way 967550721](https://www.openstreetmap.org/way/967550721)

공유 OSM 노드 285458339의 합류점은 경도 127.0506623, 위도 37.5527466이다. 원본 응답·SHA-256·ODbL 출처를 보존한다. 하폭은 청계천 반폭 18 m, 중랑천 반폭 40 m의 개념값이다. 기존 하류 끝에서 새 구간으로 넘어가는 수면 단면을 일치시켰다.

본류 전체에 하류 방향 종단 보정을 적용하고 중랑천 북쪽 진입선은 같은 합류 수면으로 연결한다. 떨어진 두 선 사이에 가상의 절삭선이 생기지 않도록 분기 시작을 명시한다. 합류 뒤 물길은 남서쪽 한강 방향으로 이어진다. 원래 DEM은 보존하며 보정을 끄면 표시 높이를 복원한다. 기본 최대 낮춤 약 77.4 m는 현대 지형과 개념 수면 사이 차이를 포함하며 실제 하천 깊이가 아니다. DEM 범위는 EPSG:3857 `[14129500,4513500,14146500,4526500]`, 401×401이다.

## 문과 숭례문 성벽

기존 성벽 개구부 다섯 곳에 창의문·숙정문·혜화문·광희문·소의문 모형을 추가했다. 원도의 문 기호와 진입로 두 점을 사용하며 지형 정합에 함께 움직인다. 이름·도성 순서는 [서울시 한양도성 안내](https://seoulcitywall.seoul.go.kr/content/8.do)를 참고한다. 숙정문도 이번 표시에서는 작은 문 모형을 사용한다. 광화문을 포함한 강조 대상 네 문은 사용자가 지정한 시각적 구분이며 역사적 ‘사대문’ 분류가 아니다.

| 문 | 폭 × 높이 × 깊이(m) |
|---|---|
| 광화문 | 36 × 21 × 15 |
| 흥인지문 | 32 × 23 × 15 |
| 숭례문 | 36 × 25 × 18 |
| 돈의문 | 28 × 19 × 13 |
| 추가한 다섯 문 | 16 × 12 × 9 |

치수·문루는 개념 표현이다. 청계천 수문 개구부는 물길로 유지한다.

숭례문 북서·남동 성벽을 원도에서 다시 읽었다. 이전 선, 재판독 선, 접속 범위를 줄인 선을 원도에 겹쳐 비교했다. 문 접속 정렬의 영향 범위를 100 m에서 50 m로 줄여 원도의 성벽 자리로 더 빨리 돌아오도록 했다. 확대된 숭례문 중심 23 m 안의 짧은 구간만 가로축에 정렬한다. 최종 국부 최대 이동은 약 14.14 m이며 반경 50 m 밖은 이동 0이다. 이전 판독점도 JSON에 보존한다.

## 재생성·검사

```bash
.venv/bin/python scripts/roads/build_doseong_road_mask.py
.venv/bin/python scripts/waterways/build_downstream.py
.venv/bin/python scripts/terrain/build_dem.py
node scripts/terrain/test_channel.cjs
node scripts/georeference/test_mountain_alignment.cjs
.venv/bin/python manage.py test webapp
.venv/bin/python scripts/terrain/check_downstream_browser.py
.venv/bin/python scripts/terrain/check_sungnyemun_connection_browser.py --browser /path/to/chrome
```

하류 생성은 보존한 OSM 응답을 사용한다. 새 응답이 필요할 때만 `scripts/waterways/fetch_downstream.py`를 실행한다. 브라우저 검사는 합류점·하류 방향 수면, 아홉 성문 통로, 길 표시 독립성, 높이·깊이 전환과 지형 원상 복원을 확인한다.
