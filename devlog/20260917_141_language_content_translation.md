# 141 — 언어 선택 2단계: 콘텐츠 영어 번역

사용자 요청: 내용을 모두 번역해 KO | EN으로 영어 사용자도 쓸 수 있게(140의 후속).

## 자료와 DB

- 한국어 옆에 `_en` 필드를 둔다. 비어 있으면 영어 화면에서도 한국어를 보여 준다.
  - `gis/buildings/1750_landmarks.json`: `name_en`, `info.summary_en`·`period_en`·`in_1750_en`, 출처 `title_en`
  - `gis/stories/doseong_stories.json`: `title_en`, `text_en`, 출처 `title_en`
  - `docs/landmarks_en.json`: 안내 문단 114절(한국어 제목이 키 → `title_en`, `body_en` Markdown)
  - `gis/characters/npcs.json`: `note_en`, 인물 `name_en`·`subtitle_en`, 노드 `text_en`, 선택지 `label_en`, `greetings_en`, 가게 `about_en`, 물건 `name_en`·`unit_en`·`desc_en`, 출처 `title_en`
  - `gis/placenames/doseong_placenames.json` 399곳 `name_en`(개정 로마자, 방·계·동은 `-bang`·`-gye`·`-dong`), 다리 `name_en`
- DB(migration `0005_english_fields`): `Building`·`Story`·`GuideSection`·`Citation`·`Item`·`Shop`에 영어 열. 백오피스의 ‘영어’ 접이식 묶음에서 편집한다. 0004로 심은 물건·가게의 영어는 0005가 `npcs.json`에서 채운다.
- 동기화(`sync_content`): 건물·이야기·물건·가게 지문에 영어 필드를 포함한다. 영어 필드가 생기기 전에 기록한 기준선은 한국어 부분만 비교해 손대지 않은 행으로 인정한다(`strip_en`). 안내 문단 영어는 `docs/landmarks_en.json`에서 같은 규칙으로 채우되, 아직 영어가 없는 문단은 지킬 편집이 없으므로 채운다(Codex가 동기화로 만든 11개 문단이 ‘운영에서 편집됨’으로 오인되던 것을 이렇게 풀었다). 한국어 안내 문단은 전처럼 손대지 않는다.
- 최초 가져오기(`import_content`)도 영어 필드를 읽는다.

## 서버와 화면

- `i18n.localize(data, lang)`: 페이지에 심는 JSON(건물·이야기·물길·NPC·물건)을 영어일 때 `_en` 값으로 바꾸고, 한국어일 때는 `_en` 키를 뺀다. 뷰 한 곳에서 일괄 적용한다.
- 안내 페이지: 영어 제목·본문을 쓰되 앵커는 한국어 제목 그대로다(`### English {#한국어}` 구문을 렌더러에 더했다). 지도 카드의 안내 링크가 영어 페이지에서도 같은 절로 간다. 표 행 앵커(육조 관청)는 영어 표에서 한국어 id를 붙이지 못해, 영어 화면에서는 그 건물들의 안내 링크가 빠질 수 있다.
- 거래 메시지의 물건 이름·단위는 요청 언어를 따른다.
- 브라우저: 지명 라벨은 `name_en`, 산·동네·거리 이름과 시전·군영·성문 이름은 사전(`en.json`, 41개 추가)으로 번역한다. 건물 라벨·카드·이야기·대화창은 서버가 바꿔 준 자료를 그대로 쓴다. 영어 건물 이름의 ‘… area’도 전각 구역으로 인식한다.

## 번역

- 여섯 갈래를 에이전트가 병렬로 번역했다: 건물 114곳, 이야기 49편, 안내 1·2부(57절씩), NPC·물건(296 문자열), 지명 399곳(규칙 기반 로마자 변환 뒤 검토).
- 고유명사는 개정 로마자에 짧은 풀이를 붙였다(Sungnyemun (South Great Gate), Doseong Daejido). 정자·문·관청 이름의 풀이 일부는 한자 뜻을 옮긴 해석이다(예: Yeongeunmun “Gate of Welcoming Grace”). 명 황제는 연호(Wanli·Hongwu·Chongzhen)로 적었다. 이런 선택은 번역상의 표기이며 사실 추가는 아니다.
- 에이전트가 불확실하다고 밝힌 표기(명주 “Korean silk”, 내어물전 “inner fish shop”, 유재빈 논문 제목 영역, 만리창 Mallichang 등)는 그대로 두었고 백오피스에서 고칠 수 있다.

## 검증

- Django 56개: 영어 페이지에 심긴 JSON의 건물 이름·소개·이야기 제목·궁감 이름이 영어이고 한국어 페이지에는 `_en` 키가 없음, 영어 안내 페이지에 한국어 앵커와 영어 제목, 지명·다리 영어 전부 존재. 기존 가져오기 테스트는 영어 필드를 뺀 비교로 바꿨다.
- `check_language_browser.py`: 건물 이름·소개·궁감 이름·인사·이야기 제목 영어, 안내 페이지 앵커. 캡처로 지도 라벨(Gwanghwamun, Uijeongbunae-gye)과 궁감 대화창 확인.
- 한국어 경로 NPC·이야기 검사 통과.

## 버전

- 웹 v0.4.1 → v0.4.2, 멀티플레이 v0.3.14 유지(`--web-only`). 배포의 `sync_content --apply`가 운영 DB에 영어를 채운다.
- v0.4.1 배포에서 건물·이야기·물건 영어는 들어갔지만 안내 문단 영어가 0건이었다. Dockerfile이 `docs/landmarks.md`만 복사해 `docs/landmarks_en.json`이 이미지에 없었기 때문이다. Dockerfile과 `.dockerignore`에 그 파일을 더해 v0.4.2로 다시 배포했다.

## 배포

- 2026-09-17 웹 v0.4.1(digest `sha256:77489030…`) 배포: migration 0005, 동기화 갱신 163건(건물 114·이야기 49), 물건 영어는 0005가 채움. 안내 문단 영어 0건(위 원인).
- 이어서 웹 v0.4.2(digest `sha256:36acd831…`) 배포: 동기화 갱신 113건(안내 문단), 운영 DB 안내 영어 108/113(나머지 5개는 본문 없는 분류 제목). 멀티플레이 v0.3.14 유지. 공개 화면 검사 통과, 운영 영어 화면에서 건물 이름·소개·궁감·물건·안내 앵커 확인. 배포 뒤 `prune.sh` 실행.
