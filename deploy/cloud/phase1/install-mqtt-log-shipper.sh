#!/usr/bin/env bash
# Install Mosquitto log shipper on mv-mqtt (posts broker auth/connect events to SaaS).
# Run as root after SaaS has MOOREVIEW_MQTT_LOG_INGEST_TOKEN set.
#
#   sudo MOOREVIEW_MQTT_LOG_INGEST_TOKEN='…' \
#     MOOREVIEW_MQTT_LOG_INGEST_URL='https://mooreview.io' \
#     bash deploy/cloud/phase1/install-mqtt-log-shipper.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${MOOREVIEW_MQTT_SHIPPER_DIR:-/opt/mooreview-mqtt-shipper}"
UNIT=/etc/systemd/system/mooreview-mqtt-log-shipper.service
ENV_FILE=/etc/mooreview/mqtt-log-shipper.env

log() { printf '[mqtt-log-shipper] %s\n' "$*"; }
die() { printf '[mqtt-log-shipper] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-$(id -u)}" -eq 0 ]] || die "Run as root"

TOKEN="${MOOREVIEW_MQTT_LOG_INGEST_TOKEN:-}"
[[ -n "$TOKEN" ]] || die "Set MOOREVIEW_MQTT_LOG_INGEST_TOKEN (must match SaaS saas.env)"

API_URL="${MOOREVIEW_MQTT_LOG_INGEST_URL:-${PUBLIC_API_URL:-https://mooreview.io}}"
LOG_PATH="${MOOREVIEW_MOSQUITTO_LOG_PATH:-/var/log/mosquitto/mosquitto.log}"
LOG_HOST="${MOOREVIEW_MOSQUITTO_LOG_HOST:-$(hostname -s)}"

install -d -m 0755 "$INSTALL_DIR"
install -m 0755 "$SCRIPT_DIR/mosquitto-log-shipper.py" "$INSTALL_DIR/mosquitto-log-shipper.py"
install -d -m 0750 /etc/mooreview
cat > "$ENV_FILE" <<EOF
MOOREVIEW_MQTT_LOG_INGEST_URL=${API_URL}
MOOREVIEW_MQTT_LOG_INGEST_TOKEN=${TOKEN}
MOOREVIEW_MOSQUITTO_LOG_PATH=${LOG_PATH}
MOOREVIEW_MOSQUITTO_LOG_HOST=${LOG_HOST}
EOF
chmod 0640 "$ENV_FILE"

cat > "$UNIT" <<EOF
[Unit]
Description=MooreVIEW Mosquitto log shipper
After=network-online.target mosquitto.service
Wants=network-online.target
Requires=mosquitto.service

[Service]
Type=simple
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/mosquitto-log-shipper.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable mooreview-mqtt-log-shipper
systemctl restart mooreview-mqtt-log-shipper
log "Shipper running → ${API_URL}/api/mqtt-broker-log/ingest"
systemctl is-active mooreview-mqtt-log-shipper
