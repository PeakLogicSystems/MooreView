# Opta Parc — cloud MQTT (port 8883 + credentials)

Use these settings on **MooreviewOptaMqttSt v2.4.5+** after reflash.

- v2.4.4 trusts **ISRG Root X2** (Let's Encrypt ECDSA). Older builds that pinned the leaf cert fail TLS verify on Opta.
- v2.4.5: checking **Use TLS** on `/setup` sets port **8883** (and the reverse); status refresh is more resilient.
- v2.4.6: **Test MQTT** is async (after HTTP releases Ethernet). Fixes Opta “USB shows IP / Ethernet dead” after TLS test.
- v2.4.7: MQTT TLS reconnect backoff — stops failed cloud connects from starving `/api/status` (`Failed to fetch`).

## Broker (mv-mqtt)

| Field | Value |
|-------|--------|
| **Host** | `mqtt.mooreview.io` (or `167.99.9.171`) |
| **Port** | **8883** |
| **TLS** | **On** |
| **Username** | `mooreview` |
| **Password** | *(see `/etc/mooreview/mqtt.env` → `MOSQUITTO_PASS` on mv-mqtt)* |

Read password on the MQTT droplet:

```bash
ssh mv-mqtt
sudo grep MOSQUITTO_PASS /etc/mooreview/mqtt.env
```

## Opta `/setup` → MQTT Parc broker

| Field | Value |
|-------|--------|
| Broker host | `mqtt.mooreview.io` |
| Port | `8883` |
| Use TLS | checked |
| Username | `mooreview` |
| Password | *(same as `MOSQUITTO_PASS`)* |

Save — MQTT reconnects immediately.

## Compile-time preset (field flash without typing password)

Copy `opta-cloud-mqtt.defaults.example` → `opta-cloud-mqtt.defaults` (do not commit), set values, then in Arduino IDE add to **Compiler flags** (or `mv_config_local.h`):

```
-DMV_MQTT_CLOUD_PRESET=1
```

With preset enabled, first boot seeds NV with broker `mqtt.mooreview.io`, port `8883`, TLS on, and the user/pass from the defaults file.

## Topics (unchanged)

```
mooreview/v1/{deviceId}/telemetry
mooreview/v1/{deviceId}/cmd
```

`deviceId` = `opta_<ATECC608 serial>` (automatic).

## TLS certificate

Cloud broker may use a self-signed cert (`CN=mqtt.mooreview.io`) until Let's Encrypt is installed. If connect fails with TLS error, paste the broker PEM into `mv_mqtt_ca.h` (see `mv_mqtt_ca.h.example`) and reflash.

Fetch PEM from the droplet:

```bash
ssh mv-mqtt "openssl s_client -connect 127.0.0.1:8883 -servername mqtt.mooreview.io </dev/null 2>/dev/null | openssl x509 -outform PEM"
```

## Verify from droplet

```bash
mosquitto_pub -h mqtt.mooreview.io -p 8883 --insecure \
  -u mooreview -P "$MOSQUITTO_PASS" \
  -t 'test/opta/ping' -m ok
```

## Older firmware (< 2.4.0)

Prior builds had **no MQTT user/pass and no TLS**. Options:

1. Reflash **v2.4.0+** (recommended)
2. Interim: LAN gateway with `MOSQUITTO_ALLOW_ANONYMOUS=true` on `:1883`, appliance uplink to cloud on `:8883`

## NanoPi NEO CAT1 gateway (LAN broker)

When Opta uses a **NanoPi** as the cellular bridge (not direct cloud MQTT), see [NANOPI-OPTA-GATEWAY-MQTT.md](./NANOPI-OPTA-GATEWAY-MQTT.md):

- Opta → **`192.168.1.1:1883`** (no TLS/auth)
- NanoPi Mosquitto bridge → **`mqtt.mooreview.io:8883`** (TLS + `mooreview` user)
