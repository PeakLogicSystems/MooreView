# Device templates (JSON)

Add a new Modbus device template by creating a `.json` file in this folder. MooreVIEW picks up `*.json` files automatically (no server restart) and lists them under **Drivers → Device template** on the next dashboard poll.

## Example

Copy `opta_rtu_slave.json`, `opta_parc_modbus_dragino.json`, or `datexel_dat10148.json` and edit:

| Field | Meaning |
|-------|---------|
| `id` | Unique preset id (used by API) |
| `label` | Text shown in the dropdown |
| `transport` | `modbus_rtu`, `modbus_tcp`, or `vgreen_epc` |
| `driverId` | Default driver id on apply — use the **same** id in several templates (e.g. `modbus_rtu`) so they share one bus connection; edit a driver in **Drivers** before Apply to target a different id |
| `sharedBus` | `false` for dedicated instruments (`tags.explicit` only) — creates/uses `driverId` instead of merging onto the first Modbus driver of the same transport |
| `defaults` | Serial port, baud, slave ID, parity |
| `tags.discrete` | BOOL inputs — FC02, `prefix` + number |
| `tags.coil` | BOOL outputs — FC01/05 |
| `tags.input` | INT inputs — FC04 (`start`, `suffix` optional) |
| `tags.holding` | INT memory — FC03 (`H1`… style) |
| `tags.explicit` | Named tags with exact Modbus address (REAL float32, status words, etc.) |
| `tags.optaParcDragino` | Full Opta Parc I/O map for Dragino gateway (`opta_parc_modbus_dragino.json`) — `I1`–`I8`, `R1`–`R4`, raw ADC, mA/scaled AI, MCSA pseudo-AI |

## Waveshare ESP32-S3-Relay-1CH-U (pool satellite)

| Template | Transport | Role |
|----------|-----------|------|
| `waveshare_esp32s3_relay_1ch_u.json` | `mqtt_parc` | Isolated 1-ch Wi-Fi relay — `R1` + aux `I1` |

Flash `firmware/waveshare-esp32s3-relay-parc`. Bind pool tags with `MOOREVIEW_POOL_WAVESHARE_RELAYS` (see [WAVESHARE_ESP32S3_RELAY_POOL.md](../../../docs/WAVESHARE_ESP32S3_RELAY_POOL.md)). This is **not** the Modbus RTU 8CH module (`waveshare_rtu_io_8ch` in `devicePresets.js`).

## Dragino + Opta RS485

| Template | Role |
|----------|------|
| `dragino_rs485_nb.json` | Cloud `mqtt_parc` driver for the Dragino gateway |
| `opta_parc_modbus_dragino.json` | Modbus map bound to Dragino via `bind-preset` — polls Opta slave ID 2 |
| `arduino_opta_parc_ezmeter.json` | MQTT Parc + EZ Meter on Opta RS485 fieldbus (`MV_FIELDBUS=1` `MV_EZMETER=1`) |

