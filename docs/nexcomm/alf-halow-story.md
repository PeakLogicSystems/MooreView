# ALF Living Campus — Nexcomm HaLow Story

**Vertical:** Institutional / assisted living (Living Campus) · Marketplace #10  
**Nexcomm reference:** MDU facility diagram + HVAC split-system slide  
**MV project:** `assisted-living-halow` · `assisted-living-pool-iot-link`  
**Pricing:** Enterprise campus — see [Pricing Guide](../marketing/MooreVIEW-Pricing-Guide.md) (Living Campus tier)  
**PDF:** Run `npm run build:nexcomm-alf-story-pdf` → `MooreVIEW-Nexcomm-ALF-HaLow-Story.pdf`

---

## One-line pitch

Nexcomm HaLow covers the **whole campus** — resident rooms, kitchen, mechanical, pool deck, and rooftop RTUs — on one long-range radio. mooreVIEW turns those tags into **survey-ready evidence and proactive CMMS** before families complain or survey week arrives.

---

## Reactive vs proactive

| Reactive (today) | Proactive (mooreVIEW + Nexcomm) |
|------------------|----------------------------------|
| Thermostat clouds, kitchen loggers, generator clipboards | One campus `.est` + Parc fleet |
| Leak found after water damage | Bath/kitchen HaLow leak tags → WO in minutes |
| RTU fails when residents complain | Rooftop MCSA on compressor/fan → PdM WO days ahead |
| Survey prep = fire drill | Continuous evidence export |
| Pool chemistry on a clipboard | MCXN947 probe + deck I/O over HaLow to pool IoT-Link |

**Scope:** Facilities / MEP only — not clinical, nurse call, EHR, or PHI.

---

## Site architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Assisted living campus (3 floors + pool wing)                  │
│                                                                 │
│  Building HaLow nodes (T-HaLow phase 1 → Nexcomm phase 2)     │
│    rooms · baths · kitchen · mechanical                         │
│         │                                                       │
│         ├─ Parc MQTT ──► Main IoT-LINK (assisted-living-halow)  │
│         │                    │ historian · HMI · CMMS · cloud   │
│         │                                                       │
│  Nexcomm MCXN947 HVAC MCSA ×3 (rooftop, one per floor)          │
│         │                                                       │
│         └─ Parc MQTT ──► same main broker                       │
│                                                                 │
│  Pool subsystem (separate IoT-LINK pool appliance)              │
│    MCXN947 chemistry · deck flow/leak/dose                      │
│         │                                                       │
│         └─ Parc MQTT ──► pool IoT-LINK Mosquitto              │
│              (optional bridge → main ALF broker / cloud)        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ optional cellular / site WAN
    Cloud SaaS — portfolio Parc · multi-campus operator view
```

**Gateway roles**

| Role | Hardware | Broker |
|------|----------|--------|
| Main campus | Compulab **IoT-Link** (`mv_alf_main_01`) | `mqtt://127.0.0.1:1883` on appliance |
| Pool plant | **IoT-Link pool** (`mv_alf_pool_01`) | Local Mosquitto — **HaLow anchor** for pool equipment room |
| HaLow AP | Nexcomm Nexus AP or site 802.11ah AP | Routes HaLow LAN to broker IP |
| Backhaul | Cellular Opta gateway or site Ethernet | Cloud remote enrollment |

---

## Node inventory (reference campus)

Maps Nexcomm **MDU facility** (building + grounds) and **HVAC monitoring** slides to deployed nodes.

| Zone | Device | Platform | Template / firmware | Signals |
|------|--------|----------|---------------------|---------|
| Mechanical room | `thalow_mech_01` | LilyGO T-HaLow | ALF #1 | Utility flow / meter pulse |
| Kitchen refer/freezer | `thalow_kitchen_01` | T-HaLow | ALF #5 | Freezer + reefer temp |
| Kitchen six sinks | `thalow_kitchen_sinks` | T-HaLow | ALF #6 | Leak ×6 |
| Resident room (×N) | `thalow_rm###_room` | T-HaLow | ALF #2 | Comfort / pan leak |
| Resident bath (×N) | `thalow_rm###_bath` | T-HaLow | ALF #3 | Toilet / sink leak |
| Common bath | `thalow_comm_*` | T-HaLow | ALF #3 | Toilet leak |
| Floor 1–3 rooftop | `hvac_mcsa_fl1..3` | **Nexcomm MCXN947** | `mcsa-hvac` | T1–T4, COMP_FLT, FAN_FLT, WR_DETECT |
| Therapy pool chemistry | `pool_sensor_01` | MCXN947 pool | `mcxn947-pool-sensor` | pH, ORP, cond, water temp |
| Pool deck | `thalow_pool_deck` | T-HaLow | custom | Flow, leak, dose relays |

Full CSV: `st/fixtures/assisted_living_halow_nodes.csv`  
Manifest: `st/fixtures/assisted_living_halow.json`

### Phase roadmap

