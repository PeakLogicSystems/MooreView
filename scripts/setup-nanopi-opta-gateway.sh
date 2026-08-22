#!/bin/sh
# NanoPi NEO + NEO CAT1 — transparent Opta Parc MQTT gateway (Option B)
#
# Matches cellular-opta-gateway firmware behavior:
#   Opta -> local Mosquitto :1883 (anonymous) on 192.168.1.1
#   Mosquitto bridge -> cloud mqtt.mooreview.io:8883 (TLS + auth)
#   Topics: mooreview/v1/# both directions
#   Gateway cellular identity -> mooreview/v1/gateway/{gatewayId}/cellular
#
# BEFORE apply-lan: unplug eth0 from UniFi (conflicts with 192.168.1.1).
# Wire Opta Ethernet directly to NanoPi eth0.
#
# Usage (on FriendlyWrt as root):
#   sh /root/setup-nanopi-opta-gateway.sh install-packages
#   echo 'YOUR_MOSQUITTO_PASS' > /etc/mosquitto/cloud.pass
#   sh /root/setup-nanopi-opta-gateway.sh configure
#   sh /root/setup-nanopi-opta-gateway.sh apply-lan   # when Opta is wired
#   sh /root/setup-nanopi-opta-gateway.sh read-cellular
#   sh /root/setup-nanopi-opta-gateway.sh publish-cellular
#   sh /root/setup-nanopi-opta-gateway.sh status

set -e

CLOUD_HOST="${CLOUD_HOST:-mqtt.mooreview.io}"
CLOUD_PORT="${CLOUD_PORT:-8883}"
CLOUD_USER="${CLOUD_USER:-mooreview}"
PASS_FILE="/etc/mosquitto/cloud.pass"
CONF="/etc/mosquitto/mosquitto.conf"
GATEWAY_JSON="/etc/mooreview-gateway.json"
TOPIC_PREFIX="${TOPIC_PREFIX:-mooreview/v1}"
MODEM_VID="${MODEM_VID:-19d1}"
MODEM_PID="${MODEM_PID:-0001}"

default_gateway_id() {
  if [ -f "$GATEWAY_JSON" ]; then
    gid="$(sed -n 's/.*"gatewayId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$GATEWAY_JSON" | head -n1)"
    [ -n "$gid" ] && echo "$gid" && return 0
  fi
  mac="$(cat /sys/class/net/eth0/address 2>/dev/null | tr -d ':' | tr 'A-Z' 'a-z')"
  if [ -n "$mac" ]; then
    echo "gw_nanopi_${mac#${mac%??????}}"
    return 0
  fi
  echo "gw_nanopi_001"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_gateway_json() {
  gid="$1"
  iccid="$2"
  imsi="$3"
  imei="$4"
  signal="$5"
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%S)"
  mkdir -p "$(dirname "$GATEWAY_JSON")"
  cat > "$GATEWAY_JSON" <<EOF
{
  "gatewayId": "$(json_escape "$gid")",
  "platform": "nanopi-neo-cat1",
  "iccid": "$(json_escape "$iccid")",
  "imsi": "$(json_escape "$imsi")",
  "imei": "$(json_escape "$imei")",
  "signal": $( [ -n "$signal" ] && echo "$signal" || echo null ),
  "reportedAt": "$ts"
}
EOF
  chmod 600 "$GATEWAY_JSON" 2>/dev/null || true
}

enable_modem_serial() {
  modprobe option 2>/dev/null || true
  if [ -w /sys/bus/usb-serial/drivers/option1/new_id ]; then
    echo "$MODEM_VID $MODEM_PID" > /sys/bus/usb-serial/drivers/option1/new_id 2>/dev/null || true
  fi
  sleep 1
}

send_at() {
  port="$1"
  cmd="$2"
  [ -c "$port" ] || return 1
  stty -F "$port" 115200 cs8 -cstopb -parenb raw -echo min 0 time 10 2>/dev/null || true
  printf '%s\r\n' "$cmd" > "$port"
  sleep 1
  timeout 3 cat "$port" 2>/dev/null | tr -d '\r'
}

extract_digits_field() {
  echo "$1" | tr '\n' ' ' | sed -n 's/.*\([0-9]\{18,22\}\).*/\1/p' | head -n1
}

