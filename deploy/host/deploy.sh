#!/usr/bin/env bash
# Image + matching data directory must already be loaded on the host.
set -euo pipefail
cd "$(dirname "$0")"
version=${1:-}
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Usage: bash deploy.sh vX.Y.Z'; exit 1; }
[[ -f .env.django && -f "data/$version/manifest.json" ]] || { echo 'Prepare .env.django and matching data first.'; exit 1; }
docker image inspect "honestjung/hanyang3d:$version" >/dev/null
# Validate the exact immutable image/data pair before touching the running service.
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --mount "type=bind,src=$PWD/data/$version,dst=/runtime,readonly" \
    --entrypoint python "honestjung/hanyang3d:$version" -c \
    'import os; os.environ.setdefault("DJANGO_SETTINGS_MODULE","webapp.settings"); import django; django.setup(); from webapp.deployment import runtime_report; r=runtime_report(True); print(r); raise SystemExit(r["status"] != "ok")'
next_env=$(mktemp .env.next.XXXXXX)
trap 'rm -f "$next_env"' EXIT
printf 'IMAGE_TAG=%s\nDATA_VERSION=%s\nHOST_PORT=%s\n' "$version" "$version" "${HOST_PORT:-8013}" > "$next_env"
docker compose --env-file "$next_env" config --quiet
if [[ -f .env ]]; then cp .env .env.previous; fi
mv "$next_env" .env
if ! docker compose up -d --wait --wait-timeout 60; then
    docker compose logs --tail 50
    if [[ -f .env.previous ]]; then
        cp .env.previous .env
        docker compose up -d --wait --wait-timeout 60
    fi
    echo 'Deployment failed; inspect logs.' >&2
    exit 1
fi
docker compose exec -T hanyang3d python /app/deploy/healthcheck.py </dev/null
docker compose ps
echo "Deployed $version. Rollback uses the same command with the previous version."
