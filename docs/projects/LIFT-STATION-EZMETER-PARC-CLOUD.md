# MooreVIEW Lift Station + EZ Meter — Parc & Cloud Commissioning Guide

> **Superseded by unified docs (v2.0):**
> - **Build guide:** [LIFT-STATION-PARC-CLOUD-BUILD.md](./LIFT-STATION-PARC-CLOUD-BUILD.md) · PDF: `MooreVIEW-Lift-Station-Parc-Cloud-Build.pdf`
> - **I/O map:** [LIFT-STATION-OPTA-IO-MAP.md](./LIFT-STATION-OPTA-IO-MAP.md) · PDF: `MooreVIEW-Lift-Station-Opta-IO-Map.pdf`
>
> This file is retained for EZ Meter detail reference. Run `npm run build:lift-station-parc-cloud-build-pdf` for the current build PDF.

**Document version:** 1.2 (legacy — see unified docs above)  
**Generated:** Run `npm run build:lift-station-ezmeter-parc-pdf` for build date  
**Audience:** Panel builders, field technicians, cloud commissioning engineers  
**Firmware:** `MooreviewOptaMqttSt` with **`-DMV_FIELDBUS=1 -DMV_EZMETER=1`**

---

## Purpose

This guide covers **building a lift-station control panel**, **wiring Opta + Sequent expansion + EZ Meter**, and **configuring MooreVIEW Parc (MQTT) and Cloud Studio** for hardware bench testing and field deployment.

Two station types are supported:

| Type | ST program | Cloud template | Pumps | Floats |
|------|------------|----------------|-------|--------|
| **Duplex** | `logic/38_duplex_lift_station_ezmeter.st` | `lift_station_dual_duplex_ezmeter` | 2 (R1, R2) | 4 (HIGH, LEAD, LAG, OFF) |
| **Triplex** | `logic/39_triplex_lift_station_ezmeter.st` | `lift_station_triplex_ezmeter` | 3 (R1–R3) | 5 (+ LAG2) |

Both use **R4** as the **station alarm relay** (horn, strobe, or SCADA alarm contact) in every configuration.

---

## 1. Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Control panel                                                   │
│  Arduino Opta + D1608E + A0602 (optional)                        │
│  EZ Meter DDS-RGB (RS485) at main service                        │
│  Floats · run aux · motor faults · CTs · R1–R3 pumps · R4 alarm  │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ Ethernet / cellular gateway   │ RS485 fieldbus
                │ MQTT :1883                    │
                ▼                               ▼
        Cloud or LAN Mosquitto          EZ Meter Modbus poll
                │
                ▼
        MooreVIEW Cloud Studio / LAN HMI
        MQTT Parc hub → mqtt_parc driver → tags · HMI · PdM
