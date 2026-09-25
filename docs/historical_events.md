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
- `module` — 이름으로 등록한 모듈(확인 지점 `checkpoints`개, 없으면 `route` 길이). 나머지 필드는 모듈이 정한다. 지금 있는 모듈:
  - `procession` — 가마 행렬 따라가기와 순찰 회피, 도착 연출(아관파천).
  - `shadow` — 등불 든 무리를 들키지 않게 뒤따르기. `group`(`kinds` 구성·속도·`spread_m`·등불·`seed`), `keep`(너무 가까움·너무 멂 거리), `appear`(다가가야 나타남; `free_until_at`을 주면 그 경로 지점까지는 플레이어와 멀어도 스스로 다가와 지나간다; `delay_s`·`delay_text`를 주면 조건이 맞은 뒤 그만큼 보이지 않게 기다렸다가 나타난다), `gate`·`stops`(멈춤: `defenders`의 `role: commander`·`weapon: rifle`·`fate: fall|flee`와 `flee_pixel`, `beats`의 `aim`·`flash`·`fall`·`flee`·`text`), `chatter`(가까울 때 의심·평소 잡담, 일본어와 번역; 섞은 순서로 되풀이 없이 뽑고, `phases`의 `from` 경로 지점을 지나면 그 구간 말이 섞인다), `neighborhood: false`(경로 곁 추정 민가 끄기), 문구(`intro`·`follow_hint`·`too_close`·`too_close_caught`·`too_far`)(을미사변).
  - `hide` — 기존 건물(`compound.building`) 또는 담장 두른 개념 모형(`compound`)에 들어가 어두운 구석(`spot_local`, `radius_m`)에 머무는 동안 `timeline`이 진행. `crowd`(`count`·`torch_every`·`grid_m`·`avoid_spot_m`) 인원이 담 안 통행 격자(벽·전각은 막고 숨은 구석 둘레는 비움)를 따라 움직이고, 박자의 `crowd`로 `wander`(이리저리)·`storm`(`shout` 외침 뒤 `door`로 몰려가 문을 부수고 들어감)·`emerge`·`gather`(`gather_local`)·`leave`(대문 밖 `exit_local`)를 바꾼다. `calls`는 무리가 오가며 외치는 말. 박자의 `text`·`flash`·`cue`·`light`·`smoke`. 구석을 벗어나면 멈추고 오래 벗어나면 되돌린다. 끝나면 `discovery`(연기 자리로 가면 `lines`가 차례로 나옴) 뒤 단계가 끝난다(을미사변).
  - 열쇠 물건을 다시 쓰고 들어오면(커튼 진입) 이미 마친 회상도 처음부터 다시 시작한다.
  - `crowd` — 길 한쪽에 모여 웅성거리는 사람들(`pixel`, `people`, `ring_m`). 멀리서는 `murmurs` 토막말이 머리 위에 떠오르고, `join_radius_m` 안으로 끼어들면 사람들이 비켜서고 `lines`(`who`=말하는 사람 순번)가 차례로 오간다. 플레이어에게 묻지 않고 엿듣는 대화이며 '다음 말 듣기'로 넘길 수 있다. 벗어나면 멈추고, 끝나면 흩어진다. 확인 지점 1개(`checkpoints: 1`)(을미사변 이튿날 저잣거리).
  - 경로를 쓰는 모듈은 `events/route.js`의 `buildRoute`를 함께 쓴다(원도 픽셀·다리 양끝·건물 앞, 막히면 A* 우회, 실패 시 구간 이름을 밝힌 오류).

장면(`scene`): `retained_buildings`(남길 1907년 건물 목록) 또는 `retain_up_to_year`(그해에 이미 있던 건물 모두), `hidden_buildings`, `show_settlement`(1907년 민가 유지), `hide_people`, `lighting`.

단계 공통 선택 항목:

