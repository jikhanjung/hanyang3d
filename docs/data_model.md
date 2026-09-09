# 데이터 모델 v0.2

카탈로그는 UTF-8 CSV이며 첫 행은 필드명입니다. 빈 셀은 미상(null)입니다. 날짜는 `YYYY-MM-DD`, 연도는 정수, ID는 재사용하지 않는 안정적인 문자열입니다. `sources.csv`와 `assets.csv`가 현재 구현된 테이블이며, 아래 공간 테이블은 P2–P3에서 구현할 설계입니다.

## 사료: sources.csv

한 행은 개별 사료 또는 아직 분해하지 않은 자료군 후보입니다. 자료군은 개별 도엽을 대신하는 geometry 근거로 쓰지 않습니다. 개별 자료를 등록하면 노트로 상위 자료군과 연결합니다.

| 필드 | 규칙 |
|---|---|
| `id` | 필수·고유, 예: `src-0001` |
| `title`, `institution` | 필수; 소장처 미확인은 명시 |
| `source_type` | `map`, `cadastral`, `plan`, `archaeology`, `photo`, `text`, `terrain`, `other` |
| `date_start`, `date_end`, `date_text` | 제작 연도 하한·상한과 원문 표현; 미상 허용 |
| `url` | 필수; 상세·목록·2차 소개 여부를 notes에 기록 |
| `coverage` | 공간 범위 설명; 실제 도엽 범위 검증은 별도 |
| `priority` | `P0`, `P1`, `P2`; 조사 우선순위이며 계획 단계와 별개 |
| `verification_status` | `unverified`, `verified`, `blocked` |
| `verified_at` | 상세 출처를 직접 확인한 날짜; verified이면 필수 |
| `notes` | 연대 차이, 자료군 관계, 확인 범위와 남은 질문 |

`verified`는 메타데이터 확인이며 다운로드 완료나 이용 허가를 의미하지 않습니다.

## 개별 파일: assets.csv

한 사료에 스캔·PDF·부분 이미지 등 여러 asset이 연결됩니다. 같은 파일이 변경되면 새 asset ID를 부여합니다. 2026-09-09 기준 지도 JPG 11건과 영인 도록 PDF 1건, 총 12건을 등록했습니다.

| 필드 | 규칙 |
|---|---|
| `id`, `source_id` | 필수·고유 asset ID, 존재하는 사료 ID |
| `download_url` | 실제 취득 파일 URL; 수동 취득이면 notes에 방법 기록 |
| `retrieved_at` | 취득일 |
| `local_path`, `storage_uri` | 저장소 기준 상대 경로 또는 외부 보관 위치; 인증정보 제외 |
| `sha256` | 취득 완료 파일의 64자리 소문자 16진 checksum |
| `media_type`, `size_bytes` | MIME 유형과 바이트 크기 |
| `image_width`, `image_height` | 이미지 pixel 크기; 해당하지 않으면 빈 셀 |
| `license_name`, `license_url`, `rights_checked_at` | 개별 파일의 조건 명칭·근거 URL·확인일 |
| `attribution` | 필요한 출처 표기 문구 |
| `download_status`, `commercial_use`, `derivative_use`, `redistribution_status` | 권리 상태: `unknown`, `allowed`, `conditional`, `prohibited` |
| `notes` | 조건 내용, 취득 방식, 기술적 제한 |

`download_status`는 **다운로드 허용 상태**이며 취득 완료 상태가 아닙니다. 취득 완료 여부는 retrieved_at·저장 위치·checksum으로 판단합니다. 취득된 파일에는 이 세 정보와 media_type·size_bytes가 필요합니다. 조건 미확인은 권리 필드에 `unknown`을 명시합니다.

## 공간 객체와 근거 관계: 예정

GeoPackage의 주제별 레이어는 `roads`, `waterways`, `parcels`, `buildings`, `walls`, `archaeological_features`입니다. 공통 필드는 다음과 같습니다.

| 필드 | 용도 |
|---|---|
| `feature_id`, `place_id` | 고유한 시기별 형상 ID, 같은 장소를 묶는 ID |
| `geometry`, `name`, `feature_type` | 공간 형상과 명칭·유형 |
| `valid_from`, `valid_to`, `temporal_status`, `chronology_note` | 존속 시기와 해석; [시간 규칙](chronology.md) 적용 |
| `existence_confidence`, `location_confidence`, `footprint_confidence`, `height_confidence`, `appearance_confidence`, `chronology_confidence` | 각각 0–1 또는 null; 평가 근거 필수 |
| `geometry_stage`, `derived_from_id` | `traced` 또는 `corrected`; 보정 전 객체 참조 |

