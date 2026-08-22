# MooreVIEW Lift Station — Opta Physical I/O Map

**Document version:** 1.0
**Generated:** 2026-08-02
**PDF:** `npm run build:lift-station-io-map-pdf`

Unified physical I/O reference for **simplex** (Opta base + 2 CT), **duplex**, and **triplex** lift-station panels.

---

## Configuration matrix

| Configuration | Pumps | Floats | ALT | ST program | Template | EZ Meter | R4 alarm |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Simplex | 1 | 4 | None | `logic/35_lift_simplex.st` | `lift_station_simplex` | No | Yes |
| Duplex | 2 | 4 | ALT2 | `logic/36_duplex_lift_station.st` | `lift_station_dual_duplex` | No | Yes |
| Duplex + EZ Meter | 2 | 4 | ALT2 | `logic/38_duplex_lift_station_ezmeter.st` | `lift_station_dual_duplex_ezmeter` | Yes | Yes |
| Triplex + EZ Meter | 3 | 5 | ALT3 | `logic/39_triplex_lift_station_ezmeter.st` | `lift_station_triplex_ezmeter` | Yes | Yes |

### Shared conventions

- **R4:** station alarm relay on **every** configuration (horn, strobe, or SCADA contact).
- **Simplex:** Opta **base unit only** — 2 CT on I1/I2 (AI1/AI2); floats on I3–I8. No expansion.
- **Duplex / triplex:** Opta base I1–I6 analog CT; D1608E slot 1 for floats and faults.
- **Expansion slot 2 (A0602):** 8× 2-wire PT100 RTD on X2_AI1–X2_AI8 when RTD enabled on Opta /setup — optional.
- **Control-panel UPS (generator panels):** AC-loss dry contact on **X1_I16** → `POWER_FAIL` (not facility/main power).
- **Expansion DIs:** +24 V active (ON when float wet or contact made).

---

## Simplex Lift Station (SIMPLEXLS)
| Field | Value |
|-------|-------|
| ST program | `logic/35_lift_simplex.st` |
| Cloud template | `lift_station_simplex` |
| Pumps | 1 |
| Floats | 4 |
| Alternator | None |
| EZ Meter | No |
### Hardware
- Arduino Opta base unit only (I1–I8, R1–R4) — no Sequent expansion
- 2× 0–1 V CT transmitters on analog inputs I1 and I2
- Floats and fault contacts on digital inputs I3–I8
### Wiring notes
- Simplex panel: Opta base unit only — no D1608E or A0602 expansion.
- Analog I1–I2: 0–1 V CT transmitters, linear 0–50 A (1.00 V = 50 A). Tags AI1, AI2.
- Digital I3–I8: +24 V active when float wet or contact made.
- Program 35 uses logical tags — bind I3–I8 to LVL_START, LVL_STOP, LVL_HIGH, LVL_LO, PUMP_FAIL in Cloud Studio.
- R1 drives pump contactor (MOTOR1_RUN); R4 drives station alarm on ALT_FAULT.
### Opta base — relay outputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| R1 | Relay out 1 | BOOL | R1 | MOTOR1_RUN | Pump 1 contactor |
| R2 | Relay out 2 | BOOL | R2 | — | Spare |
| R3 | Relay out 3 | BOOL | R3 | — | Spare |
| R4 | Relay out 4 | BOOL | R4 | R4 | Station alarm ← ALT_FAULT (high/low level, pump fault) |

### Opta base — digital inputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| I3 | Digital in 3 | BOOL | I3 | LVL_START | Start float — wet = call pump |
| I4 | Digital in 4 | BOOL | I4 | LVL_STOP | Stop float — dry = stop pump |
| I5 | Digital in 5 | BOOL | I5 | LVL_HIGH | High level alarm float |
| I6 | Digital in 6 | BOOL | I6 | LVL_LO | Low level alarm float |
| I7 | Digital in 7 | BOOL | I7 | PUMP_FAIL | Pump fault / overload contact |
| I8 | Digital in 8 | BOOL | I8 | P1_RUN_FB | Run feedback (optional fail-to-run) |

