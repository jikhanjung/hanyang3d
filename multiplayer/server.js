import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { WalkRoom } from './room.js';
import { npcWorld } from './npc_world.js';

const allowedOrigins = new Set((process.env.WALK_ORIGINS ||
  'http://127.0.0.1:18014,http://localhost:18014').split(',').map(s => s.trim()));
const allowed = origin => !origin || allowedOrigins.has(origin);
matchMaker.controller.getCorsHeaders = headers => ({
  'Access-Control-Allow-Origin': allowedOrigins.has(headers.get('origin')) ? headers.get('origin') : 'null',
  'Vary': 'Origin',
});
const transport = new WebSocketTransport({
  maxPayload: 2048,
  beforeUpgrade: request => allowed(request.headers.get('origin')) ? undefined : new Response(null, { status: 403 }),
});
const world = npcWorld();
const server = new Server({ transport, greet: false, express: app => {
  app.get('/healthz', (request, response) => response.json({
    status: 'ok', version: process.env.HANYANG_VERSION || 'development',
    protocolVersion: 2, npcCount: world.routes.reduce((count, route) => count + route.count, 0),
  }));
} });
server.define('hanyang_walk', WalkRoom).filterBy(['mapVersion', 'alignment', 'protocolVersion']);
await server.listen(Number(process.env.WALK_PORT || 2567), process.env.WALK_HOST || '127.0.0.1');
console.log('한양 함께 걷기 서버가 준비되었습니다.');
