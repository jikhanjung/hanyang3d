"""Exercise the host Nginx error page on isolated loopback ports; no app outage."""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlopen
from urllib.error import HTTPError, URLError
import re
import shutil
import socket
import subprocess
import time

host = Path(__file__).resolve().parent / 'host'

def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]

def request(url):
    try:
        response = urlopen(url, timeout=2)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()

with TemporaryDirectory(prefix='hanyang-maintenance-') as temp:
    root = Path(temp)
    front, back, closed = port(), port(), port()
    shutil.copyfile(host / 'maintenance.html', root / 'maintenance.html')
    site = (host / 'hanyang3d.nginx.conf').read_text()
    # Request-limit zones live at http level above the server blocks; keep them for the isolated config.
    zones = '\n'.join(re.findall(r'^limit_\w+_zone [^;]+;', site, flags=re.M))
    server = 'server {' + site.split('server {')[-1]
    server = re.sub(r'^\s*(listen|ssl_\w+)\s+[^;]+;', '', server, flags=re.M)
    server = server.replace('server {', f'server {{\nlisten 127.0.0.1:{front};', 1)
    server = server.replace('/srv/hanyang3d', str(root)).replace('127.0.0.1:8013', f'127.0.0.1:{back}')
    config = f'''pid {root}/nginx.pid;
error_log {root}/error.log;
events {{}}
http {{
    access_log off;
    types {{ text/html html; }}
    {zones}
    {server}
    server {{
        listen 127.0.0.1:{back};
        location = /502 {{ proxy_pass http://127.0.0.1:{closed}; }}
        location = /503 {{ return 503; }}
        location = /504 {{ return 504; }}
        location / {{ return 200 'ready'; }}
    }}
}}
'''
    path = root / 'nginx.conf'
    path.write_text(config)
    subprocess.run(['nginx', '-p', temp, '-c', str(path), '-t'], check=True)
    process = subprocess.Popen(['nginx', '-p', temp, '-c', str(path), '-g', 'daemon off;'])
    try:
        base = f'http://127.0.0.1:{front}'
        for attempt in range(50):
            try:
                assert request(base + '/')[0] == 200
                break
            except URLError:
                time.sleep(.1)
        else:
            raise RuntimeError('Isolated Nginx did not start')
        for code in (502, 503, 504):
            status, headers, body = request(base + '/' + str(code))
            assert status == 503, (code, status)
            assert '시스템 업데이트 중입니다'.encode() in body
            assert headers['Retry-After'] == '10'
            assert 'no-store' in headers['Cache-Control']
            assert 'text/html' in headers['Content-Type'] and 'utf-8' in headers['Content-Type']
        assert request(base + '/maintenance.html')[0] == 404
        assert request(base + '/')[2] == b'ready'
        assert 'max-age=' in (request(base + '/')[1]['Strict-Transport-Security'] or '')
        # The login form is rate limited per client: a burst beyond the allowance gets 429.
        statuses = [request(base + '/backoffice/login/')[0] for _ in range(12)]
        assert statuses[0] == 200 and 429 in statuses, statuses
        print('PASS: 502/503/504 → Korean HTML / HTTP 503; retry 10s; no cache; internal only; normal response preserved; HSTS; login rate limit 429')
    finally:
        process.terminate()
        process.wait(timeout=10)
