import assert from 'node:assert/strict';
import { Client } from '@colyseus/sdk';
import { npcWorld } from './npc_world.js';

const client = new Client(process.env.WALK_URL || 'http://127.0.0.1:2567');
const rooms = [];
const options = { mapVersion: 'connection-check', alignment: 'mountains', protocolVersion: 2, routeKey: npcWorld().routeKey, name: '테스트 나그네' };
const wait = (predicate, message) => new Promise((resolve, reject) => {
  const started = Date.now();
  const timer = setInterval(() => {
    if (predicate()) { clearInterval(timer); resolve(); }
    else if (Date.now() - started > 5000) { clearInterval(timer); reject(Error(message)); }
  }, 20);
});
try {
  const a = await client.joinOrCreate('hanyang_walk', { ...options, name: '한양사람' }); rooms.push(a);
  const npcHistory = new Map();
  a.onMessage('npcs', state => npcHistory.set(state.tick, state));
  const b = await client.joinOrCreate('hanyang_walk', { ...options, name: '길동' }); rooms.push(b);
  let bNpcs;
  b.onMessage('npcs', state => { bNpcs = state; });
  a.reconnection.enabled = b.reconnection.enabled = false;
  let aPoses = [], bPoses = [];
  a.onMessage('walkers', poses => { aPoses = poses; });
  b.onMessage('walkers', poses => { bPoses = poses; });
  assert.equal(a.roomId, b.roomId);
  a.send('pose', { x: 1, z: 2, yaw: 0, id: 'forged' });
  b.send('pose', { x: 4, z: 5, yaw: 1 });
  await wait(() => aPoses.length === 2 && bPoses.length === 2, 'both clients must see each other');
  assert.equal(aPoses.find(p => p.x === 1).id, a.sessionId);
  assert.equal(bPoses.find(p => p.id === a.sessionId).name, '한양사람');
  await wait(() => bNpcs && npcHistory.has(bNpcs.tick), 'NPC snapshots must reach both clients');
  assert.deepEqual(bNpcs, npcHistory.get(bNpcs.tick));
  assert.equal(bNpcs.npcs.length, 130);
  const earlierTick = bNpcs.tick;
  await wait(() => bNpcs.tick > earlierTick + 2, 'NPCs must keep moving without browser animation');
  a.send('pose', { x: 'invalid', z: 2, yaw: 0 });
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(bPoses.find(p => p.id === a.sessionId).x, 1);
  a.send('pose', { x: 8, z: 9, yaw: 2 });
  await wait(() => bPoses.some(p => p.id === a.sessionId && p.x === 8), 'movement must arrive');
  const otherVersion = await client.joinOrCreate('hanyang_walk', { ...options, mapVersion: 'other-map' }); rooms.push(otherVersion);
  otherVersion.onMessage('walkers', () => {});
  otherVersion.onMessage('npcs', () => {});
  assert.notEqual(otherVersion.roomId, a.roomId);
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, name: '<script>' }), /이름/);
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, routeKey: 'wrong' }), /자료/);
  await b.leave();
  rooms.splice(rooms.indexOf(b), 1);
  await wait(() => aPoses.length === 1, 'leaving must remove the character');
  console.log('PASS: shared room, names, movement, validation, matching NPC ticks, version separation, departure');
} finally { await Promise.all(rooms.map(room => room.leave().catch(() => {}))); }
