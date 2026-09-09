# 도성 전도와 현재 지형의 TPS 비교

2026-09-08. Django `/gis/terrain/`에서 도성대지도 전체 JPG(asset-0001)를 OpenTopoMap 지형도 또는 OpenStreetMap 일반 지도에 겹쳐 본다. 기본 화면은 광화문·광화문사거리를 포함한 **후보점 5개의 검토용 TPS 배치**다. 지리 정확도를 검증한 GIS 결과가 아니다.

## 다음 목표와 현재 구현 경계

2026-09-09 사용자 요청에 따라 도성 전체의 3D 지형 위에 원도를 입혀 회전·기울임으로 보는 화면을 다음 목표로 정했다. 현재 구현은 평면 지도와 TPS 오버레이다. 후속 [3D 지형 화면](doseong_terrain3d.md)을 `/gis/terrain/3d/`에 구현했다. 이 문서의 평면 TPS 편집 화면은 유지하며 건물 복원은 별도 후속 작업이다. [실행 계획](plan.md)을 따른다.

## 사용

1. 불투명도를 조절하거나 옛 지도를 숨겨 배경과 비교한다.
2. ‘전체 배치’는 최초 성문 3점 affine, ‘부분 변형’은 현재 대응점 전체의 TPS를 적용한다.
3. TPS에서 파란 대응점을 끌면 목표 위치와 주변 원도가 함께 변한다. 원본 픽셀 위치는 유지한다.
4. 새 대응점 이름을 적고 ‘대응점 추가’를 누른다. 옛 지도의 지점을 클릭한 뒤, 원도가 잠시 숨겨지면 현재 배경의 같은 지점을 클릭한다. 추가점은 삭제할 수 있다.
5. ‘변형 격자 표시’로 늘어남과 줄어듦을 본다. 표본 삼각형이 뒤집히면 경고한다.
6. ‘배치 기록 저장’으로 원본 체크섬·점·방식·조절값을 JSON에 보관하고 다시 불러올 수 있다. 브라우저를 닫으면 저장하지 않은 수정은 사라진다.

위치·크기·회전은 TPS 이후의 전체 조절이다. 대응점 초기화는 기본 5개 후보점으로, 위치·크기 초기화는 전체 조절값만 되돌린다. 서버 원본·실험 JSON을 수정하는 API는 없다.

## 근거와 변형량

[초벌 배치 JSON](../gis/control_points/doseong_modern_preview.json)에 원본 SHA-256, 픽셀 축, EPSG:3857 행렬, 후보점 좌표·출처·미검증 상태를 기록했다. 기본 affine의 숭례문·흥인지문·돈의문 터는 각 항목에 연결한 공개 백과사전 좌표를 위치 힌트로 사용했다. 재건·철거 이력과 기호 중심의 동일성을 검증한 측량 기준점이 아니다.

광화문 기호 `(1156,1150)`와 육조거리 남단·동서 대로 교차부 `(1155,1441)`는 원도를 육안 판독했다. 광화문의 현대 위치는 [Wikidata Q485034](https://www.wikidata.org/wiki/Q485034)의 좌표를 참고했다.

광화문사거리는 [OpenStreetMap 도로 원자료](https://www.openstreetmap.org/#map=19/37.5702093/126.9771452)의 세종대로·종로·새문안로 교차부에서 차로 결절점 4개의 평균 `(lat 37.5702093, lon 126.9771452)`을 임시 중심으로 사용했다. 노드 ID·버전·취득일·응답 체크섬은 [참고 위치 기록](../gis/control_points/gwanghwamun_reference.json)에 있다. 옛 교차 중심과 현대 중심의 역사적 동일성은 미검증이다.

기본 TPS의 사거리–돈의문 후보점 간 직선 길이는 최초 affine의 약 82.1%, 사거리–흥인지문 후보점 간 직선은 약 106.8%다. 이는 서쪽 압축·동쪽 확장을 보여 주는 **화면 변형량**이며 실제 도로 길이·역사적 변화량이 아니다.

## 계산과 제한

TPS는 `r² log(r)` 커널, 1차 다항식, smoothing 0을 사용한다. 입력·출력을 정규화하고 부분 피벗 소거로 계수를 계산한다. 중복·일직선·비유한 입력을 거부한다. 수식은 [SciPy RBFInterpolator 문서](https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.RBFInterpolator.html)를 따랐다. SciPy는 런타임 의존성이 아니다.

3점만으로는 TPS도 affine과 같다. 추가점은 국부뿐 아니라 전체 표면에 영향을 줄 수 있다. 화면은 32×28 격자를 삼각형으로 나눠 근사 렌더링한다. 격자의 표본 접힘만 검사하므로 모든 위치의 Jacobian이나 고배율 정확도를 보증하지 않는다. 새 원본점 선택도 표시 삼각형의 역방향 보간을 사용한다.

독립 검사점 0개, 지리 RMSE 미평가다. EPSG:3857은 웹 표시용이며 프로젝트 작업 CRS 확정이 아니다. 1908–1912–18세기의 단계적 검증을 대체하지 않는다. 지리 좌표 객체나 3D 지형을 생성한 결과가 아니다.

## 재현·검증

```bash
.venv/bin/python scripts/georeference/build_doseong_preview.py
.venv/bin/python manage.py check
.venv/bin/python manage.py test webapp
node scripts/georeference/test_tps.cjs
```

실제 브라우저 검증은 `requirements-dev.txt`의 Playwright와 Chromium을 사용한다. 서버를 켠 상태에서 `.venv/bin/python scripts/georeference/check_terrain_browser.py --browser /path/to/chromium`을 실행한다. `--browser` 생략 시 Playwright 기본 Chromium을 사용한다.

Django 테스트 6개와 TPS affine 재현·제어점 보간·국부 변형·퇴화 입력·역방향 선택 테스트를 통과했다. Chromium에서 타일·원도 표시, affine/TPS 전환, 점 드래그·추가, 격자, 저장·불러오기·잘못된 입력 거부, 모바일 가로폭을 확인했다. 초기 배치의 표본 격자 접힘은 없었다. 초기 Leaflet 좌표 객체 형식 오류를 수정하고 재검증했다.

## 출처·외부 파일

- 원도: 서울역사박물관 서울역사아카이브, 공공누리 제1유형. asset-0001과 같은 원본을 사용한다.
- 지형도: [OpenTopoMap](https://opentopomap.org) / OpenStreetMap / SRTM, 화면에 출처 표시. 실시간 지형 측량이 아니다.
- 일반 지도: [OpenStreetMap 이용 조건](https://www.openstreetmap.org/copyright)과 [타일 정책](https://operations.osmfoundation.org/policies/tiles/). 브라우저 화면 범위만 요청하며 일괄 다운로드하지 않는다.
- Leaflet 1.9.4 배포 파일·LICENSE: `webapp/static/vendor/leaflet/`.
- OSM 원자료 응답: `data/terrain/osm/gwanghwamun-2026-09-08.osm`, Git 제외. 배경 타일은 로컬 원본 asset으로 등록하지 않았다.

2026-09-09 사용자 확인: 기존 Leaflet·OSM 위 5점 배치는 사대문 안에서 비교적 정확했다. 이를 개관용 기준 배치로 채택하여 3D 지형 표시로 이어간다. 이 확인은 사용자의 시각적 평가이며 독립 검사점에 의한 수치 정확도 검증과 구분한다. 도성 밖·산지의 배치 정확도까지 확인된 것으로 확대하지 않는다.
