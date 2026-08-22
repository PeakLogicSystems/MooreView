# Convenience Store / Gas Station — Nexcomm HaLow Story

**Vertical:** Convenience store / cold chain · Marketplace #5 (refrigeration overlap)  
**Nexcomm reference:** Gas station / convenience store slide (shop + forecourt)  
**MV project:** `cstore-halow` (fixture scaffold)  
**Pricing:** Commercial tier — **$2,500** + **$25/mo** (+ **$3/mo** cell) · Year-1 **$2,836**  
**PDF:** Run `npm run build:nexcomm-cstore-story-pdf` → `MooreVIEW-Nexcomm-CStore-HaLow-Story.pdf`

---

## One-line pitch

One Nexcomm HaLow AP covers the **café, walk-in, bathrooms, grease/lift, and forecourt** — miles better than 2.4 GHz for a gas-station footprint. mooreVIEW turns cooler drift, RTU faults, and lift level into **planned work orders before product loss or overflow**.

---

## Reactive vs proactive

| Reactive (today) | Proactive (mooreVIEW + Nexcomm) |
|------------------|----------------------------------|
| Warm box found during restock | Walk-in/rack trend → WO before spoilage |
| RTU locked out — no cool in café | MCSA compressor/fan advisory → tune before fail |
| Grease overflow / lift high-level call | Level + pump runtime → WO before SSO |
| Bathroom leak after ceiling damage | HaLow leak tag → critical WO same day |
| Siloed OEM refrigeration app | One `.est` + contractor Parc across the chain |

---

## Site architecture

Nexcomm deck pattern: **HaLow sensors site-wide → Nexus AP → optional cellular → cloud → laptop/tablet dashboards.**

mooreVIEW mapping:

```
┌──────────────────────────────────────────────────────────────────┐
│  Gas station + café / shop (single parcel)                       │
│                                                                  │
│  INDOOR (café & shop)                                            │
│    Walk-in cooler / freezer ── HaLow ──┐                         │
│    RTU / café HVAC (MCSA) ──── HaLow ──┤                         │
│    Restroom leak ───────────── HaLow ──┤                         │
│    Grease trap + lift station ─ HaLow / RS-485 ─┤                │
│                                         │                        │
│  OUTDOOR (forecourt)                    ▼                        │
│    Pump island area (future lighting)   IoT-Link gateway         │
│    Landscape irrigation leak ─ HaLow ──►│ Mosquitto + MV Studio   │
│                                         │ CMMS · PdM · historian  │
│                                         │                         │
│  Backhaul: Ethernet │ Wi-Fi 6 │ cellular Opta (optional)         │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
    Cloud Parc — multi-store operator / HVAC-R contractor fleet
```

**Gateway:** Compulab **IoT-Link** (or Nexcomm **Nexus AP** with MQTT bridge to MV). Single broker on-site; HaLow AP routes sensor LAN to broker IP.

For **duplex lift / grease** at the shop: reuse lift-station I/O (level, pump runtimes) on the same appliance or a small Opta panel on RS-485.

---

## Node inventory (reference site)

Maps Nexcomm **gas station / c-store** diagram to MV + Nexcomm hardware.

| Zone | Device ID | Platform | Driver / template | Monitors |
|------|-----------|----------|-------------------|----------|
| Walk-in cooler | `cstore_walkin_01` | Nexcomm Halo or T-HaLow | `nexcomm_halo_mqtt` / Parc | Box temp, optional door |
| Reach-in freezer (café) | `cstore_freezer_01` | Nexcomm Halo | `nexcomm_halo_mqtt` | Freezer temp band |
| Beverage rack | `cstore_rack_01` | Modbus probe or Halo X | Modbus / Halo expansion | Rack temp ×N |
| Café RTU / split | `cstore_rtu_mcsa` | **Nexcomm MCXN947** | `mcxn947_hvac_mcsa` | COMP/FAN MCSA, T1–T4, pan leak |
| Restroom | `cstore_rr_leak` | Nexcomm HaLow leak | `nexcomm_halow_leak_mqtt` | CH1 leak, optional flow |
| Grease / lift | `cstore_lift_01` | Opta or IoT-Link I/O | `mqtt_parc` / Modbus | Level, pump1/2 run, starts |
| Forecourt irrigation | `cstore_irrig_leak` | Nexcomm HaLow leak | `nexcomm_halow_leak_mqtt` | CH2 landscape leak |
| Site gateway | `mv_cstore_01` | IoT-Link | — | Broker, ST, CMMS, uplink |

Fixture: `st/fixtures/cstore_halow.json` · CSV: `st/fixtures/cstore_halow_nodes.csv`

### Nexcomm slide → MV pack

| Nexcomm application | MV implementation | Priority |
|---------------------|-------------------|----------|
| Cooler / freezer monitoring | Cold Chain tags + bands | **P0** |
| HVAC monitoring | MCXN947 MCSA on RTU | **P0** |
| Sink / toilet leak | `nexcomm_halow_leak_mqtt` | **P0** |
| Grease trap & lift station | Lift-station `.est` slice on same gateway | **P0** |
| Outdoor lighting | Not in v1 — custom DO / phase 2 | P2 |
| Irrigation leak | HaLow leak channel on exterior node | P1 |

