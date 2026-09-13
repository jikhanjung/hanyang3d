# Hanyang 3D Docker 배포

이미지: **`honestjung/hanyang3d:v0.1.3`**, 플랫폼: `linux/amd64`.
`../fsis2026/deploy`의 Gunicorn·버전 이미지·Compose·상태 확인 구성을 참고했다.
DB가 없는 서비스이므로 migrate/seed/DB 백업 단계는 없다.

## 운영 주소

2026-09-12 dolfinid에 배포했다.

- 전체 화면 3D (기본 페이지): https://hanyang3d.nopeoplestime.info/
- 도구 포함 3D 화면: https://hanyang3d.nopeoplestime.info/gis/terrain/3d/
- 출처·저작권: https://hanyang3d.nopeoplestime.info/credits/
- 작업 현황: https://hanyang3d.nopeoplestime.info/gis/
- 상태 확인: https://hanyang3d.nopeoplestime.info/healthz
- Docker Hub: `honestjung/hanyang3d:v0.1.3`
- 배포 digest: `sha256:214387d337957086416f83e97645436a448e83c20f15d98a43c950545a7b2971`

호스트 Nginx의 전용 `hanyang3d` 사이트가 컨테이너의 8013 포트로 연결된다. HTTP는 HTTPS로 이동한다. Let's Encrypt 인증서와 webroot 자동 갱신을 설정했으며 갱신 후 `nginx -t && systemctl reload nginx`를 실행한다. 실제 설정은 [hanyang3d.nginx.conf](host/hanyang3d.nginx.conf)에 있다.

`v0.1.3`는 전체 화면 3D에 옛지도 슬라이더(50%), 보정점(기본 꺼짐), 1인칭 걷기 버튼을 제공한다. 청계천은 원도 구간만 표시한다. 이전 `v0.0.1` 이미지와 데이터는 서버에 보관해 롤백할 수 있다.

## 구성과 데이터

- 이미지: Django/Three.js 코드, 카탈로그, GIS 판독·배치 JSON, 배포 도구.
- 데이터 묶음: 카탈로그 원본 12개와 웹에서 제공하는 파생 산출물 8개. 경로·크기·SHA-256을 `manifest.json`에 기록한다.
- 컨테이너: Gunicorn, UID/GID `10001`, 읽기 전용 루트와 `/runtime`, 임시 작업용 `/tmp`.
- `/healthz`: 버전 및 제공 파일 65개의 존재 상태. 데이터 누락·버전 불일치 시 503.
- 시작 시 전체 데이터 SHA-256 검사. 런타임 healthcheck는 존재·크기·버전을 확인한다.
- 자료 파일의 기존 인용·이용 조건은 카탈로그에 유지한다. 데이터 묶음은 운영 서버 이전용이며 Docker 이미지에 들어가지 않는다.

## 빌드 호스트

원본 및 `gis/georeferenced`가 준비된 현재 작업 디렉터리에서:

```bash
bash deploy/build.sh v0.1.3
```

원본 해시 검사 → 데이터 묶음 → 이미지 빌드 → 컨테이너 내 Django 검사 → 누락/버전 불일치 시작 차단 검사 → 실제 Gunicorn HTTP 검사 → 내보내기 순서다.
이미지에 원본·`.git`·환경 파일·빌드 산출물이 섞이지 않았는지도 검사한다.
Docker Hub push나 원격 배포는 빌드 명령에 포함하지 않는다.

생성 파일(Git 제외):

```text
dist/hanyang3d-image-v0.1.3.tar.gz
dist/hanyang3d-data-v0.1.3.tar.gz
dist/hanyang3d-host-v0.1.3.tar.gz
dist/SHA256SUMS-v0.1.3
```

후속 버전은 `deploy/DOCKER_VERSION`과 `deploy/deploy.toml`을 갱신한 뒤 같은 명령을 사용한다.
이미지는 현재 작업 파일을 빌드한다. Git 커밋 전 빌드에는 revision 레이블에 `-dirty`가 붙는다.

## dolfinid 최초 설치

2026-09-12 읽기 전용 확인: SSH `dolfinid` → `honestjung@cdgts.paleobytes.info`, x86_64, Docker 29.8.0, Compose 5.5.1.
기존 서비스들과 분리하여 `/srv/hanyang3d`, **`127.0.0.1:8013`**을 사용한다. 확인 당시 8013은 비어 있었다.
공개 도메인은 `hanyang3d.nopeoplestime.info`다.

빌드 호스트에서 릴리스 파일을 전송한다:

```bash
ssh dolfinid 'mkdir -p ~/hanyang3d-release'
scp dist/hanyang3d-*-v0.1.3.tar.gz dist/SHA256SUMS-v0.1.3 dolfinid:~/hanyang3d-release/
```

서버에서:

