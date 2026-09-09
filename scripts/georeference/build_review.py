"""Build an offline image-pair review page from the local asset catalog."""
import argparse
import csv
import json
import os
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('gis/georeferenced/review/index.html'))
    args = parser.parse_args()
    with Path('data/catalog/sources.csv').open() as f:
        sources = {s['id']: s for s in csv.DictReader(f)}
    with Path('data/catalog/assets.csv').open() as f:
        assets = list(csv.DictReader(f))
    images = [dict(id=a['id'], title=sources[a['source_id']]['title'],
                   url=os.path.relpath(a['local_path'], args.output.parent), sha256=a['sha256'])
              for a in assets if a['media_type'] == 'image/jpeg' and Path(a['local_path']).is_file()]
    template = Path(__file__).with_name('review_template.html').read_text()
    encoded = json.dumps(images, ensure_ascii=False).replace('<', '\\u003c')
    packet = json.loads(Path('gis/control_points/1908_1912_comparison_cases.json').read_text())
    cases = json.dumps(packet['cases'], ensure_ascii=False).replace('<', '\\u003c')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(template.replace('__ASSETS_JSON__', encoded).replace('__CASES_JSON__', cases))
    print(args.output.resolve())


if __name__ == '__main__':
    main()
