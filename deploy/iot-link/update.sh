#!/usr/bin/env bash
# In-place MooreVIEW update on Compulab IOT-LINK — preserves /var/lib/mooreview data and /etc/mooreview/env.
# Prefer GitHub pull (no WinSCP): sudo bash deploy/update-from-github.sh
# Legacy bundle extract + this script still works:
#   tar xzf mooreview-iot-link-*.tgz --overwrite -C /opt/mooreview --strip-components=1
#   bash /opt/mooreview/deploy/iot-link/update.shif grep -q $'\r' "$0" 2>/dev/null; then
  sed -i 's/\r$//' "$0"
  exec bash "$0" "$@"
fi
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${MOOREVIEW_INSTALL_DIR:-/opt/mooreview}"
ENV_FILE="${MOOREVIEW_ENV_FILE:-/etc/mooreview/env}"
SERVICE_USER="${MOOREVIEW_USER:-mooreview}"

log() { printf '[iot-link-update] %s\n' "$*"; }
die() { printf '[iot-link-update] ERROR: %s\n' "$*" >&2; exit 1; }

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

[[ -f "$INSTALL_DIR/package.json" ]] || die "MooreVIEW not found at $INSTALL_DIR"

SERVICE=""
for unit in mooreview-iot-link-generic mooreview-iot-link mooreview; do
  if systemctl list-unit-files "${unit}.service" 2>/dev/null | grep -qE '^[^ ]+.*enabled'; then
    SERVICE="$unit"
    break
  fi
done
if [[ -z "$SERVICE" ]] && systemctl cat mooreview-iot-link-generic.service &>/dev/null; then
  SERVICE="mooreview-iot-link-generic"
elif [[ -z "$SERVICE" ]] && systemctl cat mooreview-iot-link.service &>/dev/null; then
  SERVICE="mooreview-iot-link"
fi

if [[ -n "$SERVICE" ]]; then
  log "Stopping $SERVICE…"
  systemctl stop "$SERVICE" || true
fi

log "Installing npm dependencies in $INSTALL_DIR…"
cd "$INSTALL_DIR"
strip_crlf "$SCRIPT_DIR/update.sh"
strip_crlf "$SCRIPT_DIR/install.sh" 2>/dev/null || true
strip_crlf "$SCRIPT_DIR/install-generic.sh" 2>/dev/null || true
find "$INSTALL_DIR/deploy/iot-link" -maxdepth 1 -name '*.sh' -exec grep -l $'\r' {} \; 2>/dev/null | while read -r f; do strip_crlf "$f"; done
sudo -u "$SERVICE_USER" env HOME="/var/lib/$SERVICE_USER" npm ci --omit=dev

strip_crlf "$INSTALL_DIR/scripts/modbus-probe.js" 2>/dev/null || true

usermod -aG dialout "$SERVICE_USER" 2>/dev/null || true

if [[ -n "$SERVICE" ]]; then
  log "Starting $SERVICE…"
  systemctl daemon-reload
  systemctl start "$SERVICE"
  sleep 2
  if systemctl is-active --quiet "$SERVICE"; then
    log "Service active: $SERVICE"
  else
    log "Warning: $SERVICE not active — check journalctl -u $SERVICE"
  fi
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
log "Done. Studio: http://${IP:-127.0.0.1}:3090"
log "Probe:  node $INSTALL_DIR/scripts/modbus-probe.js --serial /dev/ttyLP6 --slave 1"
log "Env:    $ENV_FILE (unchanged)"
