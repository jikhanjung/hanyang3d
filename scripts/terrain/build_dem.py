"""Fetch a bounded Seoul DEM from AWS Terrarium tiles and build a local display grid."""
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HALF = math.pi * 6378137
ZOOM = 12
# Covers the entire default warped map plus surrounding terrain; metres in EPSG:3857.
BOUNDS = [14131000, 4514000, 14142000, 4525000]
SIZE = 257


def decode(rgb):
    a = np.asarray(rgb, dtype=float)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768


def main():
    raw = ROOT / 'data/terrain/terrarium'
    raw.mkdir(parents=True, exist_ok=True)
    span = 2 * HALF / 2**ZOOM
    xmin, ymin, xmax, ymax = BOUNDS
    tx0, tx1 = math.floor((xmin+HALF)/span), math.floor((xmax+HALF)/span)
    ty0, ty1 = math.floor((HALF-ymax)/span), math.floor((HALF-ymin)/span)
    mosaic = np.empty(((ty1-ty0+1)*256, (tx1-tx0+1)*256))
    sources = []
    for ty in range(ty0, ty1+1):
        for tx in range(tx0, tx1+1):
            url = f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx}/{ty}.png'
            path = raw / f'{ZOOM}-{tx}-{ty}.png'
            if not path.exists():
                with urlopen(Request(url, headers={'User-Agent': 'Hanyang3D terrain research'}), timeout=60) as response:
                    body = response.read()
                im = Image.open(io.BytesIO(body))
                if im.size != (256, 256) or im.mode != 'RGB':
                    raise ValueError('Unexpected DEM tile format')
                path.write_bytes(body)
            with Image.open(path) as im:
                if im.size != (256, 256) or im.mode != 'RGB':
                    raise ValueError(f'Invalid tile: {path}')
                mosaic[(ty-ty0)*256:(ty-ty0+1)*256,(tx-tx0)*256:(tx-tx0+1)*256] = decode(im)
            sources.append({'url': url, 'path': str(path.relative_to(ROOT)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    # Pixel centres, not tile corners; use bilinear sampling of decoded metre values.
    xs = (np.linspace(xmin,xmax,SIZE)+HALF)/span*256-tx0*256-0.5
    ys = (HALF-np.linspace(ymax,ymin,SIZE))/span*256-ty0*256-0.5
    x, y = np.meshgrid(xs,ys)
    x0,y0=np.floor(x).astype(int),np.floor(y).astype(int)
    if x0.min()<0 or y0.min()<0 or x0.max()+1>=mosaic.shape[1] or y0.max()+1>=mosaic.shape[0]:
        raise ValueError('Insufficient tile coverage')
    fx,fy=x-x0,y-y0
    heights=(1-fy)*((1-fx)*mosaic[y0,x0]+fx*mosaic[y0,x0+1])+fy*((1-fx)*mosaic[y0+1,x0]+fx*mosaic[y0+1,x0+1])
    if not np.isfinite(heights).all() or heights.min() < -100 or heights.max() > 2000:
        raise ValueError('Unexpected Seoul elevation range')
    record={'schema_version':1,'bounds_3857':BOUNDS,'size':SIZE,'row_order':'north to south',
            'height_units':'metres','elevations':np.round(heights,2).ravel().tolist(),
            'source':'Mapzen Terrain Tiles on AWS',
            'attribution':'Mapzen / USGS SRTM and GMTED2010; global ETOPO1: NOAA',
            'source_zoom':ZOOM,'sample_spacing_3857_m':(xmax-xmin)/(SIZE-1),
            'limitations':'Modern composite elevation, resampled for overview; not historical terrain or surveyed building heights.'}
    out=ROOT/'gis/georeferenced/terrain3d'
    out.mkdir(parents=True,exist_ok=True)
    output=out/'dem.json'
    output.write_text(json.dumps(record,separators=(',',':'))+'\n')
    manifest={'id':'seoul-terrarium-001','retrieved_at':datetime.now(timezone.utc).isoformat(),'bounds_3857':BOUNDS,
              'source_zoom':ZOOM,'tiles':sources,'output':str(output.relative_to(ROOT)),
              'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
              'min_height_m':float(heights.min()),'max_height_m':float(heights.max()),
              'grid_size':SIZE,'resampling':'bilinear from decoded Terrarium pixel centres',
              'registry':'https://registry.opendata.aws/terrain-tiles/',
              'attribution_reference':'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
              'format_reference':'https://github.com/tilezen/joerd/blob/master/docs/formats.md'}
    (ROOT/'gis/control_points/seoul_terrain_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'{len(sources)} tiles; {SIZE}x{SIZE}; heights {heights.min():.1f}–{heights.max():.1f} m; {output}')


if __name__=='__main__':
    main()
