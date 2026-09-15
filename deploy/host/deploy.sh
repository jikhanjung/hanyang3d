#!/usr/bin/env bash
# Image + matching data directory must already be loaded on the host.
set -euo pipefail
cd "$(dirname "$0")"
version=${1:-}
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Usage: bash deploy.sh vX.Y.Z'; exit 1; }
[[ -f .env.django && -f "data/$version/manifest.json" ]] || { echo 'Prepare .env.django and matching data first.'; exit 1; }
docker image inspect "honestjung/hanyang3d:$version" >/dev/null
multiplayer=$(docker image inspect "honestjung/hanyang3d:$version" --format '{{index .Config.Labels "info.nopeoplestime.hanyang3d.multiplayer"}}')
if [[ "$multiplayer" == 1 ]]; then
    docker image inspect "honestjung/hanyang3d-multiplayer:$version" >/dev/null
    docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
        "honestjung/hanyang3d-multiplayer:$version" node room.test.js
fi
# Validate the exact immutable image/data pair before touching the running service.
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --mount "type=bind,src=$PWD/data/$version,dst=/runtime,readonly" \
    --entrypoint python "honestjung/hanyang3d:$version" -c \
    'import os; os.environ.setdefault("DJANGO_SETTINGS_MODULE","webapp.settings"); import django; django.setup(); from webapp.deployment import runtime_report; r=runtime_report(True); print(r); raise SystemExit(r["status"] != "ok")'
next_env=$(mktemp .env.next.XXXXXX)
trap 'rm -f "$next_env"' EXIT
python3 update_release_env.py .env "$next_env" "$version" "$multiplayer"
docker compose --env-file "$next_env" config --quiet
if [[ -f .env ]]; then cp .env .env.previous; fi
mv "$next_env" .env
apply_stack() {
    docker compose up -d --wait --wait-timeout 90 || return 1
    docker compose exec -T hanyang3d python /app/deploy/healthcheck.py </dev/null || return 1
    if docker compose config --services | grep -qx multiplayer; then
        docker compose exec -T multiplayer node healthcheck.js </dev/null || return 1
    else
        # Releases before v0.2.0 have no multiplayer image. Stop the new service
        # explicitly when rolling back to one of those releases.
        docker compose --profile multiplayer stop multiplayer || return 1
    fi
}
if ! apply_stack; then
    docker compose logs --tail 50
    if [[ -f .env.previous ]]; then
        cp .env.previous .env
        apply_stack
    fi
    echo 'Deployment failed; inspect logs.' >&2
    exit 1
fi
docker compose ps
echo "Deployed $version. Rollback uses the same command with the previous version."