```

**Direct to cloud:** Opta broker = `mooreview.io` or droplet IP, port **1883** (plain MQTT — no TLS on Opta yet).  
**Via gateway:** Opta broker = `192.168.1.1` (LilyGO cellular gateway LAN).  
See [OPTA_PARC_CLOUD.md](../OPTA_PARC_CLOUD.md) and [CSTORE_OPTA_PARC_CLOUD.md](../CSTORE_OPTA_PARC_CLOUD.md).

---

## 2. Panel bill of materials

| Qty | Item | Notes |
|-----|------|-------|
| 1 | **Arduino Opta** (AFX00001 / WiFi variant optional) | Base I/O, RS485, R1–R4 relays |
| 1 | **Sequent D1608E** (AFX00005) | Slot 1 — 16 DI + 8 relay (use DIs; pump relays on Opta base) |
| 1 | **Sequent A0602** (AFX00007) | Slot 2 optional — RTD / spare analog |
| 1 | **EZ Meter DDS-RGB** (or DDS-RGB 2.025) | Polyphase meter, Modbus RTU, RS485 |
| 2–3 | **0–1 V CT transmitters** (per pump, 3-phase) | 1.00 V = 50 A linear |
| 2–3 | **Pump contactors** | Driven by R1, R2 (duplex) or R1–R3 (triplex) |
| 1 | **Alarm horn/strobe** or dry contact | Driven by **R4** |
| 4–5 | **Float switches** | Pull-down ladder (+24 V when wet) |
| 2–3 | **Motor fault inputs** | Overload / seal failure contacts → expansion DIs |
| 1 | **24 VDC power supply** | Opta + expansion + field devices |
| 1 | **Ethernet** or **cellular gateway** | MQTT path to MooreVIEW |

---

## 3. Opta base unit — relay outputs

Pump contactors and station alarm are wired to the **Opta base** relay terminals (not expansion relays).

| Terminal | Channel | Type | ST tag | Function |
|----------|---------|------|--------|----------|
| **R1** | `R1` | BOOL | `MOTOR1_RUN` | Pump 1 contactor |
| **R2** | `R2` | BOOL | `MOTOR2_RUN` | Pump 2 contactor |
| **R3** | `R3` | BOOL | — / `MOTOR3_RUN` | Spare (duplex) · Pump 3 contactor (triplex) |
| **R4** | `R4` | BOOL | `R4` | **Station alarm** (high level / EZ Meter PQ / motor fault) |

**R4 energizes when any of:**

- **High level float** — `LVL_HIGH` (X1_I1)
- **EZ Meter PQ alarm** — `MECH_PQ_ALM` (undervolt, overvolt, phase loss, imbalance, low PF, frequency)
- **Motor fault DIs** — see expansion I/O map below

Phase fault (X1_I7 duplex / X1_I9 triplex) **interlocks auto pump demand** but does **not** drive R4.

---

## 4. Opta base unit — digital inputs

Opta terminals **I1–I6** are configured as **analog** CT inputs (see §5). Terminals **I7** and **I8** remain available as digital inputs.

| Terminal | Channel | Type | ST tag | Function |
|----------|---------|------|--------|----------|
| **I7** | `I7` | BOOL | — | Spare digital (I1–I6 used as analog CT inputs) |
| **I8** | `I8` | BOOL | — | Spare digital |

Wiring: +24 V active when contact made (same convention as expansion DIs). Unwired inputs read OFF.

---

## 5. Opta base unit — analog inputs (motor CTs)

Motor current is measured on the **Opta base** using **0–1 V CT transmitters** (one per phase per pump). Terminals **I1–I6** are the physical analog inputs; firmware publishes raw counts as `I1_RAW`…`I6_RAW` and engineering amps as `AI1`…`AI6`.

| Terminal | Channel (raw) | Engineering tag | Function | Scale |
|----------|---------------|-------------------|----------|-------|
| **AI1 / I1** | `I1_RAW` | `AI1` | Motor 1 phase A amps | 0–1 V → 0–50 A (1.00 V = 50 A) |
| **AI2 / I2** | `I2_RAW` | `AI2` | Motor 1 phase B amps | Engineering = raw × 0.48828125 |
| **AI3 / I3** | `I3_RAW` | `AI3` | Motor 1 phase C amps | |
| **AI4 / I4** | `I4_RAW` | `AI4` | Motor 2 phase A amps | |
| **AI5 / I5** | `I5_RAW` | `AI5` | Motor 2 phase B amps | |
| **AI6 / I6** | `I6_RAW` | `AI6` | Motor 2 phase C amps | |
| I7 | `I7_RAW` | — | Spare raw (if I7 configured analog) | |
| I8 | `I8_RAW` | — | Spare raw (if I8 configured analog) | |

**Wiring notes:**

- CT transmitters: linear **0–1 VDC**, **1.00 V = 50 A** full scale.
- Duplex: AI1–AI3 = pump 1 (A/B/C); AI4–AI6 = pump 2 (A/B/C).
- Triplex: same AI1–AI6 for pumps 1 and 2; pump 3 has no base CT inputs in program 39 (PdM uses run status / optional `MOTOR3_TEMP` on expansion).
- Bench test: apply **1.0 VDC** to AI1 → expect ~**50 A** on tag `AI1` (after CT calibration if enabled in Tags).

These base analog inputs feed **PdM / MCSA** on the cloud host — separate from EZ Meter `DDS_I_*` at the main service.

---

## 6. Duplex expansion I/O (D1608E slot 1)

Expansion DIs: **+24 V active** (input ON when float wet or contact made).

| Terminal | Tag | Function |
|----------|-----|----------|
| X1_I1 | `LVL_HIGH` | High level float |
| X1_I2 | `LVL_LEAD` | Lead float |
| X1_I3 | `LVL_LAG` | Lag float |
| X1_I4 | `LVL_OFF` | Off float |
| X1_I5 | `P1_RUN_FB` | Pump 1 run aux (fail-to-run) |
| X1_I6 | `P2_RUN_FB` | Pump 2 run aux (fail-to-run) |
| X1_I7 | `PHASE_FAULT` | Phase loss / monitor relay |
| X1_I8 | `GEN_RUN` | Generator running |
| X1_I9 | `GEN_FUEL_FAULT` | Generator fuel fault |
| X1_I10 | `GEN_FAULT` | Generator fault |
| X1_I11 | `MOTOR1_FAULT` | Pump 1 motor fault → **R4** |
| X1_I12 | `MOTOR2_FAULT` | Pump 2 motor fault → **R4** |
| X1_I13–I16 | — | Spare |

**Expansion relays (slot 1, spare):** `X1_R1`…`X1_R8` — not used (pump contactors on base R1/R2).

---

## 7. Triplex expansion I/O (D1608E slot 1)

| Terminal | Tag | Function |
|----------|-----|----------|
| X1_I1 | `LVL_HIGH` | High level float |
| X1_I2 | `LVL_LEAD` | Lead float |
| X1_I3 | `LVL_LAG` | Lag float |
| X1_I4 | `LVL_LAG2` | Lag2 float (3-pump stage) |
| X1_I5 | `LVL_OFF` | Off float |
| X1_I6 | `P1_RUN_FB` | Pump 1 run aux |
| X1_I7 | `P2_RUN_FB` | Pump 2 run aux |
| X1_I8 | `P3_RUN_FB` | Pump 3 run aux |
| X1_I9 | `PHASE_FAULT` | Phase fault |
| X1_I10 | `GEN_RUN` | Generator running |
| X1_I11 | `GEN_FUEL_FAULT` | Gen fuel fault |
| X1_I12 | `GEN_FAULT` | Generator fault |
| X1_I13 | `MOTOR1_FAULT` | Pump 1 motor fault → **R4** |
| X1_I14 | `MOTOR2_FAULT` | Pump 2 motor fault → **R4** |
| X1_I15 | `MOTOR3_FAULT` | Pump 3 motor fault → **R4** |
| X1_I16 | — | Spare |

**Relays:** R1–R3 = pumps (base unit); **R4** = station alarm.

Regenerate triplex ST/fixture after duplex changes: `node scripts/lift-station/generate-triplex-ezmeter.js`.

---

## 8. Expansion slot 2 — A0602 analog (optional)

Sequent **A0602** in expansion slot 2 provides RTD / analog inputs for motor winding temperature and spare channels.

| Terminal | Channel | Engineering tag | Function |
|----------|---------|-----------------|----------|
| **X2_AI1** | `X2_AI1` | `MOTOR1_TEMP` | Motor 1 winding temp (calibrate in Tags) |
| **X2_AI2** | `X2_AI2` | `MOTOR2_TEMP` | Motor 2 winding temp (triplex: also pump 3 temp binding) |
| X2_AI3–AI8 | `X2_AI3`…`X2_AI8` | — | Spare analog |
| X2_PWM1–PWM4 | `X2_PWM1`…`X2_PWM4` | — | Spare PWM outputs |

Disable slot 2 on Opta `/setup` if the A0602 module is not installed.

**Complete I/O map PDF:** `npm run build:duplex-io-map-pdf` → `docs/projects/duplex-lift-station-opta-io-map.pdf` (base unit + all expansion sections).

---

## 9. EZ Meter — wiring, Modbus, and tag data

The lift-station programs embed **EZ Meter facility PQ** inline (no separate `ezmeter_facility_pq.st` deploy). Opta firmware polls the meter on RS485; ST computes PQ alarms and drives **R4** via `MECH_PQ_ALM`.

### 9.1 Physical wiring

| Item | Detail |
|------|--------|
| Meter model | **EZ Meter DDS-RGB 2.025** (RGB firmware v1.600) |
| Location | Main service / mechanical room panel (upstream of pump loads) |
| Opta port | Onboard **RS485** terminal block (A / B / GND) |
| Cable | Twisted pair, shield optional; keep away from pump VFD output wiring |
| Termination | 120 Ω at far end if bus length > 10 m (meter may have onboard term jumper) |
| Power | Meter line voltage per nameplate (typically 120/240 V or 208/480 V service) |
| CTs | Meter CTs on main service conductors (separate from pump CT inputs on Opta AI1–AI6) |

```text
  Main service panel                    Control panel (Opta)
  ┌─────────────────┐                  ┌──────────────────┐
  │  EZ Meter       │   RS485 A/B      │  Opta RS485      │
  │  DDS-RGB        │◄────────────────►│  (Modbus master) │
  │  CTs on mains   │   9600 8N1       │  ST + MQTT Parc  │
  └─────────────────┘   slave ID 1     └──────────────────┘
