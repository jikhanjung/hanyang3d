import { createWalker } from './pedestrians.js';
import { addPlayerNameTag } from './walk_profile.js';
import { createWalkChat } from './walk_chat.js';

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

  // A failed or dropped connection also leaves first person, so the button label and the view agree.
  // exit() calls stop() itself, so the message is written after it.
  function fail(message) {
    if (firstPerson.active) firstPerson.exit();
    stop(message);
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
    button.textContent = '1인칭';
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
    const peer = { walker, target: pose, distance: 0 };
    peers.set(pose.id, peer);
    return peer;
  }

  async function start() {
    if (!await profile.requestName()) return;
    firstPerson.enter();
    if (!firstPerson.active) return;
    const attempt = ++generation;
    pending = true;
    button.textContent = '접속 취소';
    status.hidden = false; status.textContent = '함께 걸을 공간에 접속 중…';
    const timeout = setTimeout(() => {
      if (generation === attempt) fail('접속하지 못했습니다. 1인칭을 눌러 다시 시도하세요.');
    }, 10000);
    try {
      const client = new window.Colyseus.Client(endpoint);
      const joined = await client.joinOrCreate('hanyang_walk', { mapVersion, alignment, protocolVersion: 2, routeKey: pedestrians.routeKey, name: profile.name });
      if (generation !== attempt) { await joined.leave(); return; }
      room = joined; pending = false;
      chat.connect();
      joined.onMessage('chat', message => { if (room === joined) chat.receive(message); });
      joined.onMessage('chat-history', messages => { if (room === joined) messages.forEach(message => chat.receive(message, true)); });
      joined.onMessage('chat-error', message => { if (room === joined) chat.error(message); });
      joined.send('chat-history');
      joined.reconnection.enabled = false;
      previousPlayback = playback.checked; playback.checked = true; playback.disabled = true;
      playback.title = '함께 걷는 동안 보행자는 서버에서 계속 움직입니다.';
      button.textContent = '전체 지도 시점'; button.setAttribute('aria-pressed', 'true');
      status.textContent = '접속자 1명';
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
        status.textContent = `접속자 ${peers.size + 1}명`;
      });
      joined.onLeave(() => {
        if (room === joined) { room = null; fail('연결이 끊겼습니다. 1인칭을 눌러 다시 접속하세요.'); }
      });
      joined.onError(() => {
        if (room === joined) fail('연결 오류가 발생했습니다. 1인칭을 눌러 다시 접속하세요.');
      });
      const send = () => {
        if (!firstPerson.active) { stop(); return; }
        const eye = firstPerson.eye;
        joined.send('pose', { x: eye.x, z: eye.z, yaw: firstPerson.yaw });
      };
      send(); sendTimer = setInterval(send, 100);
    } catch (error) {
      if (generation === attempt) {
        fail([422, 412, 429, 4003].includes(error.code) ? error.message : '접속하지 못했습니다. 1인칭을 눌러 다시 시도하세요.');
        if (error.code === 4003) {
          if (await profile.requestName({ force: true, message: error.message })) start();
        }
      }
    } finally { clearTimeout(timeout); }
  }

  function update(dt) {
    const alpha = 1 - Math.exp(-15 * Math.min(dt, .1));
    for (const peer of peers.values()) {
      const { walker, target } = peer, p = walker.group.position;
      const dx = target.x - p.x, dz = target.z - p.z;
      const fraction = Math.hypot(dx, dz) > 30 ? 1 : alpha;
      const moved = Math.hypot(dx, dz) * fraction;
      p.x += dx * fraction; p.z += dz * fraction;
      const ground = groundAt(p.x, p.z);
      walker.group.visible = ground !== null;
      if (ground !== null) p.y = ground;
      const angle = target.yaw + Math.PI - walker.group.rotation.y;
      walker.group.rotation.y += Math.atan2(Math.sin(angle), Math.cos(angle)) * alpha;
      peer.distance += moved; walker.update(peer.distance, moved > .002);
    }
  }

  button.addEventListener('click', () => room || pending ? firstPerson.exit() : start());
  window.addEventListener('pagehide', () => stop());
  return { update, stop, get connected() { return !!room; }, get peers() { return peers; } };
}