```bash
cd ~/hanyang3d-release
sha256sum -c SHA256SUMS-v0.1.3
docker load -i hanyang3d-image-v0.1.3.tar.gz
sudo install -d -o "$(id -un)" -g "$(id -gn)" /srv/hanyang3d
tar -xzf hanyang3d-host-v0.1.3.tar.gz -C /srv/hanyang3d
mkdir -p /srv/hanyang3d/data
mkdir /srv/hanyang3d/data/v0.1.3
tar -xzf hanyang3d-data-v0.1.3.tar.gz -C /srv/hanyang3d/data/v0.1.3
cd /srv/hanyang3d
cp .env.django.example .env.django
chmod 600 .env.django
```

`.env.django`의 `DJANGO_SECRET_KEY`를 충분히 긴 무작위 값으로 바꾼다. 공개 도메인을 쓸 경우 `DJANGO_ALLOWED_HOSTS`에 그 도메인을 추가한다(healthcheck용 `127.0.0.1,localhost` 유지).

```bash
bash deploy.sh v0.1.3
curl -f http://127.0.0.1:8013/healthz
```

이미지의 `/app/deploy/host/`에도 같은 호스트 파일이 있어 운영 서버에 Git 체크아웃은 필요 없다.
이후 버전은 새 이미지와 새 `data/<version>`을 먼저 준비하고 같은 배포 명령을 실행한다.
배포 전 이미지·데이터 쌍을 검증하고, 실패 시 이전 `.env`가 있으면 이전 서비스 구성을 다시 시작한다.
예전 이미지와 데이터 디렉터리를 남겨두면 `bash deploy.sh <previous-version>`으로 롤백한다.

도메인 없이 확인하려면 로컬에서 `ssh -L 18013:127.0.0.1:8013 dolfinid` 후 `http://localhost:18013/`을 연다.
운영 서버의 Nginx 설정은 `host/hanyang3d.nginx.conf`를 사용한다. 신규 서버에서는 먼저 HTTP webroot를 연 뒤 아래 명령으로 인증서를 발급하고 HTTPS 설정을 설치한다.

```bash
sudo certbot certonly --webroot --webroot-path /srv/hanyang3d/acme \
  --domain hanyang3d.nopeoplestime.info --cert-name hanyang3d.nopeoplestime.info \
  --non-interactive --agree-tos --deploy-hook 'nginx -t && systemctl reload nginx'
```

기존 인증서 갱신은 certbot.timer가 처리한다. 운영 화면 점검은 빌드 호스트에서 `.venv/bin/python deploy/check_public_browser.py`로 재현한다. Playwright는 requirements-dev.txt를 따른다.

## 환경 변수

| 변수 | 기본값·역할 |
|---|---|
| `HANYANG_DATA_ROOT` | 로컬은 프로젝트 루트, 컨테이너는 `/runtime` |
| `HANYANG_REQUIRE_BUNDLE` | 컨테이너에서 `1`: manifest와 버전 일치 필수 |
| `HANYANG_VERSION` | 이미지 버전. 이미지에서 지정하므로 배포 환경에서 덮어쓰지 않음 |
| `DJANGO_ALLOWED_HOSTS` | 컨테이너 기본 `localhost,127.0.0.1` |
| `DJANGO_TRUST_PROXY` | 호스트 Nginx의 HTTPS 전달 헤더를 신뢰할 때 `1` |
| `GUNICORN_WORKERS`, `GUNICORN_THREADS` | 각각 2, 4 |
| `HOST_PORT` | 배포 스크립트 기본 8013; 바꿀 경우 Nginx도 맞춤 |

로컬 `manage.py runserver`에서도 `/`는 전체 화면 3D이며 작업 현황은 `/gis/`에 있다. FABDEM 고도 격자와 지도 JPG는 데이터 묶음에 있으며, 선택형 OSM 배경 타일은 계속 브라우저가 외부 서비스에 요청한다.

지형 재생성: `.venv/bin/python scripts/terrain/build_fabdem.py`. FABDEM 원본 압축 블록은 `data/terrain/fabdem-v1.2/full-coverage`에 보관한다. 고도 자료는 CC BY-NC-SA 4.0이며 `/credits/`에서 원출처와 가공 내역을 안내한다. 이전 Terrarium 생성기는 과거 자료 재현용이다.

v0.1.3에서는 지면·지도·도로가 같은 고도 표면을 사용한다. 지도 0%에서도 배치가 유지되며 눈높이는 지면 위 1.65m다.

v0.1.3은 경복궁 담장·종묘 정전 15칸 모형, 한양3D 제목·버전 표시와 현재 지도 중심의 출처 페이지를 추가한다.

v0.1.3은 모바일 조이스틱·동시 시선 드래그, 보정점 체크박스 숨김, 상시 우상단 나침반과 반투명 미니맵을 제공한다.

v0.1.3에서는 모바일 조작부를 반투명 조이스틱만 남기고 간소화했다.

