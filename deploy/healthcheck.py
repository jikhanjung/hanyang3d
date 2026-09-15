"""Container and deployment health check.

Without arguments (Docker HEALTHCHECK) the app is healthy when /healthz reports ok or degraded: a failed
hourly backup must not mark the container unhealthy and block a hotfix. With --deploy the check is stricter:
the public pages must render and no content reference may have been skipped.
"""
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

BASE = 'http://127.0.0.1:8000'
deploy = '--deploy' in sys.argv[1:]
with urlopen(BASE + '/healthz', timeout=4) as response:
    report = json.load(response)
if report['status'] not in ('ok', 'degraded') or report['version'] != os.environ['HANYANG_VERSION']:
    raise SystemExit('Unhealthy or unexpected version: ' + str(report))
if deploy:
    if report.get('content_warnings'):
        raise SystemExit('Content references are broken: ' + '; '.join(report['content_warnings']))
    for path in ('/', '/guide/'):
        try:
            with urlopen(BASE + path, timeout=20) as response:
                if response.status != 200:
                    raise SystemExit(f'{path} returned {response.status}')
        except (HTTPError, URLError) as error:
            raise SystemExit(f'{path} failed: {error}')
    if report['status'] == 'degraded':
        print('WARNING: the last content backup failed; see the backup sentinel before relying on backups.')
print('healthy', report['version'], report['status'])
