# mooreVIEW product forks

`est-pc/` is the **development source tree** for all products. The shipped all-in-one desktop app is **MVP Suite**.

| Product | Directory | Role |
|---------|-----------|------|
| **MVP Suite** | `est-pc/` or `../mooreview-mvp-suite/` | All-in-one for **Windows and Linux**: ST + runtime + HMI + historian + Parc + alarms |
| **ST MVP** | `../mooreview-st-mvp/` | Linux ST runtime with web GUI: project, program, tags, drivers, help (no HMI/Mongo/Parc) |
| **MV Client** | `../mooreview-client/` | Browser HMI and operator UI — remote API |
| **Opta Parc** | `../mooreview-opta-parc/` | Browser HMI pointed at **mooreview.io** (`MOOREVIEW_API_BASE` default) |
| **Cloud SaaS** | `est-pc` (same repo) | Multi-tenant platform (port **3100**): login, Sites, agent hub, DO Mongo — see [CLOUD_DEPLOY_DO.md](CLOUD_DEPLOY_DO.md) |

Historical **`est/`** is the older embedded stack (OpenWrt, WebSocket). **`mooreview-st-mvp`** is the est-pc–aligned embedded fork.

## Generate forks

From `est-pc`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/create-product-forks.ps1
```

Options:

```powershell
powershell -File scripts/create-product-forks.ps1 -SkipHmiAssets
powershell -File scripts/create-product-forks.ps1 -Products mvp-suite
powershell -File scripts/create-product-forks.ps1 -Products mvp-suite,client -Clean
powershell -File scripts/create-product-forks.ps1 -Products opta-parc
```

## MVP Suite (all-in-one)

Single Node process on a Windows or Linux PC:

- Integrated dashboard (program, tags, drivers, HMI, historian, alarms, Parc)
- `.est` project files
- Optional MongoDB tag historian
- Default port **3090**

Develop in `est-pc/`; distribute a copy as `mooreview-mvp-suite/` via the fork script.

## Shared core (future npm packages)

Extract when forks stabilize:

- `@mooreview/engine`, `@mooreview/tags`, `@mooreview/runtime`, `@mooreview/drivers`, `@mooreview/programs`

## API contract (MV Client ↔ server)

Client uses `public/js/api.js`. Servers must expose `GET /api/dashboard` and the REST routes documented in the MVP Suite README.

Set client API base: `MOOREVIEW_API_BASE=https://host/api`

**Opta Parc** defaults to `MOOREVIEW_API_BASE=https://mooreview.io/api` (override if needed).

## Deploy

| Product | Target | Start |
|---------|--------|-------|
| MVP Suite | Windows / Linux PC | `npm start` → :3090 |
| ST MVP | Embedded Linux / PC browser | `npm start` → web GUI + API (systemd in `deploy/`) |
| MV Client | nginx / static | `MOOREVIEW_API_BASE=… npm start` |
| Opta Parc | nginx / static | `npm start` → :3081 (API → mooreview.io) |
| Cloud | Linux VM / container | `npm start`; Mongo + MQTT |

## Environment

| Variable | MVP Suite | ST MVP | Client | Opta Parc | Cloud |
|----------|-----------|--------|--------|-----------|-------|
| `MOOREVIEW_PRODUCT` | `mvp-suite` | `st-mvp` | `client` | `opta-parc` | `cloud` |
| `MOOREVIEW_DATA` | ✓ | ✓ | — | — | ✓ |
| `MONGODB_URI` | ✓ | — | — | — | ✓ |
| `MOOREVIEW_API_BASE` | — | — | ✓ | ✓ (default `https://mooreview.io/api`) | — |
| `PORT` | ✓ | ✓ | ✓ | ✓ (3081) | ✓ |