```

Confirm slave ID and baud on the meter display or EZ Meter configuration tool before commissioning.

### 9.2 Modbus RTU parameters

| Parameter | Default | Notes |
|-----------|---------|-------|
| Protocol | Modbus RTU | Opta = master, meter = slave |
| Baud | **9600** | 8 data bits, no parity, 1 stop (8N1) |
| Slave ID | **1** | Override in template `fieldbus.ezmeter.slaveId` |
| Live poll | **30 s** | `MV_EZMETER_LIVE_POLL_MS` — V, I, W, Hz, PF, VA |
| Energy poll | **5 min** | `MV_EZMETER_ENERGY_POLL_MS` — summed Wh import/export |
| Register type | Holding (FC 03) | HR 40001+ metered values; HR 41001+ control/status |

Firmware log on success: `[EZM] RS485 EZ Meter poll slave=1`. Poll status tag: `EZM_POLL_STA` (`OK` / `poll_err`).

### 9.3 Modbus register map — live analog (HR 40025–40047)

Raw register × scale = engineering units. Opta firmware writes these to `DDS_*` tags every live poll.

| HR | Tag | Type | Scale | Units | Description |
|----|-----|------|-------|-------|-------------|
| 40025 | `DDS_V_A` | REAL | ×0.1 | V | Phase A voltage |
| 40026 | `DDS_I_A` | REAL | ×0.1 | A | Phase A current |
| 40027–28 | `DDS_W_A` | REAL | ×0.1 | W | Phase A real power (32-bit signed) |
| 40029 | `DDS_HZ_A` | REAL | ×0.1 | Hz | Phase A frequency |
| 40030 | `DDS_PF_A` | REAL | ×0.01 | — | Phase A power factor |
| 40031 | `DDS_V_B` | REAL | ×0.1 | V | Phase B voltage |
| 40032 | `DDS_I_B` | REAL | ×0.1 | A | Phase B current |
| 40033–34 | `DDS_W_B` | REAL | ×0.1 | W | Phase B real power |
| 40035 | `DDS_HZ_B` | REAL | ×0.1 | Hz | Phase B frequency |
| 40036 | `DDS_PF_B` | REAL | ×0.01 | — | Phase B power factor |
| 40037 | `DDS_V_C` | REAL | ×0.1 | V | Phase C voltage |
| 40038 | `DDS_I_C` | REAL | ×0.1 | A | Phase C current |
| 40039–40 | `DDS_W_C` | REAL | ×0.1 | W | Phase C real power |
| 40041 | `DDS_HZ_C` | REAL | ×0.1 | Hz | Phase C frequency |
| 40042 | `DDS_PF_C` | REAL | ×0.01 | — | Phase C power factor |
| 40043–44 | `DDS_VA_A` | REAL | ×0.1 | VA | Phase A apparent power |
| 40045–46 | `DDS_VA_B` | REAL | ×0.1 | VA | Phase B apparent power |
| 40047–48 | `DDS_VA_C` | REAL | ×0.1 | VA | Phase C apparent power |

### 9.4 Modbus register map — energy (HR 40001–40023)

Polled every **5 minutes**. Wh registers are 32-bit; raw × 10 = Wh.

| HR | Tag | Scale | Units | Description |
|----|-----|-------|-------|-------------|
| 40001–02 | `DDS_WH_A_IMP` | ×10 | Wh | Phase A import energy |
| 40003–04 | `DDS_WH_B_IMP` | ×10 | Wh | Phase B import energy |
| 40005–06 | `DDS_WH_C_IMP` | ×10 | Wh | Phase C import energy |
| 40009–10 | `DDS_WH_A_EXP` | ×10 | Wh | Phase A export energy |
| 40011–12 | `DDS_WH_B_EXP` | ×10 | Wh | Phase B export energy |
| 40013–14 | `DDS_WH_C_EXP` | ×10 | Wh | Phase C export energy |
| 40017–18 | `DDS_WH_SUM_IMP` | ×10 | Wh | **Summed import Wh** (primary kWh source) |
| 40019–20 | `DDS_WH_SUM_EXP` | ×10 | Wh | Summed export Wh |
| 40021–22 | `DDS_VAH_SUM_IMP` | ×10 | VAh | Summed apparent import |
| 40023–24 | `DDS_VAH_SUM_EXP` | ×10 | VAh | Summed apparent export |

**kWh conversion:** `MECH_METER_KWH` = `DDS_WH_SUM_IMP` × 0.001 (Wh → kWh after ×10 scale).

Per-phase Wh tags (`DDS_WH_A_IMP` …) are in the full Modbus map template but are **not** polled by Opta firmware — only live analog + summed Wh on the edge.

### 9.5 Modbus register map — control / status (HR 41011–41034)

Read-only identification registers. Available in cloud Modbus template; not polled on Opta edge.

| HR | Tag | Description |
|----|-----|-------------|
| 41011 | `DDS_CTL_PROT_LVL` | Protection level |
| 41012–13 | `DDS_CTL_SER_NO` | Serial number |
| 41014 | `DDS_CTL_DATA_BASE` | Data register base (typically 40001) |
| 41015 | `DDS_CTL_CTL_BASE` | Control register base (typically 41001) |
| 41016 | `DDS_CTL_COMM` | Comm settings (0x13 = 9600 8N1) |
| 41018–22 | `DDS_CTL_MODEL_W1`…`W5` | Model string (ASCII) |
| 41024–33 | `DDS_CTL_CUST_W1`…`W10` | Customer ID (ASCII) |

Source: `src/facilities/ezmeterRegisterMap.js` · extract: `st/fixtures/dds-rgb-modbus-extract.txt`.

### 9.6 Tags published by Opta firmware (MQTT Parc)

These tags are updated on-device and published via MQTT telemetry:

| Tag group | Tags | Update rate |
|-----------|------|-------------|
| Live analog | `DDS_V_A/B/C`, `DDS_I_A/B/C`, `DDS_W_A/B/C`, `DDS_HZ_A/B/C`, `DDS_PF_A/B/C`, `DDS_VA_A/B/C` | ~30 s |
| Energy | `DDS_WH_SUM_IMP`, `DDS_WH_SUM_EXP` | ~5 min |
| THD estimate | `MECH_PQ_THD_VA`, `MECH_PQ_THD_VB`, `MECH_PQ_THD_VC`, `MECH_PQ_THD_IA`, `MECH_PQ_THD_IB`, `MECH_PQ_THD_IC` | ~30 s (PF-derived) |
| THD alarm | `MECH_PQ_THD_ALM`, `MECH_PQ_CFG_THD_PCT` | ~30 s |
| PQ config (NV) | `MECH_PQ_CFG_NOM_V`, `MECH_PQ_CFG_UV_V` | On boot + cloud push |

**THD note:** RGB v1.600 has **no harmonic registers**. Firmware estimates THD from power factor (`MECH_PQ_THD_*`). Treat as indicative only — not revenue-grade harmonic analysis.

### 9.7 Derived PQ tags (ST program 38 / 39)

Computed each ST scan from `DDS_*` inputs. Visible on **Tags → Live** after program is running.

| Tag | Type | Formula / source |
|-----|------|------------------|
| `MECH_PQ_KW_SUM` | REAL | `(DDS_W_A + DDS_W_B + DDS_W_C) / 1000` kW |
| `MECH_PQ_KVA_SUM` | REAL | `(DDS_VA_A + DDS_VA_B + DDS_VA_C) / 1000` kVA |
| `MECH_PQ_PF_SYS` | REAL | `MECH_PQ_KW_SUM / MECH_PQ_KVA_SUM` |
| `MECH_PQ_V_AVG` | REAL | Average of `DDS_V_A/B/C` |
| `MECH_PQ_V_IMBAL_PCT` | REAL | Max–min phase V / average × 100 |
| `MECH_PQ_I_SUM` | REAL | `DDS_I_A + DDS_I_B + DDS_I_C` |
| `MECH_METER_INTERVAL_KWH` | REAL | Delta kWh since last scan |
| `DDS_METER_KWH_PREV` | REAL | Previous kWh snapshot (internal) |

### 9.8 Facility mirror tags (semantic map)

These tags mirror `DDS_*` for HMI bindings and campus dashboards:

| Facility tag | Source tag | Scale | Units |
|--------------|------------|-------|-------|
| `MECH_METER_KWH` | `DDS_WH_SUM_IMP` | ×0.001 | kWh |
| `MECH_METER_KWH_EXP` | `DDS_WH_SUM_EXP` | ×0.001 | kWh |
| `MECH_PQ_VA` | `DDS_V_A` | 1 | V |
| `MECH_PQ_VB` | `DDS_V_B` | 1 | V |
| `MECH_PQ_VC` | `DDS_V_C` | 1 | V |
| `MECH_PQ_IA` | `DDS_I_A` | 1 | A |
| `MECH_PQ_IB` | `DDS_I_B` | 1 | A |
| `MECH_PQ_IC` | `DDS_I_C` | 1 | A |
| `MECH_PQ_HZ` | `DDS_HZ_A` | 1 | Hz |
| `MECH_PQ_PF_A/B/C` | `DDS_PF_A/B/C` | 1 | — |

### 9.9 PQ alarm tags and R4 behavior

| Alarm tag | Default condition | Effect on lift station |
|-----------|-------------------|------------------------|
| `MECH_PQ_UNDERVOLT` | Any phase V < **108 V** | **R4 ON**; blocks `LEAD_CALL` / `LAG_CALL` |
| `MECH_PQ_OVERVOLT` | Any phase V > **132 V** | **R4 ON** |
| `MECH_PQ_PHASE_LOSS` | One phase < UV while others live | **R4 ON**; blocks pump auto demand |
| `MECH_PQ_V_IMBAL` | Imbalance > **5%** | **R4 ON** |
| `MECH_PQ_LOW_PF` | System PF low under load (> **1 A** total) | **R4 ON** |
| `MECH_PQ_FREQ_FAULT` | Frequency outside **59.5–60.5 Hz** | **R4 ON** |
| `MECH_PQ_THD_ALM` | Estimated THD > **8%** | Alarm only (does not block pumps) |
| `MECH_PQ_ALM` | **Any PQ alarm above** | **R4 ON** (OR with `LVL_HIGH`, motor faults) |

Undervolt and phase loss run **before** level demand in the ST scan so pump interlock matches phase-fault behavior.

### 9.10 Threshold configuration tags (`MECH_PQ_CFG_*`)

| Tag | Default | Cloud setting key | Opta NV |
|-----|---------|-------------------|---------|
| `MECH_PQ_CFG_NOM_V` | 120 V | Nominal voltage | ✓ `/setup` |
| `MECH_PQ_CFG_UV_V` | 108 V | Undervolt threshold | ✓ `/setup` |
| `MECH_PQ_CFG_OV_V` | 132 V | Overvolt threshold | Cloud only |
| `MECH_PQ_CFG_LOW_PF` | 0.85 | Low PF threshold | Cloud only |
| `MECH_PQ_CFG_FREQ_MIN` | 59.5 Hz | Min frequency | Cloud only |
| `MECH_PQ_CFG_FREQ_MAX` | 60.5 Hz | Max frequency | Cloud only |
| `MECH_PQ_CFG_IMBAL_PCT` | 5% | Max voltage imbalance | Cloud only |
| `MECH_PQ_CFG_LOAD_I` | 1 A | Loaded current threshold | Cloud only |
| `MECH_PQ_CFG_THD_PCT` | 8% | THD alarm threshold | Firmware NV |

**Where to set:**

| Where | Path |
|-------|------|
| **Cloud** | System setup → MQTT Parc → **EZ Meter PQ** |
| **Opta** | `http://<opta-ip>/setup` → **EZ Meter PQ** card (nominal + undervolt) |

