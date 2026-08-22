# Nexcomm Service Bus → MQTT Bridge

Forwards **Azure Service Bus** telemetry (IoT Hub / Nexcomm pipeline) to **mooreVIEW Mosquitto** using the **IoT Hub device topic** shape that `lift_station_epi` drivers already subscribe to:

```text
/devices/<serial>/messages/events/
```

**mooreVIEW application code is unchanged** — Putnam County, ACE LiftPoint fleet, and other `lift_station_epi` projects ingest via existing MQTT drivers.

## Flow

```text
IoT Hub D2C  →  Service Bus queue "nexcomm-telemetry"
                      ↓
              nexcomm-sb-mqtt-bridge (this service)
                      ↓
              Mosquitio :1883 / :8883
                      ↓
              mooreVIEW mqttDriver → tags → ST · HMI · PdM · CMMS
```

## Quick start (local dev)

```bash
cd services/nexcomm-sb-mqtt-bridge
cp .env.example .env
# Edit SERVICE_BUS_CONNECTION_STRING and MQTT_* to match your lab

npm install
npm test
npm start
```

Run mooreVIEW cloud hub on the same host with Mosquitto (`deploy/cloud/docker-compose` or DO install). Open project `ace-liftpoint-fleet` or `putnam-county-cloud`.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVICE_BUS_CONNECTION_STRING` | Yes* | Queue/topic listen connection string |
| `SERVICE_BUS_NAMESPACE` | Yes* | Managed identity mode (Azure-hosted) |
| `SERVICE_BUS_QUEUE` | Yes** | Default `nexcomm-telemetry` |
| `SERVICE_BUS_TOPIC` + `SERVICE_BUS_SUBSCRIPTION` | Yes** | Topic mode instead of queue |
| `MQTT_BROKER_URL` | Yes | mooreVIEW broker (`mqtt://mosquitto:1883`) |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | If auth | Match `MOSQUITTO_USER` / `MOSQUITTO_PASS` |
| `MQTT_EVENTS_TOPIC_TEMPLATE` | No | Default `/devices/{serial}/messages/events/` |

\* One of connection string or namespace (with managed identity).

\** Queue **or** topic+subscription.

## Upstream message shape

The bridge accepts:

1. **Raw device JSON** (same as Nexus MQTT sample payloads)
2. **Wrapped envelope** from an IoT Hub export job:

```json
{
  "tenantId": "ace-septic-waste",
  "serial": "862406071948166",
  "body": { "in3_starts": 142, "inputs": [ ... ] }
}
```

Serial resolution order: `applicationProperties.deviceId` → `iothub-connection-device-id` → `body.serial` / `body["10"]` → subject parse.

**Normalization:** hyphenated Nexcomm IDs (`xxxx-xxxxxx`) are stripped to compact lowercase before building the MQTT topic. Apply `lift_station_epi` with the same normalized `serialNum`.

## Azure deploy

- **Serverless Function (mqtt.mooreview.io):** [`deploy/azure/nexcomm-sb-mqtt-function/`](../../deploy/azure/nexcomm-sb-mqtt-function/)
- **Queue Bicep + VM bridge:** [`deploy/azure/nexcomm-sb-mqtt-bridge/`](../../deploy/azure/nexcomm-sb-mqtt-bridge/)

### IoT Hub route (Nexcomm side)

Route all device telemetry to the queue:

```text
Endpoint: Service Bus queue nexcomm-telemetry
Condition: true
```

### MOU exhibit

Include in Nexcomm partnership docs:

- Queue name: `nexcomm-telemetry`
- MQTT topic mapping table (serial → `/devices/{serial}/messages/events/`)
- Payload: pass-through JSON (no field rename)

## Operations

| Concern | Behavior |
|---------|----------|
| **Retries** | Failed messages **abandoned** → Service Bus redelivery |
| **DLQ** | Configure max delivery count on queue (e.g. 10) |
| **Duplicates** | MV tags idempotent; optional dedupe at bridge later |
| **Health** | Logs JSON stats every `BRIDGE_HEALTH_LOG_INTERVAL_MS` |
| **Shutdown** | SIGINT/SIGTERM closes receiver + MQTT cleanly |

## Related mooreVIEW docs

- [deploy/cloud/MQTT.md](../../deploy/cloud/MQTT.md) — broker credentials
- [docs/nexcomm/MooreVIEW-Nexcomm-Partnership-Discussion-MOU.md](../../docs/nexcomm/MooreVIEW-Nexcomm-Partnership-Discussion-MOU.md)
- `scripts/ace-fleet/` · `data/projects/ace-liftpoint-fleet.est.json`

## Tests

```bash
npm test
```

From repo root:

```bash
npm run test:nexcomm-sb-mqtt-bridge
```
