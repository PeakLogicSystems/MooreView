# mooreVIEW pool controller — Compulab IOT-LINK (native Debian appliance)

Edge pool controller on **Compulab IOT-LINK** (Debian Linux, NXP i.MX93 **arm64**): dual RS-485 field buses, local Mosquitto for Arduino Opta I/O, and mooreVIEW HMI on port **3090**.

For a **generic** appliance (blank workspace, no pool program), see [`README-generic.md`](README-generic.md) and `install-generic.sh`.

| Layer | Role |
|-------|------|
| mooreVIEW | ST runtime `logic/30_pool_controller.st`, chemistry, pump, backwash, lighting |
| RS-485 PORT A (`/dev/ttyLP6`) | Speck BADU Pro-VI filter pump (`vgreen_epc`, 19200, slave 21) |
| RS-485 PORT B (`/dev/ttyLP4`) | Pentair shared bus (`pentair_rs485`, 9600) — IntelliFlo, IntelliChlor, UltraTemp, valves **or** legacy heat-pump-only **or** Modbus chemistry |
| Ethernet MQTT | Opta relays, dosing pumps, flow pulse (`mqtt_parc`) |
| HMI | `pool_overview`, `pool_pump`, `pool_chemistry`, `pool_backwash`, `pool_lighting` |

**Install path:** `/opt/mooreview`  
**Data:** `/var/lib/mooreview`  
**Env:** `/etc/mooreview/env`

For cloud hub / multi-tenant SaaS, see [`deploy/cloud/debian/README-debian.md`](../cloud/debian/README-debian.md).

---

## Hardware — Compulab IOT-LINK

| Spec | Value |
|------|--------|
| CPU | NXP i.MX93, dual Cortex-A53 (arm64) |
| OS | Debian Linux (preloaded `-XL` option) |
| RS-485 | Up to 2× half-duplex (order **FARS4** + **FBRS4**) |
| DIO | 3× 24 V DI/DO (optional **DIO** code) |
| Ethernet | 1× GbE |

### Industrial I/O terminal block

| Pin | Signal |
|-----|--------|
| 5–6 | **PORT A** RS-485 (+ / −) |
| 7–8 | **PORT B** RS-485 (+ / −) |
| 2–4 | DIO1–DIO3 (24 V) |
| 9 | GND |

Enable **120 Ω termination** jumpers on the bus end only (IOT-LINK ships with jumpers installed — remove on interior nodes).

### Linux serial device names

| Order code | Port | Linux device |
|------------|------|----------------|
| **FARS4** | PORT A | `/dev/ttyLP6` |
| **FBRS4** | PORT B | `/dev/ttyLP4` |

Verify on the gateway:

```bash
ls -l /dev/ttyLP*
# FARS4+FBRS4 typical: ttyLP6 (A), ttyLP4 (B)
```

mooreVIEW uses env vars `MOOREVIEW_RS485_PORT_A` and `MOOREVIEW_RS485_PORT_B` (see `.env.example`).

---

## Wiring summary

```
IOT-LINK (mooreVIEW)
 ├── PORT A RS-485 ──► Speck BADU Pro-VI (A/B, GND, 19200 8N1, slave 21)
 ├── PORT B RS-485 ──► Pentair bus: IntelliFlo (0x60), IntelliChlor, UltraTemp (0x70), valves
 │                      OR legacy heat-pump-only driver
 │                      OR DFRobot SEN0711+SEN0712 (4800 8N1, slaves 1+2)
 ├── Ethernet ──► LAN switch ──► Opta (MQTT Parc, relays R1–R4, DI I1–I2)
 └── DIO (optional, no Opta) ──► See "Without Opta" below
```

### Opta I/O map (default fixtures)

| Tag / function | Opta channel |
|----------------|--------------|
| Flow switch `POOL_FLOW_SW` | I1 |
| Flow meter pulse `POOL_FLOW_PULSE` | I2 |
| Dose base / acid / chlorine / salt | R1–R4 (via ST logic) |
| Backwash valves | expansion or additional relays |
| Lighting zones 1–6 | R1–R4, X1_R1–X1_R2 |

Set Opta `deviceId` in **Drivers** to the ATECC id from firmware `/setup`, or edit `opta_mqtt_st` in `drivers.json` after seeding.

### Without Opta (IOT-LINK DIO only)

IOT-LINK provides **3** digital lines — insufficient for full pool I/O (6 light zones + 4 doses + valves). Options:

1. **Recommended:** Arduino Opta on MQTT (default seed config).
2. **Minimal:** Map critical outputs to DIO1–DIO3 in `tags.json` and disable lighting/backwash features in ST.
3. **Future:** mooreVIEW HAL plugin for IOT-LINK DIO (not bundled — contact integrator).

