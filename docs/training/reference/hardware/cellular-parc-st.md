# MooreVIEW cellular Parc ST — ESP32 soft PLC

ESP-IDF firmware for **LilyGO T-ETH-ELITE-A7670X**. The ESP32 runs **ST as MVBC bytecode** (same IR as the PC soft PLC and Arduino Opta) and speaks **MQTT Parc** directly to the MooreVIEW cloud broker.

This is **not** an Opta bridge. There is no local MQTT broker and no Opta in the path — the board *is* the PLC.

## Architecture

```
 [ est-pc / cloud Mosquitto ]
              ^
         MQTT Parc (auth)
              |
 [ T-ETH-ELITE-A7670X ]
   - cellular WAN (A7670) or bench Wi-Fi
   - mqtt_parc client  (put_program, runtime_*, telemetry)
   - MVBC VM           (same as Opta mv_bc / PC stBcRunner)
   - tag store + scan loop
   - Sequent SM-I-010   (I1..I4 opto, R1..R4 relays via I2C)
```

| Direction | Topics |
|-----------|--------|
| Device → hub | `mooreview/v1/{deviceId}/telemetry`, `online`, `cmd/response` |
| Hub → device | `mooreview/v1/{deviceId}/cmd`, `config` |

`platform`: `lilygo-t-eth-elite-parc-st` · `protocolVersion`: **2**

## vs cellular-opta-gateway

| | Opta gateway | **This (Parc ST)** |
|--|--------------|---------------------|
| ST runs on | Arduino Opta | **ESP32** |
| MQTT role | Local broker + cloud bridge | Parc **device** client |
| Opta required | Yes | No |

## Setup

1. Flash firmware (`idf.py set-target esp32s3 && idf.py build flash monitor`).
2. Join Wi-Fi AP **`MooreVIEW-ParcST`** / `mooreview`.
3. Open `http://192.168.4.1:8080/setup` — set deviceId, cloud MQTT host/user/pass, APN.
4. In MooreVIEW: add device with transport **`mqtt_parc`**, matching `deviceId`.
5. Download & Start ST (e.g. lift simplex) — hub sends `put_program` with base64 MVBC.

### Bench (no SIM)

Join the setup AP and open `http://192.168.4.1:8080/setup` — enter your **router Wi-Fi SSID and password** under **Router Wi-Fi (WAN)**. The device reconnects immediately on Save.

### Field

Disable Wi-Fi WAN fallback; enable LTE; insert SIM; set APN.

## Sequent SM-I-010 I/O

[SM-I-010](https://sequentmicrosystems.com/products/four-relays-four-inputs-for-raspberry-pi) = 4 relays + 4 HV opto inputs (4relind). Enabled by default.

| Parc tag | HAT channel |
|----------|-------------|
| `I1`..`I4` | Opto inputs 1..4 |
| `R1`..`R4` | Relays 1..4 |
| `I5`..`I8` | Soft (RAM) |

**Wiring (T-ETH-Elite 40-pin, Pi-compatible):**

| Signal | GPIO |
|--------|------|
| SDA | **17** (board default) |
| SCL | **18** (board default) |
| 3V3 / 5V / GND | match HAT power needs |

Stack level jumpers → menuconfig `SM_I010_STACK` (default 0). Driver probes `0x38`/`0x20` (IO-exp) and `0x0e` (CPU v4+).

Boot log: `[io  ] Sequent SM-I-010 online` or soft-I/O fallback if absent.

## Build

```powershell
cd cellular-parc-st
idf.py set-target esp32s3
idf.py menuconfig
idf.py build flash monitor
```

## Files

| Path | Role |
|------|------|
| `main/st/mv_bc.c` | MVBC VM (Opta-compatible) |
| `main/st/mv_tags.c` | Tag / timer / PID / FB store |
| `main/st/mv_program.c` | Load base64 BC + scan |
| `main/sm_i010.c` | Sequent SM-I-010 I2C driver |
| `main/mqtt_parc.c` | Parc MQTT client |
| `main/modem_net.c` | Cellular / Wi-Fi WAN |
| `main/setup_web.c` | Provisioning UI |

## Device template

`src/devices/templates/lilygo_t_eth_parc_st.json` — LilyGO T-ETH + SM-I-010 Parc ST.
