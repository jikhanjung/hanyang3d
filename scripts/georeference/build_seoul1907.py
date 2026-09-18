"""Rebuild the display image and affine registration from the catalogued original.
Fetch asset-0024 from its assets.csv download_url first if it is absent. The original is never modified.
"""
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[2]
path = ROOT / 'gis/control_points/seoul1907.json'
config = json.loads(path.read_text())
original = ROOT / config['original_url'].lstrip('/')
assert hashlib.sha256(original.read_bytes()).hexdigest() == config['input_sha256'], 'Original checksum mismatch'
output = ROOT / config['image_url'].lstrip('/')
output.parent.mkdir(parents=True, exist_ok=True)
image = ImageOps.exif_transpose(Image.open(original))
assert list(image.size) == config['image_size']
image.save(output, quality=95)
R = 6378137
project = lambda p: [R * math.radians(p['lon']), R * math.log(math.tan(math.pi / 4 + math.radians(p['lat']) / 2))]
a = np.array([[1, *p['pixel']] for p in config['controls']])
b = np.array([project(p) for p in config['controls']])
coef = np.linalg.lstsq(a, b, rcond=None)[0]
config['coefficients'] = coef.tolist()
for p in config['controls'] + config['checks']:
    error = (np.array([1, *p['pixel']]) @ coef - project(p)) * math.cos(math.radians(p['lat']))
    p['residual_ground_m'] = round(float(np.linalg.norm(error)), 2)
config['image_sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
print('Rebuilt 1907 display image and affine registration. Check residuals:', [p['residual_ground_m'] for p in config['checks']])
