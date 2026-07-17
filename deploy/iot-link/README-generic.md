# MooreVIEW generic appliance — Compulab IOT-LINK (native Debian)

Edge MooreVIEW runtime on **Compulab IOT-LINK** (Debian Linux, NXP i.MX93 **arm64**): dual RS-485 ports documented, blank workspace, and HMI on port **3090**. No pool program or Speck/Pentair drivers are pre-seeded.

| Layer | Role |
|-------|------|
| MooreVIEW | Blank workspace — add ST programs, drivers, and HMI in Studio |
| RS-485 PORT A (`/dev/ttyLP6`) | Disabled `modbus_rtu` placeholder (`rs485_a`) — configure for your bus |
| RS-485 PORT B (`/dev/ttyLP4`) | Disabled `modbus_rtu` placeholder (`rs485_b`) — configure for your bus |
| MQTT | Optional — uncomment env vars when using MQTT Parc |
| MongoDB | Local `mongod` for config store (installed by debian bootstrap) |

**Install path:** `/opt/mooreview`  
**Data:** `/var/lib/mooreview`  
**Env:** `/etc/mooreview/env`  
**Service:** `mooreview-iot-link-generic.service`

For the **pool controller** build (Speck pump, Pentair, Opta, `30_pool_controller.st`), see [`README.md`](README.md).

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

### Linux serial device names

| Order code | Port | Linux device |
|------------|------|----------------|
| **FARS4** | PORT A | `/dev/ttyLP6` |
| **FBRS4** | PORT B | `/dev/ttyLP4` |

Verify on the gateway:

```bash
ls -l /dev/ttyLP*
```

MooreVIEW documents ports via `MOOREVIEW_RS485_PORT_A` and `MOOREVIEW_RS485_PORT_B` (see `.env.generic.example`). Enable and configure drivers in **Studio → Drivers** after install.

---

## Generic vs pool build

| | Generic (`install-generic.sh`) | Pool (`install.sh`) |
|--|-------------------------------|---------------------|
| Product | `iot-link` | `iot-link-pool` |
| Active program | None (blank workspace) | `logic/30_pool_controller.st` |
| Drivers | Disabled RS-485 placeholders | Speck, Pentair, Opta MQTT |
| HMI | Empty | Pool overview / pump / chemistry |
| MQTT | Off by default | Mosquitto required (Opta) |
| systemd unit | `mooreview-iot-link-generic` | `mooreview-iot-link` |
| Env template | `.env.generic.example` | `.env.example` |

---

## In-place update (existing gateway)

Preserves `/var/lib/mooreview` projects, drivers, and `/etc/mooreview/env`.

```bash
# Dev machine — build bundle (generic or pool script)
bash deploy/iot-link/create-bundle-generic.sh

# Gateway
scp dist/mooreview-iot-link-generic-*.tgz root@<iot-link-ip>:/tmp/
ssh root@<iot-link-ip>
tar xzf /tmp/mooreview-iot-link-generic-*.tgz --overwrite -C /opt/mooreview --strip-components=1
bash /opt/mooreview/deploy/iot-link/update.sh
```

On-appliance Modbus probe after update:

```bash
node /opt/mooreview/scripts/modbus-probe.js --serial /dev/ttyLP6 --slave 1
# or HTTP: POST /api/modbus/probe {"serialPort":"/dev/ttyLP6","slaveId":1}
```

---

## 1. Build transfer bundle (dev machine)

```bash
cd /path/to/est-pc
bash deploy/iot-link/create-bundle-generic.sh
```

---

## 2. Install on IOT-LINK

```bash
scp dist/mooreview-iot-link-generic-*.tgz root@<iot-link-ip>:/tmp/
ssh root@<iot-link-ip>

mkdir -p /opt/mooreview
tar xzf /tmp/mooreview-iot-link-generic-*.tgz -C /opt/mooreview --strip-components=1

cp /opt/mooreview/deploy/iot-link/.env.generic.example /etc/mooreview/env
nano /etc/mooreview/env

export MOOREVIEW_SOURCE=/opt/mooreview
export MOOREVIEW_INSTALL_DIR=/opt/mooreview
bash /opt/mooreview/deploy/iot-link/install-generic.sh
```

`install-generic.sh` (idempotent):

| Step | Action |
|------|--------|
| Packages | Node 20, MongoDB 7, Mosquitto (via `deploy/cloud/debian/install.sh`) |
| Serial | Adds `mooreview` user to `dialout` for `/dev/ttyLP*` |
| Service | `mooreview-iot-link-generic.service` (appliance mode, port 3090) |
| Config | Seeds blank workspace, disabled RS-485 driver placeholders |

---

## 3. Environment variables

Template: [`.env.generic.example`](.env.generic.example)

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOOREVIEW_DEPLOYMENT` | `appliance` | Edge controller |
| `MOOREVIEW_PRODUCT` | `iot-link` | Product id / health metadata |
| `MOOREVIEW_DATA` | `/var/lib/mooreview` | Runtime persistence |
| `MOOREVIEW_RS485_PORT_A` | `/dev/ttyLP6` | PORT A device path (FARS4) |
| `MOOREVIEW_RS485_PORT_B` | `/dev/ttyLP4` | PORT B device path (FBRS4) |
| `MOOREVIEW_MQTT_ENABLED` | (unset) | Set `true` to enable MQTT Parc in seed/settings |
| `MOOREVIEW_MQTT_BROKER` | — | Local Mosquitto when MQTT is enabled |

After editing env:

```bash
sudo systemctl restart mooreview-iot-link-generic
sudo -u mooreview node /opt/mooreview/deploy/iot-link/seed-generic-config.js --force
```

---

## 4. Verification

```bash
curl -s http://127.0.0.1:3090/health | jq .
journalctl -u mooreview-iot-link-generic -f
ls -l /dev/ttyLP4 /dev/ttyLP6
groups mooreview   # should include dialout
```

Open **http://\<iot-link-ip\>:3090** — Studio with blank workspace. Load an ST program, enable drivers, build HMI.

---

## 5. Files in this package

| Path | Purpose |
|------|---------|
| `st/fixtures/drivers.iot_link.json` | Disabled RS-485 placeholders |
| `st/fixtures/settings.iot_link.json` | Blank startup, no active program |
| `src/appliance/iotLinkGenericSeed.js` | Seed logic (used by install + tests) |
| `deploy/iot-link/install-generic.sh` | Generic bootstrap script |
| `deploy/iot-link/seed-generic-config.js` | CLI seed / re-seed |
| `product-templates/iot-link/` | Product template metadata |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Permission denied on serial | `usermod -aG dialout mooreview` + restart service |
| Wrong tty names | Order codes — single RS485 unit may only expose one port |
| MQTT drivers offline | Uncomment `MOOREVIEW_MQTT_*` and Mosquitto creds in env |
| Want pool controller | Use `install.sh` instead — see [`README.md`](README.md) |

Compulab reference: [IOT-LINK Linux how-to](https://mediawiki.compulab.com/w/index.php?title=IOT-LINK:_Linux:_How-To_Guide)
