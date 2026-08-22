# mooreVIEW Opta Parc

Browser **HMI + operator UI** forked from [est-pc](../est-pc), preconfigured to talk to **mooreview.io** cloud.

Same client shell as MV Client; default API base is `https://mooreview.io/api` (Opta Parc / MQTT Parc sites managed in Cloud Studio).

## Start

```bash
npm install
npm start
```

Open **http://127.0.0.1:3081**

Override the API host if needed:

```bash
MOOREVIEW_API_BASE=https://other-host/api npm start
```

## Production

Serve `public/` and `views/` with nginx. The fork injects the API base in `dashboard.ejs`:

```html
<script>window.MOOREVIEW_API_BASE = 'https://mooreview.io/api';</script>
<script src="/js/api-config.js"></script>
<script src="/js/api.js"></script>
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3081 | HTTP listen port |
| `MOOREVIEW_API_BASE` | `https://mooreview.io/api` | Cloud / server REST API |
| `MOOREVIEW_PRODUCT` | `opta-parc` | Product id |

## Regenerate

```powershell
cd ..\est-pc
powershell -File scripts\create-product-forks.ps1 -Products opta-parc
```