### Opta base — analog inputs (2× CT 0–50 A)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| AI1 / I1 | Analog in 1 | REAL | I1_RAW | AI1 | Pump CT 1 (0–50 A) |
| AI2 / I2 | Analog in 2 | REAL | I2_RAW | AI2 | Pump CT 2 (0–50 A) |

---

## Duplex Lift Station (DUPLEXLS)
| Field | Value |
|-------|-------|
| ST program | `logic/36_duplex_lift_station.st` |
| Cloud template | `lift_station_dual_duplex` |
| Pumps | 2 |
| Floats | 4 |
| Alternator | ALT2 |
| EZ Meter | No |
| Flash flags | `MV_FIELDBUS=1` |
### Hardware
- Arduino Opta (base I1–I8 digital, I1–I6 analog, R1–R4 relay, RS485)
- Sequent D1608E digital expansion — slot 1 (X1_I1…X1_I16, X1_R1…X1_R8)
- Sequent A0602 analog expansion — slot 2 optional (X2_AI1…X2_AI8 as 8× 2-wire PT100 RTD when enabled, X2_PWM1…X2_PWM4)
### Wiring notes
- Analog I1–I6: 0–1 V CT transmitters, linear 0–50 A (1.00 V = 50 A). Engineering tag = raw × 0.48828125.
- Expansion DIs (+24 V active): input ON when float wet, run aux made, or fault contact active. Unwired inputs read OFF.
- Run feedback and fault inputs: +24 V active (input ON when aux made or fault contact active).
- Relay outputs R1/R2 drive pump contactors; R4 drives station alarm on ALT_FAULT.
- Float DIs: HIGH (X1_I1) · LEAD (X1_I2) · LAG (X1_I3) · OFF (X1_I4).
- PHASE_FAULT (X1_I7) clears auto pump demand — same effect as dry OFF float while upper floats are on.
- R3 spare on duplex (triplex: R3 = pump 3 contactor).
- A0602 slot 2: wire 8× 2-wire PT100 RTDs; Opta /setup → enable **A0602 RTD** (values °C on X2_AI1–X2_AI8).
- Generator panels: control-panel UPS AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost). Tag **POWER_FAIL** — not facility power (use EZ Meter / **PHASE_FAULT**). Leave unwired on non-generator panels.
### Opta base — relay outputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| R1 | Relay out 1 | BOOL | R1 | MOTOR1_RUN | Pump 1 contactor |
| R2 | Relay out 2 | BOOL | R2 | MOTOR2_RUN | Pump 2 contactor |
| R3 | Relay out 3 | BOOL | R3 | — | Spare |
| R4 | Relay out 4 | BOOL | R4 | R4 | Station alarm ← ALT_FAULT (alternator fault, fail-to-run) |

### Opta base — digital inputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| I7 | Digital in 7 | BOOL | I7 | — | Spare (I1–I6 used as analog CT inputs) |
| I8 | Digital in 8 | BOOL | I8 | — | Spare digital |

### Opta base — analog inputs (CT 0–50 A)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| AI1 / I1 | Analog in 1 | REAL | I1_RAW | AI1 | Motor 1 phase A amps |
| AI2 / I2 | Analog in 2 | REAL | I2_RAW | AI2 | Motor 1 phase B amps |
| AI3 / I3 | Analog in 3 | REAL | I3_RAW | AI3 | Motor 1 phase C amps |
| AI4 / I4 | Analog in 4 | REAL | I4_RAW | AI4 | Motor 2 phase A amps |
| AI5 / I5 | Analog in 5 | REAL | I5_RAW | AI5 | Motor 2 phase B amps |
| AI6 / I6 | Analog in 6 | REAL | I6_RAW | AI6 | Motor 2 phase C amps |
| I7_RAW | Analog raw 7 | INT | I7_RAW | — | Spare raw (if I7 configured analog) |
| I8_RAW | Analog raw 8 | INT | I8_RAW | — | Spare raw (if I8 configured analog) |