extract_iccid() {
  echo "$1" | tr '\n' ' ' | sed -n 's/.*ICCID[: ]*\([0-9]\{18,22\}\).*/\1/ip; s/.*CCID[: ]*\([0-9]\{18,22\}\).*/\1/ip' | head -n1
}

extract_imsi() {
  echo "$1" | tr '\n' ' ' | sed -n 's/.*\([0-9]\{14,16\}\).*/\1/p' | head -n1
}

read_modem_identity() {
  enable_modem_serial
  iccid=""
  imsi=""
  imei=""
  signal=""
  for port in /dev/ttyACM0 /dev/ttyACM1 /dev/ttyACM2 /dev/ttyUSB0 /dev/ttyUSB1 /dev/ttyUSB2; do
    [ -c "$port" ] || continue
    at="$(send_at "$port" "AT")"
    echo "$at" | grep -qi 'OK' || continue
    for cmd in AT+ICCID AT+CCID AT+CICCID; do
      resp="$(send_at "$port" "$cmd")"
      cand="$(extract_iccid "$resp")"
      [ -n "$cand" ] && iccid="$cand" && break
    done
    resp="$(send_at "$port" "AT+CIMI")"
    cand="$(extract_imsi "$resp")"
    [ -n "$cand" ] && imsi="$cand"
    resp="$(send_at "$port" "AT+CGSN")"
    cand="$(extract_digits_field "$resp")"
    [ -n "$cand" ] && imei="$cand"
    resp="$(send_at "$port" "AT+CSQ")"
    cand="$(echo "$resp" | sed -n 's/.*+CSQ:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1)"
    [ -n "$cand" ] && signal="$cand"
    [ -n "$iccid" ] && break
  done
  echo "$iccid|$imsi|$imei|$signal"
}

read_cellular() {
  gid="$(default_gateway_id)"
  parsed="$(read_modem_identity)"
  iccid="${parsed%%|*}"
  rest="${parsed#*|}"
  imsi="${rest%%|*}"
  rest="${rest#*|}"
  imei="${rest%%|*}"
  signal="${rest##*|}"
  write_gateway_json "$gid" "$iccid" "$imsi" "$imei" "$signal"
  echo "gatewayId=$gid iccid=${iccid:-unknown} imsi=${imsi:-unknown} imei=${imei:-unknown} signal=${signal:-unknown}"
  echo "saved $GATEWAY_JSON"
}

publish_cellular() {
  if [ ! -f "$GATEWAY_JSON" ]; then
    read_cellular
  fi
  gid="$(sed -n 's/.*"gatewayId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$GATEWAY_JSON" | head -n1)"
  [ -n "$gid" ] || gid="$(default_gateway_id)"
  topic="${TOPIC_PREFIX}/gateway/${gid}/cellular"
  payload="$(cat "$GATEWAY_JSON")"
  mosquitto_pub -h 127.0.0.1 -p 1883 -t "$topic" -m "$payload" -q 1 -r
  echo "published retained $topic"
}

install_cron() {
  line="*/15 * * * * /root/setup-nanopi-opta-gateway.sh publish-cellular >/dev/null 2>&1"
  existing="$(crontab -l 2>/dev/null || true)"
  echo "$existing" | grep -F 'setup-nanopi-opta-gateway.sh publish-cellular' >/dev/null 2>&1 && return 0
  {
    echo "$existing"
    echo "$line"
  } | sed '/^$/d' | crontab -
  /etc/init.d/cron enable 2>/dev/null || true
  /etc/init.d/cron restart 2>/dev/null || true
  echo "Installed cron: publish-cellular every 15 minutes"
}

install_packages() {
  opkg update
  opkg install mosquitto-ssl mosquitto-client-ssl ca-bundle libopenssl-conf kmod-usb-serial-option usbutils coreutils-timeout 2>/dev/null || true
  opkg install mosquitto-ssl mosquitto-client-ssl ca-bundle libopenssl-conf || true
  opkg remove libwebsockets-full --force-depends 2>/dev/null || true
  opkg install mosquitto-ssl 2>/dev/null || true
}

write_rndis() {
  echo rndis_host > /etc/modules.d/rndis
  modprobe rndis_host 2>/dev/null || true
}

