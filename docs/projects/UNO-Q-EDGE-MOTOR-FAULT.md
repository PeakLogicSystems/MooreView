# Arduino UNO Q — edge motor fault detection

**Platform:** Arduino UNO Q (STM32U585 MCU + Qualcomm Dragonwing QRB2210 MPU)  
**Firmware:** `firmware/arduino-uno-q-mcsa/`  
**Parc template:** `arduino_uno_q_mcsa` (`mqtt_parc_telemetry`)

## Why UNO Q

| Layer | Opta MQTT ST | UNO Q MCSA | MCXN947 HVAC |
|-------|--------------|------------|--------------|
| Current capture | CT RMS / low-rate | **2 kHz × 6 CT AC waveform** | On-chip FFT |
| Spectra | **Pseudo** (`mcsaLite`, no FFT) | **True FFT** on Linux | True FFT on MCU |
| Classification | Heuristic `edgeAi` on start | Heuristic **+ spectral** on MPU | Typically host after uplink |
| Uplink | Parc MQTT | Parc MQTT | Parc MQTT |

UNO Q fills the gap between Opta panel pseudo-AI and Nexcomm true-MCSA nodes: **real spectra and on-device labels** at Arduino-shield I/O cost, with Wi-Fi 5 on the Linux side.

## Data flow

```text
SCT CTs ──► A0–A5 (six native 14-bit ADC, 3.3 V, mid-rail bias)
              │
     STM32U585  2048 Hz, 2048-pt window, 2-pump start detect
              │ Bridge RPC (base64 int16)
     QRB2210   cook fund/rotor/bearing/ecc/pump
              │ classify → edgeAi[]
              ├── MQTT  mooreview/v1/{id}/telemetry     → MooreVIEW
              └── MQTT  mooreview/v1/g/{key}/UQ_*       → Opta (Wi-Fi, optional)
```

**ADC:** UNO Q already has **6 analog inputs** — no mux for duplex 6 CT. Analog mux is the wrong tool for simultaneous MCSA; use A0–A5, or an 8-ch simultaneous ADC if you need more.

**Wi-Fi to Opta:** both are MQTT clients on the same broker. UNO Q publishes retained `{"v":…}` to `UQ_AI1`…`UQ_MOTOR2_FAULT`. Opta global-tag subscribe writes them into ST memory tags (OR into R4). Do not overwrite physical motor-fault DIs.

## Labels

Start-time (Opta-compatible): `healthy`, `seal_leak`, `clog_ragging`, `impeller_worn`.  
FFT-priority: `bearing_wear`, `eccentricity` when sideband / bearing ratios exceed thresholds.

## MooreVIEW

1. Enable MQTT Parc hub (same broker as `python/config.json`).
2. Add template **Arduino UNO Q — edge motor fault (true FFT MCSA)**.
3. `deviceId` must match firmware (`unoq_mcsa_01` default).
4. Inference: production `mode: host-supplement` trusts device `edgeAi`. Use `host-override` + `backend: onnx` to re-score with `lift-submersible-v3`.

Channel map: **six CTs, Opta duplex** (`ch` 0–2 → `pump-1`, `ch` 3–5 → `pump-2`). Two-channel payloads still map 1:1.

## Related

- Firmware README: `firmware/arduino-uno-q-mcsa/README.md`
- Architecture: `docs/AI_EDGE_CLOUD.md`
- Fixture: `st/fixtures/uno-q-mcsa-telemetry-sample.json`
- Host FFT parity: `src/inference/mcsaFft.js`
