"""Exercise the built image with the exact packaged data and a temporary local port."""
import json
from pathlib import Path
import subprocess
import sys
import time
from urllib.request import urlopen

image, runtime = sys.argv[1], str(Path(sys.argv[2]).resolve())
version = image.rsplit(':', 1)[1]
base = ['docker', 'run', '--rm', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
        '--mount', f'type=bind,src={runtime},dst=/runtime,readonly']
subprocess.run(base + ['--entrypoint', 'python', image, 'manage.py', 'test', 'webapp'], check=True)
subprocess.run(base + ['--entrypoint', 'python', image, '-c',
    'from pathlib import Path; assert not any((Path("/app") / p).exists() for p in [".git", ".env", ".venv", "data/maps", "data/cadastral", "gis/georeferenced", "dist", ".build"])'], check=True)
for extra in [['-e', 'HANYANG_DATA_ROOT=/missing'], ['-e', 'HANYANG_VERSION=v999.0.0']]:
    rejected = subprocess.run(base + extra + [image], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=30)
    if rejected.returncode == 0 or "'status': 'unhealthy'" not in rejected.stdout:
        raise SystemExit('Missing/mismatched data was not rejected: ' + rejected.stdout)

cid = None
try:
    cid = subprocess.check_output(base[:2] + ['-d'] + base[2:] + ['-p', '127.0.0.1::8000', image], text=True).strip()
    port = subprocess.check_output(['docker', 'port', cid, '8000/tcp'], text=True).strip()
    url = 'http://' + port
    deadline = time.monotonic() + 45
    while True:
        try:
            with urlopen(url + '/healthz', timeout=2) as response:
                health = json.load(response)
            break
        except Exception:
            if time.monotonic() > deadline:
                raise
            time.sleep(.5)
    assert health['status'] == 'ok' and health['version'] == version, health
    for path in ['/', '/gis/terrain/', '/gis/terrain/3d/',
                 '/gis/georeferenced/terrain3d/dem.json', '/data/maps/src-0001/asset-0001.jpg',
                 '/webapp/static/terrain_worker.js', '/webapp/static/granite.js',
                 '/webapp/static/vendor/three/three.module.js', '/gis/vegetation/doseong_trees.json']:
        with urlopen(url + path, timeout=10) as response:
            assert response.status == 200 and response.read(1), path
    subprocess.run(['docker', 'exec', cid, 'python', '/app/deploy/healthcheck.py'], check=True)
    user = subprocess.check_output(['docker', 'exec', cid, 'id', '-u'], text=True).strip()
    assert user == '10001', user
    print('Container smoke passed:', health, 'uid=' + user)
except BaseException:
    if cid:
        subprocess.run(['docker', 'logs', '--tail', '50', cid])
    raise
finally:
    if cid:
        subprocess.run(['docker', 'rm', '-f', cid], stdout=subprocess.DEVNULL)
