# MooreVIEW Lift Station — Parc & Cloud Build Guide

**Document version:** 2.0  
**Generated:** Run `npm run build:lift-station-parc-cloud-build-pdf` for build date  
**Audience:** Panel builders, field technicians, cloud commissioning engineers  
**I/O reference:** [LIFT-STATION-OPTA-IO-MAP.md](./LIFT-STATION-OPTA-IO-MAP.md) · PDF: `MooreVIEW-Lift-Station-Opta-IO-Map.pdf`

---

## Purpose

Single build and commissioning guide for **simplex**, **duplex**, and **triplex** lift-station control panels on **Arduino Opta + MQTT Parc + Cloud Studio**.

Covers panel wiring, firmware flash, Opta `/setup`, cloud driver deploy, and hardware bench testing.

---

## 1. Configuration matrix

| Configuration | Pumps | Floats | ALT | ST program | Cloud template | EZ Meter | R4 alarm | Flash flags |
|---------------|-------|--------|-----|------------|----------------|----------|----------|-------------|
| **Simplex** | 1 | 4 (start/stop/high/lo) | — | `logic/35_lift_simplex.st` | `lift_station_simplex` | No | Yes | Default · **base unit only, 2 CT** |
| **Duplex** | 2 | 4 (HIGH/LEAD/LAG/OFF) | ALT2 | `logic/36_duplex_lift_station.st` | `lift_station_dual_duplex` | No | Yes | `MV_FIELDBUS=1` |
| **Duplex + EZ Meter** | 2 | 4 | ALT2 | `logic/38_duplex_lift_station_ezmeter.st` | `lift_station_dual_duplex_ezmeter` | Yes | Yes | `MV_FIELDBUS=1` `MV_EZMETER=1` |
| **Triplex + EZ Meter** | 3 | 5 (+ LAG2) | ALT3 | `logic/39_triplex_lift_station_ezmeter.st` | `lift_station_triplex_ezmeter` | Yes | Yes | `MV_FIELDBUS=1` `MV_EZMETER=1` |

**When to use:**

| Type | Typical site |
|------|--------------|
| Simplex | C-store, small tenant, low flow, septic lift |
| Duplex | Strip mall, school, standard duplex wet well |
| Duplex + EZ Meter | Main-service PQ monitoring + station alarm on undervolt |
| Triplex + EZ Meter | High-flow station, three pumps, facility PQ |

> **Note:** Full triplex without EZ Meter is not yet a dedicated ST program — use program 39 or generic `28_alternator_triplex.st` for ALT-only logic.

---

## 2. Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  Control panel                                                   │
│  Arduino Opta + D1608E (+ A0602 optional)                        │
│  [EZ Meter RS485 — duplex/triplex + EZ Meter only]               │
│  Floats · run aux · motor faults · CTs · R1–R3 pumps · R4 alarm  │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ Ethernet / cellular gateway   │ RS485 (EZ Meter)
                │ MQTT :1883                    │
                ▼                               ▼
        Cloud or LAN Mosquitto          Modbus poll (if enabled)
                │
                ▼
        MooreVIEW Cloud Studio / LAN HMI
        MQTT Parc hub → mqtt_parc driver → tags · HMI · PdM
