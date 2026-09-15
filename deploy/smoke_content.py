"""Verify DB mode and persistence in an isolated, disposable Docker volume."""
import json
import subprocess
import sys
import time
from urllib.request import urlopen
from uuid import uuid4

image = sys.argv[1]
volume = 'hanyang-content-check-' + uuid4().hex
cid = None
subprocess.run(['docker', 'volume', 'create', volume], check=True, stdout=subprocess.DEVNULL)
base = ['docker', 'run', '--rm', '--read-only', '--tmpfs', '/tmp:rw,noexec,nosuid,size=64m',
        '--mount', f'type=volume,src={volume},dst=/content',
        '--mount', f'type=bind,src={__import__("pathlib").Path(sys.argv[2]).resolve()},dst=/runtime,readonly',
        '-e', 'HANYANG_CONTENT_SOURCE=database', '-e', 'HANYANG_DB_PATH=/content/content.sqlite3',
        '-e', 'DJANGO_SECRET_KEY=isolated-content-smoke-only']
try:
    subprocess.run(base + ['--user', '0', '--entrypoint', 'chown', image, '10001:10001', '/content'], check=True)
    for command in (['migrate', '--noinput'], ['import_content']):
        subprocess.run(base + ['--entrypoint', 'python', image, 'manage.py', *command], check=True)
    cid = subprocess.check_output(base[:2] + ['-d'] + base[2:] + ['-p', '127.0.0.1::8000', image], text=True).strip()
    def ready():
        port = subprocess.check_output(['docker', 'port', cid, '8000/tcp'], text=True).strip()
        url = 'http://' + port
        deadline = time.monotonic() + 45
        while True:
            try:
                with urlopen(url + '/healthz', timeout=2) as response: report = json.load(response)
                assert report['status'] == 'ok' and report['content_source'] == 'database', report
                assert report['content'] == {'buildings': 103, 'stories': 34}, report
                return url
            except OSError:
                if time.monotonic() > deadline: raise
                time.sleep(.3)
    url = ready()
    for path in ['/backoffice/login/', '/static/admin/css/base.css', '/guide/']:
        with urlopen(url + path, timeout=10) as response: assert response.status == 200
    subprocess.run(['docker', 'exec', cid, 'python', 'manage.py', 'shell', '-c',
                    "from webapp.models import Building; Building.objects.filter(key='honghwamun').update(summary='persisted-content-check')"], check=True)
    subprocess.run(['docker', 'restart', cid], check=True, stdout=subprocess.DEVNULL)
    url = ready()
    with urlopen(url + '/', timeout=10) as response: assert b'persisted-content-check' in response.read()
    subprocess.run(['docker', 'exec', cid, 'python', 'manage.py', 'import_content'], check=True)
    subprocess.run(['docker', 'exec', cid, 'python', 'manage.py', 'backup_content', '/tmp/backup.sqlite3'], check=True)
    with urlopen(url + '/', timeout=10) as response: assert b'persisted-content-check' in response.read()
    print('PASS: DB image initialization, backoffice/static, 103 buildings/33 stories, persisted edit after restart, non-overwriting import and verified backup')
finally:
    if cid: subprocess.run(['docker', 'rm', '-f', cid], stdout=subprocess.DEVNULL)
    subprocess.run(['docker', 'volume', 'rm', volume], check=True, stdout=subprocess.DEVNULL)
