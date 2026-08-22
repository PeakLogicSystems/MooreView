#!/usr/bin/env bash
# LEGACY: Enable Mosquitto on the SaaS droplet (colocated with :3100).
# Recommended production: dedicated MQTT droplet — install-mqtt-droplet.sh +
# configure-saas-mqtt-remote.sh (docs/CLOUD_DEPLOY_DO_PHASE1_ATL-MQTT.md).
#
# Enable Mosquitto MQTT on the SaaS droplet (cloud 1) for appliance / Opta uplink.
# SaaS on :3100 keeps running; no local Mongo or 3090 runtime required.
#
#   sudo MOOREVIEW_INSTALL_DIR=/home/mooreview bash deploy/cloud/debian/enable-saas-mqtt.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${MOOREVIEW_INSTALL_DIR:-/home/mooreview}"
MQTT_ENV="${MOOREVIEW_MQTT_ENV:-/etc/mooreview/mqtt.env}"
SAAS_ENV="${MOOREVIEW_SAAS_ENV:-/etc/mooreview/saas.env}"
SERVICE_USER="${MOOREVIEW_USER:-mooreview}"
DOMAIN="${MOOREVIEW_DOMAIN:-mooreview.io}"

log() { printf '[mooreview-mqtt] %s\n' "$*"; }
die() { printf '[mooreview-mqtt] ERROR: %s\n' "$*" >&2; exit 1; }

strip_crlf() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  if grep -q $'\r' "$f" 2>/dev/null; then
    sed -i 's/\r$//' "$f"
  fi
}

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  die "Run as root"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq mosquitto mosquitto-clients

install -d -m 0750 -o root -g "$SERVICE_USER" /etc/mooreview

ENV_TEMPLATE=""
for candidate in \
  "$INSTALL_DIR/deploy/cloud/phase1/droplet-saas/mqtt.env.template" \
  "$SCRIPT_DIR/../phase1/droplet-saas/mqtt.env.template"; do
  if [[ -f "$candidate" ]]; then
    ENV_TEMPLATE="$candidate"
    break
  fi
done

if [[ ! -f "$MQTT_ENV" ]]; then
  if [[ -n "$ENV_TEMPLATE" ]]; then
    log "Creating $MQTT_ENV from phase1 template"
    install -m 0640 -o root -g "$SERVICE_USER" "$ENV_TEMPLATE" "$MQTT_ENV"
  elif [[ -f "$SCRIPT_DIR/.env.debian.example" ]]; then
    log "Creating $MQTT_ENV from legacy debian example"
    install -m 0640 -o root -g "$SERVICE_USER" "$SCRIPT_DIR/.env.debian.example" "$MQTT_ENV"
  else
    die "No mqtt.env template found — create $MQTT_ENV manually"
  fi
fi
strip_crlf "$MQTT_ENV"

if grep -qE '^MOSQUITTO_PASS=CHANGE_ME' "$MQTT_ENV" 2>/dev/null; then
  die "Edit $MQTT_ENV — set MOSQUITTO_USER and MOSQUITTO_PASS before enabling MQTT"
fi

# shellcheck disable=SC1090
set -a
source "$MQTT_ENV"
set +a

MOSQUITTO_ALLOW_ANONYMOUS="${MOSQUITTO_ALLOW_ANONYMOUS:-false}"
MOSQUITTO_USER="${MOSQUITTO_USER:-mooreview}"
MOSQUITTO_PASS="${MOSQUITTO_PASS:-}"
MOSQUITTO_TLS="${MOSQUITTO_TLS:-true}"
MOSQUITTO_TLS_PORT="${MOSQUITTO_TLS_PORT:-8883}"
MOOREVIEW_DOMAIN="${MOOREVIEW_DOMAIN:-$DOMAIN}"

MOSQUITTO_CONFD="/etc/mosquitto/conf.d/mooreview.conf"
MOSQUITTO_MAIN="/etc/mosquitto/mosquitto.conf"

