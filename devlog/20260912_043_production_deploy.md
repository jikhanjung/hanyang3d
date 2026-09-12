# 043 — Docker Hub 게시와 dolfinid HTTPS 배포

2026-09-12. 사용자가 Docker push와 실제 배포를 요청했고 도메인을 `hanyang3d.nopeoplestime.info`로 지정했다.

## 운영 구성

`honestjung/hanyang3d:v0.0.1`을 Docker Hub에 push하고 dolfinid에서 pull했다. 양쪽 digest는 `sha256:ac0b0696a6132eda32c36ca78c7ee0e0a3b24e915faedda7f5e87ddf94ee1b09`로 같다. 데이터·호스트 파일을 전송해 SHA-256을 대조한 뒤 `/srv/hanyang3d`에 설치했다.

지도 묶음은 `/srv/hanyang3d/data/v0.0.1`에서 읽기 전용으로 연결하며 컨테이너는 `hanyang3d-hanyang3d-1`, 포트는 `127.0.0.1:8013`이다. SECRET_KEY는 서버에서 생성해 0600 파일에 저장했고 저장소나 이미지에는 포함하지 않았다.

DNS가 서버 IP 34.64.158.160을 가리키는 것을 확인했다. 전용 Nginx 사이트 `/etc/nginx/sites-available/hanyang3d`를 추가했다. 기존 사이트는 변경하지 않았다. Let's Encrypt 인증서를 발급하고 HTTP→HTTPS 이동을 적용했다. 인증서 최초 만료일은 2026-12-11, certbot.timer는 enabled이며 webroot와 갱신 후 Nginx 검증·reload hook을 설정했다.

배포 래퍼 마지막 healthcheck가 `ssh bash -s`의 나머지 표준입력을 소비하지 않도록 stdin을 `/dev/null`로 연결했다. 이 호스트 스크립트와 도메인 설정은 별도로 반영했으며 이미 게시한 v0.0.1 앱 이미지는 변경하지 않았다.

## 점검

서버 데이터 사전 검사와 Compose healthcheck가 통과했다. HTTPS `/healthz`는 `status=ok`, `version=v0.0.1`, resources=51, missing/errors=[]를 반환했다. Nginx 설정 검사도 통과했다. 기존 cdgts/fcmanager 설정의 listen protocol 경고는 배포 전부터 존재했으며 이번 작업에서 해당 사이트는 수정하지 않았다.

운영 HTTPS에서 공개 자료 51개의 응답과 3D 렌더링을 확인했다. 보행자 130명, 나무 2,468그루, 산 이름 3개와 화강암 표현이 로드됐다. Certbot 인증서 갱신 dry-run도 성공했다.
