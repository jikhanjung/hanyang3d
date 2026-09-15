import * as THREE from 'three';
import { normalizePlayerName } from './player_name.js';

export function addPlayerNameTag(group, name) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '28px sans-serif';
  canvas.width = Math.ceil(ctx.measureText(name).width) + 32; canvas.height = 56;
  ctx.fillStyle = '#173d35dd'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(name, canvas.width / 2, 38);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthTest: true }));
  tag.name = 'player-name'; tag.userData.name = name;
  tag.position.y = 2.05; tag.scale.set(canvas.width / canvas.height * .22, .22, 1); group.add(tag);
  group.userData.playerName = name;
  return tag;
}

export function createWalkProfile() {
  let name = null, pending = null;
  try { name = normalizePlayerName(localStorage.getItem('hanyang3d-player-name')); } catch {}
  const dialog = document.createElement('dialog'); dialog.id = 'walk-name-dialog';
  dialog.setAttribute('aria-labelledby', 'walk-name-title');
  Object.assign(dialog.style, { border: '1px solid #83988b', borderRadius: '10px', background: '#fffdf2', color: '#24372e', padding: '24px', width: '320px', maxWidth: 'calc(100vw - 48px)' });
  dialog.innerHTML = `<form id="walk-name-form">
    <h2 id="walk-name-title" style="margin:0 0 12px;font-size:20px">한양에서 사용할 이름</h2>
    <p id="walk-name-help">다른 사람에게 머리 위 이름표로 보여요.</p>
    <label for="walk-name-input">이름</label>
    <input id="walk-name-input" name="playerName" type="text" autocomplete="nickname" maxlength="32" required aria-describedby="walk-name-help walk-name-error" style="display:block;box-sizing:border-box;width:100%;max-width:none;margin:8px 0;padding:10px;font:inherit">
    <p id="walk-name-error" role="alert" style="color:#9e2820;font-size:13px;min-height:18px"></p>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="walk-name-cancel">취소</button><button type="submit">걷기 시작</button></div>
  </form>`;
  document.getElementById('scene').append(dialog);
  const input = dialog.querySelector('input'), error = dialog.querySelector('#walk-name-error');
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault(); const chosen = normalizePlayerName(input.value);
    if (!chosen) { error.textContent = '한글·영문·숫자 등으로 1~16자 입력해 주세요. 공백과 _ . -도 쓸 수 있어요.'; input.focus(); return; }
    name = chosen; try { localStorage.setItem('hanyang3d-player-name', name); } catch {}
    dialog.close('accept');
  });
  dialog.querySelector('#walk-name-cancel').onclick = () => dialog.close('cancel');
  function requestName() {
    if (name) return Promise.resolve(name);
    if (pending) return pending;
    pending = new Promise(resolve => {
      dialog.addEventListener('close', () => { pending = null; resolve(name); }, { once: true });
      input.value = ''; error.textContent = ''; dialog.showModal(); input.focus();
    });
    return pending;
  }
  return { requestName, get name() { return name; } };
}
