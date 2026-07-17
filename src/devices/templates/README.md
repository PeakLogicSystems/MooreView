# Device templates (JSON)

Add a new Modbus device template by creating a `.json` file in this folder. MooreVIEW picks up `*.json` files automatically (no server restart) and lists them under **Drivers → Device template** on the next dashboard poll.

## Example

Copy `opta_rtu_slave.json` or `datexel_dat10148.json` and edit:

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

Default **9600 8N1**, slave **1**. FC03 holding: pH **0x0006**, moisture **0x0012**, temp **0x0013**, EC **0x0015**, N/P/K **0x001E–0x0020**. Config: address **0x0100**, baud **0x0101**.

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

Default **4800 8N1**, slave **1** (per DFRobot wiki). Integer registers use tag **scale** for ×10 / ×100; SEN0681 uses **float32** big-endian. Multiple probes on one RS-485 bus: give each probe a unique slave ID (reg **0x07D0**), add a separate driver row per probe, or merge tags with per-tag `slaveId` in **Tags**.

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
