# OPTA Parc HVAC — consolidated project

One MooreVIEW project **`hvac-opta-parc`** covers four field configs. Set tag **`HVAC_CFG`** before commissioning.

| HVAC_CFG | Config | Hardware | I/O summary |
|----------|--------|----------|-------------|
| **0 (A)** | Single air handler | Base Opta | Blower **1P+cap**: run I2, start I3 · leak I1 · safety I4 · 2 NTC |
| **1 (B)** | Single condenser | Base Opta | **MCSA HVAC**: comp+fan 1P+cap run CT I1/I2 · 2 NTC |
| **2 (C)** | Dual air handler | Opta + **D1608E** | 2× blower 1P+cap run CT · 2 leak · 2 safety · 4 NTC |
| **3 (D)** | Dual condenser | **2× Opta** + D1608E | Each unit MCSA 1P+cap comp+fan · lockout DI |

## Generate

```bash
node scripts/hvac-opta-parc/generate-est.js
```

Outputs `data/projects/hvac-opta-parc.est.json`, fixtures, MV Draw, and `st/fixtures/hvac_opta_parc_starter.json`.

## Manufacturing PDF

```bash
npm run build:hvac-opta-parc-mfg-pdf
```

Writes **`docs/projects/MooreVIEW-HVAC-Opta-Parc-Mfg.pdf`** (all configs A–D) and copies to **`public/docs/`** for download. Single config: `node scripts/hvac-opta-parc/build-hvac-mfg-pdf.js --config=C`.

Includes config matrix, WiFi AP /setup steps, per-config BOM, terminal wiring tables, and mfg test checklists.

## WiFi AP & /setup (standard Parc commissioning)

1. Flash **`firmware/arduino-opta-mqtt-st/MooreviewOptaMqttSt`** v2.3.63+ (WiFi board package).
2. Connect to AP **`MooreVIEW-Opta`** → open **`http://192.168.4.1:8080/setup`**.
3. On `/setup`:
   - Enable **WiFi AP for local setup** (`wifiApEnable`)
   - Set AP SSID / password (≥ 8 chars)
   - **Device ID** (e.g. `hvac_opta_01`)
   - **MQTT broker** host/port, user, password (≤ 47 chars)
   - **Global site key** (must match MooreVIEW System setup)
   - **Test MQTT** → Save → Reboot
4. Config **B/D**: open **`/mcsa`** → I/O layout **HVAC** → motor wiring **1P + start cap** (not plain 1P); deviceType **5** (all loads).
5. Config **C/D**: on `/setup` → **Scan expansions** → slot 1 **D1608E (AFX00005)**.
6. Config **D**: flash second Opta (`hvac_opta_02`); enable driver **`opta_hvac_02`** in MooreVIEW.

Full cloud path: **`docs/OPTA_PARC_CLOUD.md`**.

## Config wiring

### A — Single air handler (base Opta)

| Input | Use |
|-------|-----|
| I1 | Pan spot leak (digital) |
| I4 | HVAC safety switch (NC digital) |
| I2_RAW | Blower **run** CT (1P+cap) |
| I3_RAW | Blower **start-winding** CT (1P+cap) |
| I6_RAW | Supply air NTC |
| I7_RAW | Return air NTC |

Set `HVAC_CFG = 0`. Calibrate NTC on I6/I7.

### B — Single condenser (base Opta, MCSA 1P+cap)

| MCSA HVAC | Use |
|-----------|-----|
| I1 | Compressor **run** CT → `COMP_AMPS`, `COMP_FLT` (1P+cap) |
| I2 | Condenser fan **run** CT → `FAN_AMPS`, `FAN_FLT` (1P+cap) |
| I3 / I4 | High / low side NTC → `T1_C`, `T2_C` |

On `/mcsa`: wiring **1P + start cap** for both motors; edge model **single-phase-start-v1**.

### C — Dual air handler (D1608E)

| Input | Use |
|-------|-----|
| I1 | AHU 1 pan leak |
| X1_I1 | AHU 2 pan leak |
| X1_I2 | AHU 1 safety switch |
| X1_I3 | AHU 2 safety switch |
| I2_RAW | AHU 1 blower CT |
| I3_RAW | AHU 2 blower CT |
| I6 / I7 | AHU 1 supply / return NTC |
| I8 / I4_RAW | AHU 2 supply / return NTC |

Set `HVAC_CFG = 2`. Scan D1608E on `/setup`.

### D — Dual condenser (2× Opta + D1608E)

| Device | Role |
|--------|------|
| Opta 1 (`hvac_opta_01`) | Condenser 1 MCSA HVAC |
| Opta 2 (`hvac_opta_02`) | Condenser 2 MCSA HVAC |
| D1608E X1_I1 / X1_I2 | Condenser 2 lockout / shutdown DI |

Set `HVAC_CFG = 3`. Enable second mqtt_parc driver.

## MooreVIEW steps

1. Open project **`hvac-opta-parc`**.
2. Set **`HVAC_CFG`** to match installed hardware.
3. **Drivers → Apply template** → *Arduino Opta — MQTT Parc ST* (A/C) or *MCSA monitor* (B/D).
4. **Drivers → Add Opta Parc devices** from registry (or manual device ID).
5. Load matching fixtures (`tags.hvac_opta_parc.json`).
6. **Validate → Start**; deploy ST to primary Opta for configs A/C.

## Legacy split projects

The earlier `hvac-air-handlers-opta` and `hvac-condensers-opta` projects are superseded by this consolidated project (configs C and D respectively).
