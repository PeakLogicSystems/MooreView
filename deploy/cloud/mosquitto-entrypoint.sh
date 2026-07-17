#!/bin/sh
set -e

CONF="/mosquitto/config/mosquitto.conf"
PASSWD="/mosquitto/config/passwd"
ALLOW_ANON="${MOSQUITTO_ALLOW_ANONYMOUS:-false}"
TLS="${MOSQUITTO_TLS:-false}"
USER="${MOSQUITTO_USER:-}"
PASS="${MOSQUITTO_PASS:-}"

cat > "$CONF" <<EOF
persistence true
persistence_location /mosquitto/data/
log_dest stdout
connection_messages true
EOF

if [ "$TLS" = "true" ] && [ -f /mosquitto/certs/server.crt ] && [ -f /mosquitto/certs/server.key ]; then
  cat >> "$CONF" <<EOF

listener 8883
certfile /mosquitto/certs/server.crt
keyfile /mosquitto/certs/server.key
EOF
  if [ -f /mosquitto/certs/ca.crt ]; then
    echo "cafile /mosquitto/certs/ca.crt" >> "$CONF"
  fi
  if [ "$ALLOW_ANON" = "true" ]; then
    echo "allow_anonymous true" >> "$CONF"
  else
    echo "allow_anonymous false" >> "$CONF"
    if [ -n "$USER" ] && [ -n "$PASS" ]; then
      mosquitto_passwd -b -c "$PASSWD" "$USER" "$PASS"
      echo "password_file $PASSWD" >> "$CONF"
    fi
  fi
fi

cat >> "$CONF" <<EOF

listener 1883
EOF

if [ "$ALLOW_ANON" = "true" ]; then
  echo "allow_anonymous true" >> "$CONF"
else
  echo "allow_anonymous false" >> "$CONF"
  if [ -n "$USER" ] && [ -n "$PASS" ]; then
    if [ ! -f "$PASSWD" ]; then
      mosquitto_passwd -b -c "$PASSWD" "$USER" "$PASS"
    fi
    echo "password_file $PASSWD" >> "$CONF"
  else
    echo "[mosquitto-entrypoint] MOSQUITTO_ALLOW_ANONYMOUS=false but MOSQUITTO_USER/PASS unset — clients cannot connect" >&2
  fi
fi

exec /usr/sbin/mosquitto -c "$CONF"
