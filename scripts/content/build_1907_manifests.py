"""Regenerate provenance manifests from the versioned 1907 building seed."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
features = json.loads((ROOT / 'gis/buildings/1907_landmarks.json').read_text())['features']
out = ROOT / 'models/landmarks/seoul1907'
out.mkdir(parents=True, exist_ok=True)
for f in features:
    m = {
        'model_id': f['id'] + '-concept-v1', 'feature_id': f['id'], 'level': 'L1',
        'source_ids': ['src-0029'], 'asset_ids': ['asset-0024'],
        'valid_from': f['temporal']['depiction']['start_year'],
        'valid_to': f['temporal']['depiction']['end_year'],
        'temporal_status': f['temporal'], 'units': 'metres',
        'axis_convention': 'Three.js Y up; local +Z is front; display_yaw_deg rotates about Y',
        'origin': 'source_position.pixel anchors structure; anchorOffset/hallCenterZ corrects compound origin',
        'crs': 'EPSG:3857 affine to DEM-centered ground metres',
        'tool_version': 'landmarks1907.js / throne_hall.js / gate.js / palace.js concept v1',
        'parameters': {k: v for k, v in f.items() if k not in ('info', 'name', 'name_en', 'temporal')},
        'output_path': 'runtime Three.js /1907/; no baked geometry',
        'license_status': 'Project-authored geometry; source-map attribution in src-0029; no external meshes or image textures copied',
        'evidence_urls': [s['url'] for s in f['info']['sources']],
        'uncertainty': {'position': f.get('position_status', 'approximate_map_reading'),
                        'plan': 'documented architectural type; dimensions and subsidiary structures estimated',
                        'height': 'visualization estimate', 'appearance': 'simplified, not a measured reconstruction'}
    }
    (out / (f['id'] + '.json')).write_text(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print(f'{len(features)} manifests written')
