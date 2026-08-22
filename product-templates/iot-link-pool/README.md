# mooreVIEW IOT-LINK Pool Controller

Pool controller appliance profile for **Compulab IOT-LINK** industrial gateways (Debian arm64, dual RS-485).

## Architecture

```
IOT-LINK (mooreVIEW appliance)
 ├── RS-485 PORT A (/dev/ttyLP6) → Speck BADU pump (vgreen_epc, 19200, slave 21)
 ├── RS-485 PORT B (/dev/ttyLP4) → Pentair shared bus (IntelliFlo, IntelliChlor, UltraTemp, valves)
 ├── Ethernet → Mosquitto → Opta (relays, dosing, flow pulse) — off in residential-spa
 ├── Home Wi-Fi → Waveshare ESP32-S3-Relay-1CH-U satellites (spa jets, lights, acid)
 └── HTTP :3090 → pool_overview HMI

Residential home pad: `MOOREVIEW_POOL_PROFILE=residential-spa` — IntelliFlo + IntelliChlor share PORT B. See `docs/RESIDENTIAL_POOL_SPA.md`.

Product **`res-pool-link`** is that pad plus four IntelliValves. See `product-templates/res-pool-link/` and `docs/RES_POOL_LINK.md`.
```

ST program: `st/logic/30_pool_controller.st`

## Deploy

Full instructions: [`deploy/iot-link/README.md`](../../deploy/iot-link/README.md)

```bash
# On dev machine
bash deploy/iot-link/create-bundle.sh

# On IOT-LINK
tar xzf mooreview-iot-link-pool-*.tgz -C /opt/mooreview --strip-components=1
cp /opt/mooreview/deploy/iot-link/.env.example /etc/mooreview/env
bash /opt/mooreview/deploy/iot-link/install.sh
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOOREVIEW_PRODUCT` | `iot-link-pool` | Product identifier |
| `MOOREVIEW_DEPLOYMENT` | `appliance` | Edge runtime |
| `MOOREVIEW_RS485_PORT_A` | `/dev/ttyLP6` | Speck pump |
| `MOOREVIEW_RS485_PORT_B` | `/dev/ttyLP4` | Pentair / Modbus chem |
| `MOOREVIEW_POOL_OPTA_IO` | `true` | MQTT Parc Opta driver |
| `MOOREVIEW_POOL_PROFILE` | `default` | `residential-spa` — home pool & spa (shared Pentair bus, spa mode, Waveshare on home Wi-Fi). See `docs/RESIDENTIAL_POOL_SPA.md` |
| `MOOREVIEW_POOL_WAVESHARE_RELAYS` | (unset) | Satellite relays `role:deviceId[:diRole],…` — see `docs/WAVESHARE_ESP32S3_RELAY_POOL.md` |
| `MOOREVIEW_POOL_MODBUS_CHEM` | `false` | PORT B = SEN0711 + SEN0712 (4800 8N1) → `PH_AI` / `ORP_AI`. Do not mix with Pentair. |

## systemd

```bash
sudo cp deploy/mooreview-iot-link-pool.service /etc/systemd/system/mooreview-iot-link.service
sudo systemctl enable --now mooreview-iot-link
```

Or use `deploy/iot-link/install.sh` which registers the unit automatically.

## Fixtures

| File | Role |
|------|------|
| `st/fixtures/drivers.iot_link_pool.json` | Pre-wired drivers |
| `st/fixtures/settings.iot_link_pool.json` | Active program + HMI |
| `st/fixtures/tags.pool_controller.json` | Pool tags |
| `src/appliance/iotLinkPoolSeed.js` | Seed module |

Re-seed after env changes:

```bash
node deploy/iot-link/seed-pool-config.js --force
```

## Develop in est-pc

This template is metadata + deploy assets; runtime code lives in `est-pc/`. No separate fork required unless shipping a slim binary tree.