Saving cloud settings calls `syncEzMeterThresholdTags()` and pushes `MECH_PQ_CFG_*` to connected Opta drivers.

**Settings JSON** (project or tenant):

```json
"mqttParc": {
  "ezMeter": {
    "nominalVoltage": 120,
    "undervoltV": 108,
    "overvoltV": 132,
    "lowPf": 0.85,
    "freqMinHz": 59.5,
    "freqMaxHz": 60.5,
    "vImbalancePct": 5,
    "loadedCurrentA": 1,
    "thdAlarmPct": 8
  }
}
```

### 9.11 MQTT telemetry path

Opta publishes all `DDS_*` and `MECH_PQ_*` tags on the standard Parc topic:

```text
mooreview/v1/{deviceId}/telemetry
```

Payload includes tag id, value, type, and timestamp. Cloud **mqtt_parc** hub ingests telemetry → tag store → HMI composites and historian (when Hist enabled).

Enable historian on key PQ tags for post-event review: `DDS_V_*`, `DDS_PF_*`, `MECH_PQ_KW_SUM`, `MECH_PQ_V_IMBAL_PCT`, `MECH_PQ_ALM`.

### 9.12 Bench test — expected EZ Meter values

| Condition | Expected tags | Pass |
|-----------|---------------|------|
| Meter powered, healthy 120 V service | `DDS_V_A/B/C` ≈ 118–122 V | ✓ |
| No load | `DDS_I_A/B/C` ≈ 0–2 A (meter self-load) | ✓ |
| Line frequency | `DDS_HZ_A` ≈ 59.9–60.1 Hz | ✓ |
| Power factor | `DDS_PF_A/B/C` ≈ 0.95–1.0 (light load) | ✓ |
| Energy accumulating | `DDS_WH_SUM_IMP` increasing every 5 min | ✓ |
| Undervolt test | Temporarily set `MECH_PQ_CFG_UV_V` = 130 V | `MECH_PQ_UNDERVOLT`, `MECH_PQ_ALM`, **R4 ON** |
| Restore threshold | Set undervolt back to 108 V | Alarms clear, R4 off (if no other alarm) |
| RS485 fault | Disconnect A/B | `EZM_POLL_STA` = `poll_err`; `DDS_V_*` stale |