write_mosquitto() {
  mkdir -p /etc/mosquitto
  if [ ! -f "$PASS_FILE" ]; then
    echo 'CHANGE-ME' > "$PASS_FILE"
    chmod 600 "$PASS_FILE"
    echo "Wrote $PASS_FILE — set cloud MOSQUITTO_PASS before starting bridge."
  fi
  CLOUD_PASS="$(cat "$PASS_FILE")"
  cat > "$CONF" <<EOF
# MooreVIEW Opta Parc transparent gateway (NanoPi NEO CAT1)
persistence false
log_dest syslog
connection_messages true

listener 1883 0.0.0.0
allow_anonymous true

connection cloud
address ${CLOUD_HOST}:${CLOUD_PORT}
bridge_cafile /etc/ssl/certs/ca-certificates.crt
remote_username ${CLOUD_USER}
remote_password ${CLOUD_PASS}
cleansession true
try_private false
notifications false
topic mooreview/v1/# both 1
EOF
  chmod 600 "$CONF"
  if [ -f /etc/config/mosquitto ]; then
    uci set mosquitto.mosquitto.disabled='0' 2>/dev/null || true
    uci commit mosquitto 2>/dev/null || true
  fi
  /etc/init.d/mosquitto enable
  /etc/init.d/mosquitto restart
}

write_cell_wan() {
  if ! uci -q get network.cell >/dev/null; then
    uci set network.cell=interface
  fi
  uci set network.cell.ifname='eth1'
  uci set network.cell.proto='dhcp'
  uci set network.cell.metric='10'
  uci commit network
}

write_lan() {
  if ! uci -q get network.lan >/dev/null; then
    uci set network.lan=interface
  fi
  uci set network.lan.ifname='eth0'
  uci set network.lan.type='bridge'
  uci set network.lan.proto='static'
  uci set network.lan.ipaddr='192.168.1.1'
  uci set network.lan.netmask='255.255.255.0'
  uci del network.wan 2>/dev/null || true
  uci del network.wan6 2>/dev/null || true
  uci commit network

  uci set dhcp.lan.interface='lan'
  uci set dhcp.lan.start='50'
  uci set dhcp.lan.limit='50'
  uci set dhcp.lan.leasetime='12h'
  uci commit dhcp

  uci set firewall.@zone[0].network='lan'
  uci set firewall.@zone[1].network='cell'
  uci set firewall.@zone[1].name='wan'
  uci set firewall.@forwarding[0].src='lan'
  uci set firewall.@forwarding[0].dest='wan'
  uci commit firewall
}

apply_lan() {
  write_lan
  write_cell_wan
  write_rndis
  /etc/init.d/network restart
  sleep 5
  udhcpc -i eth1 -n -q 2>/dev/null || true
  /etc/init.d/mosquitto restart
  sleep 10
  read_cellular || true
  publish_cellular || true
}

configure() {
  write_rndis
  write_mosquitto
  write_cell_wan
  install_cron
  sleep 5
  read_cellular || true
  publish_cellular || true
}

status() {
  echo "=== interfaces ==="
  ip -4 addr show eth0 eth1 2>/dev/null || ip -4 addr
  echo "=== routes ==="
  ip route
  echo "=== gateway identity ==="
  if [ -f "$GATEWAY_JSON" ]; then
    cat "$GATEWAY_JSON"
  else
    echo "No $GATEWAY_JSON yet — run read-cellular"
  fi
  echo "=== mosquitto ==="
  pgrep mosquitto >/dev/null && echo "mosquitto running" || echo "mosquitto NOT running"
  netstat -ln 2>/dev/null | grep 1883 || ss -ln | grep 1883 || true
  echo "=== bridge test (needs cloud.pass set) ==="
  if [ -f "$PASS_FILE" ] && [ "$(cat "$PASS_FILE")" != "CHANGE-ME" ]; then
    mosquitto_pub -h 127.0.0.1 -p 1883 -t 'mooreview/v1/test/gateway/ping' -m ok -q 1 && echo "local publish ok"
  else
    echo "Set $PASS_FILE first"
  fi
}

case "${1:-}" in
  install-packages) install_packages ;;
  configure) configure ;;
  apply-lan) apply_lan ;;
  read-cellular) read_cellular ;;
  publish-cellular) publish_cellular ;;
  status) status ;;
  *)
    echo "Usage: $0 {install-packages|configure|apply-lan|read-cellular|publish-cellular|status}"
    exit 1
    ;;
esac
