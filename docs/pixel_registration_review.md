# 인사동 도엽 비교와 픽셀 정합 준비

2026-09-08. **이 기록의 1908–1912 비교에서 확정 대응점은 0개이며 변환 행렬과 지리 경계는 생성하지 않았다.** 앞선 기록의 ‘가로 형태가 대응할 가능성’은 육안 가설이며 이번 검토에서도 동일 지점으로 확정하지 못했다. [검토 상태 JSON](../gis/control_points/insadong_review.json)에 결과와 다음 실험 기준을 남겼다.

## 실제 확인 결과

1908 관인방 제1호(asset-0005)의 남서부 도로·필지 영역을 확대하고, 1912 인사동·낙원동 이미지 및 추가 6호·13호 도면과 비교했다. 회전 방향·도엽 경계·필지 분할이 달라 도로의 대략적인 모양만으로 대응점을 채택할 수 없었다. 검토용 확대·회전은 원본 픽셀의 표시 방식이며 새로운 사료가 아니다.

| 추가 확인 | 결과 |
|---|---|
| 경운동 0046 / BJCA000147 / docid 0014177165 | src-0015 / asset-0010. 도제의 第六號 확인. JPG 다운로드는 오류 HTML, 공식 화면 스트림 JPEG는 정상 취득 |
| 인사동 0084 / BJCA000154 / docid 0014177172 | src-0016 / asset-0011. 도제의 第十三號 확인. 정상 JPG 다운로드 |
| 낙원동 0141 / docid 0014177166 | 공식 뷰어가 원문 없음 메시지 반환 |
| 낙원동 0142 / docid 0049420347 | 같은 철의 다음 건도 원문 없음 메시지 반환 |

두 새 이미지는 모두 2380 × 1938 pixel이며 원본 TIFF가 아닌 웹 제공 JPEG다. 개별 건의 공공누리 제1유형 표시와 원문 상세·뷰어 HTML을 보존했다. 실패한 뷰어 응답과 checksum은 `data/cadastral/src-0004/access-2026-09-08/`에 별도로 보관했다. 다른 건·오프라인 소장본 전체가 없다는 의미는 아니다.

## 검토 화면 실행

저장소 루트에서 실행한다. 생성 화면은 로컬 원본을 참조하며 네트워크 연결 없이 사용할 수 있다.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python scripts/georeference/build_review.py
```

생성된 `gis/georeferenced/review/index.html`을 브라우저에서 연다. 지도 선택, 휠 확대, 드래그 이동, 90도 회전, 원본 픽셀 좌표 표시를 지원한다. 대응점 기록 모드에서 왼쪽·오른쪽을 순서대로 클릭하고 근거·역할·상태를 적어 CSV로 저장한다. 화면을 닫기 전에 반드시 CSV를 저장해야 한다. 외부 업로드와 서버 저장은 수행하지 않는다.

새 점의 기본 상태는 `proposed`다. `accepted`는 도로 연결 관계·지명·필지 모서리 등으로 같은 지점임을 검토한 경우에만 지정한다. 맞추기 어려운 점을 오차가 크다는 이유만으로 배제하거나 검사점을 보고 대응점을 반복 조정하면 독립 검증이 되지 않는다.

CSV 열은 `point_id,source_asset_id,target_asset_id,source_x,source_y,target_x,target_y,role,status,evidence_note`이며, 이미지 원점은 좌측 상단, x는 오른쪽, y는 아래쪽이다. 이 점들은 지리좌표 GCP와 구분한다.

## 계산 기준과 실행

확정 대응점이 생기기 전에 **control 최소 4개, 독립 check 최소 2개, check RMSE 20 target pixel 이하**를 거친 후보 판별 기준으로 기록했다. 20 pixel은 정밀 GIS·복원 허용 오차가 아니며 미터로 환산하지 않는다. 현대 좌표와 연결할 때 별도의 근거와 허용 기준이 필요하다.

```bash
.venv/bin/python scripts/georeference/fit_pixel_affine.py \
  gis/control_points/reviewed_points.csv \
  --max-check-rmse-px 20 \
  --output gis/georeferenced/insadong_affine.json
```

`reviewed_points.csv`는 검토 후 저장할 입력 예시이며 현재는 확정점이 없어 생성하지 않았다. 도구는 accepted control만으로 affine을 계산하고, check는 오차 평가에만 사용한다. 원본 체크섬과 이미지 내 좌표 범위를 검증하며 중복점·비유한 좌표·일직선 제어점·부족한 검사점을 거부한다. 출력에 원본과 대응점 CSV의 SHA-256, 행렬, 개별 잔차, control/check RMSE와 최대 오차, NumPy 버전을 기록한다. 기존 출력 파일은 덮어쓰지 않는다.

이 단계에서 성공한 테스트는 합성 좌표로 계산 구현을 검증한 것이다. 실제 사료의 정합 성공 사례가 아니다. 정합 수치가 작아도 역사적 동일 지점이라는 판단이나 지리 정확도를 자동 인증하지 않는다.

## 다음 작업

1908 도록의 해당 도엽 확대본과 도엽 색인을 이용해 비교 대상부터 확정한다. 그 다음 동일 도로의 분기·필지 모서리 등으로 대응점을 확보한다. 대응점이 확보되면 저장한 기준으로 픽셀 정합을 평가하고, 현대 기준자료·CRS 선택과 실제 파일럿 polygon은 그 뒤에 진행한다.

## 후속 결과

1908년 관인방도와 경행방도의 같은 방 경계로 실제 픽셀 정합을 수행했다. control 5개, check 4개, check RMSE 3.31 px. [별도 실험 기록](1908_sheet_join.md)을 참고한다. 위 1908–1912 비교의 미확정 상태는 유지한다.
