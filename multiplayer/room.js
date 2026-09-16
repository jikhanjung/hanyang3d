import { Room, ServerError, matchMaker } from '@colyseus/core';
import { createWalkingSimulation } from '../webapp/static/walking_simulation.js';
import { normalizePlayerName } from '../webapp/static/player_name.js';
import { npcWorld } from './npc_world.js';
import { verifyTicket } from './walk_ticket.js';

// Presence prototype: terrain collision remains in the browser. Never use these
// client-reported positions as authority for combat, trades or rewards.
export function readPose(value) {
  if (!value || typeof value !== 'object') return null;
  const { x, z, yaw } = value;
  if (![x, z, yaw].every(Number.isFinite) || Math.abs(x) > 30000 || Math.abs(z) > 30000) return null;
  // Riding and jumping are shown to others only: anything but a literal true is on foot, and `air` (feet above the
  // ground while jumping) must be a number from 0 to 5 m, otherwise 0.
  const air = Number.isFinite(value.air) && value.air >= 0 && value.air <= 5 ? Math.round(value.air * 100) / 100 : 0;
  return { x, z, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), mounted: value.mounted === true, air };
}

// Control and format characters are rejected (bidi overrides could disguise text), except the zero-width joiner
// that emoji sequences such as family or profession emoji need.
export function readChat(value) {
  if (typeof value !== 'string' || value.length > 800 || /[\p{Cc}]|(?!\u200d)\p{Cf}/u.test(value)) return null;
  const text = value.normalize('NFC').trim();
  return text && [...text].length <= 200 ? text : null;
}

// Errors thrown here become the HTTP status of the matchmaking response, so they use HTTP codes
// (403 missing or invalid walk ticket, 422 name, 412 data mismatch, 429 full); the duplicate-name check in onJoin keeps its WebSocket code 4003.
// Rooms are created only after these checks pass, during the matchmaking HTTP request (static onAuth runs
// before a room exists). Everything a client sends is validated; the room filter is limited to the two map
// alignments, and no new room is opened past MAX_ROOMS while every existing room is still full.
export const MAX_ROOMS = Number(process.env.WALK_MAX_ROOMS || 8);
// The host is small, so first person is capped at WALK_MAX_PLAYERS people across every room; entry is refused with 429
// once that many are already walking.
export const MAX_PLAYERS = Number(process.env.WALK_MAX_PLAYERS || 10);
export const ALIGNMENTS = new Set(['mountains', 'base']);

// With WALK_TICKET_SECRET set (production) the name comes only from a valid ticket signed by the web server for the
// logged-in account; without it (local development) the typed name is accepted.
export function readJoinOptions(options = {}, { secret = process.env.WALK_TICKET_SECRET, now } = {}) {
  let name;
  if (secret) {
    name = verifyTicket(options.ticket, secret, now);
    if (!name) return { error: [403, '로그인이 확인되지 않았소. 1인칭으로 다시 들어오시오.'] };
  } else {
    name = normalizePlayerName(options.name);
    if (!name) return { error: [422, '이름은 1~16자의 한글·한자·영문·숫자·공백·_ . -로 입력해 주세요.'] };
  }
  if (options.protocolVersion !== 2 || !ALIGNMENTS.has(options.alignment) ||
      typeof options.mapVersion !== 'string' || !/^v\d+\.\d+\.\d+$/.test(options.mapVersion) ||
      options.routeKey !== npcWorld(options.alignment).routeKey) {
    return { error: [412, '지도와 함께 걷기 서버의 자료가 다릅니다. 페이지를 새로 고쳐 주세요.'] };
  }
  return { name };
}

export function roomLimitReached(rooms, max = MAX_ROOMS) {
  return rooms.length >= max && rooms.every(room => room.clients >= room.maxClients);
}

export function playerLimitReached(rooms, max = MAX_PLAYERS) {
  return rooms.reduce((total, room) => total + room.clients, 0) >= max;
}

const round = value => Math.round(value * 100) / 100;
export const roundPose = pose => [pose[0], ...pose.slice(1).map(round)];

const colors = Array.from({ length: 32 }, (_, i) => `hsl(${Math.round(i * 137.508) % 360}, 48%, ${i % 2 ? 44 : 62}%)`);

export class WalkRoom extends Room {
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = 30;
  players = new Map();
  identities = new Map();
  chatHistory = [];
  lastChat = new Map();
  historySent = new Set();
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
    // Each session gets the history once; repeated requests are ignored so they cannot amplify traffic.
    this.onMessage('chat-history', client => {
      if (this.historySent.has(client.sessionId)) return;
      this.historySent.add(client.sessionId);
      client.send('chat-history', this.chatHistory);
    });
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
      // NPCs follow fixed routes and browsers smooth toward each snapshot, so 5 updates a second with centimetre
      // rounding is enough; this halves the largest message (about 8.8 KB each, 86 KB/s per player at 10 Hz).
      if (this.tick % 2 === 0) this.broadcast('npcs', { tick: this.tick, elapsed: round(this.npcs.elapsed), npcs: this.npcs.snapshot().map(roundPose) });
    }, 100);
  }

  static async onAuth(token, options) {
    const checked = readJoinOptions(options);
    if (checked.error) throw new ServerError(...checked.error);
    let rooms = [];
    try { rooms = await matchMaker.query({ name: 'hanyang_walk' }); } catch (error) { console.error('room query failed', error.message); }
    if (playerLimitReached(rooms)) throw new ServerError(429, `지금은 ${MAX_PLAYERS}명까지 1인칭으로 걸을 수 있소. 잠시 뒤에 다시 들어오시오.`);
    if (roomLimitReached(rooms)) throw new ServerError(429, '함께 걷기 공간이 모두 찼습니다. 잠시 뒤 다시 시도해 주세요.');
    return { name: checked.name };
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
    this.historySent.delete(client.sessionId);
    this.broadcast('walkers', [...this.players.values()]);
  }
}
