# 문서 안내

| 문서 | 역할 |
|---|---|
| [1907년 추가 건물 후보](seoul1907_next_landmarks.md) | 기존 66개와 대조한 차고·극장·호텔·학교·병원 후보 및 연대 검토 |
| [1907년 음악 조사](seoul1907_music_research.md) | 당시 음반·공연·창가 후보, 출처와 공간 연출의 고증 범위 |
| [1907년 장소 이야기 조사](seoul1907_stories_research.md) | 전차·북묘·국권침탈·생활사 초안 24편, 출처 24개, 장소·날짜·추정 범위 및 JSON 후보 |
| [고지도 간 캘리브레이션](historical_map_calibration.md) | 판본·기준점·국부 오차와 비교 설계 |
| [1750→1907 건물 대조](seoul1907_survival_review.md) | 기존 114개 선별·30개 대응·새 시설 9곳 |
| [1907년 성곽·물길·LoD](seoul1907_infrastructure.md) | 원도 판독·철거 시기·교량 7개·표시 방식과 성능 |
| [1907년 걷기·인물과 복식](seoul1907_people_and_walking.md) | 공통 걷기·시대별 NPC·대화·모바일 봇짐과 복식 근거 |
| [1907년 건물 제작 목록](seoul1907_landmarks.md) | 1907년 건물·상점군 65개·원도 위치·연대와 제작 근거 |
| [초기 조사 원문](HANYANG_3D_RESEARCH_AND_SOURCE_ROADMAP.md) | 자료원과 연구 아이디어를 보존한 출발점 |
| [실행 계획](plan.md) | 도성 전체 지도·3D 지형 우선순위, 산출물, 완료 기준 |
| [현재 인계](handoff.md) | 구현 상태(2026-09-15 갱신), 실행·원본 보존·재개 절차, 작업별 요약 |
| [함께 걷기](../multiplayer/README.md) | Colyseus 서버 실행, 브라우저 접속과 검사, 운영 연결 및 현재 제한 |
| [도성 전체 개관 우선 결정](decisions/0002-citywide-map-first.md) | 사용자 요청에 따른 우선순위 변경과 3D 지형 목표 |
| [범위](scope.md) | 파일럿과 제외 범위 |
| [방법론](methodology.md) | 출처부터 검토까지의 공통 절차 |
| [시간 모델](chronology.md) | 제작 시기와 객체 존속 시기 구분 |
| [데이터 모델](data_model.md) | 테이블, 필드, 관계, 검증 규칙 |
| [자료 수집](sources.md) | 카탈로그 등록과 파일 취득 |
| [1907년 서울 지도](seoul1907.md) | 최신경성전도 원본·3D 전환, 정합 근거와 한계 |
| [좌표 정합](georeferencing.md) | 기준점, 변환, 오차 기록 |
| [3D 복원 규칙](reconstruction_rules.md) | 모델 수준과 추정 표시 |
| [건물·시설 안내](landmarks.md) | 지도에 올린 건물마다 소개, 존재 시기, 출처와 1750년과의 차이 |
| [건물 추가 목록](landmark_backlog.md) | 1750년 무렵 건물 가운데 차례로 추가할 후보와 진행 상태 |
| [랜드마크·이야기 후속 조사](landmark_story_research_20260916.md) | 2026-09-16 조사: 건물 후보 11곳, 이야기 초안 15편과 출처·연대·위치 검토 |
| [NPC 대화와 가게](npcs.md) | 궁감·수문장·상인 대화창, 행인·군사 인사, 시전 가게 창의 자료 형식과 원칙 |
| [장소 이야기 자료](stories.md) | 건물·다리·동네에 붙이는 이야기 데이터의 형식, 쓰는 원칙, 출처 기준 |
| [조선왕조 주요 사건 자료집](joseon_major_events.md) | 1392~1910년 주요 사건 79건, 한양 상세 해설 37건, 사료 링크와 공간·연대 검토 기준 |
| [권리 관리](licensing.md) | 코드·사료·파생물의 권리 상태 |
| [초기 설계 결정](decisions/0001-project-foundation.md) | 채택한 기본 방향과 재검토 조건 |

실제 작업 기준은 주제별 문서에서 관리합니다. 초기 조사 원문의 수치·연대·서비스 설명은 원문 기록이며, 재검증 결과는 카탈로그와 사료 노트에 남깁니다. 새 결정은 `decisions/`에 배경과 영향을 기록합니다.

서울역사아카이브의 실제 폼 처리 및 기본 입력값은 [다운로드 절차](archive_download.md)에 기록합니다.

[서버 인계 기록](handoff.md): 이 환경에서 마친 작업과 다른 서버에서 재개할 순서.

[지적자료와 파일럿 검토](cadastral_pilot_review.md): 1908·1912 실제 취득 자료, 도엽·기록 색인과 정합 후보.

[픽셀 정합 검토](pixel_registration_review.md): 도엽 비교 결과, 오프라인 대응점 검토 화면과 affine 계산 도구.

- [1908 관인방–경행방 도엽 연결](1908_sheet_join.md)

- [도성 전도·현재 지형 TPS 비교](doseong_terrain_overlay.md)

- [1908 도로·하수구 판독과 1912 비교 재개](1908_road_drain_reading.md)

- [도성대지도·3D 지형 화면](doseong_terrain3d.md): 고도 출처·가공, 사용법, 재현·검증.

- [도성대지도 청계천·다리](doseong_cheonggyecheon.md): 원도 판독, 3D 표시와 해석 범위.

- [도성 성벽·다리 진입로·산기슭 정합](doseong_walls_and_mountains.md)

- [옛길·하류 연장·성문 보완](doseong_roads_and_downstream.md)

- [길 주변 주택·상가 추정 배치](doseong_settlement.md)

[공통 가이드 적용 검토](guide_adoption_review.md): 로컬 가이드 연결, 이미 충족한 운영 항목과 후속 보완 우선순위.

- [1907년 종로·육조거리와 전차 재현 계획](seoul1907_streets_and_trams.md) — 사진·범례·관아 도면 대조, 전차 배치 단계.

- [1907년 책방 주인 전체 대본](seoul1907_bookseller_script.md): 16편·64장면의 긴 대화, 사건 연대와 출처.
