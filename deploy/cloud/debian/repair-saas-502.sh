#!/usr/bin/env bash
# Fix HTTP 502 on mooreview.io — nginx must proxy to 3100 and mooreview-saas must be running.
set -euo pipefail

log() { printf '[repair-502] %s\n' "$*"; }
warn() { printf '[repair-502] WARN: %s\n' "$*" >&2; }
die() { printf '[repair-502] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-0}" -eq 0 ]] || die "Run as root"

PORT=3100
INSTALL_DIR="${MOOREVIEW_INSTALL_DIR:-/home/mooreview}"
SAAS_ENV="${MOOREVIEW_SAAS_ENV:-/etc/mooreview/saas.env}"
SCRIPT_DIR="${INSTALL_DIR}/deploy/cloud/debian"

log "=== Current nginx upstream ==="
grep -R "proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null || true

log "=== Listeners ==="
ss -tlnp | grep -E ':80 |:3100 |:3090 ' || ss -tlnp | head -12

log "=== Backend health (before fix) ==="
curl -sf "http://127.0.0.1:${PORT}/health" && log ":${PORT} OK" || warn ":${PORT} not responding"
curl -sf "http://127.0.0.1:3090/health" && log ":3090 OK" || warn ":3090 not responding"

# --- nginx -> 3100 ---
NGINX_SITE="/etc/nginx/sites-available/mooreview-saas"
if [[ -f "${SCRIPT_DIR}/nginx-mooreview-saas.conf" ]]; then
  cp "${SCRIPT_DIR}/nginx-mooreview-saas.conf" "$NGINX_SITE"
elif [[ -f "${SCRIPT_DIR}/nginx-mooreview-domain.conf" ]]; then
  cp "${SCRIPT_DIR}/nginx-mooreview-domain.conf" "$NGINX_SITE"
  sed -i 's|127.0.0.1:3090|127.0.0.1:3100|g' "$NGINX_SITE"
else
  cat > "$NGINX_SITE" <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name mooreview.io www.mooreview.io;
    client_max_body_size 50m;
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF
fi

rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/mooreview 2>/dev/null || true
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/mooreview-saas
nginx -t
systemctl restart nginx
log "nginx now proxies to :${PORT}"

# --- mooreview-saas service ---
if [[ ! -f /etc/systemd/system/mooreview-saas.service ]]; then
  if [[ -f "${SCRIPT_DIR}/install-saas.sh" ]]; then
    log "mooreview-saas not installed — running install-saas.sh..."
    MOOREVIEW_SOURCE="$INSTALL_DIR" MOOREVIEW_INSTALL_DIR="$INSTALL_DIR" \
      bash "${SCRIPT_DIR}/install-saas.sh"
  else
    die "Missing mooreview-saas.service and ${SCRIPT_DIR}/install-saas.sh — re-extract bundle to /home/mooreview"
  fi
fi

if [[ -f "$SAAS_ENV" ]]; then
  if grep -qE 'CHANGE_ME' "$SAAS_ENV" 2>/dev/null; then
    warn "$SAAS_ENV still has CHANGE_ME — edit MONGODB_URI, JWT_SECRET, PLATFORM_ADMIN_KEY"
  fi
  if grep -qE '^MONGODB_URI=mongodb://(localhost|127\.0\.0\.1)' "$SAAS_ENV" 2>/dev/null; then
    warn "MONGODB_URI is localhost — SaaS needs DO Managed Mongo (mongodb+srv://) unless you install local mongod"
  fi
fi

systemctl daemon-reload
systemctl enable mooreview-saas 2>/dev/null || true
systemctl disable --now mooreview 2>/dev/null || true
systemctl restart mooreview-saas || true
sleep 3

log "=== mooreview-saas status ==="
systemctl status mooreview-saas --no-pager -l | head -25 || true

if ! curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
  log "=== Last log lines (fix MONGODB_URI + DO Mongo allowlist) ==="
  journalctl -u mooreview-saas -n 30 --no-pager || true
  die "Backend still down on :${PORT}. Edit $SAAS_ENV then: systemctl restart mooreview-saas"
fi

CODE="$(curl -sf -o /dev/null -w '%{http_code}' -H 'Host: mooreview.io' http://127.0.0.1/login)"
log "nginx /login -> HTTP ${CODE}"
if [[ "$CODE" == "502" ]]; then
  die "Still 502 after fix — paste: journalctl -u mooreview-saas -n 40"
fi

log "OK — open http://mooreview.io/login"
log "HTTPS: certbot --nginx -d mooreview.io -d www.mooreview.io"
