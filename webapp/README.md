# Django GIS 검토 서비스

저장소 루트에서 실행합니다.

```bash
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py check
.venv/bin/python manage.py test webapp
.venv/bin/python manage.py runserver 0.0.0.0:8000 --noreload
```

## 화면 (2026-09-15)

| 주소 | 내용 |
|---|---|
| `/` | 전체 화면 3D 지도(운영 기본 화면) |
| `/gis/terrain/3d/` | 도구 막대가 있는 3D 지도 |
| `/guide/` | `docs/landmarks.md`를 그린 건물·시설 안내와 `gis/stories/`의 장소 이야기 |
| `/credits/` | 출처·저작권 |
| `/gis/` | 작업 현황(파일 수·검사점 오차는 로컬 카탈로그·실험 JSON에서 읽음) |
| `/healthz` | 버전·공개 자원 수·누락 파일 보고 |
| `/v/<버전>/<자원>` | 버전을 붙인 정적 자원(immutable 캐시, ETag/304) |

DB는 사용하지 않습니다. 공개 파일은 `webapp/resources.py`의 목록에 있는 것만 제공하므로, 새 JS 모듈이나 데이터 파일을 추가하면 목록에 넣고 `--noreload` 개발 서버를 다시 시작해야 합니다.

설정 메뉴의 **1인칭**는 별도 Colyseus 서버에 연결해 다른 접속자를 표시합니다. [서버 실행·설정과 검증](../multiplayer/README.md)을 참고하세요. 지도 둘러보기는 Colyseus 없이도 사용할 수 있습니다. 별도의 혼자 걷기 버튼은 없으며, 접속 중에는 옷 색깔·이름·NPC와 문자 채팅을 공유합니다.

## 개발 서버와 검사

작업 중에는 `.venv/bin/python manage.py runserver 127.0.0.1:18014 --noreload`로 띄웁니다. 브라우저 검사 `scripts/terrain/check_*_browser.py`의 기본 주소가 이 포트입니다. Playwright Chromium에 `--use-angle=vulkan --enable-features=Vulkan --ignore-gpu-blocklist`를 주면 소프트웨어 렌더링에서도 빨리 돕니다.

- `manage.py test`: Django 15개(자원 목록, 버전 경로, 건물 안내, 동네 이름, 장소 이야기 대상 검증 등)
- 주요 브라우저 검사: `check_walk_collision`(카드·1인칭 클릭·걷기·보행자), `check_new_landmarks`(건물·시전 행랑), `check_gate_models`·`check_gate_orientation`·`check_sungnyemun_connection`(성문), `check_palace_models`(궁궐·궁문), `check_guards`(경비병·궁감), `check_drill`(훈련원), `check_stories`, `check_placenames`
- 예전 화면 기준이라 깨진 채로 남은 검사: `check_settlement`, `check_walls_alignment`, `check_river_gates`, `check_downstream`, `check_yukjo`의 메뉴 표시 부분

## 이전 검토 화면

도엽 연결은 `/gis/georeferenced/1908_join/index.html`, 지도 비교는 `/gis/georeferenced/review/index.html`입니다. 2026-09-09에는 Tailscale 주소(`http://m710q.tail339927.ts.net:8000/`)로 이 화면들을 확인했습니다.

지도 원본과 생성된 검토 화면은 Git 제외입니다. 다른 서버에서는 assets.csv의 원본을 준비하고 [도엽 연결 재현 명령](../docs/1908_sheet_join.md)을 실행해야 합니다. 테스트 중 지도 제공 검증도 이 로컬 파일을 필요로 합니다.

파일 응답은 카탈로그 등록 원본과 명시한 검토 산출물에 한정합니다. 상세 페이지 스냅샷·환경 설정·저장소 내부 파일과 디렉터리 목록은 제공하지 않습니다. 대응점 도구는 CSV를 브라우저에서 저장하며 서버 수정 API는 없습니다.

현재 실행은 작업 확인용 Django 개발 서버입니다. `DJANGO_ALLOWED_HOSTS`로 허용 호스트를 쉼표로 지정할 수 있으며 로컬 검토 기본값은 `*`입니다. `DJANGO_SECRET_KEY`를 지정하지 않으면 프로세스마다 임시 키를 만듭니다. 공개 운영 배포는 별도 구성합니다. [Django 정적 파일 제공 문서](https://docs.djangoproject.com/en/5.2/howto/static-files/)를 참고하세요.

`/gis/terrain/`은 도성 전도의 현대 지형 오버레이와 TPS 대응점 편집 화면입니다. [사용법·근거·검증 범위](../docs/doseong_terrain_overlay.md)를 참고하세요. 배경 타일은 브라우저가 외부 서비스에 요청합니다.

`/gis/georeferenced/readings/index.html`은 1908 도로·하수구 판독, 1912 비교 후보 3개, 두 분기점 가정 배치의 투명도 비교를 제공합니다. 가설은 미채택 상태이며 확정 정합으로 표시하지 않습니다. 원본 준비 후 다음 순서로 재생성합니다.

```bash
.venv/bin/python scripts/georeference/evaluate_crossyear_hypothesis.py
.venv/bin/python scripts/georeference/build_reading_review.py
.venv/bin/python scripts/georeference/build_review.py
```

판독 데이터와 가설 기록은 저장소 파일로 관리합니다. 화면에서 대응점 CSV 또는 TPS 설정 JSON을 저장해도 서버의 기준점 파일이 자동으로 변경되지는 않습니다.

3D 지도의 지형·원도 배치는 [고도 출처·재현·검증](../docs/doseong_terrain3d.md)을, 운영 배포는 [배포 안내](../deploy/README.md)를 참고하세요.
