# mooreVIEW IOT-LINK Generic Appliance

Generic mooreVIEW appliance profile for **Compulab IOT-LINK** industrial gateways (Debian arm64, dual RS-485). Blank workspace — no pool program or vendor-specific drivers pre-seeded.

## Architecture

```
IOT-LINK (mooreVIEW appliance)
 ├── RS-485 PORT A (/dev/ttyLP6) → integrator field bus (disabled modbus_rtu placeholder)
 ├── RS-485 PORT B (/dev/ttyLP4) → integrator field bus (disabled modbus_rtu placeholder)
 ├── Ethernet → optional Mosquitto / MQTT Parc
 └── HTTP :3090 → Studio (blank workspace)
```

## Deploy

Full instructions: [`deploy/iot-link/README-generic.md`](../../deploy/iot-link/README-generic.md)

```bash
# On dev machine
bash deploy/iot-link/create-bundle-generic.sh

# On IOT-LINK
tar xzf mooreview-iot-link-generic-*.tgz -C /opt/mooreview --strip-components=1
cp /opt/mooreview/deploy/iot-link/.env.generic.example /etc/mooreview/env
bash /opt/mooreview/deploy/iot-link/install-generic.sh
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `MOOREVIEW_PRODUCT` | `iot-link` | Product identifier |
| `MOOREVIEW_DEPLOYMENT` | `appliance` | Edge runtime |
| `MOOREVIEW_RS485_PORT_A` | `/dev/ttyLP6` | PORT A (FARS4) |
| `MOOREVIEW_RS485_PORT_B` | `/dev/ttyLP4` | PORT B (FBRS4) |
| `MOOREVIEW_MQTT_ENABLED` | (unset) | Enable MQTT Parc when needed |

## systemd

```bash
sudo cp deploy/mooreview-iot-link.service /etc/systemd/system/mooreview-iot-link-generic.service
sudo systemctl enable --now mooreview-iot-link-generic
```

Or use `deploy/iot-link/install-generic.sh` which registers the unit automatically.

## Pool controller variant

For Speck pump + Pentair + Opta pool HMI, use [`product-templates/iot-link-pool`](../iot-link-pool/) and `deploy/iot-link/install.sh`.

## Fixtures

| File | Role |
|------|------|
| `st/fixtures/drivers.iot_link.json` | Disabled RS-485 placeholders |
| `st/fixtures/settings.iot_link.json` | Blank startup settings |
| `src/appliance/iotLinkGenericSeed.js` | Seed module |

Re-seed after env changes:

```bash
node deploy/iot-link/seed-generic-config.js --force
```
