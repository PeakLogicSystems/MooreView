# CENSAR SK1 ↔ Uno Q Mezzanine Netlist

Replace Siemens digital card `1593_CH_501` / `611/DA/24336/ETC` with:

**[CENSAR analog / MP board] —SK1— [this mezzanine] —headers— [Arduino Uno Q STM32U585]**

Sources: `pinout 7.24.2017.xls`, digital card PDF sheets 1–5, firmware `hwdefs.h` / `Collect.c`.

| Artifact | Path |
|----------|------|
| Bring-up sketch | [`firmware/arduino-censar-uno-q-sk1/uno_q_sk1_bringup/`](../../firmware/arduino-censar-uno-q-sk1/uno_q_sk1_bringup/) |
| KiCad outline | CENSAR workspace `hardware/mezzanine/` (not in mooreview-pc yet) |
| CSV netlist | [`SK1_UNO_Q_NETLIST.csv`](SK1_UNO_Q_NETLIST.csv) |

---

## 1. Architecture

```text
                 SK1 64-pin (2×32)
 ┌───────────────┬──────────────────────────────────────────┐
 │ Analog board  │  Mezzanine (clone digital-card AFE I/O)   │
 │               │                                          │
 │  CH_* / MON_* ├─► DG406/ADG706 ─► buffer ─► 24-bit ADC  │
 │               │                          ▲               │
 │  CNTR/PG/MON  ├─► attenuate ─────────────┼─► ADC or Uno │
 │               │                          │               │
 │  BIAS/PROTON  │◄─ bipolar DAC / digipot+opamp (±5 V)     │
 │  SWITCH/DELAY │◄─ 3.3 V→5 V level shift ← STM32 timers   │
 │  PC* / AUX*   │◄─ 3.3 V→5 V buffers ← GPIO               │
 │  ±5 V, GND    │◄─ onboard regulators from VCC            │
 └───────────────┴──────────────────────────────────────────┘
                          │ SPI + GPIO (3.3 V)
                          ▼
                     Uno Q MCU
                          │ Bridge RPC
                          ▼
                     Uno Q Linux (Modbus / log / UI)
```

**Rule:** never connect SK1 `+5V`, `-5V`, or `VCC` to Uno Q GPIO/ADC pins. Only `VSS`/`0V`/`GND` share with Uno Q GND.

---

## 2. SK1 pin map (functional)

Connector: **SK1**, dual row **A1–A32 / B1–B32**.  
Names from Tests sheet; Connectors synonyms in parentheses.

### 2.1 Power

| SK1 | Net | Dir (vs mezz) | Spec | Mezzanine action |
|-----|-----|---------------|------|------------------|
| A1 | `VCC` | in | Batt / external ≤15 V | Mezz input; fuse + reverse diode |
| B1 | `0V` | — | Power ground | Star to mezz PGND |
| A2 | `VDD` | out* | **3.3 V** digital | Source from mezz LDO **or** Uno Q 3V3 (prefer mezz LDO ≥100 mA) |
| B2 | `VSS` | — | Digital ground | Tie to Uno Q GND |
| A3 | `+5V` | out | Analog +5 V ~30 mA+ | Mezz buck/LDO → SK1; also powers mezz op-amps |
| B3 | `-5V` | out | Analog −5 V ~20 mA+ | Mezz inverter/charge-pump → SK1 |
| A4 | `GND` | — | Analog ground | Star AGND; single-point to PGND |
| B4 | `GND` | — | Analog ground | Same AGND |

\*Original digital card *generated* `VDD`/`±5V`. Mezz must do the same so the analog board keeps working.

### 2.2 Primary ΣΔ measurement inputs → mux → 24-bit ADC

These are conditioned voltages from the analog board (original path: DG406 → MAX4331 → **LT2400**, Vref **2.5 V**, FS ≈ **0–2.5 V**).

