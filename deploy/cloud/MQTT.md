# mooreVIEW Cloud MQTT

MQTT on the cloud droplet supports **Parc field devices (Opta)**, **site mooreVIEW appliances**, and **cloud sim runners**.

## Ports

| Port | Protocol | Use |
|------|----------|-----|
| **1883** | Plain MQTT | LAN/dev, legacy clients, Opta without TLS |
| **8883** | MQTT over TLS | Production appliances and TLS-capable clients |

Enable TLS with `MOSQUITTO_TLS=true` in `/etc/mooreview/env` (Debian) or `.env` (Docker), then re-run `install.sh` or restart the compose stack.

## Credentials (required by default)

| Variable | Example | Purpose |
|----------|---------|---------|
| `MOSQUITTO_USER` | `mooreview` | Broker username |
| `MOSQUITTO_PASS` | *(strong secret)* | Broker password |
| `MOSQUITTO_ALLOW_ANONYMOUS` | `false` | Set `true` only for lab/LAN |

`install.sh` writes `/etc/mosquitto/passwd`. Rotate by editing env and re-running install.

### Where to configure matching credentials

| Client | Settings |
|--------|----------|
| **Cloud VM mooreVIEW hub** | System setup → MQTT Parc → broker URL + username + password |
| **Site appliance uplink** | System setup → Cloud remote → broker URL + username + password |
| **Opta** | `http://<opta-ip>/setup` → MQTT Parc broker → host, port, username, password |

### Broker URLs

| Deployment | Plain | TLS |
|------------|-------|-----|
| Docker (internal) | `mqtt://mosquitto:1883` | `mqtts://mosquitto:8883` |
| Droplet (public) | `mqtt://mooreview.io:1883` | `mqtts://mooreview.io:8883` |
| Droplet (IP) | `mqtt://206.189.198.96:1883` | `mqtts://206.189.198.96:8883` |

Node.js `mqtt` accepts `mqtts://` URLs with `rejectUnauthorized: false` only when explicitly configured (not default in mooreVIEW).

## Topic layout

**Site / direct device (Opta on LAN or flat cloud connect):**

```
mooreview/v1/{deviceId}/telemetry
mooreview/v1/{deviceId}/cmd
mooreview/v1/{deviceId}/cmd/response
```

**Appliance uplink (tenant-scoped):**

```
mooreview/v1/{tenantId}/{deviceId}/telemetry
```

Configure tenant uplink on the **site appliance** (not on the cloud VM):

- `cloudRemote.enabled=true`
- `cloudRemote.tenantId` — from cloud pairing
- `cloudRemote.gatewayId` — appliance UUID
- `cloudRemote.brokerUrl` — `mqtts://mooreview.io:8883` (or plain `:1883`)
- `cloudRemote.username` / `cloudRemote.password` — match Mosquitto

Local Opta still uses the **LAN broker**; the appliance relays Parc telemetry to the cloud.

## TLS setup (Debian droplet)

1. Set in `/etc/mooreview/env`:

   ```bash
   MOSQUITTO_TLS=true
   MOSQUITTO_TLS_PORT=8883
   MOOREVIEW_DOMAIN=mooreview.io
   MOSQUITTO_USER=mooreview
   MOSQUITTO_PASS=<secret>
   ```

2. Optional: obtain HTTPS cert first (`certbot --nginx -d mooreview.io`) — MQTT TLS reuses Let's Encrypt files.

3. Re-run install:

   ```bash
   sudo bash /home/mooreview/deploy/cloud/debian/install.sh
   ```

4. Open firewall:

   ```bash
   sudo ufw allow 8883/tcp comment 'MQTT TLS'
   ```

5. Verify:

   ```bash
   mosquitto_pub -h mooreview.io -p 8883 --cafile /etc/mosquitto/certs/server.crt \
     -u mooreview -P '<secret>' -t 'test/ping' -m ok
   ```

## Opta firmware

mooreVIEWOptaMqttSt **v2.3.63+** stores broker host, port, username, and password in device NV (`/setup`).

- Plain cloud: host `mooreview.io`, port `1883`, user/pass from droplet env
- TLS on Opta is **not** supported yet — use site appliance relay or plain 1883 for direct cloud tests

Full commissioning checklist: [docs/OPTA_PARC_CLOUD.md](../../docs/OPTA_PARC_CLOUD.md).

## Quick smoke test (from droplet)

```bash
mosquitto_pub -h 127.0.0.1 -p 1883 -u mooreview -P "$MOSQUITTO_PASS" \
  -t 'mooreview/v1/demo-tenant/opta_01/telemetry' \
  -m '{"deviceId":"opta_01","tags":[{"id":"I1","type":"BOOL","value":true}]}'
```
