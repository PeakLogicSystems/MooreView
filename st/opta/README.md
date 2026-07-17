# Arduino Opta Modbus RTU (MooreVIEW)

Matches the **Opta Modbus RTU slave** sketch (slave ID **2**, **9600 8N1**):

| Modbus | Address | MooreVIEW tags |
|--------|---------|----------------|
| Discrete inputs | 0–7 | `I1`–`I8` |
| Coils (relays) | 0–3 | `R1`–`R4` |
| Input registers | 0–7 | `I1_RAW`–`I8_RAW` (ADC 0–1023) |
| Holding registers | 0–7 | `H1`–`H8` |
| Input registers | 8–15 | `HM1`–`HM8` (device mirrors `H1`–`H8`) |

## PC setup (Modbus RTU slave)

1. Load `opta/01_i1_to_r1.st` with **Load matching fixtures** — or use `fixtures/tags.opta.json` + `drivers.opta.json`.
2. Set driver **Serial port**, enable `opta_rtu`, **Save drivers**.
3. **Start** runtime.

Or use **Drivers → Apply device template → Arduino Opta — Modbus RTU Slave**.

## PC setup (MQTT Parc ST on Opta)

ST on device; deploy over **MQTT** (no HTTP to Opta required for programming). See **`st/opta-mqtt/README.md`** and firmware `firmware/arduino-opta-mqtt-st/`.

## PC setup (Ethernet ST on Opta)

ST logic runs **on the Opta**; MooreVIEW deploys the program over HTTP.

1. Flash firmware: `firmware/arduino-opta-st/MooreviewOptaSt/` (see README there).
2. **Drivers → Apply device template → Arduino Opta — Ethernet ST runtime** (or `fixtures/drivers.opta_eth.json`).
3. Set **Host** to the Opta IP, enable driver, **Save drivers**.
4. Load `opta/01_i1_to_r1.st` with fixtures `tags.opta_eth.json`.
5. **Validate** → **Start** — program AST is sent to the Opta; scan cycles run remotely.

Commission Ethernet and expansions on the device first: connect to WiFi AP `MooreVIEW-Opta` → `http://192.168.4.1:8080/setup`, or open `/setup` on the Ethernet IP. Configure AFX00005 (slot 1) and AFX00007 (slot 2) as needed, then use `tags.opta_eth_exp.json` for `X1_` / `X2_` tags.

## Programs

Each program header lists **required tags**. **Load matching fixtures** loads only those tags (plus driver config).

| File | Description | Required tags |
|------|-------------|---------------|
| `01_i1_to_r1.st` | Digital `I1` drives relay `R1` | `I1`, `R1` |
| `02_analog_alarm_to_r2.st` | `I1_RAW` outside ~5%–95% turns on `R2` | `I1_RAW`, `R2` |
| `03_pid_avg.st` | PID on `I1_RAW`, MOV average, `R1`/`R2` status | `I1`, `R1`, `R2`, `I1_RAW`, `H1`, `H2`, `H3`, `PID1`, `AVG1` |
| `04_timer_counter.st` | TON timer and CTU counter on `I1` | `I1`, `R1`, `R2`, `TMR1`, `CTR1` |
| `05_oneshot_init.st` | Init pulse on first scan after Start | `OS1`, `R1`, `R2` |
| `06_flow_gpm.st` | Pulse flow → GPM (1 min window + K factor) | `I1`, `VPB_RUN`, `OS1`, `CTR1`, `TMR1`, `FLOW1`, `H1`, `H2`, `R1` |
| `07_leak_ct_thermistor.st` | Leak `I1`, moisture `I1_RAW` (2-level), 4× CT, 3× NTC → `R1`–`R4`, `MOIST_ALM`, `SUBMERGED_ALM` | `I1`, `I1_RAW`, `I2_RAW`–`I8_RAW`, `R1`–`R4`, `H1`, `H2`, `MOIST_PCT`, `H_WET_RAW`, `H_DRY_RAW`, `H_MOIST_RAW`, `H_SUB_RAW`, `MOIST_ALM`, `SUBMERGED_ALM` |
| `08_ntc_piecewise.st` | Piecewise °C from one NTC (`I6_RAW` → `T1_C`); optional `R3` high-temp | `I6_RAW`, `T1_C`, `R3` |
| `09_moisture_ntc_ct.st` | 3-input test bench: moisture `I1_RAW`, 10K NTC `I2_RAW`, 0–5 A CT `I3_RAW` | `I1_RAW`–`I3_RAW`, `R1`–`R4`, `MOIST_PCT`, `T1_F`, `T1_C`, `CT_AMPS`, moisture/CT/temp alarms — **°F display/alarm** |

