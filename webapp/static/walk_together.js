import { createWalker } from './pedestrians.js';
import { createHorse } from './horse_dealer.js';
import { addPlayerNameTag } from './walk_profile.js';
import { createWalkChat } from './walk_chat.js';
import {t,lang,setLang} from './i18n.js';
// Server messages are Korean dictionary keys; one carries the player cap as a number.
const tMsg = m => { const n = String(m ?? '').match(/\d+/)?.[0]; return n ? t(m.replace(n, '{n}'), {n}) : t(m); };

// Must match the rider height in terrain3d.js first person.
const SADDLE = .35;

export function createWalkTogether({ scene, firstPerson, pedestrians, profile, groundAt, endpoint, mapVersion, alignment, button, status }) {
  const peers = new Map();
  let room = null, generation = 0, pending = false, sendTimer = null, previousPlayback = null;
  const playback = document.getElementById('walking3d');
  const chat = createWalkChat({ scene: document.getElementById('scene'), firstPerson, send: text => room?.send('chat', text) });

  function remove(id) {
    const peer = peers.get(id);
    if (!peer) return;
    scene.remove(peer.walker.group);
    const materials = new Set();
    peer.walker.group.traverse(object => {
      object.geometry?.dispose();
      if (object.material) materials.add(object.material);
    });
    materials.forEach(material => { material.map?.dispose(); material.dispose(); });
    peers.delete(id);
  }

  // A failed or dropped connection keeps first person (walking alone still works); the button then leaves first
  // person, so its label says so.
  function fail(message) {
    stop(message);
    if (firstPerson.active) { button.textContent = t('전체 지도 시점'); button.setAttribute('aria-pressed', 'true'); }
  }

  function stop(message = '') {
    generation++;
    pending = false;
    clearInterval(sendTimer);
    const previous = room;
    room = null;
    if (previous) previous.leave().catch(() => {});
    pedestrians.disconnect();
    chat.disconnect();
    if (previousPlayback !== null) { playback.checked = previousPlayback; playback.disabled = false; playback.title = ''; previousPlayback = null; }
    [...peers.keys()].forEach(remove);
    button.textContent = t('1인칭');
    button.setAttribute('aria-pressed', 'false');
    status.textContent = message;
    status.hidden = !message;
  }

  function add(pose) {
    const walker = createWalker();
    walker.group.name = 'remote-walker';
    walker.group.userData.playerId = pose.id;
    walker.group.getObjectByName('walker-body').material.color.set(pose.color);
    walker.group.userData.clothingColor = pose.color;
    addPlayerNameTag(walker.group, pose.name);
    walker.group.position.set(pose.x, 0, pose.z);
    walker.group.rotation.y = pose.yaw + Math.PI;
    scene.add(walker.group);
    const peer = { walker, horse: null, target: pose, distance: 0, air: 0 };
    peers.set(pose.id, peer);
    return peer;
  }

  async function start() {
    if (!await profile.requestName()) return;
    firstPerson.enter();
    if (!firstPerson.active) return;
    const attempt = ++generation;
    pending = true;
    button.textContent = t('접속 취소');
    status.hidden = false; status.textContent = t('함께 걸을 공간에 접속 중…');
    const timeout = setTimeout(() => {
      if (generation === attempt) fail(t('접속하지 못했습니다. 1인칭을 눌러 다시 시도하세요.'));
    }, 10000);
    try {
      // The web server vouches for the account name with a short-lived signed ticket.
      const ticketResponse = await fetch('/api/walk-ticket', { credentials: 'same-origin', cache: 'no-store' });
      if (!ticketResponse.ok) throw Object.assign(new Error(t('로그인이 확인되지 않았소. 1인칭으로 다시 들어오시오.')), { code: 403 });
      const { ticket } = await ticketResponse.json();
      const client = new window.Colyseus.Client(endpoint);
      const joined = await client.joinOrCreate('hanyang_walk', { mapVersion, alignment, protocolVersion: 2, routeKey: pedestrians.routeKey, name: profile.name, ticket });
      if (generation !== attempt) { await joined.leave(); return; }
      room = joined; pending = false;
      chat.connect();
      joined.onMessage('chat', message => { if (room === joined) chat.receive(message); });
      joined.onMessage('chat-history', messages => { if (room === joined) messages.forEach(message => chat.receive(message, true)); });
      joined.onMessage('chat-error', message => { if (room === joined) chat.error(message); });
      joined.send('chat-history');
      joined.reconnection.enabled = false;
      previousPlayback = playback.checked; playback.checked = true; playback.disabled = true;
      playback.title = t('함께 걷는 동안 보행자는 서버에서 계속 움직입니다.');
      button.textContent = t('전체 지도 시점'); button.setAttribute('aria-pressed', 'true');
      status.textContent = t('접속자 1명');
      joined.onMessage('npcs', snapshot => { if (room === joined) pedestrians.applySnapshot(snapshot); });
      joined.onMessage('walkers', poses => {
        if (room !== joined) return;
        const seen = new Set();
        for (const pose of poses) {
          if (pose.id === joined.sessionId) {
            const group = firstPerson.walker.group;
            group.getObjectByName('walker-body').material.color.set(pose.color);
            group.userData.clothingColor = pose.color;
            continue;
          }
          seen.add(pose.id);
          const peer = peers.get(pose.id) || add(pose);
          peer.target = pose;
        }
        for (const id of peers.keys()) if (!seen.has(id)) remove(id);
        status.textContent = t('접속자 {n}명', {n: peers.size + 1});
      });
      joined.onLeave(() => {
        if (room === joined) { room = null; fail(t('연결이 끊겼습니다. 1인칭을 눌러 다시 접속하세요.')); }
      });
      joined.onError(() => {
        if (room === joined) fail(t('연결 오류가 발생했습니다. 1인칭을 눌러 다시 접속하세요.'));
      });
      const send = () => {
        if (!firstPerson.active) { stop(); return; }
        const eye = firstPerson.eye;
        joined.send('pose', { x: eye.x, z: eye.z, yaw: firstPerson.yaw, mounted: firstPerson.mounted, air: firstPerson.air });
      };
      send(); sendTimer = setInterval(send, 100);
    } catch (error) {
      if (generation === attempt) {
        fail(error.code === 4003 ? t('이 이름으로 이미 함께 걷는 중이오. 다른 창을 닫고 다시 들어오시오.')
          : [403, 422, 412, 429].includes(error.code) ? tMsg(error.message) : t('함께 걷기 서버에 접속하지 못했소. 혼자 걸을 수 있소.'));
        // A full server (429) is a cap on first person itself, so leave it rather than walking alone.
        if (error.code === 429 && firstPerson.active) firstPerson.exit();
      }
    } finally { clearTimeout(timeout); }
  }

  function update(dt) {
    const alpha = 1 - Math.exp(-15 * Math.min(dt, .1));
    for (const peer of peers.values()) {
      const { walker, target } = peer, p = walker.group.position;
      // A rider sits SADDLE metres up with the horse under them (a child of the walker, so it moves and is removed with it).
      if (target.mounted && !peer.horse) { peer.horse = createHorse(); peer.horse.group.name = 'remote-horse'; walker.group.add(peer.horse.group); }
      if (peer.horse) { peer.horse.group.visible = !!target.mounted; peer.horse.group.position.y = -SADDLE; }
      const dx = target.x - p.x, dz = target.z - p.z;
      const fraction = Math.hypot(dx, dz) > 30 ? 1 : alpha;
      const moved = Math.hypot(dx, dz) * fraction;
      p.x += dx * fraction; p.z += dz * fraction;
      const ground = groundAt(p.x, p.z);
      walker.group.visible = ground !== null;
      // Jumps arrive ten times a second; ease the height between updates so the arc looks continuous.
      peer.air += ((target.air || 0) - peer.air) * Math.min(1, alpha * 2);
      if (ground !== null) p.y = ground + (target.mounted ? SADDLE : 0) + peer.air;
      const angle = target.yaw + Math.PI - walker.group.rotation.y;
      walker.group.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha;
      peer.distance += moved; walker.update(peer.distance, moved > .002 && !target.mounted, !!target.mounted);
      if (target.mounted) peer.horse.update(performance.now(), moved > .002);
    }
  }

  button.addEventListener('click', () => room || pending || firstPerson.active ? firstPerson.exit() : start());
  window.addEventListener('pagehide', () => stop());
  return { update, stop, get connected() { return !!room; }, get peers() { return peers; } };
}
