"""Build the full display DEM from official FABDEM V1.2 COG blocks.

Only required blocks are downloaded from stored GeoTIFF members of the official ZIP.
Raw blocks and their hashes are retained; the original full member CRC is not verified.
"""
import hashlib
import io
import json
import math
import struct
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import numpy as np
from PIL import Image, TiffImagePlugin
from build_dem import BOUNDS, SIZE, ROOT

URL = 'https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn/N30E120-N40E130_FABDEM_V1-2.zip'
RAW = ROOT / 'data/terrain/fabdem-v1.2/full-coverage'
LICENSE = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'

class RemoteZip(io.RawIOBase):
    def __init__(self):
        with urlopen(Request(URL, method='HEAD'), timeout=60) as r:
            self.size = int(r.headers['Content-Length'])
        self.pos = 0
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else self.pos + offset if whence == 1 else self.size + offset
        return self.pos
    def read(self, count=-1):
        count = min(self.size-self.pos, count if count >= 0 else self.size-self.pos)
        if count <= 0: return b''
        for attempt in range(3):
            try:
                expected = f'bytes {self.pos}-{self.pos+count-1}/{self.size}'
                with urlopen(Request(URL, headers={'Range': f'bytes={self.pos}-{self.pos+count-1}'}), timeout=60) as r:
                    if r.status != 206 or r.headers.get('Content-Range') != expected:
                        raise ValueError('Unexpected HTTP range response')
                    data = r.read(count)
                if len(data) != count: raise ValueError('Truncated download')
                self.pos += count
                return data
            except Exception:
                if attempt == 2: raise
                time.sleep(1)

