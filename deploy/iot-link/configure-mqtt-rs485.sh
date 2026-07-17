#!/usr/bin/env bash
# One-shot: enable local MQTT auth + RS-485 drivers on IOT-LINK appliance.
set -euo pipefail
ENV_FILE="${MOOREVIEW_ENV_FILE:-/etc/mooreview/env}"
INSTALL_DIR="${MOOREVIEW_INSTALL_DIR:-/opt/mooreview}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

grep -v -E '^(MOOREVIEW_MQTT_|MOOREVIEW_RS485_ENABLE|MOSQUITTO_ALLOW_ANONYMOUS|MOSQUITTO_USER|MOSQUITTO_PASS)=' "$ENV_FILE" > /tmp/mv.env || true
cat >> /tmp/mv.env <<'EOF'
MOOREVIEW_MQTT_ENABLED=true
MOOREVIEW_MQTT_BROKER=mqtt://127.0.0.1:1883
MOOREVIEW_RS485_ENABLE=true
MOSQUITTO_ALLOW_ANONYMOUS=true
MOSQUITTO_USER=mooreview
MOSQUITTO_PASS=mooreview
EOF
mv /tmp/mv.env "$ENV_FILE"
chmod 640 "$ENV_FILE"
chown root:mooreview "$ENV_FILE"

MOSQUITTO_CONFD="/etc/mosquitto/conf.d/mooreview.conf"
if [[ -f "$MOSQUITTO_CONFD" ]]; then
  sed -i 's/^allow_anonymous false/allow_anonymous true/' "$MOSQUITTO_CONFD"
  sed -i '/^password_file /d' "$MOSQUITTO_CONFD"
fi
mosquitto_passwd -b -c /etc/mosquitto/passwd mooreview mooreview 2>/dev/null || true
chmod 0600 /etc/mosquitto/passwd 2>/dev/null || true
chown mosquitto:mosquitto /etc/mosquitto/passwd 2>/dev/null || true
systemctl restart mosquitto
systemctl is-active mosquitto

sudo -u mooreview bash -lc "cd '$INSTALL_DIR' && set -a && source '$ENV_FILE' && set +a && node deploy/iot-link/seed-generic-config.js --force"
systemctl restart mooreview-iot-link-generic
sleep 4
curl -sS http://127.0.0.1:3090/health
echo
