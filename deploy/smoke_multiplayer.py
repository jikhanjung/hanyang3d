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
    assert subprocess.check_output(['docker', 'exec', cid, 'id', '-u'], text=True).strip() == '10001'
    print('Multiplayer container passed:', health)
finally:
    subprocess.run(['docker', 'rm', '-f', cid], check=True, stdout=subprocess.DEVNULL)
