# MooreVIEW Phase 1 — dedicated MQTT (recommended)

**Production (Year 1):** DigitalOcean **one region** — **`atl1`** (Atlanta) when available, or **`nyc1`** (New York) — **three-droplet** layout + Managed MongoDB.

> **No Atlanta in your DO account?** Use **`nyc1`** for production — same architecture. See **[NYC1-PRODUCTION.md](../deploy/cloud/phase1/NYC1-PRODUCTION.md)**. Keep prod VPC/Mongo **separate** from sandbox `test.mooreview.io` (also nyc1).

Mosquitto lives on **`cloud-mqtt-*`** from day one so future growth is mostly:

1. **Add SaaS droplets** (+ DO Load Balancer when >1)
2. **Bump Managed Mongo** tier / disk
3. **Optionally** resize MQTT droplet RAM — **no broker migration**

Legacy two-droplet layout (MQTT on SaaS): [CLOUD_DEPLOY_DO_PHASE1_ATL.md](CLOUD_DEPLOY_DO_PHASE1_ATL.md).

| Guide | Purpose |
|-------|---------|
| **`MooreVIEW-Cloud-Phase1-ATL-Deploy.pdf`** | **Printable deploy guide** — `npm run build:phase1-atl-deploy-pdf` |
| **[DEPLOY-ATL-MQTT-AUTOMATED.md](../deploy/cloud/phase1/DEPLOY-ATL-MQTT-AUTOMATED.md)** | **One-command deploy after DO setup** |
| [CHECKLIST-ATL-MQTT.txt](../deploy/cloud/phase1/CHECKLIST-ATL-MQTT.txt) | Step-by-step checklist |
| [droplet-mqtt/INSTALL.txt](../deploy/cloud/phase1/droplet-mqtt/INSTALL.txt) | MQTT droplet commands |
| [WINSCP-DEPLOY.md](../deploy/cloud/phase1/WINSCP-DEPLOY.md) | Manual bundle upload |

**Sandbox (unchanged):** `nyc1` single server @ `test.mooreview.io` — [droplet-sandbox/INSTALL.txt](../deploy/cloud/phase1/droplet-sandbox/INSTALL.txt).

---

## Architecture (`atl1`)

```text
                         Internet
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
  mooreview.io:443    mqtt.mooreview.io:8883   (archive VPC only)
         │                   │
         │                   │
  ┌──────▼──────────┐  ┌─────▼─────────────┐
  │ cloud-1-saas    │  │ cloud-mqtt-atl1   │
  │ 4 GB            │  │ 4 GB (→ 8 GB)     │
  │ nginx → :3100   │  │ Mosquitto :8883   │
  │ NO Mosquitto    │  │ :1883 VPC plain   │
  └──────┬──────────┘  └─────────┬─────────┘
         │    mqtt://10.x:1883    │
         └───────────┬────────────┘
                     │
         ┌───────────▼───────────┐     ┌─────────────────────┐
         │ DO Managed Mongo atl1 │     │ cloud-2-archive-atl1 │
         │ mooreview_cloud       │     │ :8090 + volume       │
         └───────────────────────┘     └─────────────────────┘
```

| Hostname | Role | Public ports |
|----------|------|--------------|
| `mooreview.io` | SaaS Studio, login, API | **443** (80 for certbot) |
| `mqtt.mooreview.io` | Field MQTT TLS | **8883** |
| Archive | zstd blobs | **none** (VPC 8090 from SaaS only) |

**SaaS firewall:** 22, 80, 443 — **not 8883**.  
**MQTT firewall:** 22, **8883**.

---

## DO resources (recommended names)

