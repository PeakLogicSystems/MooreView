#!/usr/bin/env bash
# MooreVIEW IOT-LINK pool appliance bootstrap (Debian on Compulab IOT-LINK arm64).
# Run as root:
#   export MOOREVIEW_SOURCE=/opt/mooreview MOOREVIEW_INSTALL_DIR=/opt/mooreview
#   bash deploy/iot-link/install.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEBIAN_INSTALL="$REPO_ROOT/deploy/cloud/debian/install.sh"

INSTALL_DIR="${MOOREVIEW_INSTALL_DIR:-/opt/mooreview}"
SOURCE_DIR="${MOOREVIEW_SOURCE:-$REPO_ROOT}"
ENV_FILE="${MOOREVIEW_ENV_FILE:-/etc/mooreview/env}"
SERVICE_USER="${MOOREVIEW_USER:-mooreview}"
IOT_LINK_ENV_EXAMPLE="${MOOREVIEW_IOT_LINK_ENV_EXAMPLE:-$SCRIPT_DIR/.env.example}"

log() { printf '[iot-link-install] %s\n' "$*"; }
die() { printf '[iot-link-install] ERROR: %s\n' "$*" >&2; exit 1; }

strip_crlf() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  if grep -q $'\r' "$f" 2>/dev/null; then
    log "Normalizing CRLF in $f"
    sed -i 's/\r$//' "$f"
  fi
}

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "Run as root: sudo bash $0"
fi

[[ -f "$DEBIAN_INSTALL" ]] || die "Missing $DEBIAN_INSTALL"
[[ -f "$SOURCE_DIR/package.json" ]] || die "MooreVIEW source not found at $SOURCE_DIR"

strip_crlf "$SCRIPT_DIR/install.sh"
strip_crlf "$SCRIPT_DIR/seed-pool-config.js"
strip_crlf "$IOT_LINK_ENV_EXAMPLE"

install -d -m 0750 -o root -g "$SERVICE_USER" /etc/mooreview
if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating $ENV_FILE from IOT-LINK template"
  install -m 0640 -o root -g "$SERVICE_USER" "$IOT_LINK_ENV_EXAMPLE" "$ENV_FILE"
else
  log "Keeping existing $ENV_FILE"
fi
strip_crlf "$ENV_FILE"

log "Running Debian base install (Node, MongoDB, Mosquitto, npm ci)…"
MOOREVIEW_SOURCE="$SOURCE_DIR" \
MOOREVIEW_INSTALL_DIR="$INSTALL_DIR" \
MOOREVIEW_ENV_FILE="$ENV_FILE" \
MOOREVIEW_DATA_DIR="${MOOREVIEW_DATA_DIR:-/var/lib/mooreview}" \
bash "$DEBIAN_INSTALL"

log "Granting serial port access to $SERVICE_USER"
usermod -aG dialout "$SERVICE_USER" 2>/dev/null || true

UNIT_SRC="$SCRIPT_DIR/mooreview-iot-link.service"
if grep -qE '^[[:space:]]*MOOREVIEW_PRODUCT=res-pool-link' "$ENV_FILE" 2>/dev/null; then
  UNIT_SRC="$SCRIPT_DIR/mooreview-res-pool-link.service"
  log "Product res-pool-link — using $(basename "$UNIT_SRC")"
fi
log "Installing mooreview-iot-link.service"
strip_crlf "$UNIT_SRC"
sed "s|@MOOREVIEW_INSTALL_DIR@|${INSTALL_DIR}|g" "$UNIT_SRC" \
  > /etc/systemd/system/mooreview-iot-link.service
chmod 0644 /etc/systemd/system/mooreview-iot-link.service

systemctl disable mooreview.service 2>/dev/null || true
systemctl stop mooreview.service 2>/dev/null || true
systemctl daemon-reload
systemctl enable mooreview-iot-link.service

log "Seeding pool controller config…"
if [[ -f "$INSTALL_DIR/deploy/iot-link/seed-pool-config.js" ]]; then
  sudo -u "$SERVICE_USER" bash -lc "cd '$INSTALL_DIR' && node deploy/iot-link/seed-pool-config.js"
else
  log "Warning: seed-pool-config.js missing — configure drivers manually"
fi

systemctl restart mooreview-iot-link.service

log "Done."
log "  Health: curl -s http://127.0.0.1:3090/health"
log "  HMI:    http://$(hostname -I 2>/dev/null | awk '{print $1}'):3090"
log "  Logs:   journalctl -u mooreview-iot-link -f"
log "  Env:    $ENV_FILE"
log "  Docs:   $INSTALL_DIR/deploy/iot-link/README.md"
