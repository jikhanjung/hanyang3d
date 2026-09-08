# 자동화 스크립트

`catalog/extract_seoul_archive.py`는 저장한 서울역사아카이브 상세 HTML에서 표 항목과 설명을 추출합니다. Python 표준 라이브러리만 사용하며 네트워크 요청이나 다운로드는 수행하지 않습니다. 나머지 자동화는 순차 구현합니다.

| 경로 | 예정 역할 |
|---|---|
| `validate/` | 카탈로그 필수값·ID·참조·체크섬, 이후 GIS 품질 검사 |
| `catalog/` | 검증된 기관별 메타데이터 수집 |
| `download/` | 이용 조건을 확인한 파일 취득·중복 방지·재시도 |
| `georeference/` | 변환 설정 적용과 오차 보고 |
| `vectorize/` | 검토 가능한 반자동 벡터 추출 |
| `export/` | GIS·모델·배포 manifest 생성 |

각 구현에는 입력·출력, 실행 예, 필요한 버전, 실패 시 재실행 방법을 기록합니다. 의존성과 실행 명령은 구현 시 추가합니다.

## 상세 페이지 추출

```bash
python3 scripts/catalog/extract_seoul_archive.py --help
```

입력 HTML 경로와 `--source-id`, `--url`, `--retrieved-at`, `--output`을 지정합니다. 출력은 기존 파일을 덮어쓰지 않는 JSON입니다. 원문 표 항목, 페이지 checksum과 취득 정보를 보존합니다. 표 구조가 없거나 필수 식별 항목이 없으면 실패합니다. 현재 도성대지도 페이지에서 확인했으며 다른 페이지 형식은 적용 전 검토해야 합니다.
