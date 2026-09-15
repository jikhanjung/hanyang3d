#!/usr/bin/env python3
"""Stream a fresh, verified hourly snapshot and this service's config to SSH stdout."""
from contextlib import closing
import fcntl
import io
import json
from pathlib import Path
import re
import sqlite3
import sys
import tarfile
import time

ROOT = Path('/srv/hanyang3d')
DIRECTORY = ROOT / 'backups/content/hourly'


def main():
    with (DIRECTORY / '.backup.lock').open('rb') as lock:
        fcntl.flock(lock, fcntl.LOCK_SH)
        paths = sorted(p for p in DIRECTORY.iterdir() if re.fullmatch(r'content_\d{8}_\d{6}_\d{6}\.sqlite3', p.name))
        if not paths: raise RuntimeError('No verified hourly snapshot')
        snapshot = paths[-1]
        age = time.time() - snapshot.stat().st_mtime
        if not 0 <= age <= 3 * 3600: raise RuntimeError('Hourly snapshot is stale or timestamp is in the future')
        with closing(sqlite3.connect(snapshot.as_uri() + '?mode=ro&immutable=1', uri=True)) as db:
            if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]: raise RuntimeError('Snapshot integrity failed')
            if db.execute('PRAGMA foreign_key_check').fetchone(): raise RuntimeError('Snapshot foreign keys failed')
            if db.execute('SELECT COUNT(*) FROM django_session').fetchone()[0]: raise RuntimeError('Snapshot contains sessions')
            if db.execute('SELECT COUNT(*) FROM webapp_building').fetchone()[0] == 0: raise RuntimeError('Snapshot contains no buildings')
        metadata = json.dumps({'snapshot': snapshot.name, 'created_at': snapshot.stat().st_mtime}).encode()
        with tarfile.open(fileobj=sys.stdout.buffer, mode='w|gz') as archive:
            archive.add(snapshot, arcname='content.sqlite3')
            for name in ('.env', '.env.django', 'docker-compose.yml', 'docker-compose.content.yml'):
                archive.add(ROOT / name, arcname='configuration/' + name)
            info = tarfile.TarInfo('snapshot.json'); info.size = len(metadata); info.mode = 0o600
            archive.addfile(info, io.BytesIO(metadata))


if __name__ == '__main__': main()
