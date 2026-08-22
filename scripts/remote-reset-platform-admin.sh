#!/usr/bin/env bash
set -euo pipefail
NEW_PASS="$(openssl rand -hex 16)"
ADMIN_EMAIL="$(grep '^MOOREVIEW_SEED_ADMIN_EMAIL=' /etc/mooreview/saas.env | cut -d= -f2- || echo admin@mooreview.io)"
python3 - "$NEW_PASS" <<'PY'
import re, sys
path = "/etc/mooreview/saas.env"
new_pass = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    text = f.read()
if re.search(r"^MOOREVIEW_SEED_ADMIN_PASSWORD=", text, re.M):
    text = re.sub(r"^MOOREVIEW_SEED_ADMIN_PASSWORD=.*", f"MOOREVIEW_SEED_ADMIN_PASSWORD={new_pass}", text, flags=re.M)
else:
    text = text.rstrip() + f"\nMOOREVIEW_SEED_ADMIN_PASSWORD={new_pass}\n"
with open(path, "w", encoding="utf-8") as f:
    f.write(text)
PY
printf '%s\n' "$NEW_PASS" > /home/mooreview/mv-system-admin-password.txt
chown mooreview:mooreview /home/mooreview/mv-system-admin-password.txt
chmod 644 /home/mooreview/mv-system-admin-password.txt
cat > /home/mooreview/SYSTEM-ADMIN-LOGIN.txt <<EOF
MooreVIEW Cloud — system admin (generated $(date -u +%Y-%m-%dT%H:%MZ))

Login:  https://mooreview.io/login
Org ID: (leave blank)
Email:  $ADMIN_EMAIL
Password file: /home/mooreview/mv-system-admin-password.txt

Delete this file after you save the password somewhere safe.
EOF
chown mooreview:mooreview /home/mooreview/SYSTEM-ADMIN-LOGIN.txt /home/mooreview/mv-system-admin-password.txt
chmod 644 /home/mooreview/SYSTEM-ADMIN-LOGIN.txt /home/mooreview/mv-system-admin-password.txt
cp /home/mooreview/SYSTEM-ADMIN-LOGIN.txt /tmp/SYSTEM-ADMIN-LOGIN.txt
cp /home/mooreview/mv-system-admin-password.txt /tmp/mv-system-admin-password.txt
chmod 644 /tmp/SYSTEM-ADMIN-LOGIN.txt /tmp/mv-system-admin-password.txt
sudo -u mooreview env MOOREVIEW_DEPLOYMENT=cloud \
  MOOREVIEW_SEED_ADMIN_EMAIL="$ADMIN_EMAIL" \
  MOOREVIEW_SEED_ADMIN_PASSWORD="$NEW_PASS" \
  node /home/mooreview/scripts/reset-platform-admin.js
systemctl restart mooreview-saas
sleep 2
HTTP="$(curl -sS -o /tmp/mv-login-test.json -w '%{http_code}' -X POST http://127.0.0.1:3100/api/auth/login \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$NEW_PASS\",\"organizationId\":\"\"}")"
echo "login_http=$HTTP"
head -c 120 /tmp/mv-login-test.json || true
echo
echo "=== System admin login ==="
echo "  https://mooreview.io/login"
echo "  Organization ID: (leave blank)"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $NEW_PASS"
echo
echo "Saved to:"
echo "  /tmp/SYSTEM-ADMIN-LOGIN.txt          (easiest — run on the droplet)"
echo "  /home/mooreview/SYSTEM-ADMIN-LOGIN.txt"
echo "Read after SSH to cloud-1-saas-nyc1: cat /tmp/SYSTEM-ADMIN-LOGIN.txt"
