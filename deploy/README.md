# Hanyang 3D Docker 배포

이미지: **`honestjung/hanyang3d:v0.0.1`**, 플랫폼: `linux/amd64`.
`../fsis2026/deploy`의 Gunicorn·버전 이미지·Compose·상태 확인 구성을 참고했다.
DB가 없는 서비스이므로 migrate/seed/DB 백업 단계는 없다.

## 구성과 데이터

- 이미지: Django/Three.js 코드, 카탈로그, GIS 판독·배치 JSON, 배포 도구.
- 데이터 묶음: 카탈로그 원본 12개와 웹에서 제공하는 파생 산출물 8개. 경로·크기·SHA-256을 `manifest.json`에 기록한다.
- 컨테이너: Gunicorn, UID/GID `10001`, 읽기 전용 루트와 `/runtime`, 임시 작업용 `/tmp`.
- `/healthz`: 버전 및 제공 파일 51개의 존재 상태. 데이터 누락·버전 불일치 시 503.
- 시작 시 전체 데이터 SHA-256 검사. 런타임 healthcheck는 존재·크기·버전을 확인한다.
- 자료 파일의 기존 인용·이용 조건은 카탈로그에 유지한다. 데이터 묶음은 운영 서버 이전용이며 Docker 이미지에 들어가지 않는다.

## 빌드 호스트

원본 및 `gis/georeferenced`가 준비된 현재 작업 디렉터리에서:

```bash
bash deploy/build.sh v0.0.1
```

원본 해시 검사 → 데이터 묶음 → 이미지 빌드 → 컨테이너 내 Django 검사 → 누락/버전 불일치 시작 차단 검사 → 실제 Gunicorn HTTP 검사 → 내보내기 순서다.
이미지에 원본·`.git`·환경 파일·빌드 산출물이 섞이지 않았는지도 검사한다.
Docker Hub push나 원격 배포는 빌드 명령에 포함하지 않는다.

생성 파일(Git 제외):

```text
dist/hanyang3d-image-v0.0.1.tar.gz
dist/hanyang3d-data-v0.0.1.tar.gz
dist/hanyang3d-host-v0.0.1.tar.gz
dist/SHA256SUMS-v0.0.1
```

후속 버전은 `deploy/DOCKER_VERSION`과 `deploy/deploy.toml`을 갱신한 뒤 같은 명령을 사용한다.
이미지는 현재 작업 파일을 빌드한다. Git 커밋 전 빌드에는 revision 레이블에 `-dirty`가 붙는다.

## dolfinid 최초 설치

2026-09-12 읽기 전용 확인: SSH `dolfinid` → `honestjung@cdgts.paleobytes.info`, x86_64, Docker 29.8.0, Compose 5.5.1.
기존 서비스들과 분리하여 `/srv/hanyang3d`, **`127.0.0.1:8013`**을 사용한다. 확인 당시 8013은 비어 있었다.
공개 도메인은 별도로 결정한다.

빌드 호스트에서 릴리스 파일을 전송한다:

```bash
ssh dolfinid 'mkdir -p ~/hanyang3d-release'
scp dist/hanyang3d-*-v0.0.1.tar.gz dist/SHA256SUMS-v0.0.1 dolfinid:~/hanyang3d-release/
```

서버에서:

```bash
cd ~/hanyang3d-release
sha256sum -c SHA256SUMS-v0.0.1
docker load -i hanyang3d-image-v0.0.1.tar.gz
sudo install -d -o "$(id -un)" -g "$(id -gn)" /srv/hanyang3d
tar -xzf hanyang3d-host-v0.0.1.tar.gz -C /srv/hanyang3d
mkdir -p /srv/hanyang3d/data
mkdir /srv/hanyang3d/data/v0.0.1
tar -xzf hanyang3d-data-v0.0.1.tar.gz -C /srv/hanyang3d/data/v0.0.1
cd /srv/hanyang3d
cp .env.django.example .env.django
chmod 600 .env.django
```

`.env.django`의 `DJANGO_SECRET_KEY`를 충분히 긴 무작위 값으로 바꾼다. 공개 도메인을 쓸 경우 `DJANGO_ALLOWED_HOSTS`에 그 도메인을 추가한다(healthcheck용 `127.0.0.1,localhost` 유지).

```bash
bash deploy.sh v0.0.1
curl -f http://127.0.0.1:8013/healthz
```

이미지의 `/app/deploy/host/`에도 같은 호스트 파일이 있어 운영 서버에 Git 체크아웃은 필요 없다.
이후 버전은 새 이미지와 새 `data/<version>`을 먼저 준비하고 같은 배포 명령을 실행한다.
배포 전 이미지·데이터 쌍을 검증하고, 실패 시 이전 `.env`가 있으면 이전 서비스 구성을 다시 시작한다.
예전 이미지와 데이터 디렉터리를 남겨두면 `bash deploy.sh <previous-version>`으로 롤백한다.

도메인 없이 확인하려면 로컬에서 `ssh -L 18013:127.0.0.1:8013 dolfinid` 후 `http://localhost:18013/`을 연다.
공개 시에는 `nginx.conf.example`의 도메인을 바꿔 별도 사이트 설정으로 설치하고 HTTPS를 구성한다. 기존 사이트 설정을 대체하지 않는다.

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

기존 로컬 `manage.py runserver` 동작과 URL은 유지한다. Mapzen 고도 격자와 지도 JPG는 데이터 묶음에 있으며, 선택형 OSM 배경 타일은 계속 브라우저가 외부 서비스에 요청한다.
