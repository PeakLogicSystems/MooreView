#!/usr/bin/env bash
# Open ports 80/443, verify nginx + MooreVIEW. Run as root on the cloud VM.
set -euo pipefail

log() { printf '[fix-web] %s\n' "$*"; }
die() { printf '[fix-web] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID:-0}" -eq 0 ]] || die "Run as root: sudo bash $0"

MOOREVIEW_PORT="${MOOREVIEW_PORT:-}"
DOMAIN="${MOOREVIEW_DOMAIN:-mooreview.io}"
INSTALL_DIR="${MOOREVIEW_INSTALL_DIR:-/home/mooreview}"

# SaaS (3100) takes precedence over legacy appliance (3090)
if [[ -z "$MOOREVIEW_PORT" ]]; then
  if systemctl list-unit-files mooreview-saas.service >/dev/null 2>&1; then
    MOOREVIEW_PORT=3100
    NGINX_SITE="/etc/nginx/sites-available/mooreview-saas"
    SVC=mooreview-saas
  else
    MOOREVIEW_PORT=3090
    NGINX_SITE="/etc/nginx/sites-available/mooreview"
    SVC=mooreview
  fi
else
  NGINX_SITE="/etc/nginx/sites-available/mooreview"
  SVC=mooreview
fi

log "=== UFW ==="
if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp comment 'SSH' || true
  ufw allow 80/tcp comment 'HTTP'
  ufw allow 443/tcp comment 'HTTPS'
  ufw allow "${MOOREVIEW_PORT}/tcp" comment 'MooreVIEW direct' || true
  ufw allow 1883/tcp comment 'MQTT' || true
  ufw --force enable || true
  ufw status verbose || ufw status
else
  log "ufw not installed"
fi

log "=== MooreVIEW service ($SVC on :$MOOREVIEW_PORT) ==="
if systemctl is-active --quiet "$SVC" 2>/dev/null; then
  log "$SVC: active"
else
  log "$SVC: not running — starting..."
  systemctl start "$SVC" || die "$SVC failed to start (journalctl -u $SVC -n 30)"
fi
curl -sf "http://127.0.0.1:${MOOREVIEW_PORT}/health" >/dev/null && log "health OK on :${MOOREVIEW_PORT}" || die "MooreVIEW not responding on 127.0.0.1:${MOOREVIEW_PORT}"

log "=== nginx ==="
apt-get update -qq
apt-get install -y -qq nginx

if [[ -f "${INSTALL_DIR}/deploy/cloud/debian/nginx-mooreview-saas.conf" ]] && [[ "$MOOREVIEW_PORT" == "3100" ]]; then
  cp "${INSTALL_DIR}/deploy/cloud/debian/nginx-mooreview-saas.conf" "$NGINX_SITE"
elif [[ -f "${INSTALL_DIR}/deploy/cloud/debian/nginx-mooreview-domain.conf" ]]; then
  cp "${INSTALL_DIR}/deploy/cloud/debian/nginx-mooreview-domain.conf" "$NGINX_SITE"
  sed -i "s/mooreview.io/${DOMAIN}/g" "$NGINX_SITE"
  sed -i "s/www.mooreview.io/www.${DOMAIN#www.}/g" "$NGINX_SITE" 2>/dev/null || true
else
  cat > "$NGINX_SITE" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${DOMAIN} www.${DOMAIN} _;

    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:${MOOREVIEW_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
EOF
fi

rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-enabled/mooreview /etc/nginx/sites-enabled/mooreview-saas 2>/dev/null || true
ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/$(basename "$NGINX_SITE")"
nginx -t
systemctl enable nginx
systemctl restart nginx

log "=== Listeners (must show :80 and :443 after certbot) ==="
ss -tlnp | grep -E ":80 |:443 |:${MOOREVIEW_PORT} " || ss -tlnp | head -20

log "=== Local HTTP test ==="
curl -sf -o /dev/null -w "HTTP %{http_code} from nginx :80\n" -H "Host: ${DOMAIN}" http://127.0.0.1/ || die "nginx :80 failed locally"

PUBLIC_IP="$(curl -sf -4 ifconfig.me 2>/dev/null || curl -sf -4 icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}')"
log "=== Public IP: ${PUBLIC_IP:-unknown} ==="
log "DNS mooreview.io should A-record to this IP."

log ""
log "If https://mooreview.io still fails from your browser:"
log "  1. DigitalOcean Control Panel -> Networking -> Firewalls"
log "     Add inbound TCP 80 and 443 (UFW alone is not enough if a DO firewall is attached)."
log "  2. DNS: dig +short mooreview.io  (must match ${PUBLIC_IP})"
log "  3. TLS: apt install -y certbot python3-certbot-nginx"
log "     certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
log ""
log "Done."
