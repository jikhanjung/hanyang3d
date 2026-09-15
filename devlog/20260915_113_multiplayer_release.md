# 113 — 함께 걷기 v0.2.0 운영 배포

사용자가 devlog 작성, commit/push와 운영 배포를 요청했다. [111](20260915_111_walk_together.md), [112](20260915_112_shared_npcs_player_names.md)의 기능을 배포한다.

## 릴리스 구성

- Django 이미지 `honestjung/hanyang3d:v0.2.0`과 별도 Node/Colyseus 이미지 `honestjung/hanyang3d-multiplayer:v0.2.0`.
- 개발 호스트 m710q에서 빌드·검증·push하고, 운영 dolfinid-2의 `/srv/hanyang3d`에서는 pull·교체한다.
- 기존 웹 포트 `127.0.0.1:8013`을 유지하고, 사용 중인 8014를 피하여 Colyseus를 `127.0.0.1:8015`에 바인드한다. Nginx `/multiplayer/`에서 HTTP 매치메이킹과 WebSocket을 프록시한다.
- Colyseus 상태 확인은 버전·프로토콜·NPC 130명을 검사한다. 두 컨테이너는 비루트·읽기 전용으로 실행한다.
- 배포 시 `.env`의 릴리스 키와 multiplayer 프로필만 변경하고 포트·기타 설정은 보존한다. `.env.django`는 변경하지 않는다.
- 실패 시 이전 `.env`를 복원한다. v0.1.39 이하로 돌아갈 때는 multiplayer 프로필을 끄고 새 컨테이너를 중지한다.

## 배포 전 확인

- 운영 호스트·기존 v0.1.39·포트·디스크 확인: dolfinid-2, amd64, 여유 14 GiB. 운영 Nginx 설정은 저장소와 일치했다.
- Django 검사 15개, NPC·이름 검사 4개, 환경 보존·실패 롤백 검사 2개, 셸 구문 검사.
- 이전 작업에서 두 브라우저 동기화와 모바일 이름 입력·터치 이동, 기존 보행 충돌 검사를 통과했다.

이미지 빌드·운영 검증 결과와 digest는 배포 후 아래에 기록한다.