---

## Proactive signal model

| Leading indicator | Tag / logic | CMMS outcome |
|-------------------|-------------|--------------|
| Walk-in temp drifting high | `WALKIN_TEMP` band persistence | Planned refrigeration WO |
| Compressor short-cycle count | ST counter on rack suction | WO before lockout |
| RTU fan MCSA fault | `RTU_FAN_FLT` | Tune/replace before café outage |
| RTU compressor MCSA fault | `RTU_COMP_FLT` | PdM-sourced PM |
| Lift lag runtime imbalance | `PUMP2_RUNTIME` vs `PUMP1` | WO before SSO |
| High level band | `WET_WELL_LEVEL` | Critical WO |
| Restroom leak | `RR_LEAK` | Critical WO — water damage |
| Door-open persistence (optional) | Door DI + temp delay | Nuisance-filtered high temp |

ST advisories: door-aware high-temp delay; short-cycle counters; lift alternating runtime checks — same patterns as [refrigeration detailed plan](../../est/docs/marketplace/01-refrigeration-detailed.md) and lift-station pack.

---

## Device templates

| Template | Topic / transport | C-store use |
|----------|---------------------|-------------|
| `nexcomm_halow_leak_mqtt` | `nexcomm/halow/<id>/telemetry` | Restroom, irrigation, grease pan |
| `nexcomm_halo_mqtt` | `nexcomm/halo/<id>/telemetry` | Walk-in, freezer, rack expansions |
| `nexcomm_bme688_env_mqtt` | `nexcomm/env/<id>/telemetry` | Café air quality (optional) |
| `mcxn947_hvac_mcsa` | Parc `mooreview/v1` | Rooftop RTU / split condenser |
| Lift I/O (Opta / IoT-Link) | Parc or Modbus | Grease / duplex lift |

---

## Commissioning checklist

1. **Survey** — walk-in/rack count, RTU location, lift panel access, HaLow AP mount (cover shop + forecourt).
2. **Install IoT-Link** — `deploy/iot-link/` generic or c-store profile; enable MQTT Parc hub.
3. **HaLow AP** — gateway IP reachable from 915 MHz LAN.
4. **Cold chain nodes** — Halo or T-HaLow; set deviceId, broker, box bands in `.est`.
5. **RTU MCSA** — Nexcomm MCXN947; `MV_DEVICE_ID=cstore_rtu_mcsa`; verify COMP_FLT/FAN_FLT in historian.
6. **Lift / grease** — import lift-station tags or RS-485 driver; tie high level to critical CMMS.
7. **Leak nodes** — map CH1 restroom, CH2 irrigation in `nexcomm_halow_leak_mqtt` driver.
8. **Cellular** (optional) — cellular Opta gateway or IoT-Link cell uplink; `$3/mo` line item.
9. **Alarm drill** — simulated high box temp + level band → WO with trend screenshot.
10. **Fleet** — clone `.est` to next store; Parc tenant for contractor route.

**Acceptance:** leading advisories create WOs; cold + lift online ≥99%; no nuisance high-temp during normal door use.

---

## Multi-store contractor Parc

| View | Filter |
|------|--------|
| **Food-critical** | All stores with walk-in/rack alarm or drift |
| **Lift / grease** | High level or runtime imbalance |
| **HVAC** | RTU MCSA warning/critical |
| **Today's route** | Open proactive WOs sorted by geo |

Clone `cstore-halow.est.json` per store; change `deviceId` prefix and site metadata only — portable `.est` model.

---

## Proof metrics (12-month)

- ≥2 contractor or chain logos; ≥20 c-store sites on Parc.
- Case study: **intervened before product loss** (walk-in drift WO, not emergency spoilage).
- Lift: zero SSO events on monitored sites vs baseline.
- Monitoring attach on existing PM / refrigeration contracts.

---

## Gaps vs Nexcomm deck

- **Outdoor lighting** monitor/control — not in MV marketplace v1; spec as Nexcomm DO module + future ST.
- **Access control** — out of scope.
- Wired **Modbus rack** vs wireless Halo — site survey chooses; MV supports both in one tag DB.

---

## Implementation status

| Artifact | Status |
|----------|--------|
| This story | **Done** |
| `st/fixtures/cstore_halow.json` | Scaffold — node manifest |
| `scripts/cstore-halow/cstore-halow-data.js` | Scaffold — source for future generator |
| `cstore-halow.est.json` | **Next** — generate after cold-chain `.est` base exists |
| HMI screens | Reuse refrigeration + lift + RTU library widgets |

---

## Related files

| Path | Purpose |
|------|---------|
| `scripts/cstore-halow/cstore-halow-data.js` | Node inventory source |
| `st/fixtures/cstore_halow.json` | Site manifest |
| `src/devices/templates/nexcomm_*.json` | Nexcomm MQTT drivers |
| [01-refrigeration-summary.md](../../est/docs/marketplace/01-refrigeration-summary.md) | Cold chain marketplace |
| [04-lift-stations-summary.md](../../est/docs/marketplace/04-lift-stations-summary.md) | Grease / lift slice |
| [MooreVIEW-Pricing-Guide.md](../marketing/MooreVIEW-Pricing-Guide.md) | Commercial tier |