---

## 1. Build transfer bundle (dev machine)

From **est-pc**:

```powershell
cd C:\Users\public\data\est-pc
tar czf dist/mooreview-iot-link-pool.tgz `
  --exclude=node_modules --exclude=.git --exclude=data `
  --exclude=products --exclude=azure `
  .
```

On Linux/macOS:

```bash
cd /path/to/est-pc
bash deploy/iot-link/create-bundle.sh
```

---

## 2. Install on IOT-LINK

Copy the archive to the gateway and run:

```bash
scp dist/mooreview-iot-link-pool.tgz root@<iot-link-ip>:/tmp/
ssh root@<iot-link-ip>

mkdir -p /opt/mooreview
tar xzf /tmp/mooreview-iot-link-pool.tgz -C /opt/mooreview --strip-components=1

# Edit MQTT password + serial ports if needed
cp /opt/mooreview/deploy/iot-link/.env.example /etc/mooreview/env
nano /etc/mooreview/env

export MOOREVIEW_SOURCE=/opt/mooreview
export MOOREVIEW_INSTALL_DIR=/opt/mooreview
bash /opt/mooreview/deploy/iot-link/install.sh
```

`install.sh` (idempotent):

| Step | Action |
|------|--------|
| Packages | Node 20, MongoDB 7, Mosquitto (via `deploy/cloud/debian/install.sh`) |
| Serial | Adds `mooreview` user to `dialout` for `/dev/ttyLP*` |
| Service | `mooreview-iot-link.service` (appliance mode, port 3090) |
| Config | Seeds `logic/30_pool_controller.st`, drivers, tags, pool HMI |

---

## Prototype on PC → deploy on IOT-LINK

mooreVIEW runs the **same** `pentair_rs485` driver on Windows (COM port) and on IOT-LINK (`/dev/ttyLP4`). Fieldbus stays on the gateway (`remoteExecution: false`); ST and drivers execute locally on the appliance.

1. **PC:** Add driver `pentair_bus` (type `pentair_rs485`), serial `COM4`, baud 9600, bus gap 120 ms. Apply hardware-wizard templates (IntelliFlo, IntelliChlor, UltraTemp, valves) or import tag fixtures from `st/fixtures/tags.pentair_*.json`.
2. **Validate:** Pump/chlorinator/heater tags update; set `IFLO_REMOTE_CMD` and `IC_TAKEOVER_CMD` true before writes if no Pentair panel is on the bus.
3. **Export:** Save project as `.est` or use the bundled seed (`buildIotLinkPoolEstDoc()` / `seed-pool-config.js`).
4. **IOT-LINK:** Set env (`MOOREVIEW_POOL_PENTAIR_BUS=true`, `MOOREVIEW_POOL_INTELLIFLO=true`), copy bundle, run `install.sh`, then `seed-pool-config.js --force`. PORT B maps to `/dev/ttyLP4` automatically.

No Opta firmware changes are required for Pentair RS-485 — the IOT-LINK polls the bus directly.

### Res-Pool-Link (home LAN + 4 IntelliValves)

Product **`res-pool-link`**: residential pool & spa, IntelliFlo + IntelliChlor on PORT B, ESP32 four-valve backwash (inlet, outlet, waste, spare).

```bash
cp /opt/mooreview/deploy/iot-link/.env.res-pool-link.example /etc/mooreview/env
bash /opt/mooreview/deploy/iot-link/install-res-pool-link.sh
```

Guide: [`docs/RES_POOL_LINK.md`](../../docs/RES_POOL_LINK.md).

### Residential pool & spa (home LAN)

Unique homeowner profile: **IntelliFlo + IntelliChlor share PORT B**, spa mode on, Opta off, Waveshare satellites join **home Wi-Fi**.

```bash
cp /opt/mooreview/deploy/iot-link/.env.residential-pool-spa.example /etc/mooreview/env
# set MOSQUITTO_PASS + confirm ttyLP ports
node /opt/mooreview/deploy/iot-link/seed-pool-config.js --force
```

Guide: [`docs/RESIDENTIAL_POOL_SPA.md`](../../docs/RESIDENTIAL_POOL_SPA.md). Do not put DFRobot Modbus probes on the Pentair cable.

---

## 3. Environment variables

Template: [`deploy/iot-link/.env.example`](.env.example)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOOREVIEW_DEPLOYMENT` | `appliance` | Edge controller (not cloud hub) |
| `MOOREVIEW_PRODUCT` | `iot-link-pool` | Product id / health metadata |
| `MOOREVIEW_DATA` | `/var/lib/mooreview` | Runtime persistence |
| `MOOREVIEW_RS485_PORT_A` | `/dev/ttyLP6` | Speck pump (PORT A / FARS4) |
| `MOOREVIEW_RS485_PORT_B` | `/dev/ttyLP4` | Pentair or Modbus chem (PORT B / FBRS4) |
| `MOOREVIEW_PRODUCT` | `iot-link-pool` | `res-pool-link` — residential pool/spa + 4 IntelliValves |
| `MOOREVIEW_POOL_PROFILE` | `default` | `residential-spa` or `res-pool-link` |
| `MOOREVIEW_POOL_PENTAIR` | `true` | Enable Pentair heat pump (legacy `pentair_hp` driver) |
| `MOOREVIEW_POOL_PENTAIR_BUS` | `false` | Shared Pentair bus driver (`pentair_bus`) — IntelliFlo + IC + heater + valves |
| `MOOREVIEW_POOL_INTELLIFLO` | follows `PENTAIR_BUS` | Use IntelliFlo instead of Speck; retargets `PUMP_*` tags for ST |
| `MOOREVIEW_POOL_INTELLIFLO_ADDR` | `96` | IntelliFlo RS-485 address (0x60) |
| `MOOREVIEW_POOL_MODBUS_CHEM` | `false` | PORT B = DFRobot SEN0711+SEN0712 (4800 8N1) instead of Pentair |
| `MOOREVIEW_POOL_OPTA_IO` | `true` | Enable `mqtt_parc` Opta driver |
| `MOOREVIEW_MQTT_BROKER` | `mqtt://127.0.0.1:1883` | Local Mosquitto for mooreVIEW hub (same host) |
| `MOSQUITTO_USER` / `MOSQUITTO_PASS` | — | Hub credentials; set `MOSQUITTO_ALLOW_ANONYMOUS=true` so Opta can connect without user/pass |

