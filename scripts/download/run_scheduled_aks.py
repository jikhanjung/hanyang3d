"""One dated archive job; safe to invoke at boot, before its date, or after completion."""
import argparse
import fcntl
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
JOBS = {
    'objects': ('물품', '2026-09-20T09:00:00+09:00'),
    'food': ('음식', '2026-09-21T09:00:00+09:00'),
}
STATE = ROOT / 'data/models/aks-hanyang/scheduled-jobs'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('category', choices=JOBS)
    parser.add_argument('--check', action='store_true', help='Inspect schedule only; no downloads or writes')
    args = parser.parse_args()
    category, date = JOBS[args.category]
    due = datetime.fromisoformat(date)
    now = datetime.now(ZoneInfo('Asia/Seoul'))
    status_path = STATE / (args.category + '.json')
    if args.check:
        print(json.dumps({'category': category, 'scheduled_at': date, 'due': now >= due,
                          'state': json.loads(status_path.read_text()) if status_path.exists() else None}, ensure_ascii=False))
        return
    if now < due:
        print(f'Not due: {category} at {date}', flush=True)
        return
    STATE.mkdir(parents=True, exist_ok=True)
    with (STATE / '.pipeline.lock').open('w') as lock:
        # If both dates were missed while powered off, requests still run one job at a time.
        fcntl.flock(lock, fcntl.LOCK_EX)
        state = json.loads(status_path.read_text()) if status_path.exists() else {}
        if state.get('completed_at'):
            print(f'Already completed: {category}', flush=True)
            return

        def save():
            tmp = status_path.with_suffix('.json.tmp')
            tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
            tmp.replace(status_path)

        state.update(category=category, scheduled_at=date, status='running', last_started_at=now.isoformat())
        save()
        try:
            with (STATE / (args.category + '.log')).open('a', buffering=1) as log:
                log.write(f'\nSTART {now.isoformat()} {category}\n')
                if not state.get('download_finished'):
                    result = subprocess.run([sys.executable, str(ROOT / 'scripts/download/fetch_aks_costumes.py'),
                                             '--category', args.category, '--download', '--pause', '3'],
                                            cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
                    data = json.loads((ROOT / 'docs/aks_objects_manifest.json').read_text())
                    models = [m for m in data['models'] if category in m['categories']]
                    if result.returncode not in (0, 1) or any(m['status'] not in ('verified', 'failed') for m in models):
                        raise RuntimeError(f'Download interrupted; see {args.category}.log')
                    state.update(download_finished=True, verified=sum(m['status'] == 'verified' for m in models),
                                 failed=sum(m['status'] == 'failed' for m in models))
                    save()
                subprocess.run([sys.executable, str(ROOT / 'scripts/download/backup_aks_archive.py')],
                               cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=True)
            state.update(status='complete_with_failures' if state['failed'] else 'complete',
                         completed_at=datetime.now(ZoneInfo('Asia/Seoul')).isoformat(), nas_verified=True)
            state.pop('error', None)
            save()
            print(json.dumps(state, ensure_ascii=False), flush=True)
        except Exception as error:
            state.update(status='interrupted', error=str(error))
            save()
            raise


if __name__ == '__main__':
    main()
