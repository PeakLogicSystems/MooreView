# MooreVIEW architecture

## Strategy (current)

**Appliance first.** `est-pc` is the reference product: one Node process on Windows or Linux for debugging, field deployment, and non-cloud sites.

**Cloud second (~30 days).** `mooreview-cloud` stays API-compatible but is not the active development target until the appliance feature set is complete.

Goal: **nearly identical behavior and API**; only deployment topology and scale limits differ.

| | Appliance (PC / Linux) | Cloud (future) |
|--|------------------------|----------------|
| **Processes** | 1 monolith (`server.js`) | Multiple VMs (ingestion, alarms/notify, GUI API, AI) |
| **Scale** | Single site, local I/O | 10M devices, 10K users |
| **Data** | `data/*.json` + optional local Mongo | MongoDB multi-tenant |
| **Users** | `data/users.json` | Mongo `users` + JWT |
| **Tenant** | Synthetic `tenantId: local` | Real tenant per account |
| **Alarm notify** | In-process event → queue file | Message bus → notify service |

Set `MOOREVIEW_DEPLOYMENT=appliance` (default) or `cloud`. Health: `GET /health` returns `deployment` and `tenantId`.

---

## Monolith layout (appliance)

```
server.js
  ├── Express API (/api/*) + EJS dashboard
  ├── TagStore + ScanEngine + drivers
  ├── eventBus (in-process)
  └── applianceServices → alarm notifier, (future: historian hooks)
```

### Event seam

`TagStore` emits **`alarm:transition`** on new or escalated alarms:

```javascript
{ tagId, level, previousLevel, value, since }
```

On appliance, `applianceServices` subscribes and calls `alarmNotifier` (user profile queue).

On cloud, the same payload will be published to a message bus; a dedicated **alarm + notification VM** will consume it and fan out email/SMS using tenant user profiles.

No direct `tagStore → alarmNotifier` coupling — keeps PC and cloud wiring aligned.

---

## Appliance completion checklist

Use this on PC/Linux before shifting focus to cloud.

| Area | Status | Notes |
|------|--------|-------|
| ST runtime + scan | Done | |
| Tags, drivers, alarms (annunciator) | Done | |
| User profiles + alarm prefs | Done | System setup → Users |
| Alarm notify queue | Done | Delivery (SMTP/SMS) TBD |
| Historian (Mongo) | Done | Optional local Mongo |
| MQTT fleet / Parc | Done | |
| PdM batch | Done | |
| HMI composer | Done | |
| `.est` project export | Done | |
| Event bus seam | Done | `src/runtime/eventBus.js` |
| Auth (optional local) | Open | Single-operator default; token optional |
| Email/SMS delivery | Open | Queue exists; wire SendGrid/Twilio later |

---

## Cloud roadmap (after appliance)

Planned VM split (same domain code, different `main.js`):

1. **Ingestion** — MQTT, device drivers, tag updates, historian writes  
2. **Alarm + notify** — `alarm:transition` consumer, user prefs, outbound channels  
3. **GUI API** — multi-user REST/WS, HMI CRUD, auth  
4. **AI** — PdM features, DO AI or external inference  

Shared packages (future): extract `userProfileSchema`, `tagStore`, alarm evaluation, and API routers from `est-pc` so cloud imports them instead of forking.

Limits today: 1k locations / systems / devices per tenant (configurable). Target: 10M devices, 10K users with sharded ingestion and stream-based alarm evaluation.

### Cloud sim management (Phase 1)

Virtual Opta/Modbus devices for cloud demo and test:

- **Store:** `src/cloud/simStore.js` — Mongo `cloud_sims` or `data/cloud_sims.json`
- **Runner:** `src/cloud/simRunner.js` — in-process MQTT publisher to tenant Parc topics
- **API/UI:** `/api/cloud/sims`, page `/cloud/sims` (enabled when `MOOREVIEW_DEPLOYMENT=cloud` or `MOOREVIEW_CLOUD_SIMS=1`)
- **Phase 2:** k8s sim workers, Modbus TCP slaves, tenant quotas, auto driver provisioning

See `deploy/cloud/README.md` for VM usage.

### Cellular SIM management (vendor APIs)

IoT SIM/eSIM inventory from Hologram, Twilio Super SIM, and extensible vendor registry:

- **Store:** `src/cellular/simStore.js` — Mongo `cellular_sims` or `data/cellular_sims.json`
- **Adapters:** `src/cellular/vendors/` — vendor-agnostic `SimVendorAdapter` pattern
- **API/UI:** `/api/cellular/sims`, `/api/cellular/vendors`, `/api/cellular/sync`, page `/cellular/sims`
- **Enabled:** `MOOREVIEW_DEPLOYMENT=cloud` or `MOOREVIEW_CELLULAR_SIMS=1`

See `docs/CELLULAR_SIMS.md` for credentials and adding new vendors.

---

## Debugging on PC or Linux

```bash
cd est-pc
npm install
npm start          # http://127.0.0.1:3090
npm run green      # full test suite
```

Linux appliance: same tree; use `MOOREVIEW_DATA` for persistent data dir. Optional `npm run build-native` for HAL plugins.

Cloud API (when needed): `mooreview-cloud` on port 3100 — do not block appliance work on cloud parity until the checklist above is satisfied.
