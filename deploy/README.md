# Hanyang 3D Docker 배포

이미지: **`honestjung/hanyang3d:v0.0.7`**, 플랫폼: `linux/amd64`.
`../fsis2026/deploy`의 Gunicorn·버전 이미지·Compose·상태 확인 구성을 참고했다.
DB가 없는 서비스이므로 migrate/seed/DB 백업 단계는 없다.

## 운영 주소

2026-09-12 dolfinid에 배포했다.

- 전체 화면 3D (기본 페이지): https://hanyang3d.nopeoplestime.info/
- 도구 포함 3D 화면: https://hanyang3d.nopeoplestime.info/gis/terrain/3d/
- 출처·저작권: https://hanyang3d.nopeoplestime.info/credits/
- 작업 현황: https://hanyang3d.nopeoplestime.info/gis/
- 상태 확인: https://hanyang3d.nopeoplestime.info/healthz
- Docker Hub: `honestjung/hanyang3d:v0.0.7`
- 배포 digest: `sha256:08c41cf35c8cb45789f5480bae94d23483abbc6a91d20e05df0533b37057cea5`

호스트 Nginx의 전용 `hanyang3d` 사이트가 컨테이너의 8013 포트로 연결된다. HTTP는 HTTPS로 이동한다. Let's Encrypt 인증서와 webroot 자동 갱신을 설정했으며 갱신 후 `nginx -t && systemctl reload nginx`를 실행한다. 실제 설정은 [hanyang3d.nginx.conf](host/hanyang3d.nginx.conf)에 있다.

`v0.0.7`는 전체 화면 3D에 옛지도 슬라이더(50%), 보정점(기본 꺼짐), 1인칭 걷기 버튼과 기존 초기화면 링크를 제공한다. 청계천은 원도 구간만 표시한다. 이전 `v0.0.1` 이미지와 데이터는 서버에 보관해 롤백할 수 있다.

## 구성과 데이터

- 이미지: Django/Three.js 코드, 카탈로그, GIS 판독·배치 JSON, 배포 도구.
- 데이터 묶음: 카탈로그 원본 12개와 웹에서 제공하는 파생 산출물 8개. 경로·크기·SHA-256을 `manifest.json`에 기록한다.
- 컨테이너: Gunicorn, UID/GID `10001`, 읽기 전용 루트와 `/runtime`, 임시 작업용 `/tmp`.
- `/healthz`: 버전 및 제공 파일 53개의 존재 상태. 데이터 누락·버전 불일치 시 503.
- 시작 시 전체 데이터 SHA-256 검사. 런타임 healthcheck는 존재·크기·버전을 확인한다.
- 자료 파일의 기존 인용·이용 조건은 카탈로그에 유지한다. 데이터 묶음은 운영 서버 이전용이며 Docker 이미지에 들어가지 않는다.

## 빌드 호스트

원본 및 `gis/georeferenced`가 준비된 현재 작업 디렉터리에서:

```bash
bash deploy/build.sh v0.0.7
```

원본 해시 검사 → 데이터 묶음 → 이미지 빌드 → 컨테이너 내 Django 검사 → 누락/버전 불일치 시작 차단 검사 → 실제 Gunicorn HTTP 검사 → 내보내기 순서다.
이미지에 원본·`.git`·환경 파일·빌드 산출물이 섞이지 않았는지도 검사한다.
Docker Hub push나 원격 배포는 빌드 명령에 포함하지 않는다.

생성 파일(Git 제외):

```text
dist/hanyang3d-image-v0.0.7.tar.gz
dist/hanyang3d-data-v0.0.7.tar.gz
dist/hanyang3d-host-v0.0.7.tar.gz
dist/SHA256SUMS-v0.0.7
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
scp dist/hanyang3d-*-v0.0.7.tar.gz dist/SHA256SUMS-v0.0.7 dolfinid:~/hanyang3d-release/
```

서버에서:

```bash
cd ~/hanyang3d-release
sha256sum -c SHA256SUMS-v0.0.7
docker load -i hanyang3d-image-v0.0.7.tar.gz
sudo install -d -o "$(id -un)" -g "$(id -gn)" /srv/hanyang3d
tar -xzf hanyang3d-host-v0.0.7.tar.gz -C /srv/hanyang3d
mkdir -p /srv/hanyang3d/data
mkdir /srv/hanyang3d/data/v0.0.7
tar -xzf hanyang3d-data-v0.0.7.tar.gz -C /srv/hanyang3d/data/v0.0.7
cd /srv/hanyang3d
cp .env.django.example .env.django
chmod 600 .env.django
```

`.env.django`의 `DJANGO_SECRET_KEY`를 충분히 긴 무작위 값으로 바꾼다. 공개 도메인을 쓸 경우 `DJANGO_ALLOWED_HOSTS`에 그 도메인을 추가한다(healthcheck용 `127.0.0.1,localhost` 유지).

```bash
bash deploy.sh v0.0.7
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

v0.0.7에서는 지면·지도·도로가 같은 고도 표면을 사용한다. 지도 0%에서도 배치가 유지되며 눈높이는 지면 위 1.65m다.

v0.0.7은 경복궁 담장·종묘 정전 15칸 모형, 한양3D 제목·버전 표시와 현재 지도 중심의 출처 페이지를 추가한다.
