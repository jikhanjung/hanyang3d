import { createWalker } from './pedestrians.js';
import { addPlayerNameTag } from './walk_profile.js';

export function createWalkTogether({ scene, firstPerson, pedestrians, profile, groundAt, endpoint, mapVersion, alignment, button, status }) {
  const peers = new Map();
  let room = null, generation = 0, pending = false, sendTimer = null, previousPlayback = null;
  const playback = document.getElementById('walking3d');

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

  function stop(message = '') {
    generation++;
    pending = false;
    clearInterval(sendTimer);
    const previous = room;
    room = null;
    if (previous) previous.leave().catch(() => {});
    pedestrians.disconnect();
    if (previousPlayback !== null) { playback.checked = previousPlayback; playback.disabled = false; playback.title = ''; previousPlayback = null; }
    [...peers.keys()].forEach(remove);
    button.textContent = '함께 걷기';
    button.setAttribute('aria-pressed', 'false');
    status.textContent = message;
    status.hidden = !message;
  }

  function add(pose) {
    const walker = createWalker();
    walker.group.name = 'remote-walker';
    walker.group.userData.playerId = pose.id;
    walker.group.getObjectByName('walker-body').material.color.set('#467b83');
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
      if (generation === attempt) stop('접속하지 못했습니다. 함께 걷기를 눌러 다시 시도하세요.');
    }, 10000);
    try {
      const client = new window.Colyseus.Client(endpoint);
      const joined = await client.joinOrCreate('hanyang_walk', { mapVersion, alignment, protocolVersion: 2, routeKey: pedestrians.routeKey, name: profile.name });
      if (generation !== attempt) { await joined.leave(); return; }
      room = joined; pending = false;
      joined.reconnection.enabled = false;
      previousPlayback = playback.checked; playback.checked = true; playback.disabled = true;
      playback.title = '함께 걷는 동안 보행자는 서버에서 계속 움직입니다.';
      button.textContent = '함께 걷기 나가기'; button.setAttribute('aria-pressed', 'true');
      status.textContent = '함께 걷는 중 · 나 포함 1명';
      joined.onMessage('npcs', snapshot => { if (room === joined) pedestrians.applySnapshot(snapshot); });
      joined.onMessage('walkers', poses => {
        if (room !== joined) return;
        const seen = new Set();
        for (const pose of poses) {
          if (pose.id === joined.sessionId) continue;
          seen.add(pose.id);
          const peer = peers.get(pose.id) || add(pose);
          peer.target = pose;
        }
        for (const id of peers.keys()) if (!seen.has(id)) remove(id);
        status.textContent = `함께 걷는 중 · 나 포함 ${peers.size + 1}명`;
      });
      joined.onLeave(() => {
        if (room === joined) { room = null; stop('연결이 끊겼습니다. 함께 걷기를 눌러 다시 접속하세요.'); }
      });
      joined.onError(() => {
        if (room === joined) stop('연결 오류가 발생했습니다. 함께 걷기를 눌러 다시 접속하세요.');
      });
      const send = () => {
        if (!firstPerson.active) { stop(); return; }
        const eye = firstPerson.eye;
        joined.send('pose', { x: eye.x, z: eye.z, yaw: firstPerson.yaw });
      };
      send(); sendTimer = setInterval(send, 100);
    } catch (error) {
      if (generation === attempt) stop([4001, 4002].includes(error.code) ? error.message : '접속하지 못했습니다. 함께 걷기를 눌러 다시 시도하세요.');
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

  button.addEventListener('click', () => room || pending ? stop() : start());
  window.addEventListener('pagehide', () => stop());
  return { update, stop, get connected() { return !!room; }, get peers() { return peers; } };
}