See also [EZMETER_FACILITY_PQ.md](../facilities/EZMETER_FACILITY_PQ.md) for standalone Modbus template apply and campus sync.

---

## 10. Firmware flash (Opta)

1. Open **`firmware/arduino-opta-mqtt-st/MooreviewOptaMqttSt`** in Arduino IDE.
2. **Tools → Board → Arduino Opta** (`mbed_opta`).
3. **Tools → Compile flags** (or `platform.local.txt`):

   ```text
   -DMV_FIELDBUS=1 -DMV_EZMETER=1
   ```

4. Install libraries: ArduinoJson 7.x, PubSubClient, Arduino_Opta_Blueprint, ArduinoModbus, ArduinoRS485.
5. Upload via USB/Ethernet.

Verify: Serial log shows `[EZM] RS485 EZ Meter poll slave=1` after boot.

---

## 11. Opta field configuration (`/setup`)

Open **`http://<opta-ip>/setup`** (or WiFi AP `MooreVIEW-Opta` → `http://192.168.4.1:8080/setup`).

### 11.1 Ethernet & expansion

| Setting | Bench | Field |
|---------|-------|-------|
| DHCP | ✓ on LAN | As site requires |
| Expansion slot 1 | **AFX00005 D1608E** | Scan expansions after save |
| Expansion slot 2 | **AFX00007 A0602** or Disabled | Optional RTD |

