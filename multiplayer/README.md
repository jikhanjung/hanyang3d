# 함께 걷기

Django가 지도와 파일을 제공하고, 별도 Colyseus 프로세스가 접속자의 위치·방향과 NPC 상태를 전달한다. Node.js 22.12 이상을 사용한다(Node.js 24.13에서 검증).

## 로컬 실행

저장소 루트에서 각각 별도 터미널로 실행한다.

```bash
npm --prefix multiplayer ci --ignore-scripts
npm --prefix multiplayer start
```

```bash
HANYANG_MULTIPLAYER_URL=http://127.0.0.1:2567 \
  .venv/bin/python manage.py runserver 127.0.0.1:18014 --noreload
```

두 브라우저에서 `http://127.0.0.1:18014`에 접속해 설정 메뉴의 **1인칭**을 누른다. 로그인하지 않았으면 계정 창(이름·비밀번호)이 뜨고, 계정 이름이 걷기 이름표가 된다. 웹 서버는 `GET /api/walk-ticket`으로 계정 이름과 60초 만료를 HMAC으로 서명한 입장권을 주고, Colyseus는 `WALK_TICKET_SECRET`이 설정돼 있으면 이름을 입장권에서만 가져온다(틀리거나 만료되면 403). 비밀값이 없으면 로컬 개발용으로 클라이언트가 보낸 이름을 쓴다. 로컬에서 입장권까지 시험하려면 Django에 `HANYANG_WALK_TICKET_SECRET`, Colyseus에 같은 값의 `WALK_TICKET_SECRET`을 준다. 같은 계정이 이미 같은 공간에서 걷는 중이면 접속하지 않고 알린다. 함께 걷기 서버에 접속하지 못해도 1인칭 혼자 걷기는 계속된다.

처음에는 기본 위치에서 시작하며, 이후에는 같은 브라우저·이름에서 마지막 위치와 방향을 복원한다. 서버가 공간 내 접속자마다 서로 다른 옷 색깔을 배정하고 자신의 화면과 다른 접속자의 화면에 같은 색을 표시한다. 퇴장하면 이름과 색깔은 다시 사용할 수 있다. 전체 지도 시점으로 돌아가거나 ‘전체 지도 시점’을 누르면 접속도 끝난다. 연결 실패 후에는 버튼으로 다시 접속한다.

환경변수:

- Django `HANYANG_MULTIPLAYER_URL`: 브라우저가 접속할 HTTP(S) 주소. 기본 `/multiplayer`.
- Colyseus `WALK_HOST`: 바인드 주소, 기본 `127.0.0.1`.
- Colyseus `WALK_PORT`: 기본 `2567`.
- Colyseus `WALK_ORIGINS`: 허용할 브라우저 Origin을 쉼표로 구분. 기본 `http://127.0.0.1:18014,http://localhost:18014`.

다른 기기에서 시험할 때는 두 서버의 바인드 주소와 방화벽을 확인하고 `HANYANG_MULTIPLAYER_URL`에 그 기기에서 접근할 수 있는 서버 주소, `WALK_ORIGINS`에 실제 지도 주소를 설정한다.

## 현재 범위

- 한 공간 최대 32명, 위치·방향을 초당 10회 전달. 가득 차면 별도 공간을 만든다.
- 지도 앱 버전·지형 정렬·프로토콜 버전이 같은 접속자끼리 묶는다. 서버와 브라우저의 보행 경로 좌표 키가 다르면 접속을 거절한다. 서버 한 프로세스의 메모리만 사용한다.
- 다른 캐릭터의 이동을 보간하고 지면 높이는 각 브라우저에서 계산한다.
- 숫자·범위 검사와 메시지 빈도 제한을 적용한다. 이동·지형 충돌은 클라이언트 판정이므로 전투·거래 등 신뢰가 필요한 게임 규칙에는 사용할 수 없다.
- 로그인, 서버 영구 저장, 음성 채팅, 접속자끼리의 충돌은 아직 없다. 서버의 접속자 정보는 퇴장/서버 종료 시 사라진다. 이름과 마지막 위치·방향을 각 브라우저의 localStorage에 기억한다.
- 함께 걷는 동안 보행자 130명의 위치·방향·회피를 서버에서 초당 10회 계산한다. 새 공간마다 서버가 출발 지점·방향과 속도(0.8~1.3 m/s)를 무작위로 정한다. 이미 존재하는 공간에 들어오는 접속자는 진행 중인 상태를 받으며 초기화하지 않는다. `경로ID:번호`로 NPC를 식별하며, 공간 내 모든 접속자의 위치를 회피 계산에 반영한다. 각 브라우저는 동일한 스냅샷을 받아 보간하고 InstancedMesh를 갱신한다. 궁감·훈련 군사의 정해진 동작은 서버 공통 시간에 맞춰 재생한다.
- 함께 걷는 동안 개인의 ‘보행 재생’ 설정으로 공통 세계를 멈출 수 없다. NPC 표시를 숨기거나 탭을 전환해도 서버 이동은 계속된다. 연결을 끝내면 독립적인 로컬 보행으로 돌아간다. 네트워크 지연과 화면 보간에 따른 순간적인 표시 차이는 남는다.
- 플레이어의 이동·충돌 판정은 아직 브라우저에 있다. NPC의 권위 있는 상태를 공유하는 단계이며, 모든 플레이어 충돌까지 서버에서 검증하는 게임 서버는 아니다.
- 32명은 공간 정원 설정이며 부하 시험으로 보장한 동시접속 수는 아니다.

