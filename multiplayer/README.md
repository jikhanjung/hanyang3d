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

두 브라우저에서 `http://127.0.0.1:18014`에 접속해 설정 메뉴의 **함께 걷기**를 누른다. 처음 걷기에 들어갈 때 1~16자의 이름을 입력한다. 이름은 브라우저의 localStorage에 기억하며 다른 접속자에게 머리 위 이름표로 표시한다. 로그인 계정이 아니므로 같은 이름을 여러 사람이 사용할 수 있다. 취소하면 걷기에 들어가지 않는다.

같은 위치에서 시작하므로 한 사람이 몇 걸음 움직이면 서로를 볼 수 있다. 다른 접속자는 청록색 옷으로 구분한다. 전체 지도 시점으로 돌아가거나 함께 걷기에서 나가면 접속도 끝난다. 연결 실패 후에는 버튼으로 다시 접속한다.

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
- 로그인, 서버 영구 저장, 문자·음성 채팅, 접속자끼리의 충돌은 아직 없다. 서버의 접속자 정보는 퇴장/서버 종료 시 사라진다. 이름만 각 브라우저의 localStorage에 기억한다.
- 함께 걷는 동안 보행자 130명의 위치·방향·회피를 서버에서 초당 10회 계산한다. `경로ID:번호`로 NPC를 식별하며, 공간 내 모든 접속자의 위치를 회피 계산에 반영한다. 각 브라우저는 동일한 스냅샷을 받아 보간하고 InstancedMesh를 갱신한다. 궁감·훈련 군사의 정해진 동작은 서버 공통 시간에 맞춰 재생한다.
- 함께 걷는 동안 개인의 ‘보행 재생’ 설정으로 공통 세계를 멈출 수 없다. NPC 표시를 숨기거나 탭을 전환해도 서버 이동은 계속된다. 연결을 끝내면 독립적인 로컬 보행으로 돌아간다. 네트워크 지연과 화면 보간에 따른 순간적인 표시 차이는 남는다.
- 플레이어의 이동·충돌 판정은 아직 브라우저에 있다. NPC의 권위 있는 상태를 공유하는 단계이며, 모든 플레이어 충돌까지 서버에서 검증하는 게임 서버는 아니다.
- 32명은 공간 정원 설정이며 부하 시험으로 보장한 동시접속 수는 아니다.

## 검사

```bash
npm --prefix multiplayer test
node multiplayer/check_connections.js
.venv/bin/python scripts/terrain/check_walk_together_browser.py --url http://127.0.0.1:18014
```

연결·브라우저 검사는 위 두 서버 실행 후 사용한다.

## 운영 연결

v0.2.0부터 운영에 별도 Node 컨테이너와 HTTPS 프록시를 배포했다. [운영 화면](https://hanyang3d.nopeoplestime.info/)의 설정 메뉴에서 함께 걷기를 시작한다. 이미지·상태 확인·롤백은 [배포 안내](../deploy/README.md)를 따른다. Node 서버는 `multiplayer/` 외에 `webapp/static/tps.js`, `walking_simulation.js`, `player_name.js`와 `gis/control_points/`의 지도 배치·고도 범위 메타데이터, `gis/roads/doseong_walking_routes.json`을 읽으므로 함께 패키징해야 한다. 전체 고도 래스터나 Three.js 렌더러는 서버에 필요 없다.

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
