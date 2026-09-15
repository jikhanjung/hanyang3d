"""Update release keys while preserving unrelated configuration verbatim."""
from pathlib import Path
import re
import sys


def update(contents, version, multiplayer):
    if not re.fullmatch(r'v\d+\.\d+\.\d+', version):
        raise ValueError('Invalid release version')
    lines = contents.splitlines(keepends=True)
    profiles = []
    for line in lines:
        match = re.match(r'\s*(?:export\s+)?COMPOSE_PROFILES\s*=\s*([^#\n]*)', line)
        if match:
            profiles = [p.strip() for p in match[1].strip().strip('\"\'').split(',') if p.strip() and p.strip() != 'multiplayer']
    if multiplayer:
        profiles.append('multiplayer')
    replacements = {'IMAGE_TAG': version, 'DATA_VERSION': version, 'COMPOSE_PROFILES': ','.join(profiles)}
    output, seen = [], set()
    for line in lines:
        match = re.match(r'\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=', line)
        key = match[1] if match else None
        if key in replacements:
            if key not in seen:
                output.append(f'{key}={replacements[key]}\n')
                seen.add(key)
        else:
            output.append(line)
    if output and not output[-1].endswith('\n'):
        output[-1] += '\n'
    output.extend(f'{key}={value}\n' for key, value in replacements.items() if key not in seen)
    return ''.join(output)


if __name__ == '__main__':
    source, destination, version, multiplayer = sys.argv[1:]
    path = Path(source)
    Path(destination).write_text(update(path.read_text() if path.exists() else '', version, multiplayer == '1'))