### Expansion slot 1 — Sequent D1608E digital inputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X1_I1 | DI 1 | BOOL | X1_I1 | LVL_HIGH | High level float |
| X1_I2 | DI 2 | BOOL | X1_I2 | LVL_LEAD | Lead float |
| X1_I3 | DI 3 | BOOL | X1_I3 | LVL_LAG | Lag float |
| X1_I4 | DI 4 | BOOL | X1_I4 | LVL_OFF | Off float |
| X1_I5 | DI 5 | BOOL | X1_I5 | P1_RUN_FB | Pump 1 run feedback (fail-to-run) |
| X1_I6 | DI 6 | BOOL | X1_I6 | P2_RUN_FB | Pump 2 run feedback (fail-to-run) |
| X1_I7 | DI 7 | BOOL | X1_I7 | PHASE_FAULT | Phase fault |
| X1_I8 | DI 8 | BOOL | X1_I8 | GEN_RUN | Generator running |
| X1_I9 | DI 9 | BOOL | X1_I9 | GEN_FUEL_FAULT | Generator fuel fault |
| X1_I10 | DI 10 | BOOL | X1_I10 | GEN_FAULT | Generator fault |
| X1_I11 | DI 11 | BOOL | X1_I11 | — | Spare |
| X1_I12 | DI 12 | BOOL | X1_I12 | — | Spare |
| X1_I13 | DI 13 | BOOL | X1_I13 | — | Spare |
| X1_I14 | DI 14 | BOOL | X1_I14 | — | Spare |
| X1_I15 | DI 15 | BOOL | X1_I15 | — | Spare |
| X1_I16 | DI 16 | BOOL | X1_I16 | POWER_FAIL | Control-panel AC loss — generator panels; UPS +24 V when AC to panel lost |

### Expansion slot 1 — Sequent D1608E relay outputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X1_R1 | Relay out 1 | BOOL | X1_R1 | — | Spare (pump contactors on base R1–R3) |
| X1_R2 | Relay out 2 | BOOL | X1_R2 | — | Spare |
| X1_R3 | Relay out 3 | BOOL | X1_R3 | — | Spare |
| X1_R4 | Relay out 4 | BOOL | X1_R4 | — | Spare |
| X1_R5 | Relay out 5 | BOOL | X1_R5 | — | Spare |
| X1_R6 | Relay out 6 | BOOL | X1_R6 | — | Spare |
| X1_R7 | Relay out 7 | BOOL | X1_R7 | — | Spare |
| X1_R8 | Relay out 8 | BOOL | X1_R8 | — | Spare |

### Expansion slot 2 — Sequent A0602 analog (optional RTD)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X2_AI1 | Analog 1 | REAL | X2_AI1 | MOTOR1_TEMP | Motor 1 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI2 | Analog 2 | REAL | X2_AI2 | MOTOR2_TEMP | Motor 2 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI3 | Analog 3 | REAL | X2_AI3 | RTD3_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI4 | Analog 4 | REAL | X2_AI4 | RTD4_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI5 | Analog 5 | REAL | X2_AI5 | RTD5_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI6 | Analog 6 | REAL | X2_AI6 | RTD6_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI7 | Analog 7 | REAL | X2_AI7 | RTD7_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI8 | Analog 8 | REAL | X2_AI8 | RTD8_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |

### Expansion slot 2 — Sequent A0602 PWM outputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X2_PWM1 | PWM 1 | REAL | X2_PWM1 | — | Spare |
| X2_PWM2 | PWM 2 | REAL | X2_PWM2 | — | Spare |
| X2_PWM3 | PWM 3 | REAL | X2_PWM3 | — | Spare |
| X2_PWM4 | PWM 4 | REAL | X2_PWM4 | — | Spare |

---

