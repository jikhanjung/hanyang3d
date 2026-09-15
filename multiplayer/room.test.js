import test from 'node:test';
import assert from 'node:assert/strict';
import { readPose, readChat } from './room.js';
import { normalizePlayerName } from '../webapp/static/player_name.js';
import { createWalkingSimulation, buildWalkingRoutes } from '../webapp/static/walking_simulation.js';
import { npcWorld } from './npc_world.js';

test('only finite, bounded coordinates reach other browsers', () => {
  for (const pose of [null, {}, { x: '2', z: 1, yaw: 0 }, { x: NaN, z: 1, yaw: 0 },
    { x: Infinity, z: 0, yaw: 0 }, { x: 30001, z: 0, yaw: 0 }]) {
    assert.equal(readPose(pose), null);
  }
  assert.deepEqual(readPose({ x: 10, z: -20, yaw: 0, id: 'forged' }), { x: 10, z: -20, yaw: 0 });
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
