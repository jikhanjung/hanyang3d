# 자동화 스크립트

`catalog/extract_seoul_archive.py`는 저장한 서울역사아카이브 상세 HTML에서 표 항목과 설명을 추출합니다. Python 표준 라이브러리만 사용하며 네트워크 요청이나 다운로드는 수행하지 않습니다. 나머지 자동화는 순차 구현합니다.

| 경로 | 예정 역할 |
|---|---|
| `validate/` | 카탈로그 필수값·ID·참조·체크섬, 이후 GIS 품질 검사 |
| `catalog/` | 검증된 기관별 메타데이터 수집 |
| `download/` | 이용 조건을 확인한 파일 취득·중복 방지·재시도 |
| `georeference/` | 픽셀 affine·대응점 검토 구현; 지리 정합은 예정 |
| `vectorize/` | 검토 가능한 반자동 벡터 추출 |
| `export/` | GIS·모델·배포 manifest 생성 |

각 구현에는 입력·출력, 실행 예, 필요한 버전, 실패 시 재실행 방법을 기록합니다. 의존성과 실행 명령은 구현 시 추가합니다.

## 지도 대응점 검토와 픽셀 정합

`build_review.py`와 `build_reading_review.py`는 `gis/control_points/1908_1912_comparison_cases.json`의 후보 구간을 공유합니다. 생성된 비교 페이지에 `?left=asset-0012&right=asset-0010&case=gh-west-branch`처럼 지정하면 해당 원본 구간을 확대합니다. 알 수 없는 ID는 기본값을 사용하고 후보만으로 대응점을 생성하지 않습니다.

`georeference/build_review.py`는 로컬 지도 선택·확대·회전·대응점 CSV 입출력을 제공하는 오프라인 HTML을 생성합니다. `georeference/fit_pixel_affine.py`는 검토된 control로 affine을 계산하고 독립 check의 오차를 보고합니다. 지리 CRS를 부여하지 않습니다.

```bash
.venv/bin/python scripts/georeference/build_review.py
.venv/bin/python -m unittest discover -s scripts/georeference -p 'test_*.py'
```

설치와 실제 입력 규칙은 [픽셀 정합 검토](../docs/pixel_registration_review.md)에 있습니다. 계산 도구의 의존성은 루트 `requirements.txt`에 고정했습니다. 테스트는 합성 좌표를 사용하며 실제 사료의 정합 검증과 별개입니다.

## 상세 페이지 추출

```bash
python3 scripts/catalog/extract_seoul_archive.py --help
```

입력 HTML 경로와 `--source-id`, `--url`, `--retrieved-at`, `--output`을 지정합니다. 출력은 기존 파일을 덮어쓰지 않는 JSON입니다. 원문 표 항목, 페이지 checksum과 취득 정보를 보존합니다. 표 구조가 없거나 필수 식별 항목이 없으면 실패합니다. 현재 도성대지도 페이지에서 확인했으며 다른 페이지 형식은 적용 전 검토해야 합니다.

`georeference/render_pixel_join.py`는 affine 보고서와 대응점·원본의 SHA-256을 검증한 뒤 오프라인 겹침 화면 및 원본 점별 확대 비교를 생성합니다. [실제 1908 실험과 실행 명령](../docs/1908_sheet_join.md)을 참고하세요. 기존 출력 폴더의 검토 파생 파일은 재생성 시 덮어씁니다.

## 시대 간 두 분기점 가설 재현

```bash
.venv/bin/python scripts/georeference/evaluate_crossyear_hypothesis.py
.venv/bin/python scripts/georeference/build_reading_review.py
.venv/bin/python scripts/georeference/build_review.py
```

첫 명령은 원본 체크섬을 검증하고 두 가정점의 유사변환 및 미채택 검토 기록을 `gis/control_points/1908_1912_branch_hypothesis.json`에 재생성한다. 뒤의 명령은 겹침 화면과 비교 후보 페이지를 갱신한다. 기존 파생 출력은 덮어쓴다. 확정 대응점이나 지리 좌표를 생성하지 않는다.
