# mooreVIEW MVP Suite

**All-in-one** mooreVIEW for **Windows and Linux**: ST programming, integrated HMI, PLC runtime, tag historian (MongoDB), alarms, and MQTT Parc — single install, one process.

## Start

```bash
npm install
npm start
```

Open **http://127.0.0.1:3090** (default port).

Press **F1** in the app for the full user guide.

## Includes

- ST editor and PLC scan engine
- Tags, drivers (Modbus, MQTT, serial, …)
- HMI screens and graphics library
- Historian trend pens and MongoDB logging
- Alarms, Parc hub, `.est` project files
- IP cameras (ONVIF/Reolink), go2rtc live view, GridFS snapshots, vision AI, HMI I/O overlays on live video

See [docs/CAMERAS.md](docs/CAMERAS.md) for camera setup. Press **F2** for Training module **M15**.

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3090 | HTTP listen port |
| `MOOREVIEW_DATA` | `./data` | Config and persistence |
| `MONGODB_URI` | — | Tag historian (optional) |
| `MOOREVIEW_PRODUCT` | `mvp-suite` | Product id (informational) |

## Other mooreVIEW products

| Product | Use when |
|---------|----------|
| **MVP Suite** (this) | Desktop or plant PC — everything local |
| **ST MVP** | Embedded Linux — runtime API only |
| **MV Client** | Browser UI against a remote server |
| **Cloud server** | Headless Linux API + historian + Parc |

See `docs/PRODUCT_FORKS.md` in the development tree.

## Regenerate from dev base

```powershell
cd ..\est-pc
powershell -File scripts\create-product-forks.ps1 -Products mvp-suite
```
