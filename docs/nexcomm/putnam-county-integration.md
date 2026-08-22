# Putnam County Utilities — Nexcomm / MooreVIEW Integration

Pilot site for **Track A** Nexcomm lift integration: six live lift stations on Nexus Cloud, one MLE WWTP plant, wired to MooreVIEW via `lift_station_epi` MQTT drivers.

**Canonical data:** `scripts/putnam-fleet/fleet-data.js` (Nexus account `69f8ff6be55ed697223831ea`, Jul 2026 scan).

## Fleet map

| Site | Product | MQTT serial (DSN) | Config | MV driver |
|------|---------|-------------------|--------|-----------|
| Master Lift — 125 Yelvington Rd | EdgePoint Industrial | `40a36bce47f3` | Triplex | `ls_yelvington` |
| Currie Lift Station | LiftPoint | `40a36bcd7bb4` | Duplex | `ls_currie` |
| Paradise Point Lift Station | LiftPoint | `40a36bc74cee` | Duplex | `ls_paradise` |
| Hiawatha Lift Station | LiftPoint | `40a36bc74b17` | Duplex | `ls_hiawatha` |
| Putnam County Blvd Lift Station | LiftPoint | `40a36bce4ce2` | Duplex | `ls_pcblvd` |
| Port Buena Vista Lift Station | LiftPoint | `40a36bc74e62` | Duplex | `ls_pbv` |
| MLE WWTP (3200 Crill Ave) | IOT-LINK appliance | `mv_pcu_mle_plant_01` | Plant SCADA | Modbus RTU + `cloudRemote` |
| WWTP 235 Gilbert Rd | EPP dialer (monitor only) | `40a36bce4a00` | — | Not in MV lift drivers |

All six lifts use template **`lift_station_epi`**, profile **`epi_master`**, subscribe topic **`/devices/<serial>/messages/events/`**.

## MooreVIEW projects

| Project | Role | Deploy target |
|---------|------|---------------|
| `putnam-county-cloud` | 6× MQTT lift drivers, fleet 3D map, lift faceplates | Azure cloud VM |
| `putnam-mle-plant` | MLE WWTP Modbus + `cloudRemote` uplink | Compulab IOT-LINK on site |
| `putnam-county` | Combined plant + lifts (operator PC view) | Local / demo |

## Track A — MQTT bridge (recommended first)

Nexcomm field devices already publish Nexus JSON. MooreVIEW ingests without changing drivers:

```text
EPI / LiftPoint (cellular)
        ↓
Nexcomm MQTT  —or—  IoT Hub → Service Bus queue
        ↓
nexcomm-sb-mqtt-bridge  (optional Azure relay)
        ↓
MooreVIEW Mosquitto :1883
        ↓
lift_station_epi mqttDriver → tags → ST · HMI · PdM · CMMS
```

See [Service Bus → MQTT bridge](../../services/nexcomm-sb-mqtt-bridge/README.md) and `deploy/azure/nexcomm-sb-mqtt-bridge/`.

**Nexcomm hot tier:** Cosmos DB (~72 hr TTL) + ADLS datalake spool — MooreVIEW does not duplicate that path; use MV for live process + PdM/CMMS, ADLS for long-term analytics if needed.

**Azure serverless (build #1):** Service Bus → `mqtts://mqtt.mooreview.io:8883` via [`deploy/azure/nexcomm-sb-mqtt-function`](../../deploy/azure/nexcomm-sb-mqtt-function/). Pack with `npm run build:nexcomm-sb-mqtt-function`. Inbound templates / tag alignment are configured separately in mooreVIEW.

## Track B — on-device (future)

MV-ST-OEM + `libmooreview-sdk` on OpenWrt/MIPS EPI firmware — displaces Nexus Cloud at the edge. Same tag map as Track A.

## Commands

```bash
# Regenerate fleet manifest, CSV, .est.json projects, ST rollup
npm run generate:putnam-fleet

# Local lab: open putnam-county — mqtt_sim_putnam driver simulates all six lifts in-process
# (no Mosquitto or external script required). Optional legacy scripts:
npm run mqtt:start
npm run simulate:putnam-mqtt-lifts

# Tests
node --test test/putnamFleet.test.js test/liftStationEpiTemplate.test.js
npm run test:nexcomm-sb-mqtt-bridge
```

## Deploy env templates

| File | Use |
|------|-----|
| `deploy/cloud/.env.putnam.example` | Cloud VM — tenant `putnam-county-utilities`, Mosquitto |
| `deploy/iot-link/.env.putnam-mle.example` | On-site IOT-LINK appliance |

## Related

- Template: `src/devices/templates/lift_station_epi.json`
- Sample MQTT payload: `st/fixtures/edgepoint-lift-station-sample.json`
- Fleet 3D map: `public/samples/putnam-county-fleet-3d.html`
- Prior Nexus scan context: [Nexcomm README](README.md) · ACE fleet scaffold (`npm run generate:ace-fleet`)
