# Raspberry Pi 4 + Sequent SM-I-001 HAL plugin

mooreVIEW **`hal`** driver plugin for the [Sequent Microsystems SM-I-001](https://sequentmicrosystems.com/products/industrial-automation-for-raspberry-pi) Industrial Automation HAT on **Raspberry Pi 4** (Pi 3/5 also work; I2C bus 1).

## Pin map (mooreVIEW tags → HAT)

| HAL pin | SM-I-001 function | Tag type | Engineering units |
|---------|-------------------|----------|-------------------|
| `DI0`–`DI3` | Opto digital inputs | BOOL input | on/off |
| `DO0`–`DO3` | Open-drain MOSFET outputs | BOOL output | on/off |
| `AI0`–`AI3` | 0–10 V analog in | INT input | millivolts (2500 = 2.5 V) |
| `AI4`–`AI7` | 4–20 mA analog in | INT input | microamps (12000 = 12 mA) |
| `AO0`–`AO3` | 0–10 V analog out | REAL output | volts |
| `AO4`–`AO7` | 4–20 mA analog out | REAL output | milliamps |
| `CNT0`–`CNT3` | Opto pulse counters | INT (`count`) / REAL (`freq`) | pulses / Hz |

Stack level **0** uses I2C address **0x50**; level 1 → 0x51, … level 7 → 0x57 (set jumpers on the card).

## 1. Prepare the Pi

```bash
sudo raspi-config   # Interface Options → I2C → Enable
sudo apt update
sudo apt install -y build-essential i2c-tools
i2cdetect -y 1      # expect 50 (or 51…57) when the HAT is stacked
```

Optional — Sequent CLI for bench checks:

```bash
git clone https://github.com/SequentMicrosystems/megaind-rpi.git
cd megaind-rpi && sudo make install
megaind -list
megaind 0 optord 1
megaind 0 uinrd 1
```

## 2. Build and install the plugin

From the mooreVIEW tree on the Pi:

```bash
cd hal/plugins
make sm_i001
sudo make install-sm_i001
# installs /usr/lib/libmooreview_hal_sm_i001.so
```

## 3. mooreVIEW driver

Apply device preset **Raspberry Pi 4 + Sequent SM-I-001 (HAL plugin)** in Drivers → device preset, or set manually:

```json
{
  "id": "sm_ind",
  "type": "hal",
  "enabled": true,
  "backend": "native",
  "pluginPath": "/usr/lib/libmooreview_hal_sm_i001.so",
  "limits": { "di": 4, "do": 4, "ai": 8, "ao": 8, "cnt": 4 },
  "halConfig": { "stack": 0, "i2cBus": 1 }
}
```

| `halConfig` field | Default | Meaning |
|-------------------|---------|---------|
| `stack` | `0` | HAT stack level 0–7 |
| `i2cBus` | `1` | `/dev/i2c-1` on Pi 4 |

Build the Node native addon on the Pi: `npm run build-native`, then start mooreVIEW / ST MVP.

## 4. Source files

| File | Role |
|------|------|
| `rpi4_sm_i001_hal.c` | mooreVIEW `mooreview_hal_*` API |
| `sm_i001_i2c.c` | Linux `i2c-dev` read/write |
| `sm_i001_regs.h` | SM-I-001 register map |
| `example_hal.c` | In-memory stub for desktop dev |

Based on the HAL example and Sequent **megaind-rpi** register layout (LGPL). No runtime dependency on megaind — only I2C.

## Troubleshooting

- **`halOpen failed`**: plugin path wrong, I2C disabled, or card not at expected address (`stack` / jumpers).
- **Permission denied on `/dev/i2c-1`**: add user to `i2c` group or run mooreVIEW as root (not recommended for production).
- **Analog reads zero**: check field wiring and megaind CLI (`uinrd`, `iinrd`) on the same stack level.
