#!/usr/bin/env bash
# Data-only updates: run DB writes in the web container, preserving image tags and operator settings.
set -euo pipefail
cd "$(dirname "$0")"
bundle=${1:?Usage: bash update_data.sh /path/to/reviewed-bundle.json}
[[ -f "$bundle" ]] || { echo 'Bundle not found'; exit 1; }
docker compose exec -T hanyang3d python manage.py apply_scene_data - < "$bundle"
# Online SQLite snapshot is validated by the same backup implementation as releases.
sudo -n python3 backup_content.py --database "$PWD/content/content.sqlite3" \
 --snapshot "$PWD/backups/content/pre-deploy/data_$(date -u +%Y%m%d_%H%M%S).sqlite3"
report=$(docker compose exec -T hanyang3d python manage.py apply_scene_data - --apply < "$bundle")
printf '%s\n' "$report"
if printf '%s' "$report" | python3 -c 'import json,sys;sys.exit(not json.load(sys.stdin)["multiplayer_restart_required"])'; then
 docker compose restart multiplayer
 docker compose up -d --wait --wait-timeout 90
fi
docker compose exec -T hanyang3d python /app/deploy/healthcheck.py --deploy </dev/null
echo 'Data applied. Reload the map. Image tags and operator settings were not changed.'
