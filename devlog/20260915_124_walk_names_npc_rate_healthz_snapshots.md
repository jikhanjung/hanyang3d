# 124 — 이름 흉내 차단, 이모지 채팅, NPC 전송량 절반, 공개 healthz 축소, 배포 전 스냅샷 정리

[123](20260915_123_content_sync_story_fixes.md)에 남긴 120 검토의 낮은 우선순위 항목.

## 함께 걷기

- **이름**: NFKC로 정규화하고(전각 `ＡＬＩＣＥ` → `ALICE`) 허용 문자를 한글·한자·라틴 문자·숫자·공백·`_ . -`로 좁혔다. 키릴·그리스 문자의 닮은 글자(`Аlice`, `αlice`)로 다른 사람 이름을 흉내낼 수 없다. 중복 검사는 정규화된 이름의 소문자 비교 그대로다. 규칙은 브라우저와 서버가 같은 `player_name.js`를 쓴다.
- **채팅**: 제어 문자와 서식 문자(글자 방향 뒤집기 `U+202E`, `U+2066` 등)는 계속 거절하되, 가족·직업 이모지에 필요한 zero-width joiner(`U+200D`)는 허용한다.
- **NPC 전송량**: 한 번에 NPC 130명 스냅샷이 약 8.8 KB(msgpack), 초당 10회라 접속자마다 약 86 KB/s였다. 소수점을 센티미터로 반올림해도 2%만 줄어, NPC 스냅샷을 2틱마다(초당 5회) 보내도록 바꿨다. 접속자 위치는 초당 10회 그대로다. 브라우저는 스냅샷 사이를 부드럽게 따라간다. 반올림 때문에 속도 1.296이 1.3이 되어 연결 검사의 `< 1.3` 경계를 `<= 1.3`으로 고쳤다.

## 웹·운영

- **공개 `/healthz`**: Nginx를 거친 요청(`X-Forwarded-For` 있음)에는 `status`·`version`만 준다. 컨테이너 healthcheck, 배포 검사, 이미지 smoke 검사는 앱에 직접 붙어 건수·경고·오류 문구를 그대로 받는다. 공개 브라우저 검사(`check_public_browser.py`)는 status·version만 쓴다.
- **배포 전 스냅샷**: `backup_content.py --snapshot`이 새 스냅샷을 검증·채택한 뒤에만 같은 폴더의 배포 전 스냅샷(`content_vX.Y.Z_YYYYmmdd_HHMMSS.sqlite3`)을 최신 10개만 남긴다(`--keep-snapshots`). 이름 규칙에 맞지 않는 파일은 건드리지 않는다.

## 확인만 한 것

- 오프사이트 백업: 개발 호스트 `/home/jikhanjung/backups/hanyang3d`는 폴더 700. NAS `/nas/JikhanJung/hanyang3d_backup`(NFS)은 파일이 600(소유자 uid 1024)이지만 폴더는 777로 보인다. 설정 묶음(`.env.django` 포함)의 내용은 소유자만 읽을 수 있으나, 같은 공유에 쓰기 권한이 있는 사람은 파일을 지우거나 바꿀 수 있다. NAS 공유·폴더 권한은 운영자가 결정할 사항이라 바꾸지 않았다. 사용자와 확인해 NAS는 지금 설정 그대로 두기로 했다(2026-09-15).
- 월드 버전 기본값이 `settings.py`(`WALK_WORLD_VERSION`)와 멀티플레이 이미지에 따로 있는 문제는, 121부터 `mapVersion`이 형식만 검사되고 방을 나누지 않으므로 어긋나도 동작에 영향이 없다.

## 검사

- 멀티플레이 `node --test` 10개(닮은 글자 이름 거절, 이모지 채팅 허용과 방향 뒤집기 거절, NPC 반올림 추가), 로컬 서버 `check_connections.js` 통과.
- Django 33개(공개 healthz 필드 축소, 배포 전 스냅샷 보존 개수와 다른 파일 보존 추가) 통과.

## 버전

웹과 멀티플레이 이미지를 함께 v0.3.4로 빌드한다(멀티플레이는 v0.3.1에서 바로 v0.3.4로 올려 두 이미지 번호를 맞췄다).

## 배포 전 DB 백업이 실제로는 한 번도 돌지 않았던 문제

v0.3.4 배포 뒤 배포 전 스냅샷 폴더를 확인하다가, `backups/content/pre-deploy`가 아예 없고 운영 어디에도 `content_v*.sqlite3`가 없는 것을 발견했다. `deploy.sh`는 `[[ -f content/content.sqlite3 ]]`로 DB가 있는지 본 뒤에만 백업하는데, `content/`는 컨테이너 사용자(10001) 소유 750이라 배포하는 로그인 사용자에게는 파일이 보이지 않아 조건이 늘 거짓이었다. 그래서 v0.3.0 이후 DB 모드 배포(v0.3.1~v0.3.4, v0.3.3의 이야기 3건 동기화 포함)는 배포 직전 스냅샷 없이 진행됐다. 그 사이 DB는 root 크론의 시간별 검증 백업으로만 보호됐다.

- `deploy.sh`: DB 확인도 `sudo -n test -f`로 하고, `sudo -n`을 쓸 수 없으면 백업을 건너뛰지 않고 배포를 거부한다.
- 발견 즉시 운영에서 설치된 `backup_content.py --snapshot`으로 v0.3.4 기준 검증 스냅샷을 만들었다(웹 중지 없이 SQLite online backup).

## 배포

- dolfinid에 웹·멀티플레이 v0.3.4 배포(`bash deploy.sh v0.3.4 v0.3.4`). 배포 전 설정·호스트 파일을 `releases-v0.3.4.*`(권한 700)에 보존. Nginx 사이트 설정 변경 없음. 배포 중 `sync_content`는 모든 항목 0, `healthcheck.py --deploy` 통과.
- 웹 digest `sha256:a9e4b903ae83df6b25c8b2852f7b98e4fcc1cf9e2f396a3ab481bb62dc69582b`, 멀티플레이 digest `sha256:2ae04b94ef5af855b2b5bb38259821feb9768fa09b69699413716d7fb4707b79`.
- 운영 확인: 공개 `/healthz`는 `{"status": "ok", "version": "v0.3.4"}`만 준다. `/`·`/guide/` 200, HSTS 유지, `/multiplayer/healthz` v0.3.4·NPC 130, 키릴 문자 `Аlice` 이름의 매치메이킹은 422, 운영 멀티플레이 컨테이너 안 `check_connections.js` 통과.
- 이미지 변경이 필요 없는 `deploy.sh` 수정(배포 전 백업 sudo 확인)은 운영 `/srv/hanyang3d/deploy.sh`에 바로 설치하고, 새 확인이 운영 DB 파일을 찾는 것을 확인했다. 다음 배포부터 배포 전 스냅샷이 실제로 만들어진다.