## Duplex Lift Station + EZ Meter (DUPLEXLS)
| Field | Value |
|-------|-------|
| ST program | `logic/38_duplex_lift_station_ezmeter.st` |
| Cloud template | `lift_station_dual_duplex_ezmeter` |
| Pumps | 2 |
| Floats | 4 |
| Alternator | ALT2 |
| EZ Meter | Yes |
| Flash flags | `MV_FIELDBUS=1 MV_EZMETER=1` |
### Hardware
- Arduino Opta (base I1–I8 digital, I1–I6 analog, R1–R4 relay, RS485)
- Sequent D1608E digital expansion — slot 1 (X1_I1…X1_I16, X1_R1…X1_R8)
- Sequent A0602 analog expansion — slot 2 optional (X2_AI1…X2_AI8 as 8× 2-wire PT100 RTD when enabled, X2_PWM1…X2_PWM4)
- EZ Meter DDS-RGB on Opta RS485 (A/B, 9600 8N1, slave ID 1)
### Wiring notes
- Analog I1–I6: 0–1 V CT transmitters, linear 0–50 A (1.00 V = 50 A). Engineering tag = raw × 0.48828125.
- Expansion DIs (+24 V active): input ON when float wet, run aux made, or fault contact active. Unwired inputs read OFF.
- Run feedback and fault inputs: +24 V active (input ON when aux made or fault contact active).
- Relay outputs R1/R2 drive pump contactors; R4 drives station alarm horn/strobe (LVL_HIGH, MECH_PQ_ALM, motor fault DIs).
- EZ Meter DDS-RGB on Opta RS485. Flash with MV_FIELDBUS=1 MV_EZMETER=1.
- Float DIs: HIGH (X1_I1) · LEAD (X1_I2) · LAG (X1_I3) · OFF (X1_I4).
- PHASE_FAULT (X1_I7) clears auto pump demand in ST — same effect as dry off float while upper floats are on.
- A0602 slot 2: wire 8× 2-wire PT100 RTDs; Opta /setup → enable **A0602 RTD** (values °C on X2_AI1–X2_AI8).
- Generator panels: control-panel UPS AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost). Tag **POWER_FAIL** — not facility power (use EZ Meter / **PHASE_FAULT**). Leave unwired on non-generator panels.
### Opta base — relay outputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| R1 | Relay out 1 | BOOL | R1 | MOTOR1_RUN | Pump 1 contactor |
| R2 | Relay out 2 | BOOL | R2 | MOTOR2_RUN | Pump 2 contactor |
| R3 | Relay out 3 | BOOL | R3 | — | Spare |
| R4 | Relay out 4 | BOOL | R4 | R4 | Station alarm (high level / EZ Meter PQ / motor fault) |

### Opta base — digital inputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| I7 | Digital in 7 | BOOL | I7 | — | Spare (I1–I6 used as analog CT inputs) |
| I8 | Digital in 8 | BOOL | I8 | — | Spare digital |

### Opta base — analog inputs (CT 0–50 A)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| AI1 / I1 | Analog in 1 | REAL | I1_RAW | AI1 | Motor 1 phase A amps |
| AI2 / I2 | Analog in 2 | REAL | I2_RAW | AI2 | Motor 1 phase B amps |
| AI3 / I3 | Analog in 3 | REAL | I3_RAW | AI3 | Motor 1 phase C amps |
| AI4 / I4 | Analog in 4 | REAL | I4_RAW | AI4 | Motor 2 phase A amps |
| AI5 / I5 | Analog in 5 | REAL | I5_RAW | AI5 | Motor 2 phase B amps |
| AI6 / I6 | Analog in 6 | REAL | I6_RAW | AI6 | Motor 2 phase C amps |
| I7_RAW | Analog raw 7 | INT | I7_RAW | — | Spare raw (if I7 configured analog) |
| I8_RAW | Analog raw 8 | INT | I8_RAW | — | Spare raw (if I8 configured analog) |

