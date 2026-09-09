"""Render a checksum-verified pixel-affine report as an offline overlay and point crops.

Run from the repository root. Outputs are review derivatives, not geographic data.
"""
import argparse
import csv
import hashlib
import html
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def verified_bytes(path, expected):
    data = Path(path).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f"Checksum mismatch: {path}")
    return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('report', type=Path)
    parser.add_argument('points', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    verified_bytes(args.points, report['points_sha256'])
    points = list(csv.DictReader(args.points.read_text().splitlines()))
    images = []
    for side in ('source', 'target'):
        entry = report['inputs'][side]
        verified_bytes(entry['path'], entry['sha256'])
        with Image.open(entry['path']) as im:
            images.append(im.convert('RGB'))
    source, target = images
    # Pillow uses output -> input coordinates; the report stores input -> output.
    inverse = np.linalg.inv(np.asarray(report['matrix_source_to_target']))
    warped = source.convert('RGBA').transform(
        target.size, Image.Transform.AFFINE, tuple(inverse[:2].ravel()),
        resample=Image.Resampling.BICUBIC, fillcolor=(0, 0, 0, 0))
    args.output.mkdir(parents=True, exist_ok=True)
    warped.save(args.output / 'source-warped.png')
    target.save(args.output / 'target.jpg', quality=95)
    accepted = [p for p in points if p['status'] == 'accepted']
    sheet = Image.new('RGB', (480, 180 * len(accepted)), 'white')
    draw = ImageDraw.Draw(sheet)
    for row, point in enumerate(accepted):
        for col, (side, im) in enumerate(zip(('source', 'target'), images)):
            x, y = float(point[f'{side}_x']), float(point[f'{side}_y'])
            patch = im.crop((round(x)-70, round(y)-70, round(x)+70, round(y)+70))
            px, py = col * 240 + 50, row * 180 + 30
            sheet.paste(patch, (px, py))
            color = '#007f99' if point['role'] == 'control' else '#cb4a00'
            draw.ellipse((px+64, py+64, px+76, py+76), outline=color, width=2)
            draw.text((col*240+8, row*180+8),
                      f"{point['point_id']} {point['role']} {side} ({x:g}, {y:g})", fill=color)
    sheet.save(args.output / 'point-crops.jpg', quality=95)
    payload = json.dumps({'report': report, 'points': accepted}, ensure_ascii=False).replace('<', '\\u003c')
    template = Path(__file__).with_name('pixel_join_template.html').read_text()
    page = template.replace('__DATA_JSON__', payload)
    page = page.replace('__PAIR__', html.escape(f"{report['source_asset_id']} → {report['target_asset_id']}"))
    (args.output / 'index.html').write_text(page)
    (args.output / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print((args.output / 'index.html').resolve())


if __name__ == '__main__':
    main()
