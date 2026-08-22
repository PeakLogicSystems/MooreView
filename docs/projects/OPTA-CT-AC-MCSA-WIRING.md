# Opta — 50 mA CT AC MCSA Wiring

**MooreVIEW integrator reference**  
**Applies to:** Arduino Opta MQTT ST firmware (`firmware/arduino-opta-mqtt-st/`)  
**Path:** True line MCSA — `-DMV_CT_WAVEFORM=1` + M4 coprocessor

---

## Purpose

This document shows how to wire **50 mA AC current transformers** to Opta base analog inputs **I1–I6** for **true AC waveform MCSA** (real 60 Hz FFT on the Cortex-M4 coprocessor), as opposed to:

| Input type | Opta sees | MCSA mode |
|------------|-----------|-----------|
| 0–1 V / 0–10 V **DC-RMS transmitter** | Steady DC ∝ RMS amps | Pseudo MCSA (`MV_CT_WAVEFORM=0`) |
| **50 mA CT + burden + mid-rail bias** | 60 Hz sine centered ~5 V | **True MCSA** (`MV_CT_WAVEFORM=1`) |

Firmware reference: `firmware/arduino-opta-mqtt-st/README.md` — *AC line MCSA* section.

---

## Single channel — AC waveform MCSA

One CT channel (example: Pump 1 phase A → **I1**):

```mermaid
flowchart TB
  subgraph PRIMARY["Primary — line side"]
    L1["Line conductor L1"]
    CTpri["50 mA CT core"]
    L1 --> CTpri
  end

  subgraph SECONDARY["Secondary — one channel e.g. I1"]
    CTs1["CT sec terminal 1 K"]
    CTs2["CT sec terminal 2 L"]
    Rb["Burden Rb 47–68 Ω 1 W+<br/>shunt: I1 → AGND"]
    Node["Analog node<br/>Opta terminal I1"]
    Rbias["Rbias 47 kΩ – 100 kΩ"]
    Div["Mid-rail divider<br/>+10 V → 10 kΩ → 5 V → 10 kΩ → AGND"]
    CTpri --> CTs1
    CTs1 --> Node
    Node --> Rb
    Rb --> AGND["Opta AGND / common"]
    CTs2 --> AGND
    Div --> Rbias
    Rbias --> Node
  end

  subgraph OPTA["Arduino Opta base"]
    ADC["I1 — 0–10 V high-Z ADC<br/>~5 V ± AC swing"]
    Node --> ADC
    AGND --- ADC
  end

  subgraph SIGNAL["ADC signal"]
    Wave["~5 V DC offset + 60 Hz sine<br/>V_ac peak = I_sec × Rb"]
  end

  ADC --> Wave
```

### Reading the diagram

- CT secondary is a **current source**; the burden is the **load from I1 to AGND** (V = I × Rb).
- **Do not** place a resistor in **series** between a DC transmitter and I1 — Opta expects **voltage at the pin relative to AGND** (high-Z input).
- Mid-rail bias lifts the idle point to **~5 V** so the sine stays inside **0–10 V**.
- At **50 mA secondary × 68 Ω ≈ 3.4 V** peak → roughly **5 V ± 3.4 V** (1.6 V to 8.4 V) — OK.

---

## Duplex lift — six CT channels

Repeat the single-channel circuit for **I1 through I6**:

```mermaid
flowchart LR
  subgraph P1["Pump 1"]
    P1A["Phase A"] --> CT1["CT"]
    P1B["Phase B"] --> CT2["CT"]
    P1C["Phase C"] --> CT3["CT"]
  end

  subgraph P2["Pump 2"]
    P2A["Phase A"] --> CT4["CT"]
    P2B["Phase B"] --> CT5["CT"]
    P2C["Phase C"] --> CT6["CT"]
  end

  subgraph OPTA["Opta analog inputs"]
    I1["I1 / AI1"]
    I2["I2 / AI2"]
    I3["I3 / AI3"]
    I4["I4 / AI4"]
    I5["I5 / AI5"]
    I6["I6 / AI6"]
  end

  CT1 --> I1
  CT2 --> I2
  CT3 --> I3
  CT4 --> I4
  CT5 --> I5
  CT6 --> I6
```

| Opta pin | Tag | Pump / phase |
|----------|-----|--------------|
| **I1** | AI1 | Pump 1 — phase A |
| **I2** | AI2 | Pump 1 — phase B |
| **I3** | AI3 | Pump 1 — phase C |
| **I4** | AI4 | Pump 2 — phase A |
| **I5** | AI5 | Pump 2 — phase B |
| **I6** | AI6 | Pump 2 — phase C |

