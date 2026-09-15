#!/usr/bin/env python3
"""Verified SQLite snapshots, following fsis2026's backup integrity/egress gates.

Stdlib only: host cron can read the live DB through SQLite's online backup API.
No host Django writer, no pruning without a verified new snapshot.
"""
import argparse
from contextlib import closing
from datetime import datetime, timezone
import fcntl
import os
from pathlib import Path
import re
import shutil
import sqlite3
import tempfile

FAILURE_SENTINEL = 'CONTENT_BACKUP_FAILED'
HOURLY_KEEP = 24
PRE_DEPLOY_KEEP = 10
PRE_DEPLOY_NAME = r'content_v\d+\.\d+\.\d+_\d{8}_\d{6}\.sqlite3'
MIN_FREE_BYTES = 5 * 1024 ** 3


class BackupIntegrityError(ValueError):
    pass


def verify(connection):
    if connection.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
        raise BackupIntegrityError('Snapshot integrity check failed')
    if connection.execute('PRAGMA foreign_key_check').fetchone():
        raise BackupIntegrityError('Snapshot foreign key check failed')


def backup_database(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_file() or destination.exists():
        raise ValueError('Source DB must exist and destination must be new')
    fd, temporary = tempfile.mkstemp(prefix='.content-backup-', dir=destination.parent)
    os.close(fd)
    try:
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as src:
            with closing(sqlite3.connect(temporary)) as dst:
                src.backup(dst)
                # backup() copies WAL mode too. Finish as a standalone DELETE-mode file.
                dst.execute('PRAGMA journal_mode=DELETE')
                verify(dst)
                if dst.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='django_session'").fetchone():
                    dst.execute('DELETE FROM django_session')
                dst.commit()
                dst.execute('VACUUM')  # also erases remnants of already expired sessions
                verify(dst)
        with open(temporary, 'rb') as file:
            os.fsync(file.fileno())
        os.link(temporary, destination)  # atomic adoption; never overwrite another snapshot
    except (BackupIntegrityError, sqlite3.DatabaseError):
        evidence = destination.parent / 'content_INTEGRITY_FAIL.corrupt'
        if Path(temporary).exists() and not evidence.exists():
            os.link(temporary, evidence)  # private evidence, excluded from rotation/offsite
        raise
    finally:
        Path(temporary).unlink(missing_ok=True)
        for suffix in ('-wal', '-shm', '-journal'):
            Path(temporary + suffix).unlink(missing_ok=True)


def snapshot_before_deploy(source, destination, keep=PRE_DEPLOY_KEEP):
    """Create one verified pre-deploy snapshot, then keep only the newest `keep` pre-deploy snapshots.

    Older ones are removed only after the new snapshot has been adopted, and only files named like deploy.sh's
    snapshots (content_vX.Y.Z_YYYYmmdd_HHMMSS.sqlite3) in the same directory.
    """
    if keep < 1:
        raise ValueError('At least one pre-deploy snapshot must be kept')
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup_database(source, destination)
    snapshots = sorted((p for p in destination.parent.iterdir() if re.fullmatch(PRE_DEPLOY_NAME, p.name)),
                       key=lambda p: (p.stat().st_mtime, p.name), reverse=True)
    for old in snapshots[keep:]:
        old.unlink(missing_ok=True)
    return destination


def run_backup(source, directory, keep=HOURLY_KEEP, min_free_bytes=MIN_FREE_BYTES):
    source, directory = Path(source).resolve(), Path(directory).resolve()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    sentinel = source.parent / FAILURE_SENTINEL
    lockfd = os.open(directory / '.backup.lock', os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(lockfd, 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            if keep < HOURLY_KEEP:
                raise ValueError('Hourly retention must cover at least the 24-hour offsite interval')
            if not source.is_file():
                raise ValueError('Source database does not exist')
            if shutil.disk_usage(directory).free < max(min_free_bytes, source.stat().st_size * 3):
                raise OSError('Insufficient free disk space for backup')
            stamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S_%f')
            destination = directory / f'content_{stamp}.sqlite3'
            backup_database(source, destination)
            sentinel.unlink(missing_ok=True)
            snapshots = sorted((p for p in directory.iterdir() if re.fullmatch(r'content_\d{8}_\d{6}_\d{6}\.sqlite3', p.name)), reverse=True)
            # Only our own snapshots, and only after successful adoption.
            retained, hours = set(), set()
            for snapshot in snapshots:
                hour = snapshot.name[8:19]
                if hour not in hours and len(hours) < keep:
                    retained.add(snapshot)
                    hours.add(hour)
            for old in (p for p in snapshots if p not in retained):
                for path in [old, *(Path(str(old) + suffix) for suffix in ('-wal', '-shm', '-journal'))]:
                    path.unlink(missing_ok=True)
            return destination
        except Exception:
            # This flag reports backup failure, not an assertion of live DB corruption.
            if source.parent.is_dir():
                fd = os.open(sentinel, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
                with os.fdopen(fd, 'w') as out:
                    out.write(datetime.now(timezone.utc).isoformat() + ' backup failed; prior snapshots retained\n')
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', default='/srv/hanyang3d/content/content.sqlite3')
    parser.add_argument('--directory', default='/srv/hanyang3d/backups/content/hourly')
    parser.add_argument('--keep', type=int, default=HOURLY_KEEP)
    parser.add_argument('--snapshot', help='Create one pre-deploy snapshot at a new path, keeping the newest --keep-snapshots')
    parser.add_argument('--keep-snapshots', type=int, default=PRE_DEPLOY_KEEP)
    args = parser.parse_args()
    try:
        if args.snapshot:
            path = snapshot_before_deploy(args.database, args.snapshot, args.keep_snapshots)
        else:
            path = run_backup(args.database, args.directory, args.keep)
    except Exception as exc:
        parser.exit(1, f'Backup failed; previous snapshots retained: {exc}\n')
    print('Verified snapshot:', path, flush=True)


if __name__ == '__main__':
    main()
