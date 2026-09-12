# 054 — 업데이트 안내, 지역 이름과 반투명 조작부

## 변경

- dolfinid의 cdGTS·strati2026 등에서 사용하는 Nginx error_page 방식을 확인했다. 한양3D도 502·503·504를 정적 안내 HTML과 HTTP 503으로 처리한다. `proxy_intercept_errors on`으로 앱에서 반환한 오류에도 적용한다.
- “시스템 업데이트 중입니다. 한양3D를 준비하고 있습니다. 잠시만 기다려 주세요.” 안내, 10초 자동 새로고침, Retry-After 10 및 no-store 헤더. 안내 HTML은 컨테이너 밖 `/srv/hanyang3d/maintenance.html`에 둔다. 직접 URL 접근은 internal로 차단한다.
- 북촌·서촌은 대략적인 지역 중심에 이름만 표시한다. 건물 모델이나 경계는 추가하지 않았다. 표기 위치는 각각 경도/위도 `(126.984, 37.582)`, `(126.969, 37.5805)`로 개략 배치한 것이며 측량점이 아니다. 기존 이름 표시 옵션과 연동한다.
- 모바일 햄버거는 제목 왼쪽으로 이동했다. PC·모바일의 제목 조작부와 출처 링크 배경 불투명도는 70%로 통일했다. 모바일 출처 링크는 ©만 보이며 접근성 이름은 “출처·저작권”을 유지한다.

## 위치 참고

서울한옥포털의 [북촌](https://hanok.seoul.go.kr/front/kor/town/town01.do), [경복궁 서측](https://hanok.seoul.go.kr/front/kor/town/town02.do) 지역 설명을 참고했다. 표시 지점은 해당 지역을 알아보기 위한 개략 위치다.

## 검증

- `deploy/check_maintenance_nginx.py`를 dolfinid에서 실행했다. 운영 Nginx와 분리한 임시 loopback 포트로 연결 거부 502, upstream 503·504를 재현하여 한국어 HTML·503 상태·Retry-After·no-store·UTF-8을 확인했다. 정상 응답 200과 안내 URL 직접 접근 404도 통과했다.
- 운영 설정 백업 후 `nginx -t` 통과, Nginx reload 완료. 서비스 중단 없이 적용했다. 기존 다른 사이트의 protocol options 경고는 변경 전후 동일하다.
- Django 11개 테스트 및 JS 구문 검사 통과.

## 마우스 조작 추가 변경

[Google Earth 공식 안내](https://support.google.com/earth/answer/148186?hl=en)의 버튼 방식을 참고하여 좌클릭 드래그는 수평 이동, 휠 버튼 드래그는 yaw/pitch 회전, 휠 스크롤 및 우클릭 드래그는 확대·축소로 매핑했다. 모바일 터치와 1인칭 시선 조작은 기존 방식을 유지한다.

PC·모바일 브라우저 검증 통과: 지역 이름 2개, 왼쪽 햄버거, 두 패널의 배경 alpha 0.7, 모바일 © 및 접근성 링크, 메뉴 시점 전환. `check_mouse_mapping_browser.py`는 실제 마우스 이벤트로 좌클릭 수평 이동 시 시선 유지, 중간 버튼 회전 시 거리 유지, 우클릭·스크롤 확대를 확인했다.

## 배포 결과

- `honestjung/hanyang3d:v0.0.13` 빌드·컨테이너 검사·Docker Hub push 및 dolfinid 배포 완료.
- digest: `sha256:159be75c70f8e3f6f4b339010ecbe490365fee2a72c340baccda15ae6ba802e4`.
- 공개 HTTPS healthz: 정상, v0.0.13, resources 56. 지도/나침반/마우스 모듈 SHA-256이 검증본과 일치. 두 지도 페이지의 햄버거 순서·반투명 배경·© 마크 확인.
- 운영 Nginx 설정과 저장소 설정 일치, 안내 HTML 해시 일치, 안내 URL 직접 접근 404 확인.