See [DRAGINO_PARC_CLOUD.md](../../../docs/DRAGINO_PARC_CLOUD.md#opta-parc-io-via-dragino). Facility PQ: [EZMETER_FACILITY_PQ.md](../../../docs/facilities/EZMETER_FACILITY_PQ.md).

## Blocks

Each array entry:

```json
{ "prefix": "DI", "count": 8, "start": 0, "suffix": "" }
```

- `start` — 0-based Modbus address (default 0)
- `suffix` — appended to tag id (e.g. `_RAW`, `_MV`)

After saving the JSON file, open **Drivers** (or wait for the next poll) — the new template appears in the dropdown.

**Shared Modbus bus:** use the same `driverId` / COM port for several templates (live reload, no restart). Each apply assigns the **next slave address**. Tag names continue sequentially (`DI1`–`DI16`, then `DI17`–`DI32` for a second 16-input module); slave is stored per tag, not in the name.

## S::CAN spectro::lyser

| Template | Transport | Default comm |
|----------|-----------|--------------|
| `scan_spectrolyser.json` | RS-485 Modbus RTU | 38400 8O1, slave **4** |
| `scan_spectrolyser_tcp.json` | Modbus TCP (con::nect / gateway) | host :502, slave **4** |

Register map follows community spectro::lyser mapping (EnviroDIY S-CAN-Modbus): input registers **120** device status, **122+8×n** parameter values as **float32** (`PARM1_VAL`…`PARM8_VAL`). Probe must be in **logging mode** for live values when connected directly (not via ana::gate).

## JXCT soil NPK (Modbus RTU)

| Template | Model | Tags |
|----------|-------|------|
| `jxct_npk_jxbs3001.json` | JXBS-3001-NPK-RS (7-in-1) | `SOIL_PH`, `SOIL_MOIST_PCT`, `SOIL_TEMP_C`, `SOIL_EC_US_CM`, `N_MG_KG`, `P_MG_KG`, `K_MG_KG` |
| `jxct_npk_jxbs3001_dragino.json` | Same probe via **Dragino RS485-NB** (Modbus→MQTT) | Same tag names on `mqtt_parc` driver |
| `jxct_npk_jxbs3001_dragino_x4.json` | **4 probes** on one Dragino (slaves **1–4**) | `S1_SOIL_PH` … `S4_K_MG_KG` (28 tags) |

Default **9600 8N1**, slave **1**. FC03 holding: pH **0x0006**, moisture **0x0012**, temp **0x0013**, EC **0x0015**, N/P/K **0x001E–0x0020**. Config: address **0x0100**, baud **0x0101**. For multi-probe Dragino: set each probe to a unique address (1, 2, 3, 4) before binding.

**Dragino cloud bind (×4):** `POST /api/parc/dragino-gateway/bind-preset` with `presetId: "jxct_npk_jxbs3001_dragino_x4"`, then `/plan` — four `AT+COMMAND*` lines (FC03 slave 1–4, start 0x0006, qty 27) and `AT+TDC=300`.

## TENET UL212NT-E ultrasonic fuel level (Modbus RTU)

| Template | Model | Tags |
|----------|-------|------|
| `tenet_ul212nt_e.json` | UL212NT-E / UL212-E (2.5 m) | `FUEL_LEVEL_MM`, `FUEL_TILT` |

Default **9600 8N1**, net address **1**. Select **Protocol 17** in the UL212 Fuel app. ATO manual frames (FC03 qty 1): height **0x0100** `01 03 01 00 00 01 85 F6` (uint16 ×10 = 0.1 mm), tilt **0x0102** `01 03 01 02 00 01 24 36`. Poll each register separately. Sample ST: `st/modbus/09_ul212nt_e_level.st`. Extract: `st/fixtures/ul212nt-e-modbus-extract.txt`.

## Seeed Studio RS485 probes (Modbus RTU)

| Template | SKU | Tags |
|----------|-----|------|
| `seeed_h2s_101990863.json` | 101990863 (S-H2S-01) | `H2S_PPM`, `H2S_TEMP_C`, `H2S_RH_PCT`, `H2S_MAX_PPM` |

Default **9600 8N1**, slave **16** (0x10). Measurements are **holding registers** (FC03): H2S float32 @ **0x2000**, temperature @ **0x2004**, humidity @ **0x2006**.

## DFRobot RS485 water-quality probes (Modbus RTU)

| Template | SKU | Tags (engineering units) |
|----------|-----|--------------------------|
| `dfrobot_sen0706_ec.json` | SEN0706 | `EC_US_CM`, `EC_TEMP_C`, `EC_SAL_PPM`, `EC_TDS_PPM` |
| `dfrobot_sen0709_orp.json` | SEN0709 | `ORP_MV`, `ORP_TEMP_C` |
| `dfrobot_sen0710_turbidity.json` | SEN0710 | `TURB_NTU`, `TURB_TEMP_C` |
| `dfrobot_sen0712_chlorine.json` | SEN0712 | `CL_MG_L` |
| `dfrobot_sen0711_ammonia_ph.json` | SEN0711 | `NH3_MG_L`, `NH3_PH`, `NH3_TEMP_C` |
| `dfrobot_sen0681_do.json` | SEN0681 | `DO_SAT_PCT`, `DO_MG_L`, `DO_TEMP_C` |
| `dfrobot_pool_chemistry.json` | **SEN0711 + SEN0712** local RS-485 (IOT-LINK PORT B) | `PH_AI`, `ORP_AI` (CL2 ppm), `WATER_TEMP_C`, `NH3_MG_L` |
| `dfrobot_pool_chemistry_dragino.json` | **SEN0711 + SEN0712** via **Dragino** (pool chemistry monitor) | `PH_PV`, `CL_PV`, `WATER_TEMP_C`, `NH3_MG_L` |
| `dfrobot_edge101_parc.json` | **Edge101 DFR0886** MQTT Parc (Ethernet + isolated RS-485) | `PH_AI`, `ORP_AI`, `WATER_TEMP_C`, `NH3_MG_L`, `I1`, `I2`, `ETH_LINK`, `CHEM_OK` |

Default **4800 8N1**, slave **1** (per DFRobot wiki). Integer registers use tag **scale** for ×10 / ×100; SEN0681 uses **float32** big-endian. Multiple probes on one RS-485 bus: give each probe a unique slave ID (reg **0x07D0**), add a separate driver row per probe, or merge tags with per-tag `slaveId` in **Tags**.

**Pool chemistry (local IOT-LINK):** `MOOREVIEW_POOL_MODBUS_CHEM=true` — PORT B @ **4800 8N1**, SEN0711 slave **1** → `PH_AI`, SEN0712 slave **2** → `ORP_AI` (pool ST already treats ORP_* as CL2 ppm). Template: `dfrobot_pool_chemistry`.

**Pool chemistry Dragino bind:** SEN0711 → slave **1**, SEN0712 → slave **2**, `presetId: "dfrobot_pool_chemistry_dragino"`. Plan emits two FC04 reads @ 4800 baud + `AT+TDC=300`. Sample: `st/fixtures/pool-chemistry-dragino-telemetry-sample.json`.

**Edge101 field controller:** flash `firmware/dfrobot-edge101-parc`. Ethernet WAN + isolated RS-485 on the DFR0886. Template `dfrobot_edge101_parc` (`platform`: `dfrobot-edge101`).

## S::CAN con::cube

| Template | Transport | Default comm |
|----------|-----------|--------------|
| `scan_concube_tcp.json` | Modbus TCP (Ethernet on cube) | host :502, slave **1** |
| `scan_concube_rtu.json` | Modbus RTU (COM-5) | 38400 8O1, slave **1** |

Register map per con::cube D-330 manual §7.4: device status IR **120**, parameter *n* status IR **128+8×(n−1)**, value IR **130+8×(n−1)** as IEEE **float32** BE. In **Drivers → Apply device template**, set **Parameter groups (×4)** (1–16). Each apply adds that many groups; repeat apply to append the next block (up to **64** parameters). First apply also adds system tags `CUBE_DEV_STATUS` / `CUBE_MB_MAP_VER`.

Explicit tag example:

```json
{
  "id": "PARM1_VAL",
  "type": "REAL",
  "table": "input",
  "address": 122,
  "wordWidth": 32,
  "encoding": "float32",
  "byteOrder": "BE"
}
```

## SPECK BADU Pro-VI UVS (VGreen RS-485)

| Template | Transport | Default comm |
|----------|-----------|--------------|
| `speck_badu_pro_vi_uvs.json` | VGreen EPC RS-485 | 19200 8N1, slave **21** (0x15) |

Century VGreen motors use the **Regal GEN3 EPC** protocol (custom Modbus functions 0x41–0x45), not standard coils/registers. Driver type: **`vgreen_epc`**.

**Pump setup:** motor menu → digital input mode **Bus**; confirm baud **19200** and slave address. Sample ST: `st/logic/25_badu_pro_vi_filter_pump.st`.

## EZ Meter DDS-RGB (Modbus RTU) — built-in presets

Not a JSON file in this folder — presets are registered in code (`src/facilities/ezmeterPq.js`, `src/devices/applyDerivedPreset.js`).

| Preset | Id | Driver | Tags |
|--------|-----|--------|------|
| Full register map | `ezmeter_dds_rgb_2025` | `dds_rgb` | 50 `DDS_*` (energy, V/I/W/Hz/PF/VA, control/status) |
| Facility PQ derived set | `ezmeter_facility_pq_derived` | (tags only) | ~35 `MECH_PQ_*` / `MECH_METER_*` mirrors + memory |

**Apply order:** (1) full map → (2) derived measurement set. Derived apply loads ST `logic/ezmeter_facility_pq.st` and enables `settings.assistedLiving.ezMeter`.

Default **9600 8N1**, slave **1**. Reference: **`docs/facilities/EZMETER_FACILITY_PQ.md`**, F1 **EZ Meter DDS-RGB 2.025**.