| SK1 | Net | ID | Mezz net | Notes |
|-----|-----|----|----------|-------|
| A5 | `PH` | C0 | `CH_A1` | Pair A |
| B5 | `REDOX` | C1 | `CH_A2` | |
| A6 | `GND_A` | — | AGND sense | Guard / return |
| A7 | `GND_A` | — | AGND | |
| A8 | `CONDUCTIVITY` | C2 | `CH_B1` | |
| B8 | `TEMP` | C3 | `CH_B2` | |
| A9 | `GND_B` | — | AGND | |
| B9 | NC | — | — | Leave open |
| A10 | `CHLORINE` | C4 | `CH_C1` / `MICROLINE1` | Cl WE current sense voltage |
| B10 | `DO` | C5 | `CH_C2` / `MICROLINE2` | DO / NH₂Cl |
| A11 | `GND_C` | — | AGND | |
| A12 | `GND_C` / `GND_D`* | — | AGND | *Connectors synonym drift — verify on PCB |
| A13 | `CH_D1` | C6 | spare | |
| B13 | `CH_D2` | C7 | spare | |
| A14 | `GND_D` | — | AGND | |
| B14 | NC | — | — | |
| A15 | `CAT_1` | C8 | colour/turbidity detector | |
| B15 | `CAT_2` | C9 | CaT sense | |
| A16 | `GND_E` | — | AGND | |
| A17 | `CH_F1` / `CaT_TEMP` | C10 | | |
| B17 | `CH_F2` | C11 | | |
| A18 | `GND_F` | — | AGND | |
| B18 | NC | — | — | |
| A19 | `CH_G1` | C12 | spare | |
| B19 | `CH_G2` | C13 | spare | |
| A20 | `GND_G` | — | AGND | |
| A21 | `CH_H1` | C14 | spare | |
| B21 | `CH_H2` | C15 | spare | |
| A22 | `GND_H` | — | AGND | |
| B22 | NC / `BATT`* | — | optional | *one sheet variant |

**Mux address:** `MUX0..MUX3` → DG406/ADG706 A0..A3 (4 GPIO).

### 2.3 Secondary / monitor inputs (SAP)

Originally MCU 8-bit ADC. Prefer route through same mux+24-bit ADC *or* Uno Q A0–A5 with dividers (max **3.3 V** into Uno).

| SK1 | Net | ID | Expected role | Mezz |
|-----|-----|----|---------------|------|
| B6 | `CNTR_I` | SAP0 | Counter electrode current | ADC / atten |
| B7 | `CNTR_V` | SAP1 | Counter electrode voltage (~1.25 V mid) | ADC / atten |
| B11 | `PROT_I_CL` | SAP2 | Proton gen 1 current | ADC / atten |
| B12 | `PROT_I_DO` | SAP3 | Proton gen 2 current | ADC / atten |
| B16 | `CAT_MON` | SAP4 | CaT monitor | ADC / atten |
| B20 | `MON6` | SAP5 | monitor | ADC / atten |

Assume **0–5 V** until scoped; use ÷2 resistor dividers into 3.3 V ADC.

### 2.4 Voltage outputs (to analog board)

| SK1 | Net | ID | Range | Mezz |
|-----|-----|----|-------|------|
| A23 | `CL_BIAS1` | VOUT1 | **±1.25 V** | Bipolar DAC ch0 |
| B23 | `DO_BIAS1` | VOUT2 | **±1.25 V** | ch1 |
| A24 | `CL_BIAS2` | VOUT3 | **±1.25 V** | ch2 |
| B24 | `DO_BIAS2` | VOUT4 | **±1.25 V** | ch3 |
| A25 | `CL_PROTON` | VOUT5 | **±2.12 V** | ch4 (higher gain) |
| B25 | `DO_PROTON` | VOUT6 | **±2.12 V** | ch5 |

Clone path: SPI digipot (AD8403 or modern DAC8568) + LMC6062 (or OPA2192) on **±5 V**, REF **2.5 V**.

### 2.5 Timing pulses (to analog board)

| SK1 | Net | ID | Spec | Mezz |
|-----|-----|----|------|------|
| A26 | `CL_SWITCH` | TMR_A1 | 274 µs–70 ms | STM32 timer → buffer |
| B26 | `CL_DELAY` | TMR_A2 | same | STM32 timer → buffer |
| A27 | `DO_SWITCH` | TMR_B1 | same | STM32 timer → buffer |
| B27 | `DO_DELAY` | TMR_B2 | same | STM32 timer → buffer |

Original used monostables RC-tuned by digipot; **software timers on Uno Q are fine** if edge polarity/levels match (verify with scope: idle high/low).

### 2.6 Power control & AUX

| SK1 | Net | ID | Use | Mezz |
|-----|-----|----|-----|------|
| A28 | `2ND_AMPS` | PC0 | secondary amps power | GPIO → 5 V buffer |
| B28 | `CONDUCTIVITY` | PC1 | conductivity power | GPIO → 5 V buffer |
| A29 | `CAT_POWER` | PC2 | colour/turbidity power | GPIO → 5 V buffer |
| B29 | `PC3` | PC3 | memory card power* | GPIO → 5 V buffer |
| A30 | `PC4` | PC4 | temp power | GPIO → 5 V buffer |
| B30 | NC | — | — | — |
| A31 | `COL` | AUX0 | colour LED / select | GPIO → buffer |
| B31 | `TURB` | AUX1 | turbidity LED / select | GPIO → buffer |
| A32 | `REF` | AUX2 | optical ref | GPIO → buffer |
| B32 | `AUX3` | AUX3 | spare | GPIO → buffer |

