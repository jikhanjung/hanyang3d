#!/bin/sh
set -eu
python manage.py check
if [ "${HANYANG_CONTENT_SOURCE:-files}" = database ]; then
    # Schema changes are an explicit, backed-up deployment step, never a worker startup write.
    python manage.py migrate --check
fi
# A failed hourly backup reports "degraded": serve and warn (like the Docker health check) rather than refuse to start,
# otherwise a backup problem becomes an outage. Missing resources or broken checks ("unhealthy") still stop the start.
python -c 'import os; os.environ.setdefault("DJANGO_SETTINGS_MODULE", "webapp.settings"); import django; django.setup(); from webapp.deployment import runtime_report; r=runtime_report(verify_hashes=True); print(r); raise SystemExit(0 if r["status"] in ("ok", "degraded") else 1)'
exec gunicorn webapp.wsgi:application --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-2}" --worker-class gthread --threads "${GUNICORN_THREADS:-4}" \
    --timeout 60 --max-requests 1000 --max-requests-jitter 100 \
    --worker-tmp-dir /tmp --access-logfile - --error-logfile -
