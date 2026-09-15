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

export function readChat(value) {
  if (typeof value !== 'string' || value.length > 800 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const text = value.normalize('NFC').trim();
  return text && [...text].length <= 200 ? text : null;
}

const colors = Array.from({ length: 32 }, (_, i) => `hsl(${Math.round(i * 137.508) % 360}, 48%, ${i % 2 ? 44 : 62}%)`);

export class WalkRoom extends Room {
  maxClients = 32;
  maxMessagesPerSecond = 30;
  players = new Map();
  identities = new Map();
  chatHistory = [];
  lastChat = new Map();
  chatSequence = 0;

  onCreate(options) {
    this.world = npcWorld(options.alignment);
    this.npcs = createWalkingSimulation(this.world.routes, { random: Math.random });
    this.tick = 0;
    this.onMessage('pose', (client, message) => {
      const pose = readPose(message);
      const identity = this.identities.get(client.sessionId);
      if (pose && identity) this.players.set(client.sessionId, { id: client.sessionId, ...identity, ...pose });
    });
    this.onMessage('chat-history', client => client.send('chat-history', this.chatHistory));
    this.onMessage('chat', (client, value) => {
      const identity = this.identities.get(client.sessionId), text = readChat(value), now = Date.now();
      if (!identity) return;
      if (!text) { client.send('chat-error', '메시지는 1~200자로 입력해 주세요.'); return; }
      if (now - (this.lastChat.get(client.sessionId) ?? -Infinity) < 1000) {
        client.send('chat-error', '잠시 기다렸다가 보내 주세요.'); return;
      }
      this.lastChat.set(client.sessionId, now);
      const message = { id: ++this.chatSequence, playerId: client.sessionId, ...identity, text, time: now };
      this.chatHistory.push(message);
      if (this.chatHistory.length > 50) this.chatHistory.shift();
      this.broadcast('chat', message);
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

  onJoin(client) {
    const key = client.auth.name.toLowerCase();
    if ([...this.identities.values()].some(identity => identity.name.toLowerCase() === key)) {
      throw new ServerError(4003, '이미 사용 중인 이름입니다. 다른 이름을 입력해 주세요.');
    }
    const occupied = new Set([...this.identities.values()].map(identity => identity.color));
    this.identities.set(client.sessionId, { name: client.auth.name, color: colors.find(color => !occupied.has(color)) });
  }

  onLeave(client) {
    this.players.delete(client.sessionId);
    this.identities.delete(client.sessionId);
    this.lastChat.delete(client.sessionId);
    this.broadcast('walkers', [...this.players.values()]);
  }
}
