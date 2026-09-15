# 113 — 함께 걷기 v0.2.0 운영 배포

사용자가 devlog 작성, commit/push와 운영 배포를 요청했고, 새 기능 릴리스이므로 버전을 v0.2.0으로 지정했다. [111](20260915_111_walk_together.md), [112](20260915_112_shared_npcs_player_names.md)의 기능을 배포한다.

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

## 운영 반영

- 2026-09-15 14:27 KST 배포. 소스 커밋 `bf12df4`를 GitHub main에 push하고 두 이미지를 Docker Hub에 게시했다.
- 웹 digest: `sha256:b77c6a2f9dc55935d92036cfea985546d861bd1e6acbc15ac1a18f539c605c88`.
- 멀티플레이 digest: `sha256:f0f17ac02ce17340d01250046d018edf779901f0ad4767f5225adebab51a0e6f`.
- 설정 백업: 운영 호스트 `/srv/hanyang3d/backups/pre-v0.2.0-20260915-052704`. `.env.django`는 백업과 바이트 단위로 같음을 확인했다. 이전 이미지·데이터를 보존했다.
- 첫 시도에서는 비공개 백업용 `umask 077`이 데이터 압축 해제에도 적용되어 컨테이너 UID 10001이 지도 파일을 읽지 못했다. 교체 전 데이터 검사가 중단했고 기존 v0.1.39 healthy 상태를 확인했다. 공개 지도 데이터에만 읽기·디렉터리 접근 권한을 추가하고 재배포했다. 재현 절차에도 권한 설정을 기록했다.
- 두 컨테이너 healthy. Nginx 설정 검사와 reload 완료. 내부·공개 `/healthz`는 v0.2.0, 리소스 92개 정상. `/multiplayer/healthz`는 v0.2.0, 프로토콜 2, NPC 130명 정상.
- 운영 HTTPS·WebSocket을 통한 두 클라이언트 검사 통과: 같은 방, 이름·이동, 잘못된 입력 거부, 동일 NPC 틱, 버전별 방 분리, 퇴장.
- 운영 두 브라우저 검사 통과: 이름 입력·취소·검증, 상대 이름표, 같은 틱의 NPC 좌표·방향 일치, 공통 시간, 이동·퇴장·재접속·탭 닫기. 자동 검사에서 native dialog의 비동기 close 이벤트를 기다리도록 보완했다.
- 공개 3D 검사 통과: 리소스 92개, 지도·지형·다리 접지, 화면 크기 변경, 지도 투명도, 걷기 눈높이, 출처 페이지. 기존 검사 선택자가 소개 창 header까지 잡던 문제를 `body > header`로 좁혀 수정했다.