| Phase | Field radio | Leak / env | HVAC rooftop |
|-------|-------------|------------|--------------|
| **1 (now)** | LilyGO T-HaLow | Parc templates #1–#6 | Nexcomm MCXN947 MCSA |
| **2** | Nexcomm HaLow leak / Halo / BME688 | `nexcomm/halow`, `nexcomm/halo`, `nexcomm/env` MQTT | Same MCSA firmware |

Phase flag in manifest: `"field": "t-halow", "future": "nexcomm"`.

---

## Nexcomm device templates (phase 2 drop-in)

| Template ID | Use on campus |
|-------------|---------------|
| `nexcomm_halow_leak_mqtt` | Bath/kitchen leak, flow, totalizer (6 ch) |
| `nexcomm_halo_mqtt` | Room temp/RH base + up to 10 expansions |
| `nexcomm_bme688_env_mqtt` | IAQ — temp, RH, VOC, CO₂ eq |
| `mcxn947_hvac_mcsa` | Rooftop split/RTU compressor + fan MCSA |

MQTT topic roots: `nexcomm/halow/<id>/telemetry`, `nexcomm/halo/<id>/telemetry`, `nexcomm/env/<id>/telemetry`.  
HVAC MCSA uses native **Parc** `mooreview/v1/<deviceId>/telemetry`.

---

## Semantic tags → CMMS

Representative bindings (see `scripts/assisted-living-halow/halow-semantic-map.js`):

| Campus tag | Source | Proactive trigger |
|------------|--------|-------------------|
| `RM101_TOILET_LEAK` | `thalow_rm101_bath` · FLOW_TOILET | Critical WO — water damage |
| `KITCH_REEFER_TEMP` | `thalow_kitchen_01` · TEMP_REF | Kitchen cold drift → WO before food loss |
| `FL1_COND_COMP_FLT` | `hvac_mcsa_fl1` · COMP_FLT | PdM / MCSA → planned RTU service |
| `POOL_PH` | `pool_sensor_01` · PH_AI | Chemistry band → pool WO |
| `MECH_METER_KWH` | `thalow_mech_01` | Utility anomaly (optional) |

HVAC condenser bindings: `scripts/assisted-living-halow/hvac-halow-bindings.js` (`FLn_COND_*` tags).

**Workflow:** tag alarm or PdM forecast → CMMS work order (source: `alarm` | `pdm` | `pm`) → technician closes with service history → next forecast learns from repair.

---

## Commissioning checklist

1. **Base project** — `node scripts/assisted-living/generate-est.js` (full campus `.est` + HMI).
2. **HaLow overlay** — `node scripts/assisted-living-halow/generate-artifacts.js` → `assisted-living-halow.est.json`, pool est, env examples.
3. **Main IoT-Link** — copy `deploy/iot-link/.env.assisted-living-halow.example`; open `assisted-living-halow.est.json`.
4. **Pool IoT-Link** — copy `.env.assisted-living-pool.example`; RS-485 pump bus; `30_pool_controller.st`.
5. **HaLow AP** — broker IP reachable from HaLow LAN (often AP gateway, e.g. `10.10.10.1`).
6. **T-HaLow nodes** — provisioning AP `MooreVIEW-T-HaLow` → `/setup` → broker, deviceId, sensor template.
7. **Nexcomm HVAC** — flash `mcsa-hvac`; set `MV_DEVICE_ID=hvac_mcsa_flN`, broker on HaLow LAN.
8. **Sync tags** — Drivers → Sync; verify Parc hub sees all `deviceId`s.
9. **Alarm drill** — leak + kitchen temp + COMP_FLT → CMMS WO with trend context.
10. **Cloud** — enroll gateway; portfolio operator view for multi-campus rollouts.

Training: **M14 — Parc edge peers (T-HaLow & cellular)** · `halow-xiao-sta/README.md`.

---

## Proof metrics (12-month pilot)

- Evidence pack used **before** survey window (not the week before).
- ≥60% critical WOs opened from **leading indicators**, not resident complaints.
- Rooftop MCSA case: compressor/fan fault → **planned** WO ≥7 days before hard failure.
- 2–3 campuses on one Parc tenant for regional operator.

---

## Gaps vs full Nexcomm MDU facility deck

Not in v1 ALF story (future vertical expansion):

- Access control
- Irrigation control
- Outdoor lighting monitor/control

These remain Nexcomm-native or custom I/O; MV core value stays MEP + leaks + cold + HVAC + pool.

---

## Related files

| Path | Purpose |
|------|---------|
| `scripts/assisted-living-halow/alf-halow-data.js` | Node manifest source |
| `scripts/assisted-living-halow/generate-artifacts.js` | Est + fixture generator |
| `data/projects/assisted-living-halow.est.json` | Generated campus project |
| `deploy/iot-link/.env.assisted-living-halow.example` | Main appliance env |
| `test/assistedLivingHalow.test.js` | Manifest + HVAC node tests |
| [06-institutional-summary.md](../../est/docs/marketplace/06-institutional-summary.md) | Marketplace 1-pager |
