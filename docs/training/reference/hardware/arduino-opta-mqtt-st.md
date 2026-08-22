# mooreVIEW Opta — ST + MQTT Parc

Combines the **ST runtime** from `arduino-opta-st` with **mooreVIEW Parc MQTT** (`mooreview/v1`).

## Flash

1. Open `MooreviewOptaMqttSt/MooreviewOptaMqttSt.ino` in Arduino IDE 2.x
2. **Tools → Board → Arduino Opta** (WiFi / Lite / RS485) — required
3. **Tools → Board Manager** → search **Arduino Opta** → install **mbed_opta** (6.x) if missing
4. Install libraries (**Sketch → Include Library → Manage Libraries**):

| Library | Required |
|---------|----------|
| ArduinoJson 7.x | Yes |
| PubSubClient | Yes (MQTT) |
| Arduino_Opta_Blueprint | Yes (expansions) |

HTTP uses **native `EthernetServer`** (`mv_http.cpp`) — same Opta mbed fix as `arduino-opta-st`. **EthernetWebServer is no longer required.**

**Sketch sources** (all under `mooreVIEWOptaMqttSt/`):

| File | Role |
|------|------|
| `mooreVIEWOptaMqttSt.ino` | Main loop, HTTP routes, MQTT config |
| `mv_st.cpp`, `mv_bc.cpp`, `mv_base64.cpp` | ST bytecode VM |
| `mv_mqtt.cpp` | Parc MQTT client |
| `mv_tags.cpp`, `mv_io.cpp`, `mv_expansions.cpp` | I/O and tags |
| `mv_store.cpp`, `mv_setup_web.cpp`, `mv_wifi.cpp` | Config / setup GUI + status panel |
| `mv_http.cpp`, `mv_device_status.cpp`, `mv_debug.cpp` | Native HTTP (Opta mbed safe) |
| `mv_ota.cpp`, `mv_version.cpp` | OTA + version |

Optional library: **Arduino_Portenta_OTA** (Board Manager) for HTTP `/api/firmware` OTA uploads.

5. Set broker IP and `deviceId` in `g_mqttCfg` (or configure on `/setup` after flash)
6. Upload

### If `PortentaEthernet.h: No such file or directory`

- **Board must be Arduino Opta** — not Uno, Mega, or a generic Portenta board without the Opta core.
- Install **Arduino Opta** in **Board Manager** (`mbed_opta`). Restart Arduino IDE after install.
- Do **not** install the standalone **Ethernet** library from Library Manager — the Opta core ships `PortentaEthernet.h` + `Ethernet.h`. Remove `Documents/Arduino/libraries/Ethernet` if present (conflicts with the core).
- Confirm **Tools → Board** shows **Arduino Opta (WiFi)** (or Lite/RS485), then compile again.

## ST environment

- Full on-device ST executor (`mv_st.cpp`) — same AST as mooreVIEW PC parser
- Tag model: `I1`–`I8`, `R1`–`R4`, `I1_RAW`–`I8_RAW`, PID/AVG/TIMER/COUNTER
- Expansion modules via setup GUI (AFX00005, AFX00007)
- Programs: `st/opta/*.st` — see `st/opta-mqtt/README.md`

## MQTT Parc

| Topic | Role |
|-------|------|
| `mooreview/v1/{id}/telemetry` | Tag snapshot + runtime status |
| `mooreview/v1/{id}/cmd` | `put_program`, `runtime_start`, `runtime_stop`, … |
| `mooreview/v1/{id}/config` | Pause telemetry during debug attach |

## Local HTTP

| Path | Purpose |
|------|---------|
| GET `/` or `/setup` | Setup page with **ST runtime status** panel (auto-refresh) |
| GET `/api/status` | JSON health + MQTT link state |
| GET `/api/tags` | Live tags |
| PUT `/api/program` | Deploy AST (local engineering) |
| GET `/api/ota` | Firmware OTA status |
| POST `/api/firmware` | Flash `.bin` (reboots) |
| GET `/setup` | Ethernet/WiFi/expansion config |

## mooreVIEW PC

Driver type **`mqtt_parc`** — use template **Arduino Opta — MQTT Parc ST runtime**. Enable **Remote execution**, **Connect**, **Start** (same as `opta_remote`). See `st/opta-mqtt/README.md`.

## Baseline I/O sketch

Raw OptaBlue mirror firmware (`baselinedigankgexpansionwMQTT`) remains separate under `arduino-opta-mqtt/` for I/O-only MQTT without ST.
