# Hanyang 3D

운영 화면: [한양 3D](https://hanyang3d.nopeoplestime.info/) · [건물 안내](https://hanyang3d.nopeoplestime.info/guide/) · [출처·저작권](https://hanyang3d.nopeoplestime.info/credits/)

조선시대 한양의 거리·수계·필지·건축·지형을 **출처와 시간, 불확실성을 추적할 수 있는 GIS / 3D 데이터**로 재구성하는 프로젝트입니다.

## 현재 상태 (2026-09-22, 웹 v0.5.46 / 멀티플레이 v0.5.31)

두 시대를 운영합니다. **1750년대 중엽 한양**(기본 화면 `/`)은 도성대지도(전체도와 부분도 12장, 제작 1753~1760년, 기준 연도 1756)를 고도 지형(FABDEM V1.2) 위에 입힌 3D 지도이고, **1907년경 경성**(`/1907/`)은 서울역사박물관 소장 「최신경성전도」를 같은 지형에 펼친 지도입니다. 모든 건물·사람은 출처를 밝힌 개념 모형이며, 위치 근거·추정·창작을 구분해 기록합니다.

| 내용 | 현재 구현 |
|---|---|
| 지형·원도 | 고도 지형 위의 두 원도, 옛 지도 불투명도·높이 강조, 시대 전환 |
| 1750년대 | 건물·시설 114곳(관청·궁궐·제례·성문·궁가 등), 성벽과 9개 성문(광화문은 석축만), 옛길·청계천·다리, 동네 이름 399개, 길가 주택·운종가 시전, 경비병·궁감·훈련 군사, 후원 정자와 원유(함춘원) |
| 1907년 | 건물 76곳(궁궐·성문·교회·공사관·학당·전차 차고 등), 성벽 개구부와 궁문 통로, 전차 노선·차량, 민가 배치, 시대 인물 21명(문지기·서점 주인·취객·말 장수 등)과 이야기 |
| 걷기 | 1인칭·3인칭 보행(키보드·터치 조이스틱, A/D 회전·Q/E 대각), 충돌·계단·궁궐 마당·실내(명동성당), 말 타기, 낚시·약초, 미니맵·전체 지도(M) |
| 함께 걷기 | Colyseus로 접속자의 이름·이동, NPC 130명의 이동·회피 공유, 문자 채팅과 놀이 알림(말 타기 등) 표시, 마지막 위치 복원 |
| 계정·경제 | 이름·비밀번호 계정(이 기기에서 기억하기), 엽전·봇짐·액션바를 서버 DB에 기록, 시전·서점·말 장수 거래 |
| 역사 회상(퀘스트) | 1907년 러시아공사관 관리인에게 받은 꾸러미로 들어가는 **1896년 아관파천** 회상: 밀서 전달 → 영추문 밖 연락책 → 두 대의 가마 따라가기(순찰 회피) → 공사관 도착·통역과 이웃의 이야기 → 날짜가 붙은 후일담. 정의 파일 하나로 사건을 더할 수 있는 공통 틀([docs/historical_events.md](docs/historical_events.md)) |
| 이야기·안내 | 출처를 확인한 장소 이야기 49편, 건물 안내 190곳, 창덕궁 수문장의 1750년대 궁중 소식 등 출처 있는 NPC 대화 |
| 언어 | 한국어·영어(KO \| EN) 전환: 화면 문구·서버 응답·건물·안내·이야기·대사·물건·지명 |
| 운영 도구 | 콘텐츠 SQLite DB와 Django 관리 화면(`/backoffice/`), 한양3D 전용 관리 화면 **도성도감**(`/office/`: 대시보드·사용자·건물·물건 값·이벤트), 검증 백업·복원 |

검증된 측량 수준의 지리 정합, 건물별 실측 복원, 1908·1912 지적도와의 연결은 아직 없습니다. 회상의 세부 동선·인물·대사는 창작이며 화면 출처 설명에 그 범위를 밝힙니다.

[서버 인계 기록](docs/handoff.md)에 현재 상태와 로컬 파일을, [개발 기록](devlog/README.md)에 작업마다의 판단·검증·한계를 남깁니다(270건).

## 먼저 읽기

- [실행 계획과 단계별 완료 기준](docs/plan.md)
- [건물·시설 안내](docs/landmarks.md) (사이트 `/guide/`)
- [장소 이야기 자료](docs/stories.md)
- [범위와 파일럿](docs/scope.md)
- [초기 조사 원문](docs/HANYANG_3D_RESEARCH_AND_SOURCE_ROADMAP.md)
- [문서 안내](docs/README.md)
- [참여 방법](CONTRIBUTING.md)
- [개발 기록](devlog/README.md)

## 진행 방향

도성대지도 중심으로 한양 도성 전체의 모습을 먼저 보여 주는 방향([우선순위 변경 결정](docs/decisions/0002-citywide-map-first.md))에 따라 지형·성곽·길·수계를 판독한 뒤, 사용자 요청에 따라 1750년 무렵의 건물·동네 이름·사람·이야기를 차례로 더했습니다. 건물은 원도나 부분도에 그려진 자리를 우선하고, 1750년에 없던 것(예: 경복궁 전각)은 터로만 표시합니다. 다음 후보는 [건물 추가 목록](docs/landmark_backlog.md)과 [실행 계획](docs/plan.md)에 있습니다.

모든 형상은 출처와 연결하고, 위치와 외형의 신뢰도를 따로 기록합니다. 후대의 필지나 현대 지형을 조선시대의 모습으로 바로 간주하지 않습니다.

## 저장소 구조

```text
.github/       자료 등록·작업 제안·PR 템플릿
 docs/         범위, 실행 계획, 방법론, 데이터 규약, 결정 기록
 data/         자료 카탈로그와 로컬 원본 보관 위치
 gis/          기준점, 좌표변환 결과, 주제별 공간 데이터(건물·동네 이름·이야기·길·물길·성벽)
 scripts/      자료 추출·지도 비교·픽셀 정합·검증 도구
 webapp/       Django 작업 현황·지도 검토 서비스
 notebooks/    탐색 분석과 실험 기록
 models/       대표 건축물, 생성 규칙, 생성된 모델
 references/   서지와 사료별 판독·해석 기록
```

각 디렉터리의 README에 파일 관리 기준이 있습니다. 빈 작업 디렉터리는 `.gitkeep`으로 유지합니다.

## 첫 작업 시작하기

1. [파일럿 범위](docs/scope.md)와 [P1 작업 목록](docs/plan.md)을 읽습니다.
2. [sources.csv](data/catalog/sources.csv)에서 우선 자료를 고르고 원문 상세 페이지를 확인합니다.
3. [자료 등록 규칙](docs/sources.md)에 따라 출처와 개별 파일의 이용 조건을 기록합니다.
4. 원본을 확보하면 `assets.csv`에 경로·SHA-256·취득일을 등록합니다.
5. 기준점 및 정합 실험을 기록한 뒤 GIS 객체를 작성합니다.

초기 조사 후보 7건에 확인한 도록·개별 지적자료를 추가해 사료 17건을 등록했습니다. 검증 범위와 상태는 행별로 관리합니다. 취득 파일 12건은 `assets.csv`에 있습니다. [지적자료와 파일럿 검토](docs/cadastral_pilot_review.md)에 1908 도엽 29건의 범위와 1912 기록 색인을 정리했습니다. 지도 대응점 검토 도구의 실행 방법은 아래에 있습니다.

## 권리와 인용

프로젝트 코드·문서의 배포 라이선스는 아직 결정하지 않았습니다. 외부 사료와 파생 데이터의 조건은 파일별로 관리합니다. [권리 관리 방침](docs/licensing.md)을 참고하세요. 정식 릴리스 전에는 저장소 주소, 커밋 해시, 참조 파일을 함께 기록해 인용합니다.

## Docker 배포

운영 이미지는 `honestjung/hanyang3d:v0.5.49`과 `honestjung/hanyang3d-multiplayer:v0.5.31`입니다. 개발 호스트에서 `bash deploy/build.sh <버전> --web-only`로 웹 이미지와 지도 데이터 묶음을 만들고 검증한 뒤, dolfinid에서는 이미지를 받아 교체만 합니다. 절차·배포 기록·digest는 [배포 안내](deploy/README.md)에 있습니다. 산출물은 `dist/`에 생성하며 Git에는 포함하지 않습니다.

## 실행과 검사

웹서비스는 Django이며 콘텐츠·계정은 SQLite DB에 둡니다. `.venv/bin/python manage.py migrate && .venv/bin/python manage.py import_content` 뒤 `.venv/bin/python manage.py runserver 127.0.0.1:18014 --noreload`로 실행합니다(파일 자료만으로 보려면 `HANYANG_CONTENT_SOURCE=files`). 주요 화면은 다음과 같습니다.

- `/`: 1750년대 중엽 한양 3D 지도(운영 기본 화면), `/1907/`: 1907년경 경성
- `/events/agwanpacheon/`: 아관파천 회상(1907년에서 꾸러미를 써서 들어감)
- `/guide/`: 건물·시설 안내와 장소 이야기, `/credits/`: 출처·저작권
- `/office/`: 도성도감(운영진), `/backoffice/`: Django 관리 화면, `/healthz`: 상태 확인

검사는 `.venv/bin/python manage.py test`(Django 96개)와 `scripts/terrain/check_*_browser.py`(Playwright 브라우저 검사 63개; 대부분 임시 DB로 자체 서버를 띄우며, 일부는 `--url`로 실행 중인 서버를 가리킵니다)입니다. 오래된 화면 기준으로 남은 검사가 일부 있습니다. 자세한 실행 방법은 [웹서비스 안내](webapp/README.md)에 있습니다. 함께 걷기 서버는 [multiplayer/README.md](multiplayer/README.md)를 참고합니다.

## 보존한 검토 도구


[픽셀 정합 검토와 실행 방법](docs/pixel_registration_review.md)에 오프라인 대응점 검토 화면과 affine 계산 CLI를 정리했습니다. 1908 관인방도–경행방도에서 공통 경계 대응점 9개를 판독하고 상대 픽셀 정합을 수행했습니다. 독립 검사점 4개의 RMSE는 3.31 px입니다. [1908 도엽 연결 결과](docs/1908_sheet_join.md)와 [로컬 겹침 화면](gis/georeferenced/1908_join/index.html)에서 확인할 수 있습니다. 1908–1912 대응점, 현대 좌표 정합과 파일럿 경계는 미완료입니다.

[도성 전도·현재 지형 TPS 비교](docs/doseong_terrain_overlay.md)는 Django의 `/gis/terrain/`에서 엽니다.

[1908 도로·하수구 판독](docs/1908_road_drain_reading.md)을 추가했습니다. Django `/gis/georeferenced/readings/index.html`에서 원본과 판독선 5개를 비교합니다. 도로 3개·하수구 2개를 기록했으며, 1912 비교 후보 3개와 두 분기점 가정 배치의 겹침 검토도 제공합니다. 해당 가설은 주변 필지 대응 근거 부족으로 미채택이며, 1908–1912 확정 대응점은 0개입니다. 이 세부 비교는 보존하고 도성 전체의 지도·3D 지형 작업을 우선합니다.

[도성 전체 3D 지형](docs/doseong_terrain3d.md)에 지형·원도 배치의 출처와 재현 방법이 있습니다.

## 콘텐츠 DB와 관리 화면

건물·이야기·상세 설명·리소스·물건·장면 데이터는 SQLite DB가 정본이며 Git의 JSON은 동기화 원천입니다. 로컬 초기화·관리자 계정은 [백오피스 안내](docs/backoffice.md), 검증 백업·복원은 [백업 안내](docs/content_backup.md)를 따릅니다. 운영에서는 [도성도감](https://hanyang3d.nopeoplestime.info/office/)과 [Django 관리 화면](https://hanyang3d.nopeoplestime.info/backoffice/)으로 편집하며, 매시 운영 백업과 매일 05:15(KST) 개발 호스트·NAS 백업을 둡니다. 도성도감의 설계와 모듈 계획은 [docs/office_design.md](docs/office_design.md)에 있습니다.

## 연구 보관 자료

한국학중앙연구원 한양 3D 자료(건축·복식·물품·음식 GLB와 PDF)를 연구용으로 수집해 개발 호스트와 NAS에 검증 보관합니다([docs/aks_archive_storage.md](docs/aks_archive_storage.md)). 사이트에 재배포하지 않으며 앱의 모형은 모두 자체 코드입니다.