### 11.2 MQTT Parc broker

| Field | LAN bench | Cloud |
|-------|-----------|-------|
| Broker host | MooreVIEW PC IP or `127.0.0.1` via gateway | `mooreview.io` or droplet IP |
| Port | **1883** | **1883** |
| Username / password | Match Mosquitto | Match `MOSQUITTO_USER` / `MOSQUITTO_PASS` (≤ **47 chars**) |
| Global site key | `1` (`0x0001`) | Must match Cloud Studio |

Click **Test MQTT connection** → expect success + `setup-test` publish.

### 11.3 EZ Meter PQ (Opta NV)

| Field | Default |
|-------|---------|
| Nominal voltage | 120 V |
| Undervolt threshold | 108 V |

**Save settings** → **Reboot device**.

Note **Device ID** on `/setup` (e.g. `mv_f2e689fd60d96bab`).

---

## 12. Cloud Studio configuration

Sign in → tenant → open or import project.

### 12.1 System setup → MQTT Parc

| Setting | Value |
|---------|-------|
| Enable MQTT Parc hub | ✓ |
| Broker URL | `mqtt://127.0.0.1:1883` (on cloud VM) |
| Username / password | Same as Mosquitto |
| Global site key | `0x0001` |
| Remote ST execution | ✓ |
| Auto-run ST on Opta after boot | ✓ (after first deploy) |