Each channel: **CT sec → Ix node → Rb (Ix→AGND) → Rbias from 5 V bus → CT return → AGND**.

---

## Bias + burden detail

Shared **+5 V bias bus** can feed all six channels (one divider, six Rbias resistors):

```mermaid
flowchart TB
  V10["+10 V Opta supply"]
  R1["10 kΩ"]
  V5["+5 V bias bus shared I1…I6"]
  R2["10 kΩ"]
  Rb["Rb 47–68 Ω per channel"]
  Rbias["Rbias 47 kΩ per channel"]
  Ix["Opta Ix"]
  CT["CT secondary"]
  GND["AGND"]

  V10 --> R1 --> V5 --> R2 --> GND
  V5 --> Rbias --> Ix
  CT --> Ix
  CT --> GND
  Ix --> Rb --> GND
```

---

## Wrong vs right — “shunt to GND, not series”

```mermaid
flowchart LR
  subgraph WRONG["Wrong — series ahead of high-Z ADC"]
    TX["DC 0–10 V transmitter"] --> Rs["R series"] --> ADCbad["Opta I1"]
  end

  subgraph RIGHT["Correct — burden shunt + bias"]
    CTw["50 mA CT sec"] --> Node["Ix node"]
    Node --> Rbw["Rb → AGND"]
    Biasw["5 V via Rbias"] --> Node
    Node --> ADCgood["Opta I1"]
  end
```

Firmware note (`mv_config.h`): *burden/shunt ohms from analog input to GND (not series)*.

---

## Burden resistor selection

| Goal | Burden | At 50 mA sec | Firmware |
|------|--------|--------------|----------|
| **AC waveform MCSA** | **47–68 Ω** | ~2.4–3.4 V peak AC | `-DMV_CT_WAVEFORM=1` |
| DC-RMS shunt (pseudo MCSA) | 180 Ω | ~9 V DC at FS | default `MV_CT_WAVEFORM=0` |
| DC-RMS shunt | 100 Ω | ~5 V DC at FS | `-DMV_CT_BURDEN_OHM=100` |
| DC-RMS shunt | 20 Ω | ~1 V DC at FS | default (same as 0–1 V TX) |

For AC MCSA use **47–68 Ω** so the biased sine does **not clip** at 0 V or 10 V.

**Do not** use AFX00007 **current** input mode with 50 mA (module max **25 mA**).

---

## Commissioning flow

```mermaid
flowchart LR
  Wire["50 mA CT + Rb 47–68 Ω<br/>+ 5 V bias"] --> Flash["Flash M7:<br/>-DMV_CT_WAVEFORM=1<br/>-DMV_CT_BURDEN_OHM=68"]
  Flash --> M4["Flash M4 sketch<br/>MooreviewOptaMcsaM4<br/>1.5 MB / 0.5 MB split"]
  M4 --> Cal["HTTP /ct-cal<br/>FS amps & FS volts"]
  Cal --> Mcsa["HTTP /mcsa<br/>deviceType = pump"]
  Mcsa --> Cloud["MooreVIEW cloud<br/>host ONNX + PdM"]
```

### Pre-power checks

| Check | Expected |
|-------|----------|
| Motor **OFF**, DMM on I1 | **~5 V DC** (mid-rail) |
| Motor **RUN**, scope on I1 | **60 Hz sine** around 5 V |
| Peak voltage | **0.2 V – 9.8 V** (no clipping) |
| CT secondary | **Never open** while primary energized — burden always connected |

### Runtime telemetry

With AC path active, MQTT Parc `runtime` should show:

- `ctWaveform`: `"ac"`
- `mcsaLite`: `false` (after M4 ingest)
- `trueFft` / cooked `mcsa[]` with real fund / rotor / bearing bins

---

## Related docs

| Document | Topic |
|----------|-------|
| `firmware/arduino-opta-mqtt-st/README.md` | Dual-core MCSA, compile flags |
| `docs/AI_EDGE_CLOUD.md` | Pseudo vs true MCSA, host ONNX |
| `docs/projects/LIFT-STATION-EZMETER-PARC-CLOUD.md` | Duplex I1–I6 tag map (DC transmitter baseline) |
| `docs/projects/UNO-Q-EDGE-MOTOR-FAULT.md` | UNO Q true FFT alternative |

---

*Generate PDF: `npm run build:opta-ct-mcsa-wiring-pdf`*
