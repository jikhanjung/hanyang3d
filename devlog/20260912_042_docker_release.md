# 042 — dolfinid용 Docker v0.0.1

2026-09-12. 사용자 요청으로 `../fsis2026/deploy`를 참고해 `honestjung/hanyang3d:v0.0.1`을 구성했다. 후속 요청에 따라 누적 작업을 Git에 커밋·푸시한다.

## 대상과 구조

SSH config의 dolfinid는 honestjung@cdgts.paleobytes.info다. 읽기 전용 확인에서 x86_64, Docker 29.8.0, Compose 5.5.1을 확인했다. 8013은 사용 중이지 않았다. 기존 서비스와 분리해 `/srv/hanyang3d`, `127.0.0.1:8013`을 배포 기본값으로 삼았다. 공개 도메인은 지정하지 않았다.

이미지는 Python 3.12 slim, Django 5.2.17, Gunicorn 25.1.0이다. 비-root UID 10001로 실행하며 DB·마이그레이션은 없다. Compose의 루트와 데이터는 읽기 전용이다. 이미지에는 코드·카탈로그·GIS 정의를 포함하고 원본·파생 자료 20개는 외부 데이터 묶음으로 분리했다. 원본은 카탈로그 SHA-256을 확인한다. 빌드 컨텍스트 재포함 규칙으로 원본이 들어가지 않도록 명시적 제외와 COPY 목록, 컨테이너 내부 부재 검사를 함께 적용했다.

외부 데이터를 `/runtime`에서 읽도록 경로 해석을 분리했고 기존 로컬 개발 경로를 유지했다. 기존 파일 제공 allowlist를 공유하여 등록하지 않은 파일은 외부 볼륨에 있어도 제공하지 않는다. `/healthz`는 버전과 제공 파일 51개를 확인한다. 버전/자료 누락·불일치 시 unhealthy이며 시작 시 전체 데이터 해시를 확인한다.

빌드는 Docker Hub push나 운영 설치를 실행하지 않는다. 이미지·데이터·호스트 구성 tar.gz 및 SHA256SUMS를 dist/에 생성한다. 운영 호스트는 git checkout 없이 이미지와 데이터 묶음을 설치할 수 있다. 배포 스크립트는 실행 전 이미지·데이터 쌍을 검사하고 실패하면 이전 구성으로 복귀한다.

## 검증

로컬 및 컨테이너에서 Django 9개 검사 통과. 실제 Gunicorn 프로세스로 대시보드·2D/3D·DEM·원도·Three.js·Worker·식생 자료 HTTP 200을 확인했다. 이미지에서 원본·환경 파일·Git·빌드 디렉터리가 빠진 것도 확인했다. 데이터 누락·잘못된 버전은 시작을 차단했으며 UID 10001과 healthcheck가 정상이다.

최종 이미지 ID: `sha256:ac0b0696a6132eda32c36ca78c7ee0e0a3b24e915faedda7f5e87ddf94ee1b09` (로컬 inspect size 372,058,274 bytes). 산출물·재현·서버 설치 절차는 [배포 안내](../deploy/README.md).

실제 호스트 배포 스크립트도 로컬 전용 Compose 프로젝트와 18013 포트에서 실행했다. 이미지·데이터 사전 검사 → Compose up --wait → healthy → healthcheck가 통과했다. 검사 컨테이너와 전용 네트워크는 정리했으며 dolfinid 운영 서비스는 변경하지 않았다.