### 12.2 EZ Meter PQ (cloud)

Under **MQTT Parc → EZ Meter PQ**:

| Field | Default |
|-------|---------|
| Nominal voltage (V) | 120 |
| Undervolt threshold (V) | 108 |
| Overvolt threshold (V) | 132 |
| THD alarm (%) | 8 |

Saving pushes `MECH_PQ_CFG_*` tags to connected Opta drivers.

### 12.3 Add Opta driver

**Drivers → Add Opta Parc devices** (from registry):

| Field | Example |
|-------|---------|
| Device ID | From Opta `/setup` |
| Position ID | Stable site slug, e.g. `bench-duplex-01` |
| Template | **DUPLEXLS + EZ Meter** or **TRIPLEXLS + EZ Meter** |

Steps:

1. Wait for Parc registry → device **online**
2. **Sync tags from device**
3. **Scan expansions**
4. **Program → Remote → Connect → Download & Start**
   - Duplex: `logic/38_duplex_lift_station_ezmeter.st`
   - Triplex: `logic/39_triplex_lift_station_ezmeter.st`
5. Add HMI: **Composites → DUPLEXLS** or **TRIPLEXLS**

### 12.4 Generate bench project (local)

```bash
npm run generate:duplex-lift-station
```

Import `data/projects/duplex-lift-station.est.zip` for a pre-wired duplex demo.

---

## 13. Hardware bench test procedure

Use this checklist before shipping the panel or leaving the site.

### 13.1 Power and comms

| Step | Pass criteria |
|------|----------------|
| 24 VDC to Opta + expansion | Green power; expansion detected on `/setup` |
| Ethernet or gateway | Opta gets IP; pingable |
| MQTT test on `/setup` | Connected; `setup-test` on broker |
| Cloud registry | Device online, telemetry age < 30 s |

### 13.2 Digital inputs (simulate with +24 V)

| Test | Action | Expected tag |
|------|--------|--------------|
| High float | Jumper X1_I1 | `LVL_HIGH` ON; **R4 ON** |
| Lead float | Jumper X1_I2 | `LVL_LEAD` ON; alternator demand |
| Motor fault | Jumper X1_I11 (duplex) | `MOTOR1_FAULT` ON; **R4 ON** |
| Phase fault | Jumper X1_I7 (duplex) | `PHASE_FAULT` ON; pumps interlocked; R4 **off** |
| Off float dry | Remove X1_I4 wet | Pumps de-stage |

Verify on **Tags → Live I/O** or Opta **`/io-map`**.

### 13.3 Relay outputs

| Test | Action | Expected |
|------|--------|----------|
| Pump 1 | Hand mode → START (HMI) or force `MOTOR1_RUN` | **R1** clicks |
| Pump 2 | Same for pump 2 | **R2** clicks |
| Alarm | High float or undervolt | **R4** clicks |

### 13.4 EZ Meter / PQ

See **§9.12** for expected values. Quick checks:

| Test | Action | Expected |
|------|--------|----------|
| Meter live | Apply line voltage to EZ Meter | `DDS_V_A/B/C` ≈ 118–122 V; `DDS_HZ_A` ≈ 60 Hz |
| Energy | Wait 5 min | `DDS_WH_SUM_IMP` increments; `MECH_METER_KWH` updates |
| kW sum | Run pumps under load | `MECH_PQ_KW_SUM` > 0; `MECH_PQ_PF_SYS` reasonable |
| Undervolt | Lower threshold in cloud to 130 V (temp) | `MECH_PQ_UNDERVOLT`, `MECH_PQ_ALM`, **R4 ON**; pumps interlocked |
| Restore | Set undervolt back to 108 V | Alarms clear when voltage healthy |
| RS485 | Serial log / `EZM_POLL_STA` | `[EZM] RS485 EZ Meter poll slave=1`; status `OK` |

