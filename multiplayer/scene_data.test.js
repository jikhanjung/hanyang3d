import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {npcWorld,loadSceneRoutes} from './npc_world.js';

test('live route data replaces image seed; failed validation preserves the last valid world',async()=>{
 const original=JSON.parse(readFileSync(new URL('../gis/roads/seoul1907_walking_routes.json',import.meta.url)));
 const before=npcWorld('seoul1907').routeKey;let payload=structuredClone(original),status=200;
 payload.routes[0].pixel_points[1][0]+=3;
 const server=createServer((req,res)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(payload))});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}/api/scene-data/walking1907/`;
 try{
  await loadSceneRoutes(url);const changed=npcWorld('seoul1907').routeKey;assert.notEqual(changed,before);
  payload.source_sha256='invalid';await assert.rejects(loadSceneRoutes(url));assert.equal(npcWorld('seoul1907').routeKey,changed);
  status=503;await assert.rejects(loadSceneRoutes(url));assert.equal(npcWorld('seoul1907').routeKey,changed);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