\*Active levels: firmware drove log power **active-low** on old P9.3 — **measure** PC*/AUX* polarity before enabling.

---

## 3. Recommended mezzanine BOM (functional)

| Block | Preferred | Alt (closer to OEM) |
|-------|-----------|---------------------|
| 16:1 mux | **ADG706** (3.3 V logic OK) | DG406 (5 V) |
| Buffer | MAX4331 / OPA192 | MAX4331 |
| 24-bit ADC | **ADS1256** or **ADS1220** | **LT2400** |
| Vref 2.5 V | ADR4525 / LT1634-2.5 | LT1634-2.5 |
| 6× bipolar out | **DAC8568** + OPA2192 (±5 V) | AD8403 ×2–3 + LMC6062 |
| TMR / PC / AUX buffers | **74LVC245** or MOSFET + 74HCT | open-drain + pull-ups to +5 |
| +5 V | TPS62125 / AP63205 from VCC | LTC1474-5 |
| −5 V | **ICL7660** / LM2662 from +5 | ICL7660 |
| 3.3 V | TPS7A2033 from VCC or USB | LTC1474-3.3 |
| Isolation (optional later) | ISOUSB / ADM2587E | keep OEM LTC1334 path |

---

## 4. Uno Q MCU pin assignment (proposed)

All pins are **STM32U585 / 3.3 V**. Adjust if a carrier covers headers.

### 4.1 SPI0 (shared ADC + DAC)

| Function | Uno Q | Mezz net |
|----------|-------|----------|
| MOSI | **D11** | `SPI_MOSI` |
| MISO | **D12** | `SPI_MISO` |
| SCK | **D13** | `SPI_SCK` |
| ADC_CS | **D10** | `nCS_ADC` |
| DAC_CS | **D7** | `nCS_DAC` |
| MUX_CS / latch (if used) | **D8** | optional |

### 4.2 Mux address

| Function | Uno Q | Mezz |
|----------|-------|------|
| MUX0 | **D2** | A0 |
| MUX1 | **D4** | A1 |
| MUX2 | **D6** | A2 |
| MUX3 | **D9** | A3 |

### 4.3 Timing outputs

| Function | Uno Q | SK1 |
|----------|-------|-----|
| CL_SWITCH | **D3** (TIM/PWM) | A26 |
| CL_DELAY | **D5** | B26 |
| DO_SWITCH | **D14** / DAC0 pin as GPIO | A27 |
| DO_DELAY | **D15** | B27 |

### 4.4 Power control & AUX

| Function | Uno Q | SK1 |
|----------|-------|-----|
| PC0 2ND_AMPS | **D16** | A28 |
| PC1 COND | **D17** | B28 |
| PC2 CAT | **D18** | A29 |
| PC3 MEM | **D19** | B29 |
| PC4 TEMP | **A4** as DIO if free, else JMISC GPIO | A30 |
| AUX0 COL | **A5** GPIO / JMISC | A31 |
| AUX1 TURB | JMISC / expand via MCP23017 | B31 |
| AUX2 REF | expand | A32 |
| AUX3 | expand | B32 |

If header pins run short, put **MCP23017** (I²C on D20/D21) on the mezz for PC*/AUX* — cleaner and matches “many enables” without burning Uno pins.

### 4.5 Optional secondary ADC on Uno

| SK1 | Uno Q ADC | Divider |
|-----|-----------|---------|
| B6 CNTR_I | A0 | 2:1 if >3.3 V |
| B7 CNTR_V | A1 | 2:1 |
| B11 PROT_I_CL | A2 | 2:1 |
| B12 PROT_I_DO | A3 | 2:1 |
| B16 CAT_MON | — | prefer ΣΔ mux |
| B20 MON6 | — | prefer ΣΔ mux |

### 4.6 Host / debug

| Function | Uno Q |
|----------|-------|
| USB | USB-C native |
| Modbus RS-485 | UART on D0/D1 + external transceiver (or USB-serial on Linux) |
| Sketch ↔ Linux | Arduino Bridge RPC |

---

## 5. Machine-readable netlist (mezz core)

