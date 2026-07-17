# Building cellular Parc ST

ESP-IDF project: `cellular-parc-st/` · target **esp32s3** · board **T-ETH-ELITE-A7670X**.

## Windows

```powershell
cd cellular-parc-st
idf.py set-target esp32s3
idf.py menuconfig
idf.py build
idf.py -p COM7 flash monitor
```

## menuconfig checklist

| Setting | Bench | Field |
|---------|-------|-------|
| Bench Wi-Fi WAN | **on** + SSID/pass | **off** |
| LTE modem | off | **on** |
| Cloud MQTT host default | droplet IP | same |
| Board | T-ETH-ELITE-A7670X | same |

## Smoke test

1. WAN up → Parc MQTT connects → `online` retained true.
2. Boot log shows `Sequent SM-I-010 online` (or soft I/O if HAT unplugged).
3. From MooreVIEW: Download & Start a small ST program → device logs `put_program OK`.
4. Telemetry shows `smI010: true` and tags; toggle opto → `I1` changes; force `R1` → relay clicks.
5. `runtime.running` true.
