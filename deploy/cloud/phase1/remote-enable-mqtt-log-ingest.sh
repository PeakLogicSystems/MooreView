#!/usr/bin/env bash
set -euo pipefail
ENV=/etc/mooreview/saas.env
if grep -q '^MOOREVIEW_MQTT_LOG_INGEST_TOKEN=' "$ENV" 2>/dev/null; then
  echo 'MOOREVIEW_MQTT_LOG_INGEST_TOKEN already set'
else
  TOKEN="$(grep '^PLATFORM_ADMIN_KEY=' "$ENV" | cut -d= -f2-)"
  printf '\nMOOREVIEW_MQTT_LOG_INGEST_TOKEN=%s\n' "$TOKEN" >> "$ENV"
  echo 'Added MOOREVIEW_MQTT_LOG_INGEST_TOKEN from PLATFORM_ADMIN_KEY'
fi
systemctl restart mooreview-saas
sleep 3
systemctl is-active mooreview-saas
curl -s http://127.0.0.1:3100/api/mqtt-broker-log/status
