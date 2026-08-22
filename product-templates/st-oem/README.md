# MV-ST-OEM

**OpenWrt OEM programming** (production) with **Raspberry Pi** bring-up for HAL. ST program editing, tags, drivers, and I/O map. Includes the **C++ SDK** for native daemons on the router.

| Target | Use |
|--------|-----|
| **OpenWrt / WRT** | Production — MV-ST-OEM runtime + `sdk/` C++ clients |
| **Raspberry Pi 4/5** | Dev bench — SM-I-001 HAL plugin (`hal/plugins/`) |

No HMI, project library, historian, Parc UI, or alarms.

## Start

```bash
npm install
npm start
```

Open **http://127.0.0.1:3090** (or `http://<device-ip>:3090`).

On Pi with SM-I-001 HAT, also run `npm run build-native` after building `hal/plugins` (see below).

## GUI tabs

| Tab | Features |
|-----|----------|
| **Program** | ST editor, validate, save, load from `st/` tree + fixtures |
| **Tags** | Live table, JSON edit, import/export `tags.json` |
| **Drivers** | JSON edit, import/export, device presets, health |
| **I/O Map** | Live input/output grid, driver wiring (no HMI bindings) |

## C++ SDK (`sdk/`)

Native OEM apps on OpenWrt (or Pi) talk to MV-ST-OEM over HTTP:

```bash
export MV_HOST=127.0.0.1 MV_PORT=3090
```

| Path | Purpose |
|------|---------|
| `sdk/` | C++ client library + examples (`poll_tags`, `runtime_control`) |
| `sdk/cmake/toolchain-openwrt.cmake` | Cross-compile for MIPS/musl |
| `sdk/openwrt/libmooreview-sdk/` | OpenWrt feed package stub |

**OpenWrt cross-compile:** see `docs/OPENWRT.md`

**On-device build (Pi / Debian):**

```bash
sudo apt install build-essential cmake libcurl4-openssl-dev
cd sdk && cmake -S . -B build && cmake --build build
MV_PORT=3090 ./build/mv_poll_tags
```

Full API reference: `sdk/README.md`

## Raspberry Pi HAL (bench / optional I/O)

| Path | Purpose |
|------|---------|
| `hal/plugins/rpi4_sm_i001_hal.c` | Pi + Sequent SM-I-001 plugin |
| `hal/plugins/README_SM-I-001.md` | I2C setup, pin map |
| `native/` | Node HAL addon (`npm run build-native`) |

```bash
cd hal/plugins && make sm_i001 && sudo make install-sm_i001
cd ../.. && npm run build-native
```

Preset: **Raspberry Pi 4 + Sequent SM-I-001 (HAL plugin)** — or **Built-in HAL (sim)** without hardware.

## API

| Route | Purpose |
|-------|---------|
| `GET /api/dashboard` | Full snapshot |
| `PUT /api/tags` | Tag table |
| `PUT /api/drivers` | Driver configuration |
| `PUT /api/program` | Active ST program |
| `GET /api/io-map` | I/O points |

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | 3090 | HTTP port |
| `MOOREVIEW_DATA` | `./data` | Persistence |
| `MOOREVIEW_PRODUCT` | `st-oem` | Product id |
| `MV_HOST` / `MV_PORT` | `127.0.0.1` / `3090` | SDK client target |

## Deploy

- **OpenWrt:** `docs/OPENWRT.md`
- **systemd (Pi / Linux):** `deploy/mooreview-st-oem.service`

## Regenerate from dev base

```powershell
cd ..\est-pc
powershell -File scripts\create-product-forks.ps1 -Products st-oem
```

## USB install kit

Package everything for a USB drive (no `node_modules` — install on device):

```powershell
cd ..\est-pc
powershell -File scripts\package-st-oem-usb.ps1
powershell -File scripts\package-st-oem-usb.ps1 -Zip   # also creates .zip
```

Output: `est-pc/dist/MV-ST-OEM-USB/` with `INSTALL.txt`, `MANIFEST.txt`, and `mooreview-st-oem/`.