```

See [OPTA_PARC_CLOUD.md](../OPTA_PARC_CLOUD.md) and [CSTORE_OPTA_PARC_CLOUD.md](../CSTORE_OPTA_PARC_CLOUD.md).

---

## 3. Panel bill of materials

| Qty | Item | Simplex | Duplex | Triplex |
|-----|------|---------|--------|---------|
| 1 | **Arduino Opta** (base only) | ✓ | — | — |
| 1 | **Sequent D1608E** (slot 1) | — | ✓ | ✓ |
| 1 | **Sequent A0602** (slot 2) | — | Optional | Optional |
| 1 | **EZ Meter DDS-RGB** | — | Optional | Optional |
| 2 | **0–1 V CT transmitters** | 2 on I1, I2 | 2 pumps × 3φ | 2 pumps × 3φ (pump 3 CT → expansion) |
| 1–3 | **Pump contactors** | 1 | 2 | 3 |
| 1 | **Alarm horn/strobe** (R4) | ✓ | ✓ | ✓ |
| 4–5 | **Float switches** | 4 | 4 | 5 |
| 1 | **24 VDC power supply** | ✓ | ✓ | ✓ |
| 1 | **Ethernet / cellular gateway** | ✓ | ✓ | ✓ |

Full terminal maps: **[LIFT-STATION-OPTA-IO-MAP.md](./LIFT-STATION-OPTA-IO-MAP.md)**.

---

## 4. Per-configuration build summary

### 4.1 Simplex (program 35)

| Item | Detail |
|------|--------|
| Hardware | **Opta base unit only** — no Sequent expansion |
| Logic | Single pump, start/stop float latch, high/low alarms |
| Tags | `st/fixtures/tags.lift_simplex.json` |
| CTs | **2× CT** on **AI1 / I1** and **AI2 / I2** (0–1 V → 0–50 A) |
| Floats / DIs | **I3–I8** digital: START, STOP, HIGH, LO, PUMP_FAIL, run fb |
| Relays | **R1** = `MOTOR1_RUN`; **R4** = station alarm (`ALT_FAULT`) |
| I/O binding | Program 35 uses logical tags — map `I3`→`LVL_START`, `I4`→`LVL_STOP`, etc. in Cloud Studio |
| HMI | mvDraw `lift_simplex` symbol; no full DUPLEXLS composite |
| Deploy | Template `lift_station_simplex` · `tagsFromDevice: true` · `ioBaseOnly: true` |

### 4.2 Duplex (program 36)

| Item | Detail |
|------|--------|
| Logic | ALT2 alternator, dual HOA faceplates, gen monitoring, fail-to-run |
| Tags | `st/fixtures/tags.duplex_lift_station.json` |
| Floats | X1_I1=HIGH, I2=LEAD, I3=LAG, I4=OFF |
| Relays | **R1/R2** = pumps; **R3** spare; **R4** = `ALT_FAULT` (ST) |
| Motor faults | Fail-to-run sets `M1_FAIL`/`M2_FAIL` → `ALT_FAULT` → **R4** |
| HMI | `@composite/duplexls` |
| Deploy | Template `lift_station_dual_duplex` |

Generate bench project: `npm run generate:duplex-lift-station`

### 4.3 Duplex + EZ Meter (program 38)

| Item | Detail |
|------|--------|
| Logic | Program 36 + facility PQ + **R4 station alarm** |
| Tags | `st/fixtures/tags.duplex_lift_station_ezmeter.json` |
| Motor faults | **X1_I11**, **X1_I12** → R4 |
| EZ Meter | RS485 on Opta; tags `DDS_*`, `MECH_PQ_*` |
| R4 alarm | `LVL_HIGH` · `MECH_PQ_ALM` · motor faults |
| HMI | `@composite/duplexls` |
| Deploy | Template `lift_station_dual_duplex_ezmeter` |

### 4.4 Triplex + EZ Meter (program 39)

| Item | Detail |
|------|--------|
| Logic | ALT3, 5-float ladder, facility PQ, R4 alarm |
| Tags | `st/fixtures/tags.triplex_lift_station_ezmeter.json` |
| Floats | X1_I1=HIGH, I2=LEAD, I3=LAG, I4=**LAG2**, I5=OFF |
| Relays | **R1–R3** = pumps; **R4** = alarm |
| Motor faults | **X1_I13–I15** → R4 |
| Run feedback | X1_I6–I8 |
| Phase fault | **X1_I9** |
| Regenerate | `node scripts/lift-station/generate-triplex-ezmeter.js` after duplex changes |
| HMI | `@composite/triplexls` |
| Deploy | Template `lift_station_triplex_ezmeter` |

---

## 5. Shared Opta base unit I/O

**Simplex** uses the base unit only (§4.1): **AI1–AI2** = 2 CTs; **I3–I8** = floats/faults; **R1** = pump.

**Duplex / triplex** add D1608E expansion and use:

| Terminal | Tag | Function |
|----------|-----|----------|
| **R1–R3** | `MOTOR1_RUN`… | Pump contactors (count per config) |
| **R4** | `R4` | **Station alarm** (all configurations) |
| **I7, I8** | — | Spare digital (I1–I6 = analog CT on duplex/triplex) |
| **AI1–AI6** | Motor CTs | 0–1 V → 0–50 A (2 pumps × 3φ) |

See I/O map document for complete tables per configuration.

---

## 6. Firmware flash (Opta)

1. Open **`firmware/arduino-opta-mqtt-st/MooreviewOptaMqttSt`** in Arduino IDE.
2. **Tools → Board → Arduino Opta** (`mbed_opta`).
3. **Compile flags** by configuration:

| Configuration | Flags |
|---------------|-------|
| Simplex | *(none required)* |
| Duplex | `-DMV_FIELDBUS=1` |
| Duplex / Triplex + EZ Meter | `-DMV_FIELDBUS=1 -DMV_EZMETER=1` |

4. Libraries: ArduinoJson 7.x, PubSubClient, Arduino_Opta_Blueprint, ArduinoModbus, ArduinoRS485 (EZ Meter builds).
5. Upload via USB/Ethernet.

**Verify EZ Meter builds:** Serial log `[EZM] RS485 EZ Meter poll slave=1`.

---

## 7. Opta field configuration (`/setup`)

Open **`http://<opta-ip>/setup`**.