- `transition` — 이 단계가 다른 때·곳에서 열린다(예: '이튿날 · 종로 저자거리'). 커튼으로 가리고 `walker_pixel`·`facing_pixel`로 옮기고 `lighting` 프리셋과 `show_settlement`(민가 다시 보이기)를 적용한 뒤 걷는다.
- `lighting` — 들어갈 때 바로 바꿀 조명 프리셋 이름. `talks`는 `lighting_to`·`lighting_seconds`로 서서히 바꾼다. 프리셋은 `scene.lighting`에 이름을 붙여 둔다(`start` 필수, 그 밖에 `end`·`dawn`·`day` 등 자유).
- `talks`의 화자는 `pixel`을 주면 그 자리에 서서 기다리고(머리 위 물음표·지도 표식), `stay: true`면 대화 뒤에도 남는다.

## 정의 공통 선택 항목

- `next` — 완료 메시지 끝에 다음 회상을 안내한다(`slug`, `text`). 선행 조건으로 막지는 않는다. `previous`는 앞 회상을 적어 두는 기록용.
- `sounds` — 소리 단서 이름 → 파일 주소. 모듈·단계가 `cue`(예: `gunfire`, `shouts`, `doors`)를 부르면 파일이 있고 보는 사람이 소리를 켰을 때만(`localStorage`의 `hanyang3d-event-sound`를 `on`) 재생한다. 없으면 문자만으로 진행한다. 켜는 UI는 아직 없다.

## 모듈 만들기

`createXxx(api)`가 다음을 돌려준다.

- `prepare()` 경로·배치 계산(시작 전 1회), `enter(index, silent)` 이 단계에 들어가거나 재개(silent는 지나간 모듈을 조용히 복원해 뒤 단계의 anchor를 제공), `update(dt)` 매 프레임, `exit()` 단계를 떠날 때(버튼 숨김 등), `reset()` 처음부터 다시 볼 때, `idle(dt)` 비활성 중에도 할 일(LOD), `regroup()` '돌아가기' 버튼, `anchors()` 뒤 단계가 쓸 인물 `{host: walker}`.
- `api`가 주는 것: `data`(단계 정의), `say`/`text`, `fp`, `scene`, `camera`, `walking`, `buildings`, `infrastructure`, `surface`, `safe`, `nearestSafe`, `atPixel`, `faceTowards`, `panel.message(text)`, `panel.button(id,label,onclick)`, `light(preset, seconds)`, `flash(strength)`, `cue(id)`, `quest`(물음표 표식), `markMap(point)`, `reach(i)`(모듈 안 i번째 확인 지점 저장, 마지막 전까지), `finish()`(마지막 확인 지점 저장 후 다음 단계), `checkpointIndex`, `saving`, `saveError`.

`procession.js`·`shadow.js`·`hide.js`·`crowd.js`가 예다. 경로·숨을 자리를 잡을 때는 회상 페이지 콘솔에서 `seoul1907.historicalEvent.probe(px,py)`로 원도 픽셀이 통행 가능한지 확인할 수 있다.

## 새 사건 추가 절차

1. `npcs.json`에 꾸러미 물건 추가(DB 동기화가 배포 때 만든다).
2. `gis/events/<slug>.json` 작성. 원도 픽셀은 기존 도구·기록을 참고하고, 창작·추정·확정을 `note`와 인물 `subtitle`("창작 인물")에 구분한다.
3. 필요하면 모듈을 만들고 `seoul1907.js`의 `modules`에 등록, `webapp/resources.py` 허용 목록에 파일 추가(리소스 수 테스트 갱신).
4. `python manage.py test` — `test_every_definition_validates`가 정의를 검사한다(꾸러미 물건 등록, 단계 종류, 확인 지점 수).
5. `scripts/terrain/check_agwanpacheon_browser.py`를 본떠 브라우저 검사를 만든다: 꾸러미 없이 시작 거부, 각 단계, 재개, 완료, 관리인 대화→봇짐 사용→커튼 진입→복귀.
6. `devlog`에 기록하고 배포한다. 정의 `version`을 올리면 기존 진행은 처음부터 다시 시작한다.

## 원칙

플레이어는 목격자이며 역사적 결과를 바꾸지 않는다. 실패가 파국으로 이어지지 않게 한다(순찰 회피의 자동 숨기처럼). 보상은 없고 완료만 계정에 기록한다. 회상은 플레이어별 화면이며 1907년 공유 세계에 흔적을 남기지 않는다.
