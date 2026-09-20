# 플레이어 접속·위치 저장 현황

2026-09-20 코드 점검. 접속 기록 기능을 새로 구현한 문서가 아니다.

| 정보 | 현재 저장소 | 의미·수명 |
|---|---|---|
| 계정, 엽전, 봇짐, 거래 | Django SQLite | 영구 보관·백업 대상 |
| `Player.created_at` | SQLite | 플레이어 최초 생성 시각 |
| `Player.last_seen` | SQLite | `auto_now`: Player.save() 때 갱신. 로그인 때는 갱신하지 않아 마지막 접속 시각으로 쓸 수 없음 |
| 로그인 실패 | `LoginAttempt` | 이름·IP 해시 기반 제한용. 성공 시 해당 이름의 실패 행 삭제. 성공 접속 이력 아님 |
| 마지막 걷기 위치 | 브라우저 localStorage | 계정 이름(소문자)·지도 alignment별 x/z/yaw, routeKey. 1초마다 및 퇴장·페이지 숨김 시 저장. 다른 기기와 공유 안 됨 |
| 함께 걷기 실시간 위치 | Colyseus 메모리 | pose를 100ms 간격 전송, 참가자 간 공유. onLeave에서 제거. 재시작하면 소실 |

근거 코드: `webapp/models.py`, `webapp/accounts.py`, `webapp/economy.py`, `webapp/static/walk_profile.js`, `webapp/static/first_person.js`, `webapp/static/walk_together.js`, `multiplayer/room.js`.

현재 백오피스의 ‘마지막 활동’이 처음 방문과 같을 수 있는 이유는, 로그인 성공 경로가 Player를 읽고 비밀번호를 확인한 뒤 반환만 하기 때문이다. 걷기는 Player.save()를 호출하지 않는다. 거래 때는 갱신되므로 접속 현황과 다른 값이다.

성공한 접속 이력, 서버의 마지막 위치, 이동 경로 이력은 현재 구현되어 있지 않다. 웹 서버의 일반 HTTP 로그는 별개이며 계정별 성공 로그인·이동 경로 기록으로 간주할 수 없다. 운영 로그 파일 보존 설정 자체는 이번 코드 조사에서 확인하지 않았다.

후속 구현 방향: 성공 로그인 시각을 별도 기록하고, 인증된 활동 시각은 쓰기 빈도를 제한해 갱신한다. 마지막 위치는 계정·시대·좌표계/routeKey와 함께 DB 저장하고, 기기 간 이어하기에 사용한다. 실시간 전체 이동 경로 수집은 별도 기능이며 마지막 위치 저장과 구별한다. 과거에 남기지 않은 접속 시간은 소급 복원하지 않는다.