## 마지막 위치

걷기를 종료하거나 페이지를 떠날 때, 모바일에서 페이지가 숨겨질 때 위치·방향을 저장한다. 걷는 동안에도 변경된 위치를 최대 초당 한 번 기록한다. 같은 브라우저·이름·지도 정렬에서 다시 ‘1인칭’으로 들어가면 복원한다. 높이는 현재 지형으로 다시 계산한다.

지도 경로 좌표가 바뀌었거나 저장값이 손상되었거나 현재 건물 안·지도 밖인 위치는 기본 출발점으로 돌아간다. 위치는 계정 DB가 아닌 브라우저 저장소에 있으므로 다른 기기로 옮겨지지는 않는다. 저장소를 사용할 수 없는 경우 현재 페이지 안에서만 기억한다.

## 문자 채팅

접속 후 오른쪽 아래 **채팅** 버튼이나 Enter 키로 연다. 같은 공간의 접속자에게 이름·옷 색깔과 함께 메시지를 전달한다. 채팅 입력 중에는 이동하지 않으며 Escape는 채팅창만 닫는다. 모바일에서도 채팅 버튼과 입력창을 사용한다.

서버에서 1~200자, 초당 1회로 제한한다. HTML은 일반 문자로 표시한다. 최근 50개는 공간 메모리에 보관해 새 접속자에게 전달하며, 공간 종료·서버 재시작 시 사라진다. 계정별 메시지 기록이나 영구 보관은 없다.

## 검사

```bash
npm --prefix multiplayer test
node multiplayer/check_connections.js
.venv/bin/python scripts/terrain/check_walk_together_browser.py --url http://127.0.0.1:18014
```

연결·브라우저 검사는 위 두 서버 실행 후 사용한다.

## 운영 연결

v0.2.0부터 운영에 별도 Node 컨테이너와 HTTPS 프록시를 배포했다. [운영 화면](https://hanyang3d.nopeoplestime.info/)의 설정 메뉴의 **1인칭**으로 함께 걷기를 시작한다. 이미지·상태 확인·롤백은 [배포 안내](../deploy/README.md)를 따른다. Node 서버는 `multiplayer/` 외에 `webapp/static/tps.js`, `walking_simulation.js`, `player_name.js`와 `gis/control_points/`의 지도 배치·고도 범위 메타데이터, `gis/roads/doseong_walking_routes.json`을 읽으므로 함께 패키징해야 한다. 전체 고도 래스터나 Three.js 렌더러는 서버에 필요 없다.

Django의 `HANYANG_MULTIPLAYER_URL=/multiplayer`를 사용할 경우 Nginx는 HTTP 매치메이킹과 WebSocket을 함께 전달해야 한다.

```nginx
location /multiplayer/ {
    proxy_pass http://127.0.0.1:8015/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 60s;
}
```

`WALK_ORIGINS`는 운영 HTTPS 도메인으로 설정한다. 여러 프로세스/호스트로 확대하기 전에는 공유 presence/driver 구성과 공간 배치 설계가 필요하다.

## SDK

브라우저 SDK는 `@colyseus/sdk` 0.18.2의 `dist/colyseus.js`와 MIT 라이선스를 `webapp/static/vendor/colyseus/`에 보존한다. 서버 버전과 의존성은 `package-lock.json`에 고정한다.
