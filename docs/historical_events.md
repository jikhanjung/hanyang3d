# 역사적 사건 회상(퀘스트) 만들기

아관파천 회상은 공통 틀 위에서 돌아간다. 새 사건(예: 을미사변)은 정의 파일 하나와, 움직이는 연출이 필요할 때만 모듈 하나를 더해 만든다. 서버·클라이언트 틀은 바꾸지 않는다.

## 구성 요소

| 부분 | 위치 | 역할 |
| --- | --- | --- |
| 정의 | `gis/events/<slug>.json` (schema 2) | 제목·출처·꾸러미·전환 문구·장면 설정·단계·후일담. 서버와 클라이언트가 함께 읽는다. |
| 서버 | `webapp/events.py` | 정의 목록, 단계별 확인 지점 합산, 꾸러미 지급·검사, 계정별 진행(`EventProgress`). URL `/events/<slug>/`, `/api/events/<slug>/`. |
| 틀 | `webapp/static/historical_event.js` | 패널, 커튼 진입, 꾸러미 확인, 장면 정리·조명, `talk`·`talks` 단계, 물음표 표식, 모듈 호스팅, 후일담. |
| 모듈 | `webapp/static/events/<name>.js` | 움직이는 연출(행렬·순찰·도착 등). `seoul1907.js`의 `modules` 목록에 이름으로 등록한다. |
| 기본 장면 | `webapp/static/walk1907.js` | 꾸러미를 주는 인물의 대화 삽입, 봇짐에서 꾸러미 사용 시 회상 진입, 커튼 전환. `historical_events` 요약(json_script)을 읽는다. |
| 물건 | `gis/characters/npcs.json` `items` | 꾸러미 물건. `use: "flashback"`, `max_owned: 1`, 가게 목록에 넣지 않는다. 값은 모델 최소값 1이며 팔 수 없다. |

## 정의 파일

```json
{
  "schema_version": 2,
  "id": "eulmi-1895", "slug": "eulmi", "version": 1, "base_scene": "seoul1907", "date": "1895-10-08",
  "title": "…", "title_en": "…", "panel_title": "…", "document_title": "…", "intro": "…",
  "note": "창작 범위와 추정을 밝힌다", "sources": [{"title": "…", "url": "…"}],
  "keepsake": {"item": "<npcs.json items 키>", "giver_building": "<1907 건물 id>",
               "offer": "관리인 대화 선택지", "nodes": {"rumour": {…, "options": [{"label": "받아 두겠습니다.", "action": "event:keepsake"}]}, "hint": {…}},
               "received": "봇짐에 넣었다는 안내", "missing": "꾸러미 없이 들어왔을 때", "in_visit": "회상 안에서 사용했을 때", "on_use": "사용 직후 문구"},
  "transition": {"out": "…", "in": "…", "back_out": "…", "back_in": "…"},
  "scene": {"retained_buildings": ["…"], "hide_people": true,
            "lighting": {"start": {"sky": "#…", "hemi": "#…", "ground": "#…", "sun": "#…", "hemi_intensity": 1, "sun_intensity": 1}, "end": {…}}},
  "stages": [ … ],
  "epilogue": {"lead": "…", "items": [{"date": "YYYY-MM-DD", "text": "…", "source": "…"}]}
}
```

모든 문구는 `_en` 짝을 둔다. 영어가 없으면 한국어를 그대로 쓴다.

## 단계(stage) 종류

확인 지점 0은 '시작'이고 이후 단계가 차례로 번호를 더한다. 서버 `last_checkpoint()`와 클라이언트가 같은 규칙으로 센다.

- `talk` — 한 사람을 찾아가 대화한다(확인 지점 1개). `contact_pixel`(원도 픽셀), `contact`(이름·부제·초상·`color`), `nodes`(마지막 선택지는 `"action": "event:<아무 이름>"`), `hint`(`{m}`에 남은 거리), `task`(패널의 임무 물품 문구), `after`(끝난 뒤 안내), 첫 단계라면 `walker_start_pixel`. 머리 위 물음표와 지도 표식은 틀이 붙인다.
- `talks` — 화자들이 차례로 다가온다(확인 지점 1개). `speakers[].at`은 `"beside_walker"`(플레이어 옆 안전한 자리) 또는 `"module:<anchor>"`(앞 모듈이 내놓는 인물, 예: 통역). `lighting_to: "end"`와 `lighting_seconds`로 조명을 바꿀 수 있다.
- `module` — 이름으로 등록한 모듈(확인 지점 `checkpoints`개, 없으면 `route` 길이). 나머지 필드는 모듈이 정한다.

## 모듈 만들기

`createXxx(api)`가 다음을 돌려준다.

- `prepare()` 경로·배치 계산(시작 전 1회), `enter(index, silent)` 이 단계에 들어가거나 재개(silent는 지나간 모듈을 조용히 복원해 뒤 단계의 anchor를 제공), `update(dt)` 매 프레임, `exit()` 단계를 떠날 때(버튼 숨김 등), `reset()` 처음부터 다시 볼 때, `idle(dt)` 비활성 중에도 할 일(LOD), `regroup()` '돌아가기' 버튼, `anchors()` 뒤 단계가 쓸 인물 `{host: walker}`.
- `api`가 주는 것: `data`(단계 정의), `say`/`text`, `fp`, `scene`, `camera`, `walking`, `buildings`, `infrastructure`, `surface`, `safe`, `nearestSafe`, `atPixel`, `faceTowards`, `panel.message(text)`, `panel.button(id,label,onclick)`, `reach(i)`(모듈 안 i번째 확인 지점 저장, 마지막 전까지), `finish()`(마지막 확인 지점 저장 후 다음 단계), `checkpointIndex`, `saving`, `saveError`.

`procession.js`가 예다: 경로 A*·이웃 민가·가마·순찰·도착을 모두 이 인터페이스 안에서 처리한다.

## 새 사건 추가 절차

1. `npcs.json`에 꾸러미 물건 추가(DB 동기화가 배포 때 만든다).
2. `gis/events/<slug>.json` 작성. 원도 픽셀은 기존 도구·기록을 참고하고, 창작·추정·확정을 `note`와 인물 `subtitle`("창작 인물")에 구분한다.
3. 필요하면 모듈을 만들고 `seoul1907.js`의 `modules`에 등록, `webapp/resources.py` 허용 목록에 파일 추가(리소스 수 테스트 갱신).
4. `python manage.py test` — `test_every_definition_validates`가 정의를 검사한다(꾸러미 물건 등록, 단계 종류, 확인 지점 수).
5. `scripts/terrain/check_agwanpacheon_browser.py`를 본떠 브라우저 검사를 만든다: 꾸러미 없이 시작 거부, 각 단계, 재개, 완료, 관리인 대화→봇짐 사용→커튼 진입→복귀.
6. `devlog`에 기록하고 배포한다. 정의 `version`을 올리면 기존 진행은 처음부터 다시 시작한다.

## 원칙

플레이어는 목격자이며 역사적 결과를 바꾸지 않는다. 실패가 파국으로 이어지지 않게 한다(순찰 회피의 자동 숨기처럼). 보상은 없고 완료만 계정에 기록한다. 회상은 플레이어별 화면이며 1907년 공유 세계에 흔적을 남기지 않는다.
