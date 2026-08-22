# mooreVIEW Client

Browser **HMI + operator UI** forked from [est-pc](../est-pc). No PLC runtime in-process — connects to a mooreVIEW **cloud** or **MVP Suite** API.

When the server has cameras enabled, HMI **Camera** popup buttons resolve streams via `/api/cameras/{id}/viewer` on the API host. See server `docs/CAMERAS.md`.

## Start (local dev, API on same machine)

```bash
# Terminal 1 — server (est-pc or mooreview-cloud)
cd ..\mooreview-cloud && npm start

# Terminal 2 — client UI
cd mooreview-client
npm install
MOOREVIEW_API_BASE=http://127.0.0.1:3090/api npm start
```

Open **http://127.0.0.1:3080**

## Production

Serve `public/` and `views/` with nginx. Inject API base in `dashboard.ejs`:

```html
<script>window.MOOREVIEW_API_BASE = 'https://plant.example.com/api';</script>
<script src="/js/api-config.js"></script>
<script src="/js/api.js"></script>
```

## HMI SVG library

Re-run fork **without** `-SkipHmiAssets` to copy ~3.7k graphics, or mount the library from est-pc.

## Regenerate

```powershell
cd ..\est-pc
powershell -File scripts\create-product-forks.ps1 -Products client
```