def decode_block(payload, width, height):
    """Use libtiff to decode a single Float32 DEFLATE/Predictor=2 tile as a strip."""
    ifd = TiffImagePlugin.ImageFileDirectory_v2()
    for key, value in {256:width,257:height,258:32,259:8,262:1,273:0,277:1,
                       278:height,279:len(payload),284:1,317:2,339:3}.items():
        ifd[key] = value
    blob = b'II\x2a\x00\x08\x00\x00\x00' + ifd.tobytes(8) + payload
    with Image.open(io.BytesIO(blob)) as image:
        return np.array(image, dtype=np.float64)

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    xmin,ymin,xmax,ymax = BOUNDS
    longitude = np.linspace(xmin,xmax,SIZE)/6378137*180/math.pi
    latitude = (2*np.arctan(np.exp(np.linspace(ymax,ymin,SIZE)/6378137))-math.pi/2)*180/math.pi
    # A continuous 1 arcsecond point lattice across E127, with bilinear support margin.
    gx = (longitude-126)*3600
    gy = (38-latitude)*3600
    left,right = int(np.floor(gx.min())),int(np.floor(gx.max()))+1
    top,bottom = int(np.floor(gy.min())),int(np.floor(gy.max()))+1
    mosaic = np.full((bottom-top+1,right-left+1), np.nan)
    sources = []
    remote = None
    def fetch(offset, length):
        nonlocal remote
        if remote is None: remote = RemoteZip()
        remote.seek(offset)
        return remote.read(length)
    # Cache ZIP offsets and original TIFF headers for reproducible offline rebuilds.
    meta_path = RAW/'members.json'
    if not meta_path.exists():
        remote = RemoteZip()
        members = {}
        with zipfile.ZipFile(remote) as archive:
            for lon in (126,127):
                name = f'N37E{lon}_FABDEM_V1-2.tif'
                entry = archive.getinfo(name)
                if entry.compress_type != zipfile.ZIP_STORED: raise ValueError('Expected stored ZIP member')
                header = fetch(entry.header_offset,30)
                a,b = struct.unpack_from('<HH',header,26)
                base = entry.header_offset+30+a+b
                (RAW/(name+'.header')).write_bytes(fetch(base,32768))
                members[name] = {'offset':base,'size':entry.file_size,'crc32':f'{entry.CRC:08x}'}
        meta_path.write_text(json.dumps(members,indent=2)+'\n')
    members = json.loads(meta_path.read_text())
    for lon in (126,127):
        name = f'N37E{lon}_FABDEM_V1-2.tif'
        header_path = RAW/(name+'.header')
        with Image.open(io.BytesIO(header_path.read_bytes())) as image:
            tags = dict(image.tag_v2)
        if not (tags[256]==3600 and tags[257]==3600 and tags[258]==(32,) and tags[259]==8 and tags[317]==2 and tags[339]==(3,)):
            raise ValueError('Unexpected FABDEM raster format')
        if tags[33922] != (0.,0.,0.,float(lon),38.,0.): raise ValueError('Unexpected grid origin')
        np.testing.assert_allclose(tags[33550][:2],[1/3600,1/3600],rtol=0,atol=1e-12)
        keys = tags[34735]; geo = {keys[i]:keys[i+3] for i in range(4,len(keys),4)}
        if geo.get(1025)!=2 or geo.get(2048)!=4326: raise ValueError('Expected WGS84 PixelIsPoint')
        tw,th = tags[322],tags[323]; ncols = math.ceil(3600/tw); shift = (lon-126)*3600
        x0,x1 = max(0,left-shift),min(3599,right-shift)
        for by in range(top//th,bottom//th+1):
            for bx in range(x0//tw,x1//tw+1):
                index = by*ncols+bx; length = tags[325][index]
                path = RAW/f'{name}.{bx}-{by}.deflate'
                if not path.exists():
                    print(f'Downloading {name} block {bx},{by} ({length} bytes)',flush=True)
                    payload = fetch(members[name]['offset']+tags[324][index],length)
                    decode_block(payload,tw,th)  # reject invalid blocks before caching
                    path.write_bytes(payload)
                if path.stat().st_size != length: raise ValueError('Invalid cached block size')
                block = decode_block(path.read_bytes(),tw,th)
                xx0,xx1 = max(left,shift+bx*tw),min(right+1,shift+(bx+1)*tw,shift+3600)
                yy0,yy1 = max(top,by*th),min(bottom+1,(by+1)*th,3600)
                mosaic[yy0-top:yy1-top,xx0-left:xx1-left] = block[yy0-by*th:yy1-by*th,xx0-shift-bx*tw:xx1-shift-bx*tw]
                sources.append({'member':name,'block':[bx,by],'path':str(path.relative_to(ROOT)),
                                'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    if not np.isfinite(mosaic).all() or np.any(mosaic == -9999): raise ValueError('Missing elevation coverage')
    x,y = np.meshgrid(gx-left,gy-top);i,j = np.floor(x).astype(int),np.floor(y).astype(int);a,b=x-i,y-j
    heights = (1-b)*((1-a)*mosaic[j,i]+a*mosaic[j,i+1])+b*((1-a)*mosaic[j+1,i]+a*mosaic[j+1,i+1])
    if heights.min() < -100 or heights.max() > 2000: raise ValueError('Unexpected Seoul elevation range')
    output = ROOT/'gis/georeferenced/terrain3d/dem.json'
    manifest_path = ROOT/'gis/control_points/seoul_terrain_manifest.json'
    backup = ROOT/'data/terrain/pre-fabdem';backup.mkdir(exist_ok=True)
    if not (backup/'dem.json').exists():
        (backup/'dem.json').write_bytes(output.read_bytes())
        (backup/'manifest.json').write_bytes(manifest_path.read_bytes())
    record = {'schema_version':1,'bounds_3857':BOUNDS,'size':SIZE,'row_order':'north to south',
              'height_units':'metres','elevations':np.round(heights,2).ravel().tolist(),
              'source':'FABDEM V1.2','attribution':'Neal et al. (2023), University of Bristol; modified/reprojected by Hanyang 3D',
              'license':'CC BY-NC-SA 4.0','license_url':LICENSE,'vertical_datum':'EGM2008',
              'sample_spacing_3857_m':(xmax-xmin)/(SIZE-1),
              'limitations':'Estimated modern bare-earth terrain, not surveyed street/river geometry or historical terrain.'}
    output.write_text(json.dumps(record,separators=(',',':'))+'\n')
    seam = 3600-left
    seam_jump = np.abs(mosaic[:,seam]-mosaic[:,seam-1])
    manifest = {'id':'seoul-fabdem-v1.2','retrieved_at':datetime.now(timezone.utc).isoformat(),
                'bounds_3857':BOUNDS,'tiles':sources,'source_url':URL,'source_version':'V1.2',
                'source_grid_arcseconds':1,'vertical_datum':'EGM2008','license':'CC BY-NC-SA 4.0','license_url':LICENSE,
                'output':str(output.relative_to(ROOT)),'output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
                'grid_size':SIZE,'min_height_m':float(heights.min()),'max_height_m':float(heights.max()),
                'resampling':'bilinear from PixelIsPoint lattice across E127; no smoothing or gap filling',
                'e127_adjacent_columns_delta_m':{'median':float(np.median(seam_jump)),'max':float(seam_jump.max())},
                'verification':'Complete display bounds; compressed blocks decoded by libtiff and SHA256 recorded; full ZIP CRC not verified',
                'attribution_reference':'https://research-information.bris.ac.uk/en/datasets/fabdem-v1-2/'}
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
    print(f'{len(sources)} blocks; {SIZE}x{SIZE}; {heights.min():.2f} to {heights.max():.2f} m; seam {manifest["e127_adjacent_columns_delta_m"]}',flush=True)

if __name__ == '__main__': main()
