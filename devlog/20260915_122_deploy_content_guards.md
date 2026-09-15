# 122 — 배포 검사·SECRET_KEY·백업 상태·되돌리기 안전장치

[120](20260915_120_codex_review.md) 검토의 수정 2단계(운영).

## 콘텐츠 참조가 끊겨도 페이지는 뜨고, 배포는 실패

- `webapp/content.py`: DB 행이 새 이미지에 없는 모형 생성기·다리 id·동네 이름을 가리키면, 전에는 `KeyError`로 `/`가 500이 됐다. 이제 건물은 모형 없이 그대로 싣고 이야기는 건너뛰며, 건너뛴 항목을 로그와 `problems` 목록에 남긴다. `content_problems()`가 공개 콘텐츠를 한 번 그려 보고 목록을 돌려준다.
- `/healthz`에 `content_warnings`를 더했다. 경고가 있어도 상태는 ok(사이트는 동작)다.
- `deploy/healthcheck.py`
  - 인자 없이(Docker HEALTHCHECK): ok와 degraded를 모두 통과. 시간별 백업이 한 번 실패해도 컨테이너가 unhealthy가 되어 급한 수정 배포가 되돌려지는 일이 없다.
  - `--deploy`(`deploy.sh`): `content_warnings`가 있으면 실패, `/`와 `/guide/`가 200이 아니면 실패. degraded면 경고만 출력.

## SECRET_KEY

- `DJANGO_COOKIE_SECURE=1`(운영 HTTPS·DB 모드)이면 `DJANGO_SECRET_KEY`가 32자 미만이거나 예시값(`replace-with…` 등)일 때 시작을 거부한다(`webapp/secret_check.py`). 키가 없을 때 워커마다 다른 무작위 키가 생겨 세션·CSRF가 깨지던 경로를 막는다.
- 배포 전 운영 `.env.django`의 키가 64자 사용자 값임을 값 출력 없이 확인했다.

## 되돌리기 안전장치 (`deploy/host/deploy.sh`)

- DB 모드 배포에서 대상 이미지에 콘텐츠 DB 명령(`webapp.management.commands.import_content`)이 없으면 아무것도 멈추기 전에 거부한다. v0.2.x 같은 옛 이미지로 DB 모드 되돌리기를 시도해 migrate·import가 실패하고 recover되던 경로를 막는다.
- migrate 전에 DB에 적용된 migration 가운데 이미지가 모르는 것이 있으면 중단한다(더 새 스키마 위에서 옛 코드가 도는 경우). 중단되면 기존 recover가 이전 설정으로 되돌린다.
- 배포 후 검사는 `healthcheck.py --deploy`.

## 검사

- Django 29개 통과: 참조가 끊긴 모형·다리 행이 건너뛰어지고 보고되며 `/`는 200, `/healthz` 상태 ok와 경고 목록 일치, 운영용 키 검사.
- 이미지 지원 검사 명령을 로컬 이미지에 돌려 v0.3.1은 통과, 콘텐츠 DB가 없는 이전 이미지는 거부됨을 확인했다.
- 스키마 검사 명령을 임시 DB에 돌려 깨끗한 DB는 통과, 없는 migration 행(`0099_future`)을 넣으면 종료 코드 1을 확인했다.
