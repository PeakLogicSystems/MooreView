# Azure Function — Nexcomm Service Bus → mqtt.mooreview.io (build #1)

Serverless converter: **Service Bus queue `nexcomm-telemetry`** → **MQTT** on the Phase 1 cloud broker.

```text
Nexcomm / IoT Hub  →  SB queue nexcomm-telemetry
                           ↓
              nexcommTelemetryToMqtt (this Function)
                           ↓
         mqtts://mqtt.mooreview.io:8883
         topic /devices/<serial>/messages/events/
                           ↓
         Your inbound templates (tag alignment)
```

**Build #1 = this Function.** Inbound device templates / tag maps are owned separately (you).

## Serial conversion

| Upstream (Nexcomm) | MQTT topic id |
|--------------------|---------------|
| `xxxx-xxxxxx` | `xxxxxxxxxx` (hyphens stripped, lowercased) |
| Hex DSN / IMEI | lowercased, unchanged |

Topic: `/devices/{id}/messages/events/`

## Build (local — no Azure CLI required)

```powershell
cd deploy/azure/nexcomm-sb-mqtt-function
.\build.ps1
# → dist/nexcomm-sb-mqtt-function.zip
npm test
```

`build.ps1` syncs `mapMessage.js` from `services/nexcomm-sb-mqtt-bridge` so serial rules stay identical.

From repo root:

```bash
npm run build:nexcomm-sb-mqtt-function
```

## Infra (Azure)

```bash
az deployment group create -g YOUR_RG \
  -f deploy/azure/nexcomm-sb-mqtt-function/main.bicep \
  -p serviceBusNamespaceName=YOUR_NS \
  -p serviceBusConnectionString='Endpoint=sb://...' \
  -p mqttPassword='MOSQUITTO_PASS'
```

Defaults: Consumption (Y1), `MQTT_BROKER_URL=mqtts://mqtt.mooreview.io:8883`, queue `nexcomm-telemetry`.

Publish code:

```bash
az functionapp deployment source config-zip \
  -g YOUR_RG -n APP_NAME \
  --src dist/nexcomm-sb-mqtt-function.zip
```

## App settings

| Setting | Purpose |
|---------|---------|
| `ServiceBusConnection` | Listen on `nexcomm-telemetry` |
| `SERVICE_BUS_QUEUE` | `nexcomm-telemetry` |
| `MQTT_BROKER_URL` | `mqtts://mqtt.mooreview.io:8883` |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | Match cloud Mosquitto (`mqtt.env.template`) |
| `MQTT_EVENTS_TOPIC_TEMPLATE` | `/devices/{serial}/messages/events/` |

Cloud broker reference: `deploy/cloud/phase1/droplet-mqtt/mqtt.env.template`

## Your step — inbound templates

Apply / author inbound templates so tags align to Nexcomm JSON (e.g. `lift_station_epi` or custom inbound maps). Use **normalized** serials (no hyphens) and broker `mqtts://mqtt.mooreview.io:8883`.

## Local run

```bash
cp local.settings.json.example local.settings.json
npm install
npm test
func start   # requires Azure Functions Core Tools
```
