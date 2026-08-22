#!/usr/bin/env bash
set -euo pipefail

chown mosquitto:mosquitto /etc/mosquitto/passwd
chmod 0640 /etc/mosquitto/passwd
systemctl restart mosquitto
sleep 1
systemctl is-active mosquitto
ss -lnt | grep -E ':1883|:8883'

set -a
# shellcheck disable=SC1091
. /etc/mooreview/mqtt.env
set +a

mosquitto_pub -h 127.0.0.1 -p 1883 -u "$MOSQUITTO_USER" -P "$MOSQUITTO_PASS" -t test/ping -m ok
echo PLAIN_OK

# Self-signed: trust our cert + skip hostname (CN is mqtt.mooreview.io, host is IP)
mosquitto_pub -h 127.0.0.1 -p 8883 \
  --cafile /etc/mosquitto/certs/server.crt \
  --insecure \
  -u "$MOSQUITTO_USER" -P "$MOSQUITTO_PASS" \
  -t test/ping -m ok-tls
echo TLS_OK

echo "Broker: mqtts://167.99.9.171:8883 (self-signed CN=mqtt.mooreview.io)"
echo "Creds:  /etc/mooreview/mqtt.env"
echo "Later:  DNS mqtt.mooreview.io + certbot → real LE cert"
