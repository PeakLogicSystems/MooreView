#!/usr/bin/env bash
# Build mooreview-cloud tar.gz for Debian cloud install (SBC + bare metal / droplet).
# Run from est-pc or mooreview-cloud. Requires bash, tar, rsync.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EST_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CLOUD_ROOT="${MOOREVIEW_CLOUD_ROOT:-$(cd "$EST_ROOT/../mooreview-cloud" 2>/dev/null && pwd || true)}"
OUTPUT_DIR="${MOOREVIEW_BUNDLE_DIR:-$EST_ROOT/dist}"
SKIP_SYNC=0
BUNDLE_NAME=""

usage() {
  cat <<'EOF'
Usage: create-bundle.sh [options]

  --cloud-root PATH   mooreview-cloud directory (default: ../mooreview-cloud)
  --output-dir PATH   output directory (default: est-pc/dist)
  --name NAME         archive filename (default: mooreview-cloud-YYYYMMDD.tgz)
  --skip-sync         do not run sync-runtime-to-cloud.ps1 / manual sync first
  -h, --help          show this help

Creates a gzip tarball suitable for:
  - Debian SBC (arm64, e.g. Raspberry Pi 64-bit)
  - DigitalOcean bare metal or droplets (amd64)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cloud-root) CLOUD_ROOT="$2"; shift 2 ;;
    --output-dir) OUTPUT_DIR="$2"; shift 2 ;;
    --name) BUNDLE_NAME="$2"; shift 2 ;;
    --skip-sync) SKIP_SYNC=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "${CLOUD_ROOT:-}" || ! -d "$CLOUD_ROOT" ]]; then
  echo "mooreview-cloud not found. Set MOOREVIEW_CLOUD_ROOT or run from est-pc tree." >&2
  exit 1
fi

if [[ "$SKIP_SYNC" -eq 0 ]]; then
  SYNC_PS1="$EST_ROOT/scripts/sync-runtime-to-cloud.ps1"
  if [[ -f "$SYNC_PS1" ]] && command -v pwsh >/dev/null 2>&1; then
    echo "[bundle] Syncing est-pc → mooreview-cloud (pwsh)…"
    pwsh -File "$SYNC_PS1" -CloudRoot "$CLOUD_ROOT"
  elif [[ -f "$SYNC_PS1" ]] && command -v powershell >/dev/null 2>&1; then
    echo "[bundle] Syncing est-pc → mooreview-cloud (powershell)…"
    powershell -File "$SYNC_PS1" -CloudRoot "$CLOUD_ROOT"
  else
    echo "[bundle] Skip sync: run sync-runtime-to-cloud.ps1 on dev machine first" >&2
  fi
fi

for req in server.js package.json deploy/cloud/debian/install.sh; do
  if [[ ! -f "$CLOUD_ROOT/$req" ]]; then
    echo "Missing $req in $CLOUD_ROOT" >&2
    exit 1
  fi
done

EXCLUDE_FILE="$SCRIPT_DIR/rsync-exclude.txt"
INSTALL_TXT="$SCRIPT_DIR/INSTALL.txt"
STAMP="$(date +%Y%m%d)"
BUNDLE_NAME="${BUNDLE_NAME:-mooreview-cloud-$STAMP.tgz}"
[[ "$BUNDLE_NAME" == *.tgz || "$BUNDLE_NAME" == *.tar.gz ]] || BUNDLE_NAME="${BUNDLE_NAME}.tgz"

mkdir -p "$OUTPUT_DIR"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
STAGE_APP="$STAGE/mooreview-cloud"
mkdir -p "$STAGE_APP"

echo "[bundle] Staging from $CLOUD_ROOT …"
rsync -a --delete \
  --exclude-from="$EXCLUDE_FILE" \
  "$CLOUD_ROOT/" "$STAGE_APP/"

if [[ -f "$INSTALL_TXT" ]]; then
  cp "$INSTALL_TXT" "$STAGE_APP/INSTALL.txt"
fi

# Shell scripts must use LF (CRLF breaks bash)
find "$STAGE_APP" -type f \( -name '*.sh' -o -name '*.service' -o -name '.env*' \) -print0 \
  | xargs -0 sed -i 's/\r$//'

ARCHIVE="$OUTPUT_DIR/$BUNDLE_NAME"
rm -f "$ARCHIVE"

echo "[bundle] Creating $ARCHIVE …"
tar -czf "$ARCHIVE" -C "$STAGE" mooreview-cloud

MANIFEST="${ARCHIVE%.tgz}.txt"
MANIFEST="${MANIFEST%.tar.gz}.txt"
{
  echo "MooreVIEW cloud install bundle"
  echo "Built: $(date -Iseconds)"
  echo "Target: Debian 11/12 (amd64, arm64)"
  echo "Extract: tar xzf $BUNDLE_NAME -C /home/mooreview --strip-components=1"
  echo "Install: MOOREVIEW_SOURCE=/home/mooreview MOOREVIEW_INSTALL_DIR=/home/mooreview bash /home/mooreview/deploy/cloud/debian/install.sh"
} > "$MANIFEST"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
echo ""
echo "Bundle ready: $ARCHIVE ($SIZE)"
echo "Manifest:     $MANIFEST"
echo ""
echo "On target host:"
echo "  scp $ARCHIVE root@<host>:/tmp/"
echo "  ssh root@<host> 'mkdir -p /home/mooreview && tar xzf /tmp/$BUNDLE_NAME -C /home/mooreview --strip-components=1'"
echo "  ssh root@<host> 'MOOREVIEW_SOURCE=/home/mooreview MOOREVIEW_INSTALL_DIR=/home/mooreview bash /home/mooreview/deploy/cloud/debian/install.sh'"
