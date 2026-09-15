# NPC 대화와 가게

지도 위 사람을 누르면 대화한다. 코드는 `webapp/static/npc_dialogue.js`(대화 틀)와 `webapp/static/shop.js`(가게 창), 자료는 `gis/characters/npcs.json` 한 파일이다. 3D 화면(`terrain3d.js`)이 NPC 제공자를 등록한다. 처음 만든 경위는 [개발 기록 125](../devlog/20260915_125_npc_dialogue_shop.md)에 있다.

## 누구와 어떻게

| 인물 | 표시 방식 | 내용 |
|---|---|---|
| 경복궁 궁감 | 대화창(옛 어드벤처 게임식 오버레이) | 경복궁 창건·소실, 경회루 돌기둥, 궁감의 일, 1729년 나무 문제, 1743·1744년 연못 준설. 대화하는 동안 멈춰 서서 사용자를 본다. |
| 궁문 수문장(돈화문·홍화문·금호문·흥화문) | 대화창 | 수문장청, 궁성 파수 분담, 밤의 표신 |
| 시전 상인 | 대화창 → 가게 창 | 가게 소개(육의전 출처), ‘거래하기’ |
| 경비 군사, 길 가는 사람 | 머리 위 말풍선(4초) | 짧은 인사 |

## 자료 형식 (`gis/characters/npcs.json`)

- `keeper.nodes`, `officer.nodes`, `merchant.nodes`: 대화 나무. 노드마다 `text`, 선택 `year`·`sources`, `options`(`label`과 `next` 노드 또는 `action`: `close`·`shop`). 시작 노드는 `hello`.
- 수문장·상인 문장의 `{gate}`, `{unit}`, `{shop}`, `{sells}`, `{about}`은 화면에서 문·군영·가게 이름으로 채운다.
- `pedestrian.greetings.male/female`, `soldier.greetings`: 인사말 목록.
- `shops`: 시전 구역(`gis/buildings/doseong_sijeon.json`의 `signs.zones`)마다 소개 문장과 파는 물건 id.
- `items`: 이름, 단위(필·쾌·두름), 가격(문), 아이콘 모양·색, 설명. `wallet`: 처음 엽전과 되파는 비율.

## 쓰는 원칙

- 사실을 말하는 대사에는 [장소 이야기](stories.md)와 같은 기준으로 출처를 붙인다. 궁감·수문장의 `hello` 밖 노드는 출처가 반드시 있다(Django 테스트).
- 인물의 1인칭 말투는 지어낸 것이다. 1750년 무렵의 인물이 알 수 없는 뒷날 일은 말하게 하지 않는다.
- 가게 가격은 기록에서 확인하지 않은 놀이용 값이며 창에 그렇게 적는다. 봇짐과 엽전은 브라우저 `localStorage`(`hanyang3d-pack`)에만 저장되고 서버·함께 걷기와 공유하지 않는다.

## 검사

- Django `test_npc_data_is_consistent_and_sourced`: 선택지가 가리키는 노드, 출처 https, 궁감·수문장 사실 노드의 출처, 시전 구역마다 가게와 물건, 가격·아이콘.
- `scripts/terrain/check_npc_browser.py`: 궁감·수문장 대화창과 출처, Esc로 닫고 궁감이 다시 걷는지, 군사·행인 말풍선, 면포전 상인 거래하기 → 가게 창에서 사고팔기와 저장.