| Setting | All configs | EZ Meter builds |
|---------|-------------|-----------------|
| Expansion slot 1 | **AFX00005 D1608E** | Same |
| Expansion slot 2 | **AFX00007 A0602** or Disabled | Same |
| A0602 RTD mode | **Enable** (8× 2-wire PT100 → X2_AI1–X2_AI8 °C) when A0602 installed | Same |
| Control-panel UPS | **Generator panels only:** AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost) → `POWER_FAIL` | Same — not facility power |
| MQTT broker | Host, port **1883**, user/pass | Same |
| Global site key | `1` (`0x0001`) | Must match cloud |
| EZ Meter PQ | — | Nominal **120 V**, undervolt **108 V** |

**Test MQTT connection** → success + `setup-test` publish. Record **Device ID**.

---

## 8. Cloud Studio configuration

### 8.1 System setup → MQTT Parc

| Setting | Value |
|---------|-------|
| Enable MQTT Parc hub | ✓ |
| Broker URL | `mqtt://127.0.0.1:1883` (cloud VM) |
| Global site key | `0x0001` |
| Remote ST execution | ✓ |

### 8.2 Add Opta driver

| Field | Example |
|-------|---------|
| Device ID | From Opta `/setup` |
| Position ID | `bench-duplex-01` |
| Template | See matrix §1 |

**Steps:**

1. Device **online** in Parc registry
2. **Sync tags from device**
3. **Scan expansions**
4. **Program → Remote → Download & Start** (program from matrix §1)
5. Add HMI composite: **DUPLEXLS** or **TRIPLEXLS** (duplex/triplex); simplex uses mvDraw or custom screen

### 8.3 EZ Meter PQ (duplex/triplex + EZ Meter only)

Cloud: **System setup → MQTT Parc → EZ Meter PQ**

| Field | Default |
|-------|---------|
| Nominal voltage (V) | 120 |
| Undervolt threshold (V) | 108 |
| Overvolt threshold (V) | 132 |

Saving pushes `MECH_PQ_CFG_*` to connected Opta drivers. Undervolt drives **R4** and interlocks auto pump demand.

Full EZ Meter tag/register reference: see §9 and [EZMETER_FACILITY_PQ.md](../facilities/EZMETER_FACILITY_PQ.md).

---

## 9. EZ Meter (duplex/triplex + EZ Meter builds)

| Parameter | Value |
|-----------|-------|
| Meter | EZ Meter DDS-RGB 2.025, RS485 A/B on Opta |
| Modbus | 9600 8N1, slave **1** |
| Poll | Live ~30 s; energy ~5 min |
| Key tags | `DDS_V_*`, `DDS_I_*`, `MECH_PQ_*`, `MECH_PQ_ALM` |
| R4 | ON when `MECH_PQ_ALM` (undervolt, overvolt, phase loss, imbalance, low PF, freq) |

**Bench test:** With line voltage applied, `DDS_V_A/B/C` ≈ 118–122 V. Temporarily set undervolt threshold to 130 V → `MECH_PQ_ALM` and **R4 ON**.

---

## 10. Hardware bench test

### 10.1 All configurations

| Step | Pass |
|------|------|
| 24 VDC to Opta + expansion | Expansion detected on `/setup` |
| MQTT test | Connected; device online in cloud |
| ST running | Program → Remote status OK |

### 10.2 Simplex (base unit, 2 CT)

