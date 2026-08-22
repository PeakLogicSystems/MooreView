# Facility HVAC — IoT-Link project

## I/O maps (base Opta + D1608E)

### AHU Opta (`hvac_ahu_01`) — dual unit on one board

| Input | Assignment |
|-------|------------|
| I1 | Unit 1 fan start CT → `/ct-cal` |
| I2 | Unit 1 fan run CT |
| I3 | Unit 2 fan start CT |
| I4 | Unit 2 fan run CT |
| I5 | Unit 1 supply NTC → `/ahu-env` |
| I6 | Unit 1 return NTC |
| I7 | Unit 2 supply NTC |
| I8 | Unit 2 return NTC |
| X1_IRAW1 | Unit 1 pan leak (analog mV) → `/ahu-env` |
| X1_IRAW2 | Unit 2 pan leak (analog mV) |

### Condenser Opta (`hvac_cond_01`) — dual unit on one board

| Input | Assignment |
|-------|------------|
| I1 | Unit 1 fan start CT → `/mcsa` |
| I2 | Unit 1 fan run CT |
| I3 | Unit 2 fan start CT |
| I4 | Unit 2 fan run CT |
| I5 | Unit 1 comp start CT |
| I6 | Unit 1 comp run CT |
| I7 | Unit 2 comp start CT |
| I8 | Unit 2 comp run CT |
| X1_IRAW1 | Unit 1 low side NTC |
| X1_IRAW2 | Unit 1 high side NTC |
| X1_IRAW3 | Unit 2 low side NTC |
| X1_IRAW4 | Unit 2 high side NTC |

Use **`/mcsa` → Preset: facility condenser** on the single condenser Opta (4 motors + 4 NTC).

**Field hardware:** 2 Optas total (1 AHU + 1 condenser) plus IoT-Link hub and EZ Meter.

## Build

```bash
npm run build:facility-hvac-iot-link
```

Review PDF: `docs/projects/MooreVIEW-Facility-HVAC-IoT-Link-Review.pdf`