```
# POWER
SK1.A1  -> MEZZ.VCC_IN
SK1.B1  -> MEZZ.PGND
SK1.A2  <- MEZZ.VDD_3V3
SK1.B2  -> MEZZ.DGND -> UNO.GND
SK1.A3  <- MEZZ.P5V
SK1.B3  <- MEZZ.N5V
SK1.A4  -> MEZZ.AGND
SK1.B4  -> MEZZ.AGND

# PRIMARY ANALOG IN (to mux)
SK1.A5  -> MUX.S1   # PH
SK1.B5  -> MUX.S2   # REDOX
SK1.A8  -> MUX.S3   # COND
SK1.B8  -> MUX.S4   # TEMP
SK1.A10 -> MUX.S5   # CL
SK1.B10 -> MUX.S6   # DO
SK1.A13 -> MUX.S7
SK1.B13 -> MUX.S8
SK1.A15 -> MUX.S9   # CAT1
SK1.B15 -> MUX.S10  # CAT2
SK1.A17 -> MUX.S11
SK1.B17 -> MUX.S12
SK1.A19 -> MUX.S13
SK1.B19 -> MUX.S14
SK1.A21 -> MUX.S15
SK1.B21 -> MUX.S16
MUX.D   -> BUF.IN -> ADC.AIN
MUX.A0..A3 <- UNO.D2,D4,D6,D9
ADC.SPI <- UNO.D11,D12,D13 ; nCS <- UNO.D10

# SECONDARY (optional direct)
SK1.B6  -> DIV -> UNO.A0   # CNTR_I
SK1.B7  -> DIV -> UNO.A1   # CNTR_V
SK1.B11 -> DIV -> UNO.A2   # PROT_I_CL
SK1.B12 -> DIV -> UNO.A3   # PROT_I_DO

# BIPOLAR OUTPUTS
DAC.CH0 -> AMP -> SK1.A23  # CL_BIAS1  ±1.25
DAC.CH1 -> AMP -> SK1.B23  # DO_BIAS1
DAC.CH2 -> AMP -> SK1.A24  # CL_BIAS2
DAC.CH3 -> AMP -> SK1.B24  # DO_BIAS2
DAC.CH4 -> AMP -> SK1.A25  # CL_PROTON ±2.12
DAC.CH5 -> AMP -> SK1.B25  # DO_PROTON
DAC.SPI <- UNO.D11,D12,D13 ; nCS <- UNO.D7

# TIMING
UNO.D3  -> BUF5 -> SK1.A26  # CL_SWITCH
UNO.D5  -> BUF5 -> SK1.B26  # CL_DELAY
UNO.D14 -> BUF5 -> SK1.A27  # DO_SWITCH
UNO.D15 -> BUF5 -> SK1.B27  # DO_DELAY

# POWER / AUX (via 5 V buffer or MCP23017)
GPIO/EXPAND.PC0 -> SK1.A28
GPIO/EXPAND.PC1 -> SK1.B28
GPIO/EXPAND.PC2 -> SK1.A29
GPIO/EXPAND.PC3 -> SK1.B29
GPIO/EXPAND.PC4 -> SK1.A30
GPIO/EXPAND.AUX0 -> SK1.A31
GPIO/EXPAND.AUX1 -> SK1.B31
GPIO/EXPAND.AUX2 -> SK1.A32
GPIO/EXPAND.AUX3 -> SK1.B32
```

Companion CSV: [`SK1_UNO_Q_NETLIST.csv`](SK1_UNO_Q_NETLIST.csv)

---

## 6. Bring-up sequence (safe)

1. **Power only** — no analog board. Verify mezz `VDD=3.3`, `+5`, `−5` from `VCC`.  
2. Connect Uno Q GND↔mezz DGND; USB power Uno separately at first.  
3. SPI loopback / ID read on ADC + DAC.  
4. Set all `VOUT` to **0 V** (midrail / 0 differential). Set all `PC*` **off** (inactive level).  
5. Mate SK1 to analog board.  
6. Enable `PC0` (amps) only; mux PH/ORP; confirm LT2400/ADS counts move in buffer.  
7. Program Bias1/Bias2 near firmware defaults (~+0.13 / +0.34 V Cl; ~−0.38 / +0.16 V DO vs mid).  
8. Enable Cl SWITCH/DELAY timing; watch Cl channel.  
9. Port `Collect.c` order + cal math from existing firmware.

---

## 7. Open items to verify on the bench

1. Exact SK1 connector part number / keying (photograph mating face).  
2. Idle level and polarity of `TMR_*` and `PC*` / `AUX*`.  
3. Actual voltage span on `CH_*` and `SAP*` with analog board powered (expect ≤2.5 V into old LT2400 path).  
4. Whether `GND_C` double-pin on A11/A12 matches PCB (sheet synonym conflict).  
5. Current draw on `±5 V` with full MP + CaT enabled (size regulators).

---

## 8. What this deliberately omits

- Isolated RS-232/485 (`LTC1334`) — add later on a daughter or use Uno Q USB/Ethernet/Wi-Fi.  
- Keypad / LCD parallel bus on digital card — not required for SK1↔analog.  
- Flash-port programming header — Uno Q has its own boot/debug.

---

*Generated for CENSAR digital-card replacement study. Confirm all levels on hardware before applying electrode bias.*