### 13.5 ST runtime

| Check | Pass |
|-------|------|
| Program → Remote → status | Running; scan OK |
| `STATION_STA` | 0=Online when healthy |
| Fail-to-run | Run R1 without run aux → `M1_FAIL` after 5 s |
| HMI composite | Floats, pumps, alarms animate |

### 13.6 CT inputs (base unit analog)

Apply **1.0 VDC** to **AI1** (terminal I1) → expect ~**50 A** on tag `AI1`. Repeat for AI2–AI6 per pump phase wiring (§5).

---

## 14. Cloud broker (production droplet)

On the cloud VM:

```bash
grep MOSQUITTO /etc/mooreview/env
sudo ufw allow 1883/tcp
mosquitto_sub -h 127.0.0.1 -p 1883 -u mooreview -P "$MOSQUITTO_PASS" \
  -t 'mooreview/v1/+/telemetry' -v
```

Env template: [deploy/cloud/.env.cstore-opta-parc.example](../deploy/cloud/.env.cstore-opta-parc.example).

Enable runtime on same droplet:

```bash
sudo MOOREVIEW_INSTALL_DIR=/home/mooreview bash deploy/cloud/debian/enable-runtime-3090.sh
```

---

## 15. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| No expansion DIs | 24 V missing on D1608E | Check expansion supply; **Scan expansions** on `/setup` |
| R4 always ON | Default DDS_V = 0 triggers undervolt | Set healthy meter voltage or raise undervolt threshold; set `DDS_HZ_A` path needs meter online |
| R4 never ON | Alarm relay wiring | Confirm R4 contactor; force `LVL_HIGH` |
| No `DDS_*` tags | RS485 or compile flags | Reflash with `MV_FIELDBUS=1 MV_EZMETER=1`; check A/B polarity |
| MQTT auth fail | Password > 47 chars | Shorten `MOSQUITTO_PASS` |
| Deploy timeout | Old firmware / hub off | Reflash v2.3.41+; enable MQTT Parc hub |
| LEAD_CALL stuck | PQ fault active | Clear undervolt; check EZ Meter wiring |

MooreVIEW hints on Connect/Download failures: match broker host, auth, and firewall **1883**.

---

## 16. Reference files

| Path | Purpose |
|------|---------|
| `st/logic/38_duplex_lift_station_ezmeter.st` | Duplex ST + EZ Meter PQ |
| `st/logic/39_triplex_lift_station_ezmeter.st` | Triplex ST + EZ Meter PQ |
| `st/fixtures/tags.duplex_lift_station_ezmeter.json` | Duplex tag fixture |
| `st/fixtures/tags.triplex_lift_station_ezmeter.json` | Triplex tag fixture |
| `src/devices/templates/lift_station_dual_duplex_ezmeter.json` | Duplex cloud template |
| `src/devices/templates/lift_station_triplex_ezmeter.json` | Triplex cloud template |
| `src/devices/templates/arduino_opta_parc_ezmeter.json` | Opta-only Parc + EZ Meter |
| `docs/OPTA_PARC_CLOUD.md` | Opta → cloud MQTT |
| `docs/facilities/EZMETER_FACILITY_PQ.md` | PQ tags and Modbus map |
| `firmware/arduino-opta-mqtt-st/OPTa_FEATURES.md` | Firmware features |
| `scripts/duplex-lift-station/opta-io-map-data.js` | I/O map source for PDF |

**PDF outputs:**

```bash
npm run build:lift-station-ezmeter-parc-pdf   # This guide
npm run build:duplex-io-map-pdf               # Duplex I/O map only
```

---

## 17. Quick commissioning checklist

| # | Task | ✓ |
|---|------|---|
| 1 | Panel wired per I/O map (§3–§8); R4 → alarm device; AI1–AI6 CT transmitters on base I1–I6 | |
| 2 | EZ Meter on RS485; line voltage applied; `DDS_V_*` live | |
| 3 | Opta flashed with MV_FIELDBUS + MV_EZMETER | |
| 4 | `/setup` — broker, site key, EZ Meter undervolt saved | |
| 5 | MQTT test OK; device ID recorded | |
| 6 | Cloud — MQTT Parc hub + EZ Meter PQ settings | |
| 7 | Driver added; tags synced; expansions scanned | |
| 8 | ST 38 or 39 deployed Download & Start | |
| 9 | Bench floats, motor faults, R4 alarm verified; base CT inputs AI1–AI6 live (§5); EZ Meter PQ tags live (§9) | |
| 10 | HMI composite bound; PdM assets seeded | |

---

*MooreVIEW · The Purple Standard · Lift station Parc + EZ Meter commissioning v1.2*
