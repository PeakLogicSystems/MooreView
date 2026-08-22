# mooreVIEW C++ SDK

HTTP client library for **native C++ apps** on embedded Linux:

- **OpenWrt / WRT** (MIPS, MIPSel, musl)
- **Raspberry Pi 4 / 5** (aarch64, Raspberry Pi OS / Debian)

Talks to the mooreVIEW runtime over JSON/HTTP — LuCI, MV-ST-OEM, or legacy `est`.

Default endpoint: `http://127.0.0.1:3080/api` (legacy `est`) — **MV-ST-OEM uses port `3090`** (`MV_PORT=3090`).

## Requirements

- C++11
- **libcurl** (`libcurl4-openssl-dev` on Debian/RPi, `libcurl` on OpenWrt)
- **cJSON** (bundled in `third_party/cjson`)

## Build — Raspberry Pi (native)

On Pi OS / Debian aarch64:

```bash
sudo apt install build-essential cmake libcurl4-openssl-dev
cd sdk
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
./build/mv_poll_tags
```

With `mooreview-runtime` (or `est` server) listening on `:3080`.

## Build — OpenWrt cross-compile (MIPS)

```bash
export STAGING_DIR=/path/to/openwrt/staging_dir/toolchain-mipsel_24kc_gcc-12.3.0_musl

cmake -S sdk -B build-mips \
  -DCMAKE_TOOLCHAIN_FILE=sdk/cmake/toolchain-openwrt.cmake \
  -DCMAKE_PREFIX_PATH=$STAGING_DIR/usr

cmake --build build-mips
```

Static linking is recommended on routers (`-DMOOREVIEW_SDK_BUILD_SHARED=OFF`).

## Build — Raspberry Pi cross-compile (optional)

From an x86 host with aarch64 cross toolchain:

```bash
cmake -S sdk -B build-rpi \
  -DCMAKE_TOOLCHAIN_FILE=sdk/cmake/toolchain-rpi-aarch64.cmake

cmake --build build-rpi
```

## OpenWrt package

Feed stub: `sdk/openwrt/libmooreview-sdk`

```bash
make package/libmooreview-sdk/compile V=s
opkg install libmooreview-sdk
```

Link your daemon: `-lmooreview_sdk -lcurl`

## Usage

```cpp
#include "mooreview/mooreview.hpp"

mooreview::ClientConfig cfg;
cfg.host = "127.0.0.1";
cfg.port = 3080;

mooreview::Client client(cfg);

auto tags = client.get_tags();
if (!tags.ok) { /* handle tags.error */ }

auto rt = client.runtime_start();
```

Environment variables (examples):

| Variable | Default | Description |
|----------|---------|-------------|
| `MV_HOST` | `127.0.0.1` | Runtime host |
| `MV_PORT` | `3080` | Runtime port |
| `MV_TOKEN` | (none) | Bearer token if `MOOREVIEW_TOKEN` is set |

## API (`mooreview::Client`)

| Method | HTTP |
|--------|------|
| `get_tags()` / `put_tags()` | GET/PUT `/api/tags` |
| `runtime_status()` / `runtime_start()` / `runtime_stop()` | GET/POST `/api/runtime/*` |
| `get_program()` / `put_program()` | GET/PUT `/api/program` |
| `validate_program()` | POST `/api/program/validate` |
| `get_settings_json()` / `put_settings_json()` | GET/PUT `/api/settings` |
| `export_config_json()` / `import_config_json()` | GET/POST `/api/config/*` |
| `get_drivers_json()` / `put_drivers_json()` | GET/PUT `/api/drivers` |
| `set_force()` / `clear_force()` | POST/DELETE `/api/debug/force` |
| `get_graph_history()` / `clear_graph()` | GET `/api/graph/history`, POST `/api/graph/clear` |
| `raw_get/post/put/delete()` | Forward-compatible escape hatch |

## Integration patterns

**On-router daemon (WRT):** runtime on loopback; SDK client in C++ service for MQTT bridge, logging, BACnet, custom I/O.

**On Raspberry Pi:** run `est` runtime as systemd service; native apps link `libmooreview_sdk` for HMI glue, fieldbus gateways, or edge analytics.

**Remote host:** set `MV_HOST` to the Pi/router LAN IP if the runtime binds `0.0.0.0:3080`.

## Remote Parc (MQTT — not HTTP)

Many edge devices report to the central HMI over **MQTT** (built into `est` / `est-pc`). The C++ SDK stays **local-only** (`127.0.0.1:3080`) so on-device daemons are not coupled to the broker.

Enable on the edge runtime (`settings.json`):

```json
"mqttParc": {
  "enabled": true,
  "brokerUrl": "mqtt://192.168.1.10:1883",
  "deviceId": "site-router-01",
  "reportIntervalSec": 300
}
```

Remote programming from est-pc: `POST /api/parc/devices/:id/cmd` with ops like `put_program`, `get_tags` (proxied over MQTT). See `docs/parc-architecture.md`.

The optional `mooreview::ParcReporter` / `mv_parc_reporter` HTTP helper is **legacy** — prefer MQTT.

## Error handling

```cpp
auto r = client.get_tags();
if (!r.ok) {
  std::cerr << r.error.http_status << " " << r.error.message << "\n";
}
```

## License

Same as mooreVIEW (`est`). cJSON is MIT.
