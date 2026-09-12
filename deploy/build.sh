#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
version=${1:-$(cat deploy/DOCKER_VERSION)}
[[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Usage: bash deploy/build.sh vX.Y.Z' >&2; exit 1; }
[[ "$version" == "$(cat deploy/DOCKER_VERSION)" ]] || { echo 'Update deploy/DOCKER_VERSION first.' >&2; exit 1; }
image="honestjung/hanyang3d:$version"
python_bin=${PYTHON:-.venv/bin/python}
[[ -x "$python_bin" ]] || python_bin=python3
"$python_bin" deploy/pack_data.py "$version"
revision=$(git rev-parse --short HEAD)
if [[ -n "$(git status --porcelain)" ]]; then revision="$revision-dirty"; fi
docker build --platform linux/amd64 -f deploy/Dockerfile \
    --build-arg "APP_VERSION=$version" --build-arg "VCS_REF=$revision" -t "$image" .
"$python_bin" deploy/smoke_image.py "$image" ".build/runtime-$version"
docker save "$image" | gzip > "dist/hanyang3d-image-$version.tar.gz"
tar -czf "dist/hanyang3d-host-$version.tar.gz" -C deploy/host .
(
    cd dist
    sha256sum "hanyang3d-image-$version.tar.gz" "hanyang3d-data-$version.tar.gz" "hanyang3d-host-$version.tar.gz" > "SHA256SUMS-$version"
)
docker image inspect "$image" --format 'Built {{.RepoTags}} {{.Id}} ({{.Size}} bytes)'
echo "Release files are in dist/. See deploy/README.md for dolfinid installation."
