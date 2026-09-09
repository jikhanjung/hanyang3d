# 1908 관인방–경행방 도엽 연결

2026-09-08. 관인방 제1호(asset-0005)와 경행방 제3호(asset-0012)의 공통 방 경계로 **상대 픽셀 정합을 수행했다**. 두 지도에서 상대 방명이 표시되고, 계단형 경계 굴곡이 같은 순서로 이어지는 것을 원본 확대본에서 판독했다.

| 평가 | 점 수 | RMSE (target px) | 최대 오차 (target px) |
|---|---:|---:|---:|
| 계산에 사용한 control | 5 | 3.5092 | 6.1980 |
| 계산에서 제외한 check | 4 | 3.3098 | 5.0054 |

점의 역할은 변환 계산 전에 정했으며, 검사 결과를 보고 점을 이동하거나 제외하지 않았다. 수동 판독의 읽기 불확실성은 대략 ±3 px로 추정했다. 이전 검토에서 정한 거친 후보 선별 기준(check RMSE ≤20 px)을 통과했으며 이 기준은 정밀 GIS 정확도 기준이 아니다.

## 검토 자료

- [겹침 비교 화면](../gis/georeferenced/1908_join/index.html): 투명도 조절, 공통 경계 확대·전체 도엽 전환, 대응점·잔차·근거 표시.
- [변형하지 않은 원본 점별 확대 비교](../gis/georeferenced/1908_join/point-crops.jpg)
- [대응점 CSV](../gis/control_points/1908_gwanin_gyeonghaeng_points.csv)
- [입력 체크섬·행렬·평가 결과를 보존한 실험 JSON](../gis/control_points/1908_sheet_join_experiment.json)
- [추가 원본의 출처와 설명 불일치](../references/source_notes/src-0017.md)

화면과 확대 비교는 로컬 파생 파일로 Git 제외이며 아래 명령으로 재생성한다. 원본은 수정하지 않았다. 서울역사박물관 서울역사아카이브 두 개별 지도 파일의 공공누리 제1유형을 적용하고, 겹침과 변환이 프로젝트의 가공임을 표시했다.

## 재현

저장소 루트에서 실행한다. NumPy·Pillow 버전은 `requirements.txt`에 고정되어 있다. 먼저 assets.csv에 등록된 두 JPG 원본을 해당 경로에 준비한다.

```bash
.venv/bin/python scripts/georeference/fit_pixel_affine.py gis/control_points/1908_gwanin_gyeonghaeng_points.csv --max-check-rmse-px 20 --output gis/georeferenced/1908_gwanin_gyeonghaeng_affine.json
.venv/bin/python scripts/georeference/render_pixel_join.py gis/georeferenced/1908_gwanin_gyeonghaeng_affine.json gis/control_points/1908_gwanin_gyeonghaeng_points.csv --output gis/georeferenced/1908_join
.venv/bin/python scripts/georeference/build_review.py
```

affine CLI는 기존 보고서를 덮어쓰지 않으므로 이미 있으면 첫 명령을 생략하거나 다른 출력 경로를 사용한다. 화면 생성기는 지정 폴더의 파생 파일을 갱신한다. 외부 서비스 없이 HTML을 열어 검토할 수 있다. 전체 보기는 경행방도 이미지 범위로 잘린다.

## 해석 범위와 다음 단계

기준점·검사점이 공통 경계에 집중되어 있으므로 두 도엽 내부 전체의 정확도를 보증하지 않는다. 같은 측량 계통에서 파생된 지도일 수 있어 경계 일치를 독립된 역사 사료의 교차 검증으로 세지 않는다. 자동 보고서의 `historical_correspondence_verified: false`는 수치 계산만으로 역사적 동일성을 인증하지 않는다는 의미이며, 수동 판독 근거는 CSV와 이 기록에 별도로 남겼다.

1908–1912 대응점은 여전히 미확정이다. 현대 좌표·미터 단위 오차·파일럿 polygon·3D 모델도 생성하지 않았다. 후속 작업에서 도로 3개·하수구 2개를 판독하고 1912 제6호와 두 분기점 가설을 비교했으나 미채택했다. [최신 판독·검토 결과](1908_road_drain_reading.md)를 참고한다. 현재 우선 작업은 [도성 전체 지도·3D 지형 개관](plan.md)이다. 세부 비교 재개 시 지명·시설·도엽 경계의 별도 근거로 중첩 구역을 좁힌 뒤 인접 필지·도로 연결 관계로 대응점을 검증한다.
