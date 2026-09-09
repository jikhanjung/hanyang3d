"""Fit reviewed image-to-image points; never assigns a geographic CRS."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np


def fit(points, max_check_rmse_px):
    if not np.isfinite(max_check_rmse_px) or max_check_rmse_px <= 0:
        raise ValueError('A positive, predeclared check RMSE limit is required')
    accepted = [p for p in points if p['status'] == 'accepted']
    if len({p['point_id'] for p in points}) != len(points):
        raise ValueError('Duplicate point IDs')
    if any(p['role'] not in ('control', 'check') for p in points):
        raise ValueError('Invalid point role')
    if any(p['status'] not in ('proposed', 'accepted', 'rejected') for p in points):
        raise ValueError('Invalid point status')
    if any(not p.get('evidence_note', '').strip() for p in accepted):
        raise ValueError('Accepted points require evidence notes')
    if len({(p['source_asset_id'], p['target_asset_id']) for p in accepted}) != 1:
        raise ValueError('Accepted points must describe exactly one image pair')
    control = [p for p in accepted if p['role'] == 'control']
    check = [p for p in accepted if p['role'] == 'check']
    if len(control) < 4 or len(check) < 2:
        raise ValueError('Need at least 4 accepted controls and 2 independent checks')
    values = np.array([[float(p[k]) for k in ('source_x', 'source_y', 'target_x', 'target_y')]
                       for p in accepted])
    if not np.isfinite(values).all():
        raise ValueError('Point coordinates must be finite')
    if len(np.unique(values[:, :2], axis=0)) != len(values):
        raise ValueError('Repeated source points cannot be independent observations')
    if len(np.unique(values[:, 2:], axis=0)) != len(values):
        raise ValueError('Repeated target points cannot be independent observations')
    ci = [i for i, p in enumerate(accepted) if p['role'] == 'control']
    mean = values[ci, :2].mean(axis=0)
    scale = values[ci, :2].std(axis=0)
    if np.any(scale == 0):
        raise ValueError('Degenerate control geometry')
    design = np.column_stack(((values[:, :2] - mean) / scale, np.ones(len(values))))
    coeff, _, rank, _ = np.linalg.lstsq(design[ci], values[ci, 2:], rcond=None)
    if rank != 3:
        raise ValueError('Collinear controls cannot determine an affine transform')
    matrix = np.eye(3)
    matrix[:2, :2] = (coeff[:2] / scale[:, None]).T
    matrix[:2, 2] = coeff[2] - mean @ (coeff[:2] / scale[:, None])
    if np.linalg.matrix_rank(matrix[:2, :2]) < 2:
        raise ValueError('Singular output transform')
    errors = design @ coeff - values[:, 2:]
    residuals = [dict(point_id=p['point_id'], role=p['role'], dx_px=float(e[0]),
                      dy_px=float(e[1]), distance_px=float(np.linalg.norm(e)))
                 for p, e in zip(accepted, errors)]
    metrics = {}
    for role in ('control', 'check'):
        distances = [r['distance_px'] for r in residuals if r['role'] == role]
        metrics[role] = dict(count=len(distances), rmse_px=float(np.sqrt(np.mean(np.square(distances)))),
                             max_px=max(distances))
    return dict(model='affine', coordinate_space='target image pixels; origin upper-left; x right; y down',
                geographic_crs=None, source_asset_id=accepted[0]['source_asset_id'],
                target_asset_id=accepted[0]['target_asset_id'], matrix_source_to_target=matrix.tolist(),
                metrics=metrics, residuals=residuals, max_check_rmse_px=max_check_rmse_px,
                within_pixel_tolerance=metrics['check']['rmse_px'] <= max_check_rmse_px,
                historical_correspondence_verified=False,
                limitation='Pixel residuals alone do not establish historical correspondence or metric accuracy',
                numpy_version=np.__version__)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('points', type=Path)
    parser.add_argument('--assets', type=Path, default=Path('data/catalog/assets.csv'))
    parser.add_argument('--max-check-rmse-px', type=float, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    with args.points.open() as f:
        points = list(csv.DictReader(f))
    result = fit(points, args.max_check_rmse_px)
    with args.assets.open() as f:
        assets = {a['id']: a for a in csv.DictReader(f)}
    inputs = {}
    for side in ('source', 'target'):
        asset = assets[result[side + '_asset_id']]
        path = Path(asset['local_path'])
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != asset['sha256']:
            raise ValueError(f'Asset checksum mismatch: {path}')
        for p in points:
            if p['status'] == 'accepted':
                x, y = float(p[side + '_x']), float(p[side + '_y'])
                if not (0 <= x < int(asset['image_width']) and 0 <= y < int(asset['image_height'])):
                    raise ValueError(f'Point outside image: {p["point_id"]}')
        inputs[side] = dict(path=str(path), sha256=digest)
    result['inputs'] = inputs
    result['points_sha256'] = hashlib.sha256(args.points.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as f:
        json.dump(result, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write('\n')


if __name__ == '__main__':
    main()
