#!/usr/bin/env bash
# Issue Let's Encrypt cert for cloud-1 SaaS (mooreview.io + www)
set -euo pipefail

# Minimal HTTP site so certbot --nginx can authenticate
cat > /etc/nginx/sites-available/mooreview-saas <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name mooreview.io www.mooreview.io;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/mooreview-saas /etc/nginx/sites-enabled/mooreview-saas
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

certbot --nginx \
  -d mooreview.io -d www.mooreview.io \
  --non-interactive --agree-tos \
  --register-unsafely-without-email \
  --redirect

echo "--- cert ---"
ls -la /etc/letsencrypt/live/mooreview.io/
echo "SAAS_TLS_OK"
curl -sI https://mooreview.io/ | head -5 || true
