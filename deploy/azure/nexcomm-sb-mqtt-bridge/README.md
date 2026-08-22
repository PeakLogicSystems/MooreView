# Azure — Nexcomm Service Bus → MQTT bridge

Deploy a **Service Bus queue** for Nexcomm / IoT Hub telemetry fan-out, then run the bridge next to mooreVIEW Mosquitto.

## 1. Create queue (Bicep)

```bash
az deployment group create \
  -g YOUR_RG \
  -f deploy/azure/nexcomm-sb-mqtt-bridge/main.bicep \
  -p namespaceName=YOUR_SERVICEBUS_NAMESPACE
```

Default queue name: **`nexcomm-telemetry`**

## 2. IoT Hub route (Nexcomm or shared hub)

In Azure Portal → IoT Hub → **Message routing**:

| Setting | Value |
|---------|-------|
| Endpoint | Service Bus queue `nexcomm-telemetry` |
| Route query | `true` (all device messages) or product-specific |

Or custom endpoint from Nexcomm Nexus export — messages must land on the same queue.

## 3. Bridge credentials

**Option A — Connection string (pilot)**

Create **Listen** policy on the queue → set `SERVICE_BUS_CONNECTION_STRING` in bridge env.

**Option B — Managed identity (production)**

Assign Container App / VM identity **Azure Service Bus Data Receiver** on the namespace → set `SERVICE_BUS_NAMESPACE` only.

## 4. Run converter (pick one)

### A. Azure Functions (serverless) — recommended for cloud

See **[../nexcomm-sb-mqtt-function/README.md](../nexcomm-sb-mqtt-function/README.md)**.

Publishes to **`mqtts://mqtt.mooreview.io:8883`**. Normalizes Nexcomm serials `xxxx-xxxxxx` → compact id for `/devices/<serial>/messages/events/`.

```powershell
cd deploy/azure/nexcomm-sb-mqtt-function
.\pack-nexcomm-sb-mqtt-function.ps1
func azure functionapp publish YOUR_FUNCTION_APP
```

### B. Long-running bridge (Docker / VM)

```bash
cd services/nexcomm-sb-mqtt-bridge
cp .env.example .env
# Production: MQTT_BROKER_URL=mqtts://mqtt.mooreview.io:8883
# Lab:       MQTT_BROKER_URL=mqtt://127.0.0.1:1883

npm install
npm start
```

### systemd example

```ini
[Unit]
Description=Nexcomm Service Bus MQTT bridge
After=network.target mosquitto.service

[Service]
Type=simple
WorkingDirectory=/home/mooreview/services/nexcomm-sb-mqtt-bridge
EnvironmentFile=/etc/mooreview/nexcomm-bridge.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
User=mooreview

[Install]
WantedBy=multi-user.target
```

Env file template: `deploy/azure/nexcomm-sb-mqtt-bridge/bridge.env.example`

## 5. Verify mooreVIEW ingest

1. Mosquitto running with same credentials as bridge `.env`
2. mooreVIEW cloud hub or project with `lift_station_epi` MQTT drivers
3. Publish test message to queue (Azure Portal → Service Bus → Send) or wait for live device
4. Watch bridge logs: `published N messages`
5. MV Historian / tag live values update for prefixed tags (e.g. `YELV_X1_I1`)

## Message contract (MOU exhibit)

| Field | Source | MQTT |
|-------|--------|------|
| Serial | `deviceId` / `iothub-connection-device-id` / body | Topic path |
| Payload | Device JSON | Body unchanged |
| Topic | — | `/devices/{serial}/messages/events/` |

## Cost (directional)

| Resource | ~Monthly |
|----------|----------|
| Service Bus Standard (1 queue, moderate volume) | $10–25 |
| Bridge Container App 0.25 vCPU | $15–30 |
| **Incremental** vs direct MQTT | Buffer + DLQ + multi-consumer |

## Related

- [services/nexcomm-sb-mqtt-bridge/README.md](../../../services/nexcomm-sb-mqtt-bridge/README.md)
- [deploy/cloud/MQTT.md](../../cloud/MQTT.md)
