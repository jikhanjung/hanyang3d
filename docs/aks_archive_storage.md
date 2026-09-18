# AKS 연구자료 원본과 NAS 보관

2026-09-18 사용자 요청으로 원본 수집과 NAS 추가 보관을 완료했다. 건축 GLB 1,015개(178.41GiB), PDF 92개(10.37GiB)를 확보했다. 건축 링크 19개는 서버 HTTP 404로 두 차례 요청 모두 실패했다. 검증된 바이너리 1,107개가 NAS 상태 파일의 크기·SHA-256과 모두 일치하며 누락은 없다. HTML·목록까지 포함한 최초 완료 시점의 NAS 사본은 1,128개, 약 188.79GiB였다. 이후 설명 문서 갱신으로 파일 수는 달라질 수 있다.

| 자료 | 개발 PC 경로 | 목록 |
|---|---|---|
| 건축 GLB 1,034개 URL | `data/models/aks-hanyang/glb/` | `docs/aks_architecture_manifest.json` |
| 복식·물품·음식 1,203개 URL | 현재 목록만 확보 | `docs/aks_objects_manifest.json`, CSV |
| PDF 92개 URL | `data/texts/aks-hanyang/pdf/` | `docs/aks_pdf_manifest.json` |

NAS 루트는 `/nas/JikhanJung/hanyang3d_backup/research/aks-hanyang/`이다. 그 안에서 프로젝트 상대 경로를 유지한다. 예를 들어 건축 모델은 `data/models/aks-hanyang/glb/`, PDF는 `data/texts/aks-hanyang/pdf/` 아래에 들어간다. 목록, 출처 HTML과 수집 계획도 함께 보관한다. 운영 DB 백업과 별도 폴더이며 기존 자료를 삭제하지 않는다.

## 실행·재개

```sh
python3 scripts/download/fetch_aks_architecture.py --download --pause 3
python3 scripts/download/fetch_aks_pdfs.py --download --wait-for-glb
python3 scripts/download/backup_aks_archive.py --watch
```

각 명령은 별도 작업이다. PDF 작업은 건축 목록의 pending 항목이 없어질 때까지 기다리므로 외부 바이너리 다운로드가 겹치지 않는다. NAS 작업은 현재 두 manifest의 검증된 파일을 반복 확인하고, pending 항목이 없어지고 마지막 복사가 끝나면 종료한다. 장비 재시작을 견디는 서비스나 정기 예약은 아니므로 중단되면 위 명령으로 재개한다. 같은 명령을 중복 실행하지 않는다.

NAS는 실제 `/nas` 마운트가 있어야 시작한다. NAS에 원본 크기 + 5GiB의 여유를 확인하고 `.part`로 복사한 뒤 NAS 파일의 SHA-256을 원본 manifest와 대조한다. 일치한 파일만 최종 이름으로 바꾼다. `backup_status.json`에 파일별 크기·해시·검증 시각을 남기고 이후 실행에서는 동일한 검증 이력·크기·수정 시각의 파일을 건너뛴다. 이 조건은 반복 복사를 줄이기 위한 것으로 장기 비트 손상 검사를 대체하지 않는다.

현재 실행 로그는 개발 PC의 `/tmp/aks-model-download.log`, `/tmp/aks-pdf-download.log`, `/tmp/aks-nas-backup.log`다. Git에 들어가는 manifest는 커밋 당시 스냅샷이며 다운로드 중의 최신 상태와 다를 수 있다. `failed`는 성공 개수에 포함하지 않는다. 404 파일을 임의 주소로 대체하지 않는다.

원본은 Git과 배포 이미지에 넣지 않는다. 2020–2022 제작 시기를 역사적 재현 시기와 구분하고, 시대·복원 이력·개별 이용 조건을 검토한 뒤 앱 적용 여부를 결정한다. PDF도 연구 보관용이며 사이트에 일괄 재배포하지 않는다.

## 다운로드 실패 링크

모두 서버 HTTP 404 응답이며 성공 자료에 포함하지 않았다. 정확한 원본 주소는 건축 manifest에 보존한다.

- `경복궁문가수청남담장.glb`
- `경복궁문가수청동담장.glb`
- `경복궁문가수청북담장.glb`
- `경복궁문가수청서담장.glb`
- `경복궁문가수청서행각.glb`
- `3D-서울_구_서대문형무소_경교장.glb`
- `3D-경희궁_숭정문.glb`
- `3D-덕수궁_중화전_동행각2.glb`
- `3D-서울_한국기독교자로회총회_선교교육원.glb`
- `3D-창경궁_집복헌_및_연춘헌.glb`
- `3D-창경궁_집복헌_연춘헌_남행각.glb`
- `3D-창덕궁_부용청_남전각.glb`
- `3D-창덕궁_영군번소2.glb`
- `3D-창덕궁_장고_부속채.glb`
- `3D-창덕궁_집경문_문간채.glb`
- `3D-창덕궁_창의문.glb`
- `3D-경복궁_용무당_경무대.glb`
- `3D-경복궁_용문당_부속건물1.glb`
- `3D-경복궁_용문당_부속건물2.glb`