**Opta MQTT broker** (on device `/setup` → MQTT Parc broker): use this gateway's **LAN IP** (e.g. `192.168.1.176:1883`), not `127.0.0.1` and not the sketch default `192.168.1.233`.

After editing env:

```bash
sudo systemctl restart mooreview-iot-link
# Re-seed drivers only (keeps historian data):
sudo -u mooreview node /opt/mooreview/deploy/iot-link/seed-pool-config.js --force
```

---

## 4. Verification

```bash
curl -s http://127.0.0.1:3090/health | jq .
journalctl -u mooreview-iot-link -f

# RS-485 presence
ls -l /dev/ttyLP4 /dev/ttyLP6
groups mooreview   # should include dialout

# MQTT (after setting MOSQUITTO_PASS)
mosquitto_pub -h 127.0.0.1 -p 1883 -u mooreview -P '<secret>' \
  -t 'mooreview/v1/g/0001/PumpRun' -m '{"v":true,"t":"BOOL"}' -r
```

Open **http://\<iot-link-ip\>:3090** — pool overview HMI. Press **F1** for in-app help.

---

## 5. Cloud uplink (optional)

On the IOT-LINK appliance: **System setup → Cloud remote** — set `tenantId`, `gatewayId`, `brokerUrl` to your mooreVIEW cloud droplet. Parc telemetry relays to `mooreview/v1/{tenantId}/{deviceId}/telemetry`.

---

## 6. Files in this package

| Path | Purpose |
|------|---------|
| `st/fixtures/drivers.iot_link_pool.json` | Dual RS-485 + Opta MQTT drivers |
| `st/fixtures/settings.iot_link_pool.json` | Active program, HMI, MQTT defaults |
| `src/appliance/iotLinkPoolSeed.js` | Seed logic (used by install + tests) |
| `deploy/iot-link/install.sh` | Bootstrap script |
| `deploy/iot-link/seed-pool-config.js` | CLI seed / re-seed |
| `product-templates/iot-link-pool/` | Product template metadata |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Pump driver offline | `badu_pump.serialPort` → `/dev/ttyLP6`; baud 19200; termination |
| Pentair no data | PORT B `/dev/ttyLP4`; only one bus master; `busGapMs` ≥ 120 with pump + chlorinator |
| IntelliFlo won't run | Set `IFLO_REMOTE_CMD` true; disable Pentair panel or use service mode |
| Opta tags stale | Mosquitto auth matches Opta firmware; `deviceId` in driver |
| Permission denied on serial | `usermod -aG dialout mooreview` + restart service |
| Wrong tty names | Order codes — single RS485 unit may only have PORT A or B |

Compulab reference: [IOT-LINK Linux how-to](https://mediawiki.compulab.com/w/index.php?title=IOT-LINK:_Linux:_How-To_Guide)