### Expansion slot 1 — Sequent D1608E digital inputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X1_I1 | DI 1 | BOOL | X1_I1 | LVL_HIGH | High level float |
| X1_I2 | DI 2 | BOOL | X1_I2 | LVL_LEAD | Lead float |
| X1_I3 | DI 3 | BOOL | X1_I3 | LVL_LAG | Lag float |
| X1_I4 | DI 4 | BOOL | X1_I4 | LVL_OFF | Off float |
| X1_I5 | DI 5 | BOOL | X1_I5 | P1_RUN_FB | Pump 1 run feedback (fail-to-run) |
| X1_I6 | DI 6 | BOOL | X1_I6 | P2_RUN_FB | Pump 2 run feedback (fail-to-run) |
| X1_I7 | DI 7 | BOOL | X1_I7 | PHASE_FAULT | Phase fault |
| X1_I8 | DI 8 | BOOL | X1_I8 | GEN_RUN | Generator running |
| X1_I9 | DI 9 | BOOL | X1_I9 | GEN_FUEL_FAULT | Generator fuel fault |
| X1_I10 | DI 10 | BOOL | X1_I10 | GEN_FAULT | Generator fault |
| X1_I11 | DI 11 | BOOL | X1_I11 | MOTOR1_FAULT | Pump 1 motor fault → R4 |
| X1_I12 | DI 12 | BOOL | X1_I12 | MOTOR2_FAULT | Pump 2 motor fault → R4 |
| X1_I13 | DI 13 | BOOL | X1_I13 | — | Spare |
| X1_I14 | DI 14 | BOOL | X1_I14 | — | Spare |
| X1_I15 | DI 15 | BOOL | X1_I15 | — | Spare |
| X1_I16 | DI 16 | BOOL | X1_I16 | POWER_FAIL | Control-panel AC loss — generator panels; UPS +24 V when AC to panel lost |

### Expansion slot 1 — Sequent D1608E relay outputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X1_R1 | Relay out 1 | BOOL | X1_R1 | — | Spare (pump contactors on base R1–R3) |
| X1_R2 | Relay out 2 | BOOL | X1_R2 | — | Spare |
| X1_R3 | Relay out 3 | BOOL | X1_R3 | — | Spare |
| X1_R4 | Relay out 4 | BOOL | X1_R4 | — | Spare |
| X1_R5 | Relay out 5 | BOOL | X1_R5 | — | Spare |
| X1_R6 | Relay out 6 | BOOL | X1_R6 | — | Spare |
| X1_R7 | Relay out 7 | BOOL | X1_R7 | — | Spare |
| X1_R8 | Relay out 8 | BOOL | X1_R8 | — | Spare |

### Expansion slot 2 — Sequent A0602 analog (optional RTD)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X2_AI1 | Analog 1 | REAL | X2_AI1 | MOTOR1_TEMP | Motor 1 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI2 | Analog 2 | REAL | X2_AI2 | MOTOR2_TEMP | Motor 2 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI3 | Analog 3 | REAL | X2_AI3 | RTD3_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI4 | Analog 4 | REAL | X2_AI4 | RTD4_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI5 | Analog 5 | REAL | X2_AI5 | RTD5_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI6 | Analog 6 | REAL | X2_AI6 | RTD6_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI7 | Analog 7 | REAL | X2_AI7 | RTD7_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI8 | Analog 8 | REAL | X2_AI8 | RTD8_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |

### Expansion slot 2 — Sequent A0602 PWM outputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X2_PWM1 | PWM 1 | REAL | X2_PWM1 | — | Spare |
| X2_PWM2 | PWM 2 | REAL | X2_PWM2 | — | Spare |
| X2_PWM3 | PWM 3 | REAL | X2_PWM3 | — | Spare |
| X2_PWM4 | PWM 4 | REAL | X2_PWM4 | — | Spare |

---

