# 도성대지도와 3D 지형

2026-09-09 구현. Django `/gis/terrain/3d/`에서 현대 고도로 만든 지형 위에 도성대지도를 표시한다. 기존 `doseong_modern_preview.json`의 5점과 `tps.js` 계산을 그대로 사용한다. 사대문 안의 사용자 시각 확인을 거친 개관용 배치를 유지했으며, 새 대응점을 만들거나 위치를 재조정하지 않았다.

## 사용

- 왼쪽 드래그: 회전·기울임, 휠: 확대, 오른쪽 드래그: 이동. 터치에서는 한 손가락 회전·두 손가락 확대 및 이동.
- 옛 지도 불투명도 0–100%, 높이 1·1.5·2배. 기본 높이는 1배다.
- 배경은 음영 고도 지형 또는 OSM 지도. OSM은 선택할 때만 현재 고정 범위의 z12 타일 4개를 브라우저에서 요청한다. 실패하면 고도 지형으로 돌아간다.
- 기준 위치 라벨 표시, 처음 시점, 위에서 보기 제공.
- 평면 TPS 편집은 기존 `/gis/terrain/`에서 수행한다. 3D는 서버 기본 5점을 사용하며 브라우저에서 편집한 배치 JSON 가져오기는 아직 구현하지 않았다.

## 고도와 가공

[Mapzen Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/)의 Terrarium z12 PNG 4개를 취득했다. [형식 문서](https://github.com/tilezen/joerd/blob/master/docs/formats.md)에 따라 `R*256 + G + B/256 - 32768`로 미터 고도를 복원했다. [출처 표기](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)에 따라 Mapzen·USGS SRTM/GMTED2010·NOAA ETOPO1을 표시한다. 합성 타일의 개별 픽셀별 원자료 계통은 별도로 확정하지 않았다.

- EPSG:3857 범위: `[14131000, 4514000, 14142000, 4525000]`. 중심 위도에서 지상 약 8.7 × 8.7 km.
- 원본 픽셀 중심을 기준으로 고도를 bilinear 보간하여 257 × 257 격자로 생성했다. 웹 메르카토르 격자 간격은 42.97 m, 중심 위도 지상 간격은 약 34 m다. 이는 출력 표본 간격이며 원자료 정확도가 아니다.
- 출력 고도 범위 약 -6.4–331.2 m. 낮은 음수도 임의로 0으로 바꾸지 않았다.
- Three.js 0.180.0·OrbitControls를 라이선스와 함께 로컬 제공한다. 수평 메르카토르 길이에 중심 위도의 cos 값을 적용하고 수직은 고도 미터를 사용한다. 지역 개관을 위한 근사다.
- 원도는 128 × 112 격자의 TPS 변형 표면에 텍스처로 입힌다. 고도 표면과 표시 충돌을 줄이기 위한 4 m 오프셋을 적용한다. 접힘이 검출되거나 고도 범위를 벗어나면 오류를 표시한다.

현대 고도와 원도 배치를 합친 시각화다. 조선시대 지형·건물·정밀 측량 복원 결과가 아니며 북쪽 산지·도성 밖 정합은 미검증이다. 고도 타일은 참고 배경으로 [별도 manifest](../gis/control_points/seoul_terrain_manifest.json)에 URL·체크섬·처리 이력을 보존했다. 역사 사료 카탈로그는 17건·파일 12개를 유지한다.

## 재생성과 검증

```bash
.venv/bin/python scripts/terrain/build_dem.py
.venv/bin/python manage.py test webapp
.venv/bin/python -m unittest discover -s scripts/terrain -p 'test_*.py'
node scripts/georeference/test_tps.cjs
.venv/bin/python scripts/terrain/check_browser.py --browser /path/to/chromium
```

DEM 생성기는 누락된 타일만 네트워크에서 취득한다. 원본 `data/terrain/terrarium/`와 파생 `gis/georeferenced/terrain3d/dem.json`은 Git 제외다. manifest·생성기·테스트는 Git 관리다. 재생성 시 파생 JSON·manifest를 갱신한다. Three.js의 버전·원본 위치는 `webapp/static/vendor/three/README.md`에 있다.

Django 7개, 고도 디코딩·체크섬 검사 2개, 기존 TPS 검사 통과. Tailscale Chromium에서 WebGL·원도·고도 표시, 5점의 TPS 수평 위치 일치, 회전·위에서 보기·투명도·높이·라벨·OSM 배경·모바일 가로폭을 확인했다. 이는 표시·계산 검증이며 역사적 정확도 검증은 아니다.
