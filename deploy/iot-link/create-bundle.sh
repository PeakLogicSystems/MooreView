#!/usr/bin/env bash
# Create mooreview-iot-link-pool.tgz for transfer to Compulab IOT-LINK.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DIST_DIR="$REPO_ROOT/dist"
STAMP="$(date +%Y%m%d)"
ARCHIVE="$DIST_DIR/mooreview-iot-link-pool-${STAMP}.tgz"

mkdir -p "$DIST_DIR"
tar czf "$ARCHIVE" \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=data \
  --exclude=products \
  --exclude=azure \
  --exclude=dist \
  --exclude=deploy/windows \
  -C "$REPO_ROOT" .

echo "Created $ARCHIVE"
echo "Transfer: scp $ARCHIVE root@<iot-link-ip>:/tmp/"
echo "Update:   tar xzf /tmp/$(basename "$ARCHIVE") --overwrite -C /opt/mooreview --strip-components=1"
echo "          bash /opt/mooreview/deploy/iot-link/install.sh"