## Triplex Lift Station + EZ Meter (TRIPLEXLS)
| Field | Value |
|-------|-------|
| ST program | `logic/39_triplex_lift_station_ezmeter.st` |
| Cloud template | `lift_station_triplex_ezmeter` |
| Pumps | 3 |
| Floats | 5 |
| Alternator | ALT3 |
| EZ Meter | Yes |
| Flash flags | `MV_FIELDBUS=1 MV_EZMETER=1` |
### Hardware
- Arduino Opta (base I1–I8 digital, I1–I6 analog, R1–R4 relay, RS485)
- Sequent D1608E digital expansion — slot 1 (X1_I1…X1_I16, X1_R1…X1_R8)
- Sequent A0602 analog expansion — slot 2 optional (X2_AI1…X2_AI8 as 8× 2-wire PT100 RTD when enabled, X2_PWM1…X2_PWM4)
- EZ Meter DDS-RGB on Opta RS485 (A/B, 9600 8N1, slave ID 1)
### Wiring notes
- Analog I1–I6: 0–1 V CT transmitters, linear 0–50 A (1.00 V = 50 A). Engineering tag = raw × 0.48828125.
- Expansion DIs (+24 V active): input ON when float wet, run aux made, or fault contact active. Unwired inputs read OFF.
- Run feedback and fault inputs: +24 V active (input ON when aux made or fault contact active).
- Relay outputs R1–R3 drive pump contactors; R4 drives station alarm (LVL_HIGH, MECH_PQ_ALM, motor faults).
- EZ Meter DDS-RGB on Opta RS485. Flash with MV_FIELDBUS=1 MV_EZMETER=1.
- Float DIs: HIGH (X1_I1) · LEAD (X1_I2) · LAG (X1_I3) · LAG2 (X1_I4) · OFF (X1_I5).
- PHASE_FAULT (X1_I9) clears auto pump demand in ST.
- A0602 slot 2: wire 8× 2-wire PT100 RTDs; Opta /setup → enable **A0602 RTD** (MOTOR1–3 on X2_AI1–3, RTD4–8 spare).
- Generator panels: control-panel UPS AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost). Tag **POWER_FAIL** — not facility power (use EZ Meter / **PHASE_FAULT**). Leave unwired on non-generator panels.
### Opta base — relay outputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| R1 | Relay out 1 | BOOL | R1 | MOTOR1_RUN | Pump 1 contactor |
| R2 | Relay out 2 | BOOL | R2 | MOTOR2_RUN | Pump 2 contactor |
| R3 | Relay out 3 | BOOL | R3 | MOTOR3_RUN | Pump 3 contactor |
| R4 | Relay out 4 | BOOL | R4 | R4 | Station alarm (high level / EZ Meter PQ / motor fault) |

### Opta base — digital inputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| I7 | Digital in 7 | BOOL | I7 | — | Spare (I1–I6 used as analog CT inputs) |
| I8 | Digital in 8 | BOOL | I8 | — | Spare digital |

### Opta base — analog inputs (CT 0–50 A)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| AI1 / I1 | Analog in 1 | REAL | I1_RAW | AI1 | Motor 1 phase A amps |
| AI2 / I2 | Analog in 2 | REAL | I2_RAW | AI2 | Motor 1 phase B amps |
| AI3 / I3 | Analog in 3 | REAL | I3_RAW | AI3 | Motor 1 phase C amps |
| AI4 / I4 | Analog in 4 | REAL | I4_RAW | AI4 | Motor 2 phase A amps |
| AI5 / I5 | Analog in 5 | REAL | I5_RAW | AI5 | Motor 2 phase B amps |
| AI6 / I6 | Analog in 6 | REAL | I6_RAW | AI6 | Motor 2 phase C amps |
| I7_RAW | Analog raw 7 | INT | I7_RAW | — | Spare raw (if I7 configured analog) |
| I8_RAW | Analog raw 8 | INT | I8_RAW | — | Spare raw (if I8 configured analog) |
| — | — | — | — | — | Pump 3 CTs: expansion analog or spare (not base I1–I6) |

