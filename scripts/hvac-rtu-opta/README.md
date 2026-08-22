# HVAC RTU — Opta + D1608E

Single rooftop unit (RTU) on one Opta with D1608E expansion.

## I/O map

| Input | Assignment |
|-------|------------|
| I1 | Blower start CT → `/mcsa` |
| I2 | Blower run CT |
| I3 | Condenser fan start CT |
| I4 | Condenser fan run CT |
| I5 | Compressor start CT |
| I6 | Compressor run CT |
| X1_IRAW1 | Refrigerant low side NTC → `T2_C` |
| X1_IRAW2 | Refrigerant high side NTC → `T1_C` |
| X1_IRAW3 | Supply air NTC → `T3_C` |
| X1_IRAW4 | Return air NTC → `T4_C` |
| X1_IRAW5 | Pan leak analog mV → `/ahu-env` |

Pan leak is an **analog** spot-leak sensor (mV threshold on `/ahu-env`), not a digital DI.

## Commission

1. Flash `MooreviewOptaMqttSt`; device ID `hvac_rtu_01`.
2. `/setup` → scan D1608E slot 1.
3. `/mcsa` → **Preset: HVAC RTU** (3 motors + 4 NTC).
4. `/ahu-env` → enable; calibrate leak on **X1_IRAW5** (threshold mV).
5. Import `data/projects/hvac-rtu-opta.est.zip`; start runtime.

## Build

```bash
npm run build:hvac-rtu-opta
```
