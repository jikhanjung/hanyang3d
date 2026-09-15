import assert from 'node:assert/strict';
import { Client } from '@colyseus/sdk';
import { npcWorld } from './npc_world.js';

const client = new Client(process.env.WALK_URL || 'http://127.0.0.1:2567');
const rooms = [];
const options = { mapVersion: 'v0.0.0', alignment: 'mountains', protocolVersion: 2, routeKey: npcWorld().routeKey, name: '테스트 나그네' };
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
  a.send('pose', { x: 1, z: 2, yaw: 0, id: 'forged', name: 'forged', color: '#000000' });
  b.send('pose', { x: 4, z: 5, yaw: 1 });
  await wait(() => aPoses.length === 2 && bPoses.length === 2, 'both clients must see each other');
  assert.equal(aPoses.find(p => p.x === 1).id, a.sessionId);
  assert.equal(bPoses.find(p => p.id === a.sessionId).name, '한양사람');
  assert.notEqual(aPoses[0].color, aPoses[1].color);
  assert.notEqual(aPoses.find(p => p.id === a.sessionId).color, '#000000');
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, name: ' 한양사람 ' }), /이미 사용/);
  // Reserve names before the first pose, including concurrent case variants.
  const raced = await Promise.allSettled(['Alice', 'alice'].map(name => client.joinOrCreate('hanyang_walk', { ...options, name })));
  assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
  const reserved = raced.find(result => result.status === 'fulfilled').value; rooms.push(reserved);
  reserved.onMessage('walkers', () => {}); reserved.onMessage('npcs', () => {});
  await reserved.leave(); rooms.splice(rooms.indexOf(reserved), 1);
  const reused = await client.joinOrCreate('hanyang_walk', { ...options, name: 'ALICE' }); rooms.push(reused);
  reused.onMessage('walkers', () => {}); reused.onMessage('npcs', () => {});
  await reused.leave(); rooms.splice(rooms.indexOf(reused), 1);
  const messagesA = [], messagesB = [], chatErrors = [];
  a.onMessage('chat', message => messagesA.push(message));
  b.onMessage('chat', message => messagesB.push(message));
  a.onMessage('chat-error', message => chatErrors.push(message));
  a.send('chat', '안녕하세요 <script>문자입니다</script>');
  await wait(() => messagesA.length === 1 && messagesB.length === 1, 'chat must reach both clients');
  assert.deepEqual(messagesA, messagesB);
  assert.equal(messagesB[0].name, '한양사람');
  assert.equal(messagesB[0].color, aPoses.find(p => p.id === a.sessionId).color);
  a.send('chat', 'too fast');
  await wait(() => chatErrors.length === 1, 'chat rate limit must respond');
  a.send('chat', '가'.repeat(201));
  await wait(() => chatErrors.length === 2, 'oversized chat must be rejected');
  assert.equal(messagesB.length, 1);
  let history, historyReplies = 0;
  b.onMessage('chat-history', messages => { history = messages; historyReplies++; }); b.send('chat-history');
  await wait(() => history?.length === 1, 'recent history must be available');
  assert.deepEqual(history, messagesB);
  // A session gets the history once; repeating the request must not resend it.
  b.send('chat-history');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(historyReplies, 1);
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
  // A different map version no longer opens its own room; only the map alignment separates spaces.
  const sameSpace = await client.joinOrCreate('hanyang_walk', { ...options, mapVersion: 'v9.9.9', name: '다른판' }); rooms.push(sameSpace);
  assert.equal(sameSpace.roomId, a.roomId);
  await sameSpace.leave(); rooms.splice(rooms.indexOf(sameSpace), 1);
  const otherVersion = await client.joinOrCreate('hanyang_walk', { ...options, alignment: 'base', routeKey: npcWorld('base').routeKey, name: '기준배치' }); rooms.push(otherVersion);
  otherVersion.onMessage('walkers', () => {});
  let otherNpcs;
  otherVersion.onMessage('npcs', snapshot => { otherNpcs = snapshot; });
  assert.notEqual(otherVersion.roomId, a.roomId);
  await wait(() => otherNpcs, 'new space must publish NPCs');
  assert.notDeepEqual(otherNpcs.npcs.map(p => p[6]), bNpcs.npcs.map(p => p[6]));
  assert.ok(bNpcs.npcs.every(p => p[7] >= .8 && p[7] < 1.3));
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, name: '<script>' }), /이름/);
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, routeKey: 'wrong' }), /자료/);
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, mapVersion: 'random-123', name: '위조' }), /자료/);
  await assert.rejects(client.joinOrCreate('hanyang_walk', { ...options, alignment: 'arbitrary', name: '위조' }), /자료/);
  await b.leave();
  rooms.splice(rooms.indexOf(b), 1);
  await wait(() => aPoses.length === 1, 'leaving must remove the character');
  console.log('PASS: unique names (race/reuse), colors, chat/history/limits, movement, shared NPC ticks, randomized new spaces, alignment separation, join checks, departure');
} finally { await Promise.all(rooms.map(room => room.leave().catch(() => {}))); }
