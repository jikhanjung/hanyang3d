# Django GIS 검토 서비스

저장소 루트에서 실행합니다.

```bash
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py check
.venv/bin/python manage.py test webapp
.venv/bin/python manage.py runserver 0.0.0.0:8000 --noreload
```

첫 화면은 `/`, 도엽 연결은 `/gis/georeferenced/1908_join/index.html`, 지도 비교는 `/gis/georeferenced/review/index.html`입니다. 첫 화면의 파일 수와 검사점 오차는 로컬 카탈로그·실험 JSON에서 읽습니다. DB는 아직 사용하지 않습니다.

현재 서버의 Tailscale 접속 주소는 `http://100.98.176.40:8000/` 또는 `http://m710q.tail339927.ts.net:8000/`입니다. 같은 Tailscale 네트워크에 연결된 기기에서 엽니다. 2026-09-09 서버의 Tailscale IP로 첫 화면·지형 오버레이·판독 화면의 HTTP 200 응답을 확인했습니다. 서버 재부팅 후에는 위 실행 명령으로 다시 시작해야 합니다.

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
