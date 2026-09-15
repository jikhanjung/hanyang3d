import { Room, ServerError } from '@colyseus/core';
import { createWalkingSimulation } from '../webapp/static/walking_simulation.js';
import { normalizePlayerName } from '../webapp/static/player_name.js';
import { npcWorld } from './npc_world.js';

// Presence prototype: terrain collision remains in the browser. Never use these
// client-reported positions as authority for combat, trades or rewards.
export function readPose(value) {
  if (!value || typeof value !== 'object') return null;
  const { x, z, yaw } = value;
  if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 30000 || Math.abs(z) > 30000) return null;
  return { x, z, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)) };
}

export class WalkRoom extends Room {
  maxClients = 32;
  maxMessagesPerSecond = 30;
  players = new Map();

  onCreate(options) {
    this.world = npcWorld(options.alignment);
    this.npcs = createWalkingSimulation(this.world.routes);
    this.tick = 0;
    this.onMessage('pose', (client, message) => {
      const pose = readPose(message);
      if (pose) this.players.set(client.sessionId, { id: client.sessionId, name: client.auth.name, ...pose });
    });
    this.setSimulationInterval(() => {
      this.npcs.step(.1, [...this.players.values()]);
      this.tick++;
      this.broadcast('walkers', [...this.players.values()]);
      this.broadcast('npcs', { tick: this.tick, elapsed: this.npcs.elapsed, npcs: this.npcs.snapshot() });
    }, 100);
  }

  onAuth(client, options) {
    const name = normalizePlayerName(options.name);
    if (!name) throw new ServerError(4001, '이름은 1~16자의 문자·숫자·공백·_ . -로 입력해 주세요.');
    if (options.protocolVersion !== 2 || options.routeKey !== this.world.routeKey) {
      throw new ServerError(4002, '지도와 함께 걷기 서버의 자료가 다릅니다. 페이지를 새로 고쳐 주세요.');
    }
    return { name };
  }

  onLeave(client) {
    this.players.delete(client.sessionId);
    this.broadcast('walkers', [...this.players.values()]);
  }
}