도로·수계는 중심선과 폭 추정, 필지·건물은 polygon을 기본으로 합니다. 건물에는 `roof_type`, `floors`, `height`를 추가하고 미상 치수를 0으로 대체하지 않습니다. 길이·높이 단위와 수직 기준은 레이어 메타데이터에 기록합니다. 성곽과 발굴 유구의 geometry 유형은 레이어 생성 시 명시합니다.

다대다 관계는 `feature_evidence` 테이블에 `evidence_id, feature_id, source_id, asset_id, aspect, locator, interpretation, confidence_reason`으로 기록합니다. `aspect`는 `existence`, `location`, `footprint`, `height`, `appearance`, `chronology`입니다. `locator`는 페이지·도엽·이미지 영역 등 재검토 위치입니다. 실제 geometry 근거는 개별 사료와 asset에 연결합니다.

`places`는 `place_id, name_hangul, name_hanja, alternate_names, place_type`을 기본으로 하고 이름의 시기별 변화는 별도 이력으로 확장합니다. 필지 분할·합병 등은 `feature_changes`에 이전·이후 객체 ID, 변화 유형, 기간, 근거 ID를 저장합니다.

## 검증 기준

- CSV 열 수, 필수값, 허용 상태, ID 중복, 외래키 존재 여부를 확인합니다.
- 연도 양쪽이 있으면 시작 ≤ 종료여야 합니다. 미상과 추정을 구별합니다.
- geometry는 해당 레이어 유형에 맞고 유효해야 하며 CRS가 명시되어야 합니다.
- 모든 공간 객체는 근거 연결을 가져야 합니다. 위치·외형의 근거를 혼용하지 않습니다.
- 다운로드 파일은 저장 위치와 SHA-256을 확인합니다.
- 공개 묶음은 권리 상태와 조건 이행 여부를 별도로 확인합니다.

현재 자동 검증기와 GeoPackage 스키마는 미구현입니다. P1에서 실제 자료로 필드를 검토한 뒤 버전 변경을 기록합니다.

## 상세 페이지 메타데이터 (v0.2 추가)

sources.csv에 다음 열을 추가했습니다. 기관이 화면에 표시하는 식별자와 다운로드용 내부 fileId/fileSn은 별개입니다.

| 필드 | 의미 |
|---|---|
| `archive_number` | 화면의 아카이브 번호 |
| `relic_number` | 유물 번호; 문자·접두어·선행 0 보존 |
| `material_number` | 별도 자료 번호가 있는 경우 원문 값; 없으면 빈 셀 |
| `period_text` | 상세 페이지의 시기 원문; 정규화 연대와 별개 |
| `source_citation` | 자료출처의 서지 표기 원문 |
| `detail_metadata_path` | 원문 항목·상세 설명을 보존한 로컬 JSON 경로 |
| `detail_retrieved_at` | 상세 페이지 취득일 |

상세 JSON은 원문 항목명을 key로 보존하고 내용 전체를 저장합니다. 화면 공백만 정리하며 요약이나 번역으로 대체하지 않습니다. 원본 HTML 경로·SHA-256·출처 URL·취득일을 함께 기록합니다. 화면에 없는 항목은 추측하지 않고 비워 둡니다. 전체 HTML·설명 JSON은 원본 자료와 함께 로컬 보관하며 일반 Git에서 제외합니다. 카탈로그의 로컬 경로는 다른 체크아웃에 파일이 존재한다는 보장이 아닙니다.

## 조사 색인

- `1908_sheet_index.csv`: 공식 목록 29개 도엽과 도록에 따른 동명 수준 coverage. 등록한 도엽만 source_id를 연결한다.
- `1912_jongno_record_index.csv`: 종로 자료군 22철의 건 항목 1,414행. docid와 뷰어를 연결하며 고유 이미지 수를 의미하지 않는다.
- `cadastral_discovery_pages.csv`: 색인 작성에 사용한 목록·철 상세 HTML의 URL·로컬 경로·SHA-256·취득일.

조사 색인은 sources/assets의 대체 테이블이 아니다. source_id가 빈 항목은 개별 사료 등록·취득 미완료다. 국가기록원 개별 사료의 archive_number는 docid/archiveEventId, material_number는 철 관리번호 mngno를 저장하며 각 행의 notes에 의미를 명시한다.
