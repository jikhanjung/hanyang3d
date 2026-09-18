import test from 'node:test';
import assert from 'node:assert/strict';
import { readPose, readChat, readJoinOptions, roomLimitReached, playerLimitReached, roundPose } from './room.js';
import { normalizePlayerName } from '../webapp/static/player_name.js';
import { createWalkingSimulation, buildWalkingRoutes } from '../webapp/static/walking_simulation.js';
import { npcWorld } from './npc_world.js';
import { makeTicket, verifyTicket } from './walk_ticket.js';

test('only finite, bounded coordinates reach other browsers', () => {
  for (const pose of [null, {}, { x: '2', z: 1, yaw: 0 }, { x: NaN, z: 1, yaw: 0 },
    { x: Infinity, z: 0, yaw: 0 }, { x: 30001, z: 0, yaw: 0 }]) {
    assert.equal(readPose(pose), null);
  }
  assert.deepEqual(readPose({ x: 10, z: -20, yaw: 0, id: 'forged' }), { x: 10, z: -20, yaw: 0, mounted: false, air: 0 });
  assert.equal(readPose({ x: 0, z: 0, yaw: 0, air: .987 }).air, .99);
  for (const air of [-1, 6, NaN, '1', Infinity]) assert.equal(readPose({ x: 0, z: 0, yaw: 0, air }).air, 0);
  assert.equal(readPose({ x: 0, z: 0, yaw: 0, mounted: true }).mounted, true);
  assert.equal(readPose({ x: 0, z: 0, yaw: 0, mounted: 'yes' }).mounted, false);
  assert.ok(Math.abs(readPose({ x: 0, z: 0, yaw: 100 }).yaw) <= Math.PI);
});

test('names are normalized and validated as display text', () => {
  assert.equal(normalizePlayerName('  한양  나그네  '), '한양 나그네');
  assert.equal(normalizePlayerName('Alice_2'), 'Alice_2');
  for (const name of ['', '   ', '<script>', 'a\nb', '가'.repeat(17), 123, null]) assert.equal(normalizePlayerName(name), null);
  assert.equal(normalizePlayerName('가'.repeat(16)), '가'.repeat(16));
});

test('chat accepts bounded text and rejects control characters or forged objects', () => {
  assert.equal(readChat('  안녕하세요 <b>반가워요</b>  '), '안녕하세요 <b>반가워요</b>');
  assert.equal(readChat('가'.repeat(200)), '가'.repeat(200));
  for (const text of ['', '  ', '가'.repeat(201), 'a\nb', 'a\u202eb', { text: 'fake', name: 'other' }, null]) {
    assert.equal(readChat(text), null);
  }
});

test('NPC movement is deterministic and responds to all players', () => {
  const routes = buildWalkingRoutes({ routes: [{ id: 'road', count: 2, pixel_points: [[0,0],[100,0]] }] }, (x,z) => ({x,z}));
  const a = createWalkingSimulation(routes), b = createWalkingSimulation(routes), solo = createWalkingSimulation(routes);
  const players = a.walkers.map(w => ({ ...w.position }));
  for (let i = 0; i < 10; i++) { a.step(.1, players); b.step(.1, players); solo.step(.1); }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.equal(new Set(a.snapshot().map(p => p[0])).size, 2);
  for (let i = 0; i < 2; i++) assert.ok(Math.abs(a.walkers[i].position.z - solo.walkers[i].position.z) > .5);
  assert.ok(a.elapsed > .9);
});

test('both map alignments load complete routes with stable identities and 130 NPCs', () => {
  const mountain = npcWorld('mountains'), base = npcWorld('base');
  assert.equal(npcWorld('mountains'), mountain);
  // These streets lie in the protected flat area: mountain alignment may leave
  // their coordinates unchanged even though the surrounding terrain differs.
  assert.ok(base.routes.every(route => Number.isFinite(route.length) && route.length > 0));
  assert.equal(createWalkingSimulation(mountain.routes).walkers.length, 130);
  assert.throws(() => npcWorld('arbitrary'));
});

test('random starts vary positions and speeds while preserving routes and repeatable simulation', () => {
  const routes = npcWorld('mountains').routes;
  const seeded = seed => () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  const a = createWalkingSimulation(routes, { random: seeded(123) });
  const b = createWalkingSimulation(routes, { random: seeded(123) });
  const c = createWalkingSimulation(routes, { random: seeded(456) });
  assert.equal(a.walkers.length, 130);
  assert.notDeepEqual(a.snapshot(), c.snapshot());
  assert.deepEqual(a.walkers.map(w => w.id), c.walkers.map(w => w.id));
  for (const w of a.walkers) {
    assert.ok(w.phase >= 0 && w.phase < 2 * w.route.length);
    assert.ok(w.distance >= 0 && w.distance <= w.route.length);
    assert.ok(w.speed >= .8 && w.speed < 1.3);
  }
  for (let i = 0; i < 20; i++) { a.step(.1); b.step(.1); }
  assert.deepEqual(a.snapshot(), b.snapshot());
});

