# MooreVIEW Res-Pool-Link

Residential **pool & spa** on the **ESP32** (standalone): home Wi‑Fi, DFRobot chemistry, IntelliFlo + IntelliChlor, and **four backwash valves**. No IOT-LINK.

```
ESP32-S3-Relay-6CH  →  http://<lan>:8080/
 ├── UART1 9600 8N1  IntelliFlo (96) + IntelliChlor
 ├── UART2 4800 8N1  SEN0711 + SEN0712
 └── CH1–4           inlet / outlet / waste / spare
```

An optional IOT-LINK seed still exists for shops that want a PC hub. The pad does not need it.

Product id: `res-pool-link`  
Guide: [`docs/RES_POOL_LINK.md`](../../docs/RES_POOL_LINK.md)

## Flash the pad

See `firmware/esp32-res-pool-link/README.md`. Join AP `MooreVIEW-ResPool` / `mooreview` → `http://192.168.4.1:8080/` → home Wi-Fi. Three valves are enough; R4 may stay unwired. Do not put DFRobot probes on the Pentair cable.

Optional shop hub seed (not required):

```bash
cp /opt/mooreview/deploy/iot-link/.env.res-pool-link.example /etc/mooreview/env
node deploy/iot-link/seed-pool-config.js --force
```
