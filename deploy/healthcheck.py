import json
import os
from urllib.request import urlopen

with urlopen('http://127.0.0.1:8000/healthz', timeout=4) as response:
    report = json.load(response)
if report['status'] != 'ok' or report['version'] != os.environ['HANYANG_VERSION']:
    raise SystemExit('Unhealthy or unexpected version: ' + str(report))