| Resource | Name | Region | Spec |
|----------|------|--------|------|
| VPC | `mooreview-prod-atl1` | atl1 | |
| MongoDB | `mooreview-prod-mongo` | atl1 | 10–20 GB → scale tier |
| Droplet | `cloud-1-saas-atl1` | atl1 | **4 GB** / 2 vCPU |
| Droplet | `cloud-mqtt-atl1` | atl1 | **4 GB** / 2 vCPU |
| Droplet | `cloud-2-archive-atl1` | atl1 | **1–2 GB** |
| Volume | `archive-prod-atl1` | atl1 | 100 GB+ |
| Firewall | `fw-saas-atl1` | atl1 | cloud-1 |
| Firewall | `fw-mqtt-atl1` | atl1 | cloud-mqtt |
| Firewall | `fw-archive-atl1` | atl1 | cloud-2 |

---

## DNS

| Record | Target | When |
|--------|--------|------|
| `mooreview.io` | cloud-1-saas public IP | After SaaS verification gate |
| `www.mooreview.io` | same | With production cutover |
| **`mqtt.mooreview.io`** | **cloud-mqtt public IP** | **Before field device onboarding** |
| `test.mooreview.io` | NYC sandbox | Independent |

**Field broker URL (permanent):** `mqtts://mqtt.mooreview.io:8883`

Appliances / Opta **System setup → Cloud remote** and MQTT Parc use this hostname from day one.

---

## Secrets

Generate once for production (different from sandbox):

```powershell
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # PLATFORM_ADMIN_KEY
openssl rand -hex 32   # ARCHIVE_SERVER_TOKEN
openssl rand -hex 16   # MOSQUITTO_PASS  (shared: mqtt droplet + SaaS hub + field)
```

---

## Env files

### cloud-mqtt-atl1

| File | Template |
|------|----------|
| `/etc/mooreview/mqtt.env` | [droplet-mqtt/mqtt.env.template](../deploy/cloud/phase1/droplet-mqtt/mqtt.env.template) |

Set `MOOREVIEW_DOMAIN=mqtt.mooreview.io`, `MOSQUITTO_USER`, `MOSQUITTO_PASS`.

### cloud-1-saas-atl1

| File | Template |
|------|----------|
| `/etc/mooreview/saas.env` | [droplet-saas/saas.env.template](../deploy/cloud/phase1/droplet-saas/saas.env.template) |
| `/etc/mooreview/archive-compact.env` | [droplet-saas/archive-compact.env.template](../deploy/cloud/phase1/droplet-saas/archive-compact.env.template) |

**Do not** run `enable-saas-mqtt.sh` on SaaS. After MQTT droplet is up:

```bash
MOOREVIEW_MQTT_PRIVATE_IP=10.x.x.x \
  bash /home/mooreview/deploy/cloud/debian/configure-saas-mqtt-remote.sh
```

This sets `MOOREVIEW_MQTT_BROKER=mqtt://10.x.x.x:1883` and stops any local Mosquitto.

### cloud-2-archive-atl1

Same as legacy Phase 1 — [droplet-archive/archive.env.template](../deploy/cloud/phase1/droplet-archive/archive.env.template).

---

## Deploy order (Atlanta + dedicated MQTT)

**Automated (Windows, after DO resources exist):** [DEPLOY-ATL-MQTT-AUTOMATED.md](../deploy/cloud/phase1/DEPLOY-ATL-MQTT-AUTOMATED.md) — `npm run deploy:phase1-atl` runs steps 4–10 below over SSH.

**Manual order:**

1. `npm run build:phase1-bundles` (Windows)
2. Create VPC, Mongo, firewalls, **three** droplets, archive volume — all **`atl1`**
3. **DNS:** `mqtt.mooreview.io` → MQTT droplet IP (can precede SaaS cutover)
4. **cloud-2-archive** — install → record **private IP**
5. **cloud-mqtt-atl1** — certbot for `mqtt.mooreview.io` → `install-mqtt-droplet.sh` → record **private IP**
6. **cloud-1-saas** — `saas.env` → `install-saas.sh` → Mongo allowlist → `npm run seed`
7. **`configure-saas-mqtt-remote.sh`** with MQTT private IP
8. Verify on IPs (gate below) — **before** `mooreview.io` DNS
9. `certbot --nginx -d mooreview.io -d www.mooreview.io`
10. `enable-phase1-archive-compact.sh` (not MQTT on SaaS)
11. DNS cutover `mooreview.io` → update `PUBLIC_*` if needed