v0.1.3은 육조거리 관청 11곳과 건물별 연대 메타데이터를 추가하고, 모바일 상단 옵션을 설정 버튼으로 접는다.

v0.1.3은 PC·모바일 공통으로 수평 3D 나침반을 제공한다. 모바일 좌상단에는 제목·버전과 햄버거만 표시하며 걷기·지도 옵션은 메뉴로 연다.

v0.1.3에서는 기존 초기화면 링크를 조작부에서 제거했다.

## 업데이트 중 안내

Nginx가 502·503·504를 받으면 `/srv/hanyang3d/maintenance.html`을 HTTP 503으로 제공한다. 10초마다 원래 주소를 다시 요청하며 `Retry-After: 10`, `Cache-Control: no-store, must-revalidate`를 보낸다. HTML은 호스트 묶음에 포함되어 컨테이너 교체 중에도 제공된다.

최초 설정 시 `host/maintenance.html`을 `/srv/hanyang3d/maintenance.html`로, `host/hanyang3d.nginx.conf`를 Nginx 사이트 설정으로 설치하고 `nginx -t` 후 reload한다. 기존 dolfinid에는 적용 완료했다. 재현 검사는 Nginx가 설치된 환경에서 `python3 deploy/check_maintenance_nginx.py`로 실행하며, 운영 포트를 건드리지 않는다.

v0.1.3은 북촌·서촌 지역 이름과 반투명 제목/출처 배경, 모바일 왼쪽 햄버거 및 © 출처 링크를 제공한다.

마우스: 좌클릭 드래그 이동, 휠 버튼 드래그 회전, 스크롤/우클릭 드래그 확대·축소.

v0.1.3는 서촌을 경복궁 서쪽 담장과 상류 사이로, 북촌을 기존 표기와 안국방 글씨 사이로 옮긴다. 두 이름은 원도 기준 위치를 사용한다.

v0.1.3는 사직단·경덕궁·문묘·성균관을 원도에 그려진 건물과 담장 내부로 맞춘다.

v0.1.3는 기본 지면을 황토색, 수목 주변을 녹지로 표현한다. 북악산·인왕산 화강암 중심부의 수목 후보 유지 확률은 25%이며 가장자리에서는 정상 밀도로 이어진다.

v0.1.3은 경덕궁·창덕궁·창경궁을 상자 대신 단순화한 궁궐 모형으로 표시한다.

v0.1.3은 황토색을 밝고 연하게 바꾸고 모든 지도 이름의 글자 크기·굵기를 통일한다.

최종 v0.1.3는 창덕궁을 원도의 전각 지붕 자리로 옮기고 돈화문·홍화문 모형을 추가한다. 창경궁과 홍화문은 두 모형의 중간이 기존 위치와 맞도록 배치한다.

v0.1.3은 걷기 시점을 3인칭으로 바꿔 내 캐릭터를 보여 주고, 걷는 속도를 3 m/s로 올린다. 휠로 시점 거리를 조절하며 0이면 기존 1인칭 화면이다.

v0.1.3는 정도전·송시열 집을 담장·기와집 모형으로 표시하고 설정의 `유명인 집터`로 껐다 켤 수 있게 한다.

v0.1.3은 두 집터 모형을 남향으로 세우고 정도전 집을 북동쪽으로 20 m 옮긴다.

v0.1.3는 종루·의금부·좌우 포도청·훈련원·경모궁을 추가하고, 종루와 의금부를 원도의 길에 맞춰 사거리 밖 블록에 둔다.

v0.1.3은 종로1가 사거리를 보정점으로 추가하고 그에 맞춰 현대 좌표 기준 배치를 다시 계산한다. v0.0.25 이미지는 배포하지 않았다.

v0.1.3은 훈련원과 좌포도청을 원도의 길 밖으로 옮긴다.

v0.1.3은 종루를 보신각 형태의 중층 누각으로 다시 만든다.

v0.1.3는 운종가 시전 행랑과 넓힌 훈련원을 추가하고 표시 전환을 설정 패널로 묶는다.

v0.1.3은 시전 구간을 창덕궁 동구까지로 줄이고 대로를 넓히며 가게 앞을 연 모습으로 바꾼다.

v0.1.3은 시전 좌판 뒤 상자를 없애고 가게 주인과 시전 이름 간판을 넣는다.

v0.1.3은 건물 클릭 정보 팝업, 걷기 충돌과 보행자 비키기, 1층 종루, 시전 물건 그림, 경복궁 이름을 더한다.

v0.1.3은 햄버거 메뉴에 프로젝트 소개 About 창을 더한다.

v0.1.3는 원각사지 십층석탑을 1750년 무렵 모습(일곱 층과 곁에 놓인 세 층)으로 더하고 좌포도청을 원도 글씨 자리로 옮긴다.

v0.1.3은 창덕궁 돈화문 서쪽에 금위영을 더한다.