## Leak + moisture + CT + thermistor demo

Wiring on the base Opta unit:

| Input | Sensor | Tag |
|-------|--------|-----|
| I1 (digital) | Leak rope / spot detector | `I1` |
| I1 (analog) | Resistive moisture probe — **same terminal as digital I1; wire one or the other** | `I1_RAW` |
| I2–I5 (analog 0–10 V) | 0–1 V current transformers | `I2_RAW`–`I5_RAW` |
| I6–I8 (analog) | 10K NTC — **24 VDC** divider per `firmware/thermistor info.c` | `I6_RAW`–`I8_RAW` |

**Moisture** (probe reads raw **0 dry → 700 submerged**): 24 V → probe → **I1** → 10 kΩ → GND; wet reads **higher** raw ADC. `MOIST_PCT` is scaled 0–100% from **`H_DRY_RAW`** (0) / **`H_WET_RAW`** (700) — trim from Live I/O. Two raw-level alarms: **`MOIST_ALM`** when `I1_RAW >= H_MOIST_RAW` (default 70, moist) and **`SUBMERGED_ALM`** when `I1_RAW >= H_SUB_RAW` (default 700, submerged).

1. **Drivers → Apply device template → Arduino Opta — Leak + moisture + CT + Thermistor demo** (or load fixtures `tags.opta_leak_demo.json` + `drivers.opta_leak_demo.json`).
2. Load `opta/07_leak_ct_thermistor.st` with **Load matching fixtures**.
3. **Tags → Scale → Cal…** on `I2_RAW`–`I5_RAW`: two-point linear (0–1 V CT). On `I6_RAW`–`I8_RAW`: **Opta NTC — 24 VDC divider** (matches `firmware/thermistor info.c`).
4. For °C logic on Opta ST, see `08_ntc_piecewise.st` (lookup table — no `LN()` in ST).
5. Tune `H1` (current overload raw threshold) and `H2` (high-temp raw threshold) in Tags.
6. **Validate** → **Start** — program deploys to the Opta over MQTT.

Relay outputs: `R1` leak, `R2` current overload, `R3` high temperature, `R4` system OK (clears when any alarm including `MOIST_ALM` / `SUBMERGED_ALM` is active).

## 3-input sensor test bench

Minimal wiring for bench testing moisture, temperature, and current on inputs 1–3:

| Input | Sensor | Tag | Notes |
|-------|--------|-----|-------|
| I1 (analog) | Resistive moisture probe | `I1_RAW` | raw 0 dry, 70 moist, 700 submerged |
| I2 (analog) | 10K NTC, Opta 24 V divider | `I2_RAW` | Cal **°F**, adcMax **1023**; ~670 raw @ 75°F |
| I3 (analog 0–10 V) | 0–1 V CT (0–5 A) | `I3_RAW` | scale 0.048875 (1 V ≈ 5 A) |

1. Load `opta/09_moisture_ntc_ct.st` with **Load matching fixtures** (`tags.opta_sensor_test.json`).
2. Enable MQTT Parc driver (`drivers.opta_mqtt_st.json`) or Ethernet ST runtime.
3. Tune `H1` (CT overload raw, default 82 ≈ 4 A) and `H2` (high-temp **°F**, default **131**) in Tags.
4. **Validate** → **Start**.