---

## Verification gate

**MQTT droplet:**

```bash
mosquitto_pub -h 127.0.0.1 -u mooreview -P '...' -t test -m ok
systemctl status mosquitto
```

**SaaS droplet:**

```bash
curl -s http://127.0.0.1:3100/health    # parc/mqtt should show connected broker
grep MOOREVIEW_MQTT_BROKER /etc/mooreview/saas.env
systemctl status mooreview-saas
! systemctl is-active mosquitto 2>/dev/null && echo "OK: no local mosquitto"
```

**End-to-end (from SaaS via VPC):**

```bash
mosquitto_pub -h 10.x.x.x -u mooreview -P '...' \
  -t 'mooreview/v1/demo-tenant/test_device/telemetry' \
  -m '{"deviceId":"test_device","tags":[{"id":"T1","type":"BOOL","value":true}]}'
```

**Archive + compact:** same as [CLOUD_DEPLOY_DO_PHASE1_ATL.md](CLOUD_DEPLOY_DO_PHASE1_ATL.md#verification-gate-before-mooreviewio-dns).

---

## Future scaling (what you add — what stays)

### Stays fixed (years 1–3)

| Component | Action |
|-----------|--------|
| **`mqtt.mooreview.io` / cloud-mqtt-atl1** | Keep hostname; resize 4→8 GB if connection count grows |
| **Archive droplet + volume** | Snapshots; grow volume |
| **VPC** | Same `mooreview-prod-atl1` |

### What you add as fleet grows

| Trigger | Add / change |
|---------|--------------|
| Operator load / HA | **2+ SaaS droplets** + **DO Load Balancer** on :443 |
| Historian / tag growth | **Bump Managed Mongo** RAM + disk (M10→M20→M30…) |
| Ingest / vertical shards | **New `:3090` ingest droplets** — each uses `MOOREVIEW_MQTT_BROKER=mqtt://10.x.x.x:1883` |
| >25K MQTT devices | Resize MQTT droplet or second MQTT node (HA) — **same DNS** via failover IP or EMQX |

### What you do **not** redo

- Field device broker URL (`mqtts://mqtt.mooreview.io:8883`)
- Mongo connection string pattern (`mongodb+srv://…`) — only tier/size
- Archive compact pipeline
- Tenant → MQTT topic layout

```text
Future (Y2–Y3):

Internet → DO LB :443 → cloud-1-saas-a / cloud-1-saas-b (:3100)
                mqtt.mooreview.io:8883 → cloud-mqtt-atl1 (unchanged)
                ingest shards (:3090) ──VPC──► cloud-mqtt (hub clients)
                all SaaS + ingest ──► Managed Mongo (bumped tier)
```

See also: [CLOUD_VERTICAL_SHARDS.md](CLOUD_VERTICAL_SHARDS.md) · [CLOUD_INFRA_PRICING.md](marketing/CLOUD_INFRA_PRICING.md).

---

## Cost delta vs colocated MQTT

| Layout | ~Monthly (atl1) |
|--------|------------------|
| 2-droplet (MQTT on SaaS) | ~$70–90 |
| **3-droplet (+ dedicated MQTT 4 GB)** | **~$95–115** |

---

## Related

- [CLOUD_DEPLOY_DO_PHASE1_ATL.md](CLOUD_DEPLOY_DO_PHASE1_ATL.md) — legacy 2-droplet (MQTT on SaaS)
- [CLOUD_DEPLOY_DO_PHASE1.md](CLOUD_DEPLOY_DO_PHASE1.md) — generic Phase 1
- [ARCHIVE_EXPORT.md](ARCHIVE_EXPORT.md)
- [MQTT.md](../deploy/cloud/MQTT.md)
