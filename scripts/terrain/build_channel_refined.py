"""Export the channel-refined terrain computed by the browser worker to a binary cache file.

The page computes the refinement exactly as users' browsers would (worker, no cache) and packs the
result with a key over its inputs. At load time the page uses the file only when its own key matches,
so a stale or engine-dependent mismatch silently falls back to the worker.
"""
import argparse
import base64
import gzip
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'gis/georeferenced/terrain3d/channel_refined.bin.gz'

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:18014/')
args = parser.parse_args()
with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = browser.new_page()
    page.goto(args.url + '?refine-cache=off&refine-export=1', wait_until='domcontentloaded')
    page.wait_for_function('window.terrain3d?.ready', timeout=400000)
    info = page.evaluate('terrainLoading.refine')
    assert info['source'] == 'worker', info
    data = base64.b64decode(page.evaluate('terrainLoading.exportRefinement()'))
    browser.close()
OUT.write_bytes(gzip.compress(data, 9, mtime=0))
print(json.dumps({'file': str(OUT.relative_to(ROOT)), 'bytes': len(data), 'gzip_bytes': OUT.stat().st_size, 'key': info['key'], 'vertices': info['vertices']}))