| Test | Action | Expected |
|------|--------|----------|
| Start float | Jumper **I3** (+24 V) | `LVL_START` ON; pump call |
| Stop float | **I4** dry | `LVL_STOP`; pump off |
| High alarm | Jumper **I5** | `LVL_HIGH_ALM` |
| Low alarm | Jumper **I6** dry | `LVL_LO_ALM` |
| Pump run | Auto + call | **R1** ON |
| CT 1 | 1.0 VDC on **I1** | `AI1` ≈ 50 A |
| CT 2 | 1.0 VDC on **I2** | `AI2` ≈ 50 A |

### 10.3 Duplex / Duplex + EZ Meter

| Test | Action | Expected |
|------|--------|----------|
| High float | X1_I1 | `LVL_HIGH` ON |
| Lead float | X1_I2 | `LVL_LEAD` ON; alternator demand |
| Phase fault | X1_I7 | Pumps interlocked |
| Motor fault | X1_I11 (EZ Meter build) | **R4 ON** |
| Pump 1 | Hand START | **R1** clicks |

### 10.4 Triplex + EZ Meter

| Test | Action | Expected |
|------|--------|----------|
| Lag2 float | X1_I4 | 3-pump stage demand |
| Off float | X1_I5 dry | De-stage |
| Motor 3 fault | X1_I15 | **R4 ON** |
| Pump 3 | Hand START | **R3** clicks |

### 10.5 Base CT inputs (all)

Apply **1.0 VDC** to **AI1** → ~**50 A** on tag `AI1`.

### 10.6 EZ Meter (if installed)

`DDS_V_*` live; undervolt test per §9.

---

## 11. Troubleshooting

| Symptom | Fix |
|---------|-----|
| No expansion DIs | Check 24 V on D1608E; **Scan expansions** |
| Float tags inverted | Verify +24 V active when wet |
| R4 always ON (EZ Meter) | Meter offline → undervolt; check RS485 |
| No `DDS_*` tags | Reflash with `MV_EZMETER=1`; check A/B |
| Simplex tags not updating | Bind logical tags to physical DIs in cloud |
| Deploy timeout | Enable MQTT Parc hub; check broker auth |

---

## 12. Quick commissioning checklists

### Simplex

| # | Task | ✓ |
|---|------|---|
| 1 | Opta base wired: I1–I2 CTs, I3–I8 floats/faults, R1 pump | |
| 2 | Opta flashed; MQTT test OK | |
| 3 | Driver added; tags synced | |
| 4 | Program 35 deployed | |
| 5 | Floats and R1 verified | |

### Duplex (+ optional EZ Meter)

| # | Task | ✓ |
|---|------|---|
| 1 | Panel wired per I/O map § Duplex | |
| 2 | Expansions scanned; AI1–AI6 CTs wired | |
| 3 | Flash flags per config matrix | |
| 4 | Program 36 or 38 deployed | |
| 5 | Floats, pumps, fail-to-run verified | |
| 6 | [EZ Meter] RS485 live; R4 alarm tested | |

### Triplex + EZ Meter

| # | Task | ✓ |
|---|------|---|
| 1 | Panel wired per I/O map § Triplex | |
| 2 | 5 floats + 3 run fb + 3 motor faults | |
| 3 | Program 39 deployed | |
| 4 | R1–R3 pumps; R4 alarm verified | |
| 5 | EZ Meter PQ tags live | |

---

## 13. Reference files

| Path | Purpose |
|------|---------|
| `docs/projects/LIFT-STATION-OPTA-IO-MAP.md` | Unified I/O map (this doc's companion) |
| `scripts/lift-station/opta-io-map-data.js` | I/O map source data |
| `st/logic/35_lift_simplex.st` | Simplex ST |
| `st/logic/36_duplex_lift_station.st` | Duplex ST |
| `st/logic/38_duplex_lift_station_ezmeter.st` | Duplex + EZ Meter |
| `st/logic/39_triplex_lift_station_ezmeter.st` | Triplex + EZ Meter |
| `src/devices/templates/lift_station_*.json` | Cloud templates |
| `docs/facilities/EZMETER_FACILITY_PQ.md` | EZ Meter Modbus / PQ detail |

**Build commands:**

```bash
npm run generate:lift-station-io-map-md    # Regenerate I/O map markdown
npm run build:lift-station-io-map-pdf      # Unified I/O map PDF
npm run build:lift-station-parc-cloud-build-pdf   # This guide PDF
npm run generate:duplex-lift-station       # Duplex bench .est project
```

---

*MooreVIEW · Lift Station Parc & Cloud Build Guide v2.0*