### Expansion slot 1 — Sequent D1608E digital inputs

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X1_I1 | DI 1 | BOOL | X1_I1 | LVL_HIGH | High level float |
| X1_I2 | DI 2 | BOOL | X1_I2 | LVL_LEAD | Lead float |
| X1_I3 | DI 3 | BOOL | X1_I3 | LVL_LAG | Lag float |
| X1_I4 | DI 4 | BOOL | X1_I4 | LVL_LAG2 | Lag2 float (3-pump stage) |
| X1_I5 | DI 5 | BOOL | X1_I5 | LVL_OFF | Off float |
| X1_I6 | DI 6 | BOOL | X1_I6 | P1_RUN_FB | Pump 1 run feedback (fail-to-run) |
| X1_I7 | DI 7 | BOOL | X1_I7 | P2_RUN_FB | Pump 2 run feedback (fail-to-run) |
| X1_I8 | DI 8 | BOOL | X1_I8 | P3_RUN_FB | Pump 3 run feedback (fail-to-run) |
| X1_I9 | DI 9 | BOOL | X1_I9 | PHASE_FAULT | Phase fault |
| X1_I10 | DI 10 | BOOL | X1_I10 | GEN_RUN | Generator running |
| X1_I11 | DI 11 | BOOL | X1_I11 | GEN_FUEL_FAULT | Generator fuel fault |
| X1_I12 | DI 12 | BOOL | X1_I12 | GEN_FAULT | Generator fault |
| X1_I13 | DI 13 | BOOL | X1_I13 | MOTOR1_FAULT | Pump 1 motor fault → R4 |
| X1_I14 | DI 14 | BOOL | X1_I14 | MOTOR2_FAULT | Pump 2 motor fault → R4 |
| X1_I15 | DI 15 | BOOL | X1_I15 | MOTOR3_FAULT | Pump 3 motor fault → R4 |
| X1_I16 | DI 16 | BOOL | X1_I16 | POWER_FAIL | Control-panel AC loss — generator panels; UPS +24 V when AC to panel lost |

### Expansion slot 1 — Sequent D1608E relay outputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X1_R1 | Relay out 1 | BOOL | X1_R1 | — | Spare (pump contactors on base R1–R3) |
| X1_R2 | Relay out 2 | BOOL | X1_R2 | — | Spare |
| X1_R3 | Relay out 3 | BOOL | X1_R3 | — | Spare |
| X1_R4 | Relay out 4 | BOOL | X1_R4 | — | Spare |
| X1_R5 | Relay out 5 | BOOL | X1_R5 | — | Spare |
| X1_R6 | Relay out 6 | BOOL | X1_R6 | — | Spare |
| X1_R7 | Relay out 7 | BOOL | X1_R7 | — | Spare |
| X1_R8 | Relay out 8 | BOOL | X1_R8 | — | Spare |

### Expansion slot 2 — Sequent A0602 analog (optional RTD)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X2_AI1 | Analog 1 | REAL | X2_AI1 | MOTOR1_TEMP | Motor 1 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI2 | Analog 2 | REAL | X2_AI2 | MOTOR2_TEMP | Motor 2 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI3 | Analog 3 | REAL | X2_AI3 | MOTOR3_TEMP | Motor 3 winding temp — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI4 | Analog 4 | REAL | X2_AI4 | RTD4_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI5 | Analog 5 | REAL | X2_AI5 | RTD5_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI6 | Analog 6 | REAL | X2_AI6 | RTD6_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI7 | Analog 7 | REAL | X2_AI7 | RTD7_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |
| X2_AI8 | Analog 8 | REAL | X2_AI8 | RTD8_TEMP | Spare RTD — 2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd) |

### Expansion slot 2 — Sequent A0602 PWM outputs (spare)

| Terminal / tag | Point | Type | Channel | Logic tag | Description |
| --- | --- | --- | --- | --- | --- |
| X2_PWM1 | PWM 1 | REAL | X2_PWM1 | — | Spare |
| X2_PWM2 | PWM 2 | REAL | X2_PWM2 | — | Spare |
| X2_PWM3 | PWM 3 | REAL | X2_PWM3 | — | Spare |
| X2_PWM4 | PWM 4 | REAL | X2_PWM4 | — | Spare |


## Related documents

- [LIFT-STATION-PARC-CLOUD-BUILD.md](./LIFT-STATION-PARC-CLOUD-BUILD.md) — panel build and cloud commissioning
- `npm run build:lift-station-io-map-pdf` → `MooreVIEW-Lift-Station-Opta-IO-Map.pdf`

---

*MooreVIEW · Lift Station Opta I/O Map v1.0*
