#!/usr/bin/env bash
# Immutable image/data prepared by the build host. DB writers run only in containers.
set -euo pipefail
cd "$(dirname "$0")"
version=${1:-}
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Usage: bash deploy.sh vX.Y.Z [multiplayer-version]'; exit 1; }
[[ -f .env.django && -f "data/$version/manifest.json" ]] || { echo 'Prepare settings and data first.'; exit 1; }
mp_version=${2:-$(sed -n 's/^MULTIPLAYER_IMAGE_TAG=//p' .env 2>/dev/null || true)}
mp_version=${mp_version:-$version}
[[ "$mp_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 1
docker image inspect "honestjung/hanyang3d:$version" >/dev/null
multiplayer=$(docker image inspect "honestjung/hanyang3d:$version" --format '{{index .Config.Labels "info.nopeoplestime.hanyang3d.multiplayer"}}')
if [[ "$multiplayer" == 1 ]]; then
    docker image inspect "honestjung/hanyang3d-multiplayer:$mp_version" >/dev/null
fi
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --mount "type=bind,src=$PWD/data/$version,dst=/runtime,readonly" \
    --entrypoint python "honestjung/hanyang3d:$version" -c \
    'import os; os.environ.setdefault("DJANGO_SETTINGS_MODULE","webapp.settings"); import django; django.setup(); from webapp.deployment import runtime_report; r=runtime_report(True, check_content=False); print(r); raise SystemExit(r["status"] != "ok")'
next_env=$(mktemp .env.next.XXXXXX)
trap 'rm -f "$next_env"' EXIT
python3 update_release_env.py .env "$next_env" "$version" "$multiplayer" "$mp_version"
docker compose --env-file "$next_env" config --quiet
if [[ -f .env ]]; then cp -p .env .env.previous; fi
# The opt-in override is persistent operator configuration.
db_mode=0
if grep -q 'docker-compose.content.yml' "$next_env"; then db_mode=1; fi
recover() {
    code=$?
    trap - ERR
    if [[ -f .env.previous ]]; then cp -p .env.previous .env; fi
    docker compose up -d --wait --wait-timeout 90 || true
    if ! docker compose config --services | grep -qx multiplayer; then
        docker compose --profile multiplayer stop multiplayer || true
    fi
    echo 'Deployment failed; previous configuration restored. DB is retained; inspect the pre-deploy backup before any DB restore.' >&2
    exit "$code"
}
trap recover ERR
if [[ "$db_mode" == 1 ]]; then
    docker compose stop hanyang3d
    if [[ -f content/content.sqlite3 ]]; then
        sudo -n python3 backup_content.py --database "$PWD/content/content.sqlite3" \
            --snapshot "$PWD/backups/content/pre-deploy/content_${version}_$(date -u +%Y%m%d_%H%M%S).sqlite3"
    fi
fi
mv "$next_env" .env
if [[ "$db_mode" == 1 ]]; then
    docker compose run --rm --no-deps --entrypoint python hanyang3d manage.py migrate --noinput
    docker compose run --rm --no-deps --entrypoint python hanyang3d manage.py import_content
fi
# Unchanged multiplayer image/config stays running when Compose reconciles the stack.
docker compose up -d --wait --wait-timeout 90
docker compose exec -T hanyang3d python /app/deploy/healthcheck.py </dev/null
if docker compose config --services | grep -qx multiplayer; then
    docker compose exec -T multiplayer node healthcheck.js </dev/null
else
    docker compose --profile multiplayer stop multiplayer
fi
trap - ERR
docker compose ps
echo "Deployed web $version; multiplayer $mp_version."
