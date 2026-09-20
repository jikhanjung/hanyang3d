# Firefox에서 Shift+우클릭 메뉴

Firefox는 기본적으로 Shift+우클릭 시 사이트의 `contextmenu` 이벤트를 발생시키지 않고 브라우저 메뉴를 강제로 표시한다. 한양3D의 일반 우클릭 차단(`orbit_navigation.js`)이 있어도 이 조합은 우회된다. 따라서 해당 이벤트에 `preventDefault()`를 더하는 것만으로는 해결되지 않는다.

사용자가 Firefox 주소창의 `about:config`에서 `dom.event.contextmenu.shift_suppresses_event`를 `false`로 변경하면 Shift+우클릭도 사이트에 이벤트가 전달되어 기존 메뉴 차단이 작동한다. 브라우저 전체에 적용되는 설정이며 사이트가 자동으로 변경할 수 없다. 이 설정으로 Shift 달리기와 우클릭 시점 조작을 함께 사용할 수 있다.

- [MDN contextmenu 예외 설명](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event)
- [Mozilla 지원 — Firefox 117부터의 설정](https://support.mozilla.org/en-US/questions/1420135)

2026-09-20 사용자 Firefox 사용 확인 후 안내. 이번 조사로 앱 입력 코드를 변경하지 않았다.
