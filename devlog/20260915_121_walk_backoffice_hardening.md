# 121 — 함께 걷기 과부하 차단과 백오피스·HTTPS 보강

[120](20260915_120_codex_review.md) 검토의 수정 1단계(보안).

## 함께 걷기 서버 (`multiplayer/room.js`, `server.js`)

- 방 입장 검사를 인스턴스 `onAuth`에서 정적 `WalkRoom.onAuth`로 옮겼다. Colyseus 0.18의 `joinOrCreate`는 정적 `onAuth`를 방 생성 전에 부르므로, 이름·프로토콜·지도 배치·`mapVersion` 형식·`routeKey`를 통과하지 못한 요청은 방을 만들지 못한다.
- `mapVersion`을 방 필터에서 뺐다. 이제 방은 지도 배치(`mountains`/`base`)로만 나뉘고, 임의 문자열로 방을 여는 경로가 없다. `mapVersion`은 `vX.Y.Z` 형식만 검사한다(같은 자료인지는 `routeKey`가 보증).
- 방 수 상한 `WALK_MAX_ROOMS`(기본 8): 방이 상한만큼 있고 모두 찼으면 새 방을 만들지 않고 429를 돌려준다.
- 매치메이킹 HTTP 단계의 오류 코드는 HTTP 상태로 쓰이므로 422(이름)·412(자료 불일치)·429(만석)로 바꿨다. 처음에 4001·4002를 던졌더니 Colyseus가 응답을 만들지 못해 500이 되는 것을 로컬 서버에서 확인하고 고쳤다. 중복 이름(onJoin, WebSocket 단계)은 4003 그대로다.
- `chat-history`는 세션마다 한 번만 응답한다(반복 요청 증폭 차단).
- 헬스체크의 NPC 수 130 고정값을 이미지 안 경로 자료의 합계로 바꿨다.

## 브라우저 (`walk_together.js`)

- 접속 실패·끊김·오류 시 1인칭에서도 나오게 했다(`fail`). 전에는 1인칭이 남고 버튼만 ‘1인칭’으로 돌아가 버튼으로 나올 수 없었다.
- 새 오류 코드(422·412·429)의 안내문을 그대로 보여 준다.

## Nginx (`deploy/host/hanyang3d.nginx.conf`)

- `/multiplayer/matchmake/`: IP당 분당 20회(버스트 10), 초과 시 429.
- `/multiplayer/`: IP당 동시 연결 8개. 두 위치 모두 `X-Real-IP`·`X-Forwarded-For` 전달.
- `/backoffice/login/`: IP당 분당 10회(버스트 5), 초과 시 429.
- HSTS `Strict-Transport-Security: max-age=31536000`.
- `docs/backoffice.md`에서 관리자 ID를 지우고 로그인 제한을 적었다.

## 검사

- `node --test`(multiplayer) 8개: 입장 옵션 검사, 방 상한 규칙 추가.
- 로컬 Colyseus 서버에 `check_connections.js` 통과. 임의 `mapVersion`으로 보낸 매치메이킹 요청 3건은 412, `<b>` 이름은 422로 방 생성 전에 거절됐다. 검사 스크립트는 `mapVersion` 형식, ‘다른 버전은 같은 방’, 배치별 공간 분리, 채팅 기록 1회 응답, 위조 `mapVersion`·배치 거절을 확인하도록 고쳤다.
- `deploy/check_maintenance_nginx.py`: 격리 Nginx에서 설정 문법, 점검 페이지, HSTS 헤더, 로그인 12회 연속 요청 중 429를 확인하도록 늘렸다(한도 영역 줄을 격리 설정에 포함).
- Django 테스트 27개 통과.

## 배포

- dolfinid에 웹·멀티플레이 v0.3.1 배포(`bash deploy.sh v0.3.1 v0.3.1`, DB 모드). 배포 전 `.env`·`.env.django`·Compose·호스트 스크립트·Nginx 사이트 설정을 `releases-v0.3.1.*`(권한 700)에 보존했다. 새 Nginx 사이트 설정은 `nginx -t` 통과 후 reload.
- 웹 digest `sha256:72f41958e3c79141a9f07226456a0a8afd156c7fc6779502e6d72954a31952da`, 멀티플레이 digest `sha256:545b6e362e4f7c35ae1812b7b956110a6e84e1a897983103e3b1b66a3b8b03ed`.
- 운영 확인: `/healthz` v0.3.1(database, 건물 103·이야기 33, 백업 실패 없음), `/multiplayer/healthz` v0.3.1·NPC 130, `strict-transport-security: max-age=31536000`, 위조 `mapVersion` 매치메이킹 412·잘못된 이름 422, `/backoffice/login/` 12회 연속 요청 중 7번째부터 429, 운영 멀티플레이 컨테이너 안 `check_connections.js` 통과.
- 두 브라우저로 운영에 붙는 `check_walk_together_browser.py`는 돌리지 않았다.