install -d -m 0755 -o mosquitto -g mosquitto /var/lib/mosquitto
install -d -m 0755 /etc/mosquitto/conf.d

if [[ -f "$MOSQUITTO_MAIN" ]]; then
  sed -i 's/^[[:space:]]*port[[:space:]]/# port /' "$MOSQUITTO_MAIN" 2>/dev/null || true
  sed -i 's/^[[:space:]]*allow_anonymous[[:space:]]/# allow_anonymous /' "$MOSQUITTO_MAIN" 2>/dev/null || true
  sed -i 's/^[[:space:]]*password_file[[:space:]]/# password_file /' "$MOSQUITTO_MAIN" 2>/dev/null || true
fi

for f in /etc/mosquitto/conf.d/*; do
  [[ -f "$f" ]] || continue
  base="$(basename "$f")"
  [[ "$base" == "mooreview.conf" ]] && continue
  [[ "$base" == *.disabled ]] && continue
  log "Disabling stock Mosquitto config: $f"
  mv -f "$f" "${f}.disabled"
done

install -m 0644 "$SCRIPT_DIR/mosquitto-debian.conf" "$MOSQUITTO_CONFD"

if [[ "$MOSQUITTO_ALLOW_ANONYMOUS" == "true" ]]; then
  sed -i 's/^allow_anonymous false/allow_anonymous true/' "$MOSQUITTO_CONFD"
  sed -i '/^password_file /d' "$MOSQUITTO_CONFD"
  rm -f /etc/mosquitto/passwd
else
  mosquitto_passwd -b -c /etc/mosquitto/passwd "$MOSQUITTO_USER" "$MOSQUITTO_PASS"
  chown root:mosquitto /etc/mosquitto/passwd 2>/dev/null || chown root:root /etc/mosquitto/passwd
  chmod 0640 /etc/mosquitto/passwd
fi

if [[ "$MOSQUITTO_TLS" == "true" ]]; then
  MOOREVIEW_DOMAIN="$MOOREVIEW_DOMAIN" bash "$SCRIPT_DIR/setup-mosquitto-tls.sh"
  if [[ -f "$SCRIPT_DIR/mosquitto-tls.conf" ]]; then
    grep -q '^listener 8883' "$MOSQUITTO_CONFD" 2>/dev/null || cat "$SCRIPT_DIR/mosquitto-tls.conf" >> "$MOSQUITTO_CONFD"
  fi
fi

systemctl enable mosquitto >/dev/null 2>&1 || true
systemctl restart mosquitto || die "Mosquitto failed — journalctl -xeu mosquitto.service"

if [[ -f "$SAAS_ENV" ]]; then
  if ! grep -qE '^MOOREVIEW_MQTT_BROKER=' "$SAAS_ENV" 2>/dev/null; then
    log "Adding MOOREVIEW_MQTT_BROKER to $SAAS_ENV"
    printf '\nMOOREVIEW_MQTT_BROKER=mqtt://127.0.0.1:1883\n' >> "$SAAS_ENV"
  fi
  systemctl restart mooreview-saas.service 2>/dev/null || true
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 1883/tcp >/dev/null 2>&1 || true
  ufw allow 8883/tcp >/dev/null 2>&1 || true
fi

log "Mosquitto enabled for SaaS droplet"
log "  Plain:  mqtt://127.0.0.1:1883 (internal)"
if [[ "$MOSQUITTO_TLS" == "true" ]]; then
  log "  Field:  mqtts://${MOOREVIEW_DOMAIN}:${MOSQUITTO_TLS_PORT} (user ${MOSQUITTO_USER})"
else
  log "  Field:  mqtt://${MOOREVIEW_DOMAIN}:1883 (user ${MOSQUITTO_USER})"
fi
log "  Env:    $MQTT_ENV"
log "  Test:   mosquitto_pub -h 127.0.0.1 -u '$MOSQUITTO_USER' -P '***' -t test -m ok"
