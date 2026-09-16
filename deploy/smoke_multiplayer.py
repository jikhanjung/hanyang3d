"""Verify the actual release container, including two WebSocket clients."""
import json
import subprocess
import sys
import time

image = sys.argv[1]
version = image.rsplit(':', 1)[1]
base = ['docker', 'run', '--rm', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m']
subprocess.run(base + [image, 'node', 'room.test.js'], check=True)
cid = subprocess.check_output(base[:2] + ['-d'] + base[2:] + [image], text=True).strip()
try:
    deadline = time.monotonic() + 30
    while True:
        result = subprocess.run(['docker', 'exec', cid, 'node', 'healthcheck.js'], capture_output=True, text=True)
        if result.returncode == 0:
            health = json.loads(result.stdout)
            assert health['version'] == version and health['npcCount'] == 130, health
            break
        if time.monotonic() >= deadline:
            raise RuntimeError(result.stderr)
        time.sleep(.5)
    subprocess.run(['docker', 'exec', cid, 'node', 'check_connections.js'], check=True)
    # With a ticket secret the server takes names only from signed walk tickets.
    cid2 = subprocess.check_output(base[:2] + ['-d', '-e', 'WALK_TICKET_SECRET=smoke-only-secret'] + base[2:] + [image], text=True).strip()
    try:
        deadline = time.monotonic() + 30
        while subprocess.run(['docker', 'exec', cid2, 'node', 'healthcheck.js'], capture_output=True).returncode:
            if time.monotonic() >= deadline: raise RuntimeError('ticket container did not become healthy')
            time.sleep(.5)
        subprocess.run(['docker', 'exec', '-e', 'WALK_TICKET_SECRET=smoke-only-secret', cid2, 'node', 'check_connections.js'], check=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', cid2], check=True, stdout=subprocess.DEVNULL)
    # The player cap refuses entry once that many are walking (checked with a two-player container).
    cid3 = subprocess.check_output(base[:2] + ['-d', '-e', 'WALK_MAX_PLAYERS=2'] + base[2:] + [image], text=True).strip()
    try:
        deadline = time.monotonic() + 30
        while subprocess.run(['docker', 'exec', cid3, 'node', 'healthcheck.js'], capture_output=True).returncode:
            if time.monotonic() >= deadline: raise RuntimeError('cap container did not become healthy')
            time.sleep(.5)
        script = """
import { Client } from '@colyseus/sdk';
import { npcWorld } from './npc_world.js';
const base = { mapVersion: 'v0.0.0', alignment: 'mountains', protocolVersion: 2, routeKey: npcWorld('mountains').routeKey };
const client = new Client('http://127.0.0.1:2567');
const rooms = [];
for (const name of ['\uccab\uc9f8', '\ub458\uc9f8']) rooms.push(await client.joinOrCreate('hanyang_walk', { ...base, name }));
let refused = null;
try { rooms.push(await client.joinOrCreate('hanyang_walk', { ...base, name: '\uc14b\uc9f8' })); }
catch (error) { refused = error.code; }
await Promise.all(rooms.map(room => room.leave().catch(() => {})));
if (refused !== 429) { console.error('expected 429, got', refused); process.exit(1); }
console.log('player cap refused the third walker with 429');
process.exit(0);
"""
        result = subprocess.run(['docker', 'exec', '-i', cid3, 'node', '--input-type=module', '-e', script], capture_output=True, text=True)
        assert result.returncode == 0 and '429' in result.stdout, (result.returncode, result.stdout[-500:], result.stderr[-500:])
        print(result.stdout.strip().splitlines()[-1])
    finally:
        subprocess.run(['docker', 'rm', '-f', cid3], check=True, stdout=subprocess.DEVNULL)
    assert subprocess.check_output(['docker', 'exec', cid, 'id', '-u'], text=True).strip() == '10001'
    print('Multiplayer container passed:', health)
finally:
    subprocess.run(['docker', 'rm', '-f', cid], check=True, stdout=subprocess.DEVNULL)
