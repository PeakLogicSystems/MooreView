# mooreVIEW — Product Description

**Proactive operations. Portable everywhere.**

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

**Document version:** 1.4 · Run `npm run build:product-description-pdf` for build date

---

## Part of The Purple Standard

At **[The Purple Standard](https://purple-standard.com)**, we are leading the next generation of field services in Florida. Through strategic investment and shared support, our companies modernize their trades and expand their reach to serve businesses, municipalities, communities, and homeowners with lasting value and reliability.

**mooreVIEW** is one of the companies **powered by The Purple Standard** — distinct in its service (industrial automation, condition monitoring, and maintenance software), but united with every sister company by **The Purple Standard Pledge**:

- Clear communication  
- Technology and solutions driven  
- Professionalism in action  
- Exceeding expectations  

Our flagship sister company, **ACE Septic & Waste**, has become instantly recognizable across the Tampa Bay area with its bold purple trucks. That same standout identity carries through to each of our companies: **distinct in their services, but united by our pledge.**

While sister companies hold the licenses and credentials for septic, electric, well systems, and on-site field work — commercial, municipal, residential, and environmental — **mooreVIEW** provides the technology layer those trades use to modernize: fleet visibility, predictive maintenance, portable project files, and work orders scheduled **before** the emergency call.

| Sister field-service focus | mooreVIEW technology role |
|----------------------------|---------------------------|
| Septic, lift station, and wastewater service | Level, pump, and ATU monitoring → proactive CMMS |
| Pool and aquatic service | Filter, chemistry, pump health → planned service before failure |
| HVAC and convenience retail | Comfort drift and cold-chain alarms → tune before complaint or product loss |
| Well and pump service | Dry-run and yield trends → scheduled pull before burn-up |
| Electrical and on-site work | Alarm context, historian, and compliance evidence |
| **Institutional / ALF campuses** | Living Campus MEP — comfort, cold, gen, DHW, leaks → survey evidence before outage |
| Fleet operations across Florida | Parc MQTT hub, multi-site Cloud Studio, portable `.est` projects |

Learn more about the portfolio at **[purple-standard.com](https://purple-standard.com)** — or contact The Purple Standard to inquire about integrated field services and becoming a Purple Standard company.

---

## At a glance

**mooreVIEW** is an integrated industrial automation, condition monitoring, and maintenance platform for mechanical and environmental assets — lift stations, septic and wastewater, **residential and commercial pools**, **residential and commercial HVAC**, **convenience stores**, refrigeration, wells and pumps, and institutional campuses. It is the proactive, portable software platform in **The Purple Standard** family of companies.

Most facilities still run **reactive**: equipment fails, someone notices, a truck rolls, and downtime cost hits the budget. mooreVIEW inverts that model. It **sees degradation early**, **turns signals into planned work**, and **moves with you** — from a laptop in the office to an edge appliance in the mechanical room to a multi-site cloud dashboard — without re-engineering the project every time.

**One line:** mooreVIEW turns distributed mechanical assets from breakdown businesses into condition-based, portable, contracted monitoring businesses.

---

## The reactive trap

Across the industries mooreVIEW serves, the dominant operating model looks the same:

| What happens today | What it costs |
|--------------------|---------------|
| Assets run until failure or complaint | Emergency dispatch, overtime, spoiled product, overflow, resident harm |
| Alarms are local dialers or siloed OEM apps | No fleet view, no history, no work order context |
| “Preventive” maintenance is calendar guesswork | Parts and labor spent whether the asset needs it or not |
| Every site is a custom snowflake | Knowledge trapped on one PC; handoffs mean starting over |

Competitors optimize the **reactive loop** — faster dispatch, cheaper controllers, better parts. mooreVIEW changes the **model**: detect drift before catastrophe, schedule the fix on your terms, and carry the entire project configuration wherever the work happens.

---

## What mooreVIEW is

mooreVIEW is a **single platform** that combines what operators, integrators, and service firms usually buy in fragments:

| Capability | Role |
|------------|------|
| **Structured Text (ST) runtime** | Edge logic on pumps, compressors, blowers, wells, **pool filtration and chemistry**, and plant equipment — detect leading indicators, not only hard faults |
| **Tag database & I/O drivers** | Modbus, MQTT, serial, HTTP APIs, **BACnet/IP** (edge), HAL — one tag model from field to historian |
| **Integrated HMI** | Operator screens built in-product; no separate SCADA license stack |
| **Historian & trends** | MongoDB-backed tag history; optional **7-day hot → zstd archive** pipeline for fleet scale |
| **MQTT Parc fleet hub** | Multi-site visibility for contractors, utilities, OEMs, and campuses — Opta, **cellular Opta gateway**, T-HaLow peers |
| **Predictive maintenance (PdM)** | Health index, failure forecast, remaining useful life (RUL) — days or weeks **before** alarm |
| **Integrated CMMS** | Work orders, PM schedules, assignees — alarm, PdM, and calendar triggers in one app |
| **IP cameras & vision AI** | ONVIF discovery, live streaming, snapshots, optional edge or host inference |
| **Training & certification** | Built-in IoT Condition-Based Monitoring curriculum (F2) for operators and integrators |
| **BAS coexistence** | BACnet/IP discover, browse, and tag import on edge appliances — read-mostly alongside incumbent BMS |
| **Facility power quality** | EZ Meter DDS-RGB Modbus templates + derived `MECH_PQ_*` measurement set for campus mechanical rooms |

mooreVIEW ships as **MVP Suite** on Windows and Linux (all-in-one desktop appliance), **Cloud SaaS** for multi-tenant hosted operations, **IoT-Link** profiles for embedded edge gateways, and **MV Client** for lightweight remote operator UI — all from one codebase, one API contract, one project format.

---

## Proactive, not reactive — the mooreVIEW difference

**North star:** mooreVIEW is proactive. PdM detects degradation early; CMMS schedules the fix **before** failure — not after an alarm, overflow call, or warm-box discovery.

### Three layers of action

| Layer | Timing | mooreVIEW trigger | Outcome |
|-------|--------|-------------------|---------|
| **Predictive (PdM)** | Days to weeks before failure | Failure forecast warning / critical / failed | **Proactive PM** work order — planned visit, parts on the truck |
| **Preventive (PM)** | Calendar interval | PM schedule due | Routine service without waiting for symptoms |
| **Reactive (alarm)** | Condition already out of limits | Tag alarm transition | Urgent work order — **last line of defense**, not the strategy |

All three coexist. The difference is **where you live on the timeline**. mooreVIEW customers aim to spend most of their maintenance budget on the first two rows — and treat alarms as the safety net, not the business model.

### Proactive workflow (end to end)

```
Edge sensing + historian
  → PdM feature windows (vibration, runtime, starts, temperature bands)
  → Failure forecast (ok → warning → critical → failed)
  → CMMS proactive PM work order (source: pdm)
  → Technician completes work on a planned route
  → Service history feeds back into the next forecast
```

When a PdM-sourced work order is completed, mooreVIEW appends service history to the asset context — so the **next** forecast reflects the repair. That closed loop is what turns one saved pump into a fleet learning system.

### Reactive vs proactive — by industry

| Industry | Reactive (competition) | Proactive (mooreVIEW) |
|----------|------------------------|------------------------|
| **Lift stations** | Autodialer at overflow | Level and pump trends → intervene before SSO |
| **Refrigeration / convenience store** | Discover warm boxes after loss | Walk-in/rack trends, short-cycle → planned WO |
| **HVAC — residential** | Comfort complaint → truck | Band drift before occupant call |
| **HVAC — commercial** | RTU fail on arrival | Runtime/amp anomalies → tune before call |
| **Pool — residential** | Green pool / pump dead on visit | Filter/chemistry/backwash advisories |
| **Pool — commercial** | Guest-event or health-dept crisis | Pump health, chemistry, schedule compliance |
| **Septic / ATU** | Fail at inspection or odor event | Blower, UV, pump health → compliance route |
| **Wells & pumps** | Emergency pull after burn-up | Dry-run and yield trends → scheduled pull |
| **Institutional / ALF** | Survey scramble, fragmented apps | Campus ops picture + evidence before outage |

---

## Marketplace verticals — ten spaces

Each marketplace vertical gets the same mooreVIEW stack: edge monitoring, portable `.est`, PdM, integrated CMMS, and optional fleet Parc. **Residential** and **commercial** tiers cover dispersed single-asset sites; **enterprise campus** tier covers multi-building institutional deployments.

| # | Vertical | Proactive wedge | Project pack | Tier |
|---|----------|-----------------|--------------|------|
| 1 | **Lift stations** | Level/pump trends before SSO | `duplex-lift-station` | Commercial |
| 2 | **Wastewater / ATU** | Blower/UV/pump health; compliance route | Wastewater / ATS packs | Res / Com |
| 3 | **Septic / ATS OEM** | White-label panel + provider fleet | `ATS.est` | OEM + provider |
| 4 | **Wells & pumps** | Dry-run/yield → scheduled pull | Well Guard | Commercial |
| 5 | **Convenience store / cold chain** | Walk-in/rack drift before product loss | Cold Chain / c-store | Commercial |
| 6 | **HVAC — residential** | Band drift before occupant call | Comfort residential | Residential |
| 7 | **HVAC — commercial** | RTU runtime/amp anomalies; filter DP | Comfort commercial | Commercial |
| 8 | **Pool — residential** | Filter/chemistry/backwash before green water | Pool residential / `iot-link-pool` | Residential |
| 9 | **Pool — commercial** | Pump health, chemistry, schedule compliance | Pool commercial | Commercial |
| 10 | **Institutional / ALF** | Campus MEP + leaks + survey evidence | `assisted-living` / Living Campus | Enterprise |

---

### 1. Lift stations

**Reactive default:** Autodialer at high level; overflow call drives the truck.  
**Proactive (mooreVIEW):** Escalating level bands, pump runtime/starts imbalance, PdM on lag pump → CMMS WO before SSO.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Duplex level, pump runtimes, starts, generator/ATS optional | Lift Station Pack · `duplex-lift-station` | **$2,836** commercial (+ cell) |

---

### 2. Wastewater / ATU

**Reactive default:** Fail at inspection, odor event, or high water.  
**Proactive (mooreVIEW):** Blower current, UV hours/faults, pump health → service-due route before compliance miss.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Blower, UV, pumps, high water, compliance export | ATS Compliance Pack | **$1,752** residential · **$2,836** commercial |

---

### 3. Septic / ATS OEM

**Reactive default:** OEM “connected app” years out; providers on paper routes.  
**Proactive (mooreVIEW):** Embedded panel runtime + provider fleet Parc; compliance export for licensed routes.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Panel embed + provider tenant | `ATS.est` · OEM license | OEM per-panel + provider SaaS (see Pricing Guide) |

---

### 4. Wells & pumps

**Reactive default:** Emergency pull after burn-up; yield loss noticed in drought crisis.  
**Proactive (mooreVIEW):** Dry-run, low pressure, drawdown/recovery trends → scheduled pull.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Wellhead pressure, pump amps, transducer health | Well Guard · `Well.est` | **$2,836** commercial (+ cell) |

---

### 5. Convenience store / cold chain

**Reactive default:** Warm box discovered after product loss; RTU fail on arrival.  
**Proactive (mooreVIEW):** Walk-in/rack trends, compressor short-cycle, RTU bands → planned WO before spoilage.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Walk-in, rack, RTU, door/temp in one template | Cold Chain / c-store `.est` | **$2,836** commercial (+ cell) |

---

### 6. HVAC — residential

**Reactive default:** Comfort complaint → truck roll.  
**Proactive (mooreVIEW):** Supply/return band persistence, runtime anomalies before occupant call.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Comfort bands, filter/runtime, contractor route Parc | Comfort residential | **$1,752** residential (+ cell) |

---

### 7. HVAC — commercial

**Reactive default:** RTU fail when staff or guests arrive.  
**Proactive (mooreVIEW):** Stage/runtime/amp anomalies, filter DP across light-commercial portfolio.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Multi-RTU lead/lag, economizer faults, portfolio Parc | Comfort commercial | **$2,836** commercial (+ cell) |

---

### 8. Pool — residential

**Reactive default:** Green pool or dead pump discovered on service visit.  
**Proactive (mooreVIEW):** Filter pressure, backwash schedule, chemistry bands → route before crisis.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Filter pump, chemistry, turnover schedule | `iot-link-pool` · pool `.est` | **$1,752** residential (+ cell) |

---

### 9. Pool — commercial

**Reactive default:** Guest event or health-department crisis.  
**Proactive (mooreVIEW):** Multi-pump health, chemistry compliance, documented turnover — hotels, HOAs, aquatic centers.

| Monitors | Pack | List pricing (year-1) |
|----------|------|------------------------|
| Speck/Pentair bus, Opta I/O, pool overview HMI | Pool commercial · campus pool rooms | **$2,836** commercial (+ cell) |

---

### 10. Institutional / ALF campus

**Reactive default:** Thermostat clouds, kitchen loggers, generator clipboards, and vendor portals — action starts when residents complain or survey week arrives. BMS, if present, is siloed from CMMS.

**Proactive (mooreVIEW):** **Living Campus** bundles HVAC comfort, kitchen cold, generator exercise, DHW, optional pool/septic/well, and leak detection (e.g. NextCentury) under one campus `.est` — leading indicators become SLA work orders and **evidence packs before outage or survey**.

**Scope:** Facilities / MEP only — not clinical, nurse call, EHR, or PHI.

| Signal | Leading indicator | Proactive outcome |
|--------|-------------------|-------------------|
| **Zone comfort** | Band persistence | WO before family complaint |
| **Kitchen cold** | Box drift, logging gaps | WO before food loss / citation |
| **Generator / ATS** | Failed exercise, fault | WO before outage without backup |
| **DHW** | Temperature band / logging gap | WO before survey finding |
| **Leaks (bath/toilet)** | Early leak tags | WO before water damage claim |
| **Campus pool / mechanical** | Same as pool + mechanical room packs | Planned service before guest/survey event |
| **Portfolio** | Multi-campus Parc | Regional operator standardization |

| Pack | Description |
|------|-------------|
| **`assisted-living` demo** | Full campus `.est` — floors, pool room, mechanical, kitchen, leak tags |
| **Living Campus enterprise** | Campus gateway(s) + `Living.est` glue over vertical libraries |
| **Compliance evidence export** | Continuous survey-ready pack — not a pre-survey fire drill |
| **Preferred contractor marketplace** | FM partner or in-house team on same CMMS |

**Enterprise campus pricing (list):**

| Campus profile | One-time | Renewal | Year-1 total |
|----------------|----------|---------|--------------|
| **Small** (1 building, ≤80 beds) | **$8,000** | **$417/mo** (~$5K/yr) | **~$13,000** |
| **Standard** (2–3 buildings) | **$12,000** | **$833/mo** (~$10K/yr) | **~$22,000** |
| **Large / multi-system** | **$15,000** | **$2,083/mo** (~$25K/yr) | **~$40,000** |

*Industry comparison and competitor bands: **Pricing Guide v2.4** — Institutional pricing study.*

---

## Portable everywhere — one project, any deployment

Portability is not an afterthought in mooreVIEW. It is how integrators **win repeat business**, how service firms **standardize routes**, and how asset owners **keep continuity** when staff or vendors change.

### `.est` — the portable project file

Every mooreVIEW site is captured in a **portable `.est` project archive** (`.est.zip` / `.mvbundle`). One file holds:

- ST program and scan configuration  
- Tag database, drivers, and I/O map  
- HMI screens and faceplates  
- Alarm limits and notification profiles  
- Camera inventory and vision AI settings  
- PdM asset context, service history, and CMMS data  
- Site plan and MV-Draw layout (where used)  

**Open on a laptop. Save. Email to the cloud team. Deploy to the edge appliance. Hand off to the next contractor.** Same project, same behavior — no silent re-commissioning.

Typical portability wins:

| Scenario | How `.est` helps |
|----------|------------------|
| **Site handoff** | Owner receives a complete, documented configuration — not a password on a mystery PC |
| **Version control & backup** | Named project snapshots; rollback after a bad change |
| **Fleet standardization** | One “gold” lift-station or refrigeration template cloned to dozens of sites |
| **Office ↔ field** | Engineer on MVP Suite; operator on MV Client or Cloud Studio — same API, same tags |
| **Training & demos** | Bundled vertical projects (duplex lift station, assisted living, **pool**, **HVAC**, **c-store**) ship ready to run |

### Deploy where the work happens

mooreVIEW uses **one codebase** with deployment mode controlled by environment — not separate products that diverge over time.

| Deployment | Best for | Portability note |
|------------|----------|------------------|
| **MVP Suite (appliance)** | Plant-floor PC, offline-capable site | Full Studio at `localhost:3090`; `.est` is the unit of backup and migration |
| **IoT-Link (edge Linux)** | Remote mechanical rooms, cellular gateways | Same runtime stack; field buses stay on the LAN at the edge |
| **Cloud SaaS** | Multi-customer hosted operations | Tenant workspace + site agents; projects sync via export/import |
| **Cloud hub** | Central MQTT ingest and fleet Parc | Edge appliances uplink telemetry; configuration still lives in portable projects |
| **MV Client** | Operator UI only | Points at any mooreVIEW API — thin client, portable HMI experience |

**Rule that protects portability:** anything requiring LAN broadcast, serial COM, or subnet sweep runs on the **edge appliance**. Cloud adds fleet scale; edge keeps field integrity. The **project file** bridges both.

### Edge AI that travels with the asset

mooreVIEW supports predictive signals from **device edge AI** (Opta firmware), **host inference** (ONNX on the appliance), and **historian feature builds** — mapped to the same PdM asset IDs in the project. Swap a pump motor, update service history in CMMS, rebuild features: the forecast reflects reality because context lives **in the project**, not in a vendor’s closed cloud silo.

---

## Platform architecture (plain language)

mooreVIEW is a **monolithic Node application** with an integrated Express API, EJS dashboard, scan engine, and in-process event bus — designed for reliability on a single-site appliance and scale-out to cloud SaaS.

```
Field devices (Opta, Modbus, MQTT)
        ↓
Edge appliance — ST runtime, drivers, alarms, PdM batch
        ↓
Portable .est project + optional Mongo historian (7-day hot)
        ↓
Optional cloud archive export → zstd JSONL on archive server (see ARCHIVE_EXPORT.md)
        ↓
Parc MQTT uplink (optional) → Cloud SaaS fleet view
        ↓
Integrated CMMS — proactive PM, alarm WO, scheduled PM
        ↓
Technician completes work → service history → next forecast
```

On alarm transition, mooreVIEW emits a structured event (`alarm:transition`) — consumed in-process on the appliance and publishable to external CMMS via MQTT Integration v1. PdM proactive checks run on nightly batch, manual **Build features now**, or **Run proactive CMMS check**.

---

## Integrated CMMS — maintenance without another silo

mooreVIEW includes a **built-in CMMS** (`/cmms`) on appliance and cloud — no separate maintenance product required for the core proactive workflow.

| Source | Trigger | Typical priority |
|--------|---------|------------------|
| **PdM forecast** | Pending failure (warning ≤30 days RUL; critical ≤7 days) | High → urgent |
| **Alarm** | Tag out of limits | Normal → high |
| **PM schedule** | Calendar due | Normal |
| **Manual** | Operator or dispatcher | Normal |

Overview dashboard shows open work orders, overdue PM, and counts by source — so managers see at a glance whether the fleet is running **proactive** (PdM/PM) or **firefighting** (alarm-only).

External CMMS systems can **subscribe** to mooreVIEW-published MQTT alarm topics (mooreVIEW remains the authoritative alarm source). Integrated CMMS is the default for greenfield; MQTT bridge extends brownfield.

---

## Predictive maintenance — fix before breakdown

PdM in mooreVIEW is production-oriented, not a dashboard widget:

- **Asset mapping** — motor/pump/fan/compressor types, location class, install and service history  
- **Feature windows** — time-series features from historian and edge AI ingest  
- **Health index & forecast** — ok, warning, critical, failed with RUL estimates  
- **Proactive CMMS** — one open WO per asset, deduped and escalated as severity worsens  
- **Reports** — per-asset PdM PDF, scheduled report batch, Mongo report templates  

Settings (`Issue CMMS PM on pending PdM failure`) default **on** — because the product thesis is proactive. Alarms remain enabled as the last line.

Duplex lift-station, **pool controller**, and **assisted-living campus** deployments demonstrate the full loop: lag pump wear, filter pressure drift, comfort-band persistence, or leak tags → proactive PM work orders weeks before alarm, green pool, or survey finding — documented in training, simulation studies, and bundled `.est` projects.

---

## Market revenue potential (directional)

| Horizon | Metric | Target |
|---------|--------|--------|
| **Per site (residential pool)** | Year-1 list revenue | **~$1,752** |
| **Per site (commercial pool)** | Year-1 list revenue | **~$2,836** |
| **Per site (enterprise campus — standard)** | Year-1 list revenue | **~$22,000** |
| **Institutional / ALF** | 5-year recurring ARR potential | **$3 – 10M** |
| **Year 1 (portfolio)** | ~237 sites · total revenue | **~$550K – $600K** |
| **Year 3 (portfolio)** | ~1,500 cumulative sites · total revenue | **~$3.5M** |
| **5-year (all verticals)** | Recurring ARR ceiling | **$50 – 120M** |

Serviceable US wedge for lift/ATU/wastewater alone: **~$400M/yr** (sites without full SCADA). Convenience retail, pools, and HVAC contractor routes expand SAM materially beyond wastewater.

---

## Who mooreVIEW is for

| Buyer | Proactive outcome | Portability outcome |
|-------|-------------------|---------------------|
| **Asset owners** (utilities, food service, **ALF / campus operators**) | Fewer emergencies; SLA and compliance evidence | One project file per site; vendor-independent continuity |
| **Service & monitoring contractors** | Monitoring contracts + planned routes, not only T&M breakdowns | Clone templates across **lift, pool, HVAC, c-store, well, and campus** routes |
| **OEMs & panel shops** | Ship connected panels, not dialer-only skids | White-label appliance profiles; embed proactive monitoring |
| **Integrators & commissioners** | Deliver CBM programs with training built in | `.est` handoff; MVP Suite ↔ Cloud parity |

---

## Deployment & packaging

| Package | Description |
|---------|-------------|
| **mooreVIEW MVP Suite** | All-in-one Windows/Linux installer — ST, HMI, historian, Parc, PdM, CMMS |
| **IoT-Link appliance** | Edge Linux image for remote sites (cellular, MQTT uplink) |
| **Cloud SaaS** | Multi-tenant hosted Studio on port 3100 — org login, sites, agent hub |
| **Vertical project packs** | Pre-wired `.est` for all **ten marketplace verticals** — lift, ATU, wells, c-store, HVAC, pools, **`assisted-living` / Living Campus**, OEM embeds |
| **Training curriculum** | IoT CBM course (13 modules) + mooreVIEW labs (M0–M15) in-product |

---

## Proof mooreVIEW is working

A deployment is truly **proactive** when:

- Alarms fire on **leading** indicators — drift, imbalance, abnormal starts — not only hard faults  
- Work orders are created **before** the customer complaint or overflow call  
- Partners sell **monitoring agreements**, not only emergency dispatch  
- Reference stories cite **avoided** failure, food loss, SSO, **survey findings**, or pool/campus events — not “faster response to failure”  
- Project files move between office, edge, and cloud **without** re-commissioning  

---

## Summary

| | Reactive industry default | mooreVIEW |
|--|---------------------------|-----------|
| **Timing** | Fix after failure | Fix on forecast, before failure |
| **Visibility** | Single-site silo | Fleet Parc + historian |
| **Maintenance** | Voicemail → truck | PdM → CMMS → planned route |
| **Configuration** | Trapped on one PC | Portable `.est` project everywhere |
| **Deployment** | OEM lock-in | Appliance, edge, cloud, client — one platform |

**mooreVIEW: proactive operations you can carry anywhere.**

---

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings. Product features reflect MVP Suite and Cloud SaaS as of document version 1.4. Deployment entitlements (CMMS, cellular SIM management, cloud sims) may vary by license.*

**Related sales & planning docs:** [Pricing Guide v2.4](MooreVIEW-Pricing-Guide.md) · [Subscription Sell Sheet v1.1](MooreVIEW-Subscription-Sell-Sheet.md) · [Product Market Entry v1.4](MooreVIEW-Product-Market-Entry.md) · [Infrastructure Projections v1.0](MooreVIEW-Infrastructure-Projections.md) · [SCADA Competitive Comparison v1.0](MooreVIEW-SCADA-Competitive-Comparison.md) · Training: `docs/training/` (F2 in-product)
