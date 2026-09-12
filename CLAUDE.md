# Hanyang3D 작업 안내

한양3D는 Django·Three.js 기반의 읽기 전용 지도 서비스다. 현재 DB, 계정, 사용자 업로드는 없다.

공통 웹 개발·운영 가이드는 `.guides/web/README.md`, 브랜드 관련 참고는 `.guides/branding.md`에서 읽는다. `.guides`는 `../devdocs/guides`를 가리키는 로컬 상대 심볼릭 링크다. 없거나 끊어져 있으면 형제 devdocs 체크아웃이 없는 것이므로 설정을 확인한다. 가이드 원문과 링크는 이 저장소에 커밋하지 않는다.

프로젝트 적용 현황과 차이는 `docs/guide_adoption_review.md`에 기록한다. 사용자 요청과 프로젝트 특성을 우선하며, DB 전용 항목이나 화면 간소화 요청에 맞지 않는 UI 규칙을 기계적으로 적용하지 않는다.

배포 구성은 `deploy/deploy.toml`, 절차는 `deploy/README.md`에 있다. 빌드는 개발 호스트에서 하고 dolfinid는 이미지 pull·교체만 수행한다. 작업 전에 호스트와 경로를 확인한다. 운영 비밀값은 출력하거나 커밋하지 않는다.

작업 결과는 `devlog/README.md`의 순서에 맞춰 기록한다.
