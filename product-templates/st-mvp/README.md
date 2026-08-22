# mooreVIEW ST MVP

**ST programming and PLC runtime for Linux** with a built-in web GUI: projects, programs, exportable tags, drivers, and help.

## Start

```bash
npm install
npm start
```

Open **http://127.0.0.1:3090** (or `http://<device-ip>:3090` on your network).

Press **F1** or **Help** for the in-app guide.

## GUI tabs

| Tab | Features |
|-----|----------|
| **Project** | New, open/save `.est`, workspace, on-device project library |
| **Program** | ST editor, validate, save, load from `st/` tree + fixtures |
| **Tags** | Live table, JSON edit, import/export `tags.json` |
| **Drivers** | JSON edit, import/export, device presets, health |
| **Runtime** | Start / pause / stop, scan interval |

## Headless / API

`GET /health` and `GET /api/dashboard` remain available for automation.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3090 | HTTP port |
| `MOOREVIEW_DATA` | `./data` | Persistence |
| `MOOREVIEW_PRODUCT` | `st-mvp` | Product id |

## systemd (embedded Linux)

```bash
sudo cp deploy/mooreview-st-mvp.service /etc/systemd/system/
sudo systemctl enable --now mooreview-st-mvp
```

## Regenerate from dev base

```powershell
cd ..\est-pc
powershell -File scripts\create-product-forks.ps1 -Products st-mvp
```
