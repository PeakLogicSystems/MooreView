#!/usr/bin/env bash
# One-shot: ensure mqtt.env + run install-mqtt-droplet.sh + smoke test
set -euo pipefail

mkdir -p /etc/mooreview
if ! grep -q '^MOSQUITTO_PASS=' /etc/mooreview/mqtt.env 2>/dev/null || grep -q CHANGE_ME /etc/mooreview/mqtt.env 2>/dev/null; then
  PASS="$(openssl rand -hex 24)"
  cat > /etc/mooreview/mqtt.env <<EOF
MOOREVIEW_DOMAIN=mqtt.mooreview.io
MOSQUITTO_USER=mooreview
MOSQUITTO_PASS=${PASS}
MOSQUITTO_ALLOW_ANONYMOUS=false
MOSQUITTO_TLS=true
MOSQUITTO_TLS_PORT=8883
MOSQUITTO_PLAIN=true
MOSQUITTO_PLAIN_PORT=1883
EOF
  chmod 0640 /etc/mooreview/mqtt.env
fi

bash /home/mooreview/deploy/cloud/phase1/install-mqtt-droplet.sh

echo "--- listeners ---"
ss -lnt | grep -E ':1883|:8883' || true
ls -la /etc/mosquitto/certs/
systemctl is-active mosquitto

set -a
# shellcheck disable=SC1091
. /etc/mooreview/mqtt.env
set +a

mosquitto_pub -h 127.0.0.1 -p 1883 -u "$MOSQUITTO_USER" -P "$MOSQUITTO_PASS" -t test/ping -m ok && echo PLAIN_OK
mosquitto_pub -h 127.0.0.1 -p 8883 --insecure -u "$MOSQUITTO_USER" -P "$MOSQUITTO_PASS" -t test/ping -m ok-tls && echo TLS_OK
echo "Credentials: /etc/mooreview/mqtt.env (MOSQUITTO_USER / MOSQUITTO_PASS)"
echo "Broker TLS: mqtts://167.99.9.171:8883 (self-signed CN=mqtt.mooreview.io until LE)"
