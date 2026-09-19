import {t,lang,setLang} from './i18n.js';
export function createWalkChat({ scene, firstPerson, send }) {
  const toggle = document.createElement('button');
  toggle.id = 'walk-chat-toggle'; toggle.textContent = t('채팅'); toggle.hidden = true;
  toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'walk-chat');
  Object.assign(toggle.style, { position: 'absolute', right: '12px', bottom: '70px', zIndex: 28 });
  const panel = document.createElement('section'); panel.id = 'walk-chat'; panel.hidden = true;
  panel.setAttribute('aria-label', t('같은 공간 채팅'));
  Object.assign(panel.style, { position: 'absolute', right: '12px', bottom: '110px', zIndex: 28,
    width: 'min(320px, calc(100% - 24px))', maxHeight: '60%', overflow: 'auto', boxSizing: 'border-box',
    background: '#fffdf2f2', color: '#24372e', borderRadius: '8px', padding: '12px', fontSize: '13px' });
  panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><strong>${t('같은 공간 채팅')}</strong><button id="walk-chat-close" type="button" aria-label="${t('채팅 닫기')}">${t('닫기')}</button></div>
    <div id="walk-chat-messages" role="log" aria-live="polite" aria-relevant="additions" style="height:150px;max-height:25vh;overflow:auto;overflow-wrap:anywhere;margin:8px 0"></div>
    <form id="walk-chat-form" style="display:flex;gap:6px"><input id="walk-chat-input" aria-label="${t('채팅 메시지')}" placeholder="${t('메시지 (최대 200자)')}" maxlength="200" autocomplete="off" style="min-width:0;max-width:none;flex:1;font-size:16px"><button type="submit">${t('보내기')}</button></form>
    <p id="walk-chat-error" role="status" style="margin:4px 0 0;color:#9e2820"></p>`;
  scene.append(toggle, panel);
  const input = panel.querySelector('input'), log = panel.querySelector('[role=log]'), error = panel.querySelector('#walk-chat-error');
  let connected = false, unread = 0;
  const desktop=()=>matchMedia('(min-width:601px) and (pointer:fine)').matches;
  const form=panel.querySelector('form'),closeButton=panel.querySelector('#walk-chat-close');
  const chatTitle=panel.querySelector('strong');
  const seen = new Set();
  function show(open) {
    panel.hidden=desktop()?!connected:!open;form.hidden=!open;closeButton.hidden=!open;chatTitle.hidden=desktop();panel.classList.toggle('editing',open);toggle.setAttribute('aria-expanded',String(open));
    if (open) { unread = 0; toggle.textContent = t('채팅'); firstPerson.clearInput(); input.focus(); log.scrollTop = log.scrollHeight; }
    else if (connected) scene.querySelector('canvas')?.focus({ preventScroll: true });
  }
  const desktopQuery=matchMedia('(min-width:601px) and (pointer:fine)');
  desktopQuery.addEventListener('change',()=>{toggle.hidden=!connected||desktop();show(false)});
  toggle.onclick = () => show(panel.hidden);
  panel.querySelector('#walk-chat-close').onclick = () => show(false);
  input.addEventListener('focus', () => firstPerson.clearInput());
  // Capture before the walking Escape handler; composing Enter must not submit.
  document.addEventListener('keydown', event => {
    if (!connected || event.repeat) return;
    const enter=event.code==='Enter'||event.code==='NumpadEnter';
    if (panel.contains(event.target)) {
      event.stopPropagation();
      if (event.code === 'Escape') { event.preventDefault();input.value='';show(false); }
      if (enter && (event.isComposing||event.keyCode===229)) event.preventDefault();
    } else if (enter && !event.isComposing && firstPerson.active && !event.target.closest?.('input,textarea,select,[contenteditable="true"],#account-overlay,#shop-window,#pack-window')) {
      event.preventDefault(); event.stopPropagation(); show(true);
    }
  }, true);
  panel.querySelector('form').onsubmit = event => {
    event.preventDefault(); const text = input.value.trim();
    if (!text) {show(false);return;}
    error.textContent = ''; send(text); input.value = ''; show(false);
  };
  function receive(message, history = false) {
    if (seen.has(message.id)) return;
    seen.add(message.id);
    const row = document.createElement('div'); row.dataset.messageId = message.id;
    const swatch = document.createElement('span'); swatch.textContent = '● '; swatch.style.color = message.color;
    const name = document.createElement('strong'); name.textContent = `${message.name}: `;
    row.append(swatch, name, document.createTextNode(message.text)); log.append(row);
    while (log.children.length > 50) { seen.delete(Number(log.firstChild.dataset.messageId)); log.firstChild.remove(); }
    if (panel.hidden && !history) toggle.textContent = `${t('채팅')} (${++unread})`;
    log.scrollTop = log.scrollHeight;
  }
  return {
    receive,
    error(message) { error.textContent = t(message); if (connected) show(true); },
    connect() {connected=true;toggle.hidden=desktop();show(false)},
    disconnect() { connected = false; panel.hidden = toggle.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.textContent = t('채팅'); unread = 0; log.replaceChildren(); seen.clear(); input.value = ''; error.textContent = ''; },
  };
}