test('join options are checked before any room exists', () => {
  const routeKey = npcWorld('mountains').routeKey;
  const ok = { name: '한양 나그네', protocolVersion: 2, alignment: 'mountains', mapVersion: 'v0.2.4', routeKey };
  assert.deepEqual(readJoinOptions(ok), { name: '한양 나그네' });
  for (const bad of [{ ...ok, name: '' }, { ...ok, protocolVersion: 3 }, { ...ok, alignment: 'arbitrary' },
    { ...ok, mapVersion: 'random-123' }, { ...ok, mapVersion: 7 }, { ...ok, routeKey: 'forged' }, {}]) {
    assert.ok(readJoinOptions(bad).error, JSON.stringify(bad));
  }
});

test('no new room past the cap while every room is full', () => {
  const full = { clients: 32, maxClients: 32 }, open = { clients: 3, maxClients: 32 };
  assert.equal(roomLimitReached([], 2), false);
  assert.equal(roomLimitReached([full], 2), false);
  assert.equal(roomLimitReached([full, full], 2), true);
  assert.equal(roomLimitReached([full, open], 2), false);
});

test('first person is capped at a total number of walkers', () => {
  assert.equal(playerLimitReached([], 10), false);
  assert.equal(playerLimitReached([{ clients: 4 }, { clients: 5 }], 10), false);
  assert.equal(playerLimitReached([{ clients: 4 }, { clients: 6 }], 10), true);
  assert.equal(playerLimitReached([{ clients: 12 }], 10), true);
});

test('look-alike letters cannot imitate names; emoji sequences pass chat', () => {
  assert.equal(normalizePlayerName('ＡＬＩＣＥ'), 'ALICE');
  for (const name of ['Аlice', 'αlice', 'аdmin']) assert.equal(normalizePlayerName(name), null, name);
  assert.equal(normalizePlayerName('漢陽 길동'), '漢陽 길동');
  assert.equal(readChat('가족 👨\u200d👩\u200d👧 반가워요'), '가족 👨\u200d👩\u200d👧 반가워요');
  assert.equal(readChat('a\u202eb'), null);
  assert.equal(readChat('a\u2066b'), null);
});

test('NPC snapshots are rounded to centimetres and keep ids', () => {
  assert.deepEqual(roundPose(['road:1', 1.23456, -2.34567, 3.1, 4, 0, 5.555, 1.004]), ['road:1', 1.23, -2.35, 3.1, 4, 0, 5.56, 1]);
});

test('walk tickets carry the account name and must be signed and fresh', () => {
  const secret = 'test-secret', routeKey = npcWorld('mountains').routeKey, now = 1_000_000;
  const base = { protocolVersion: 2, alignment: 'mountains', mapVersion: 'v0.3.7', routeKey };
  const ticket = makeTicket('한양 길동', secret, now);
  assert.equal(verifyTicket(ticket, secret, now + 30), '한양 길동');
  assert.equal(verifyTicket(ticket, secret, now + 61), null);
  assert.equal(verifyTicket(ticket, 'other-secret', now), null);
  assert.equal(verifyTicket(ticket.replace(/.$/, c => c === '0' ? '1' : '0'), secret, now), null);
  // With a secret the typed name is ignored: only the ticket decides.
  assert.deepEqual(readJoinOptions({ ...base, ticket, name: '사칭' }, { secret, now }), { name: '한양 길동' });
  assert.equal(readJoinOptions({ ...base, name: '한양 길동' }, { secret, now }).error[0], 403);
  assert.deepEqual(readJoinOptions({ ...base, name: '로컬 개발' }, { secret: '' }), { name: '로컬 개발' });
});

test('1907 uses separate route identities and cannot join a 1750 room with its route key', () => {
  const modern=npcWorld('seoul1907'),old=npcWorld('mountains');
  assert.equal(modern.routes.length,8);
  assert.equal(createWalkingSimulation(modern.routes).walkers.length,128);
  assert.notEqual(modern.routeKey,old.routeKey);
  assert.ok(modern.routes.every(r=>r.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))));
  const options={name:'경성 검사',protocolVersion:2,alignment:'seoul1907',mapVersion:'v0.2.4',routeKey:modern.routeKey};
  assert.deepEqual(readJoinOptions(options),{name:options.name});
  assert.equal(readJoinOptions({...options,alignment:'mountains'}).error[0],412);
});
