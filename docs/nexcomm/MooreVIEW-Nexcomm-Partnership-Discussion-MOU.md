# MooreVIEW × Nexcomm Systems — Partnership Discussion Document

**Purpose:** Working brief for executive alignment and a **Memorandum of Understanding (MOU)** between **Nexcomm Systems** (field hardware, cellular, Nexus Cloud ingest) and **mooreVIEW / The Purple Standard** (process software, PdM, AI, CMMS, fleet HMI).

**Status:** Discussion draft · July 2026  
**PDF:** Run `npm run build:nexcomm-partnership-mou-pdf`
**End state:** Signed MOU → pilot → commercial framework → co-branded go-to-market

**Related implementation:** `lift_station_epi` template · `ace-liftpoint-fleet` project · Putnam County cloud pilot · `starts_analytics` PdM

---

## 1. Executive summary

Nexcomm and mooreVIEW serve the **same wastewater lift customer** from different layers of the stack. Nexcomm wins on **rugged hardware, SIM lifecycle, and cost-effective cloud ingest**. mooreVIEW wins on **proactive operations** — PdM, integrated CMMS, portable projects, and AI that turns telemetry into **scheduled work before overflow**.

Together they replace the reactive loop (autodialer → emergency truck) with **monitoring-contract economics** — without Nexcomm rebuilding SCADA or mooreVIEW rebuilding cellular gateways.

| Today | Joint offer |
|-------|-------------|
| Nexus Cloud = alerts + basic trends | mooreVIEW = fleet HMI, PdM → CMMS, compliance evidence |
| Custom panel projects per job | Standard `lift_station_epi` + `.est` on every install |
| Operators outgrow “clunky SCADA” | Same Nexcomm hardware; upgraded process layer |
| mooreVIEW greenfield IoT-Link ramp | **Instant scale** on 2,000+ LiftPoint Light installed base (ACE alone) |

**Proposed MOU outcome:** Nexcomm remains **system of record for field → Azure** (IoT Hub, Cosmos hot tier, ADLS lake). mooreVIEW becomes the **recommended process layer** for lift monitoring — co-sold, co-branded, revenue-shared — with ACE Septic & Waste as the **reference operator fleet**.

---

## 2. Parties and channel context

| Party | Role |
|-------|------|
| **Nexcomm Systems** | LiftPoint Light / LiftPoint / EPI / Nexus Panel hardware; CAT-M1 cellular; Nexus Cloud (Azure); panel-builder channel |
| **mooreVIEW** (The Purple Standard) | ST runtime option, HMI, historian interface, Parc fleet, PdM/AI, CMMS, portable `.est` projects, cloud SaaS |
| **ACE Septic & Waste** | Flagship field operator; septic/lift/electrical licenses; **~2,000+ LiftPoint Light** monitored lifts in Florida; 24/7 dispatch |
| **Panel builders / utilities** | Nexcomm existing channel; Putnam County–class municipal fleets |

ACE is not a passive logo — it is **install capacity, certified operator of record, and the first bulk conversion** under any Nexcomm–mooreVIEW MOU.

---

## 3. Strategic fit (why partner, not compete)

### 3.1 Marketplace thesis (shared)

Both parties address operators who cannot afford full municipal SCADA but **cannot afford SSO either**:

- **See** — Nexcomm I/O + cellular + cloud pipe  
- **Know** — mooreVIEW trends, PdM health index, starts/amp analytics  
- **Act** — mooreVIEW CMMS proactive work orders  
- **Prove** — service history + lake-backed reports for compliance (Florida Rule 62-604.500, Largo Ordinance 2010-27, etc.)

mooreVIEW’s published competitor displacement list explicitly names **NexComm Systems** as a target for operators seeking a **standard kit** — partnership converts displacement into **channel revenue** for both sides.

### 3.2 Division of labor

```
┌──────────────────────────────────────────────────────────────────┐
│  NEXCOMM — "Connect"                                              │
│  LiftPoint Light · LiftPoint · EPI · Nexus Panel                  │
│  SIM / CAT-M1 · IoT Hub · Cosmos (~72 hr) · ADLS datalake         │
│  Nexus Cloud (optional coexistence for legacy accounts)           │
└────────────────────────────┬─────────────────────────────────────┘
                             │ MQTT fan-out · lake export · device twin
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  MOOREVIEW — "Monitor · Predict · Act"                            │
│  lift_station_epi MQTT · fleet HMI · ST (optional on EPI)         │
│  starts_analytics + run_amps_creep · CMMS · `.est` portability    │
│  Slim process DB — not duplicate high-rate telemetry warehouse    │
└──────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  OPERATOR — ACE, utilities, panel builders, property managers     │
│  Monitoring contract · planned routes · regulatory logs           │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 What each party should **not** build

| Nexcomm should not… | mooreVIEW should not… |
|---------------------|------------------------|
| Rebuild PdM, RUL, CMMS | Replace LiftPoint hardware or SIM ops |
| Compete with Ignition/VTScada on analytics | Duplicate Cosmos + full-rate Mongo for all pens |
| Own field-service dispatch | Own panel UL listing / manufacturing |

---

## 4. Technical integration (current state)

### 4.1 Device coverage

| Product | mooreVIEW profile | Integration track |
|---------|-------------------|-------------------|
| **LiftPoint Light** | `liftpoint_light` | Track A — MQTT `/devices/<serial>/messages/events/` |
| **LiftPoint / EPI** | `epi_master` | Track A now; Track B MV-ST-OEM on OpenWrt (future) |
| **Nexus Panel / WWTP dialer** | Custom / EPP | Phase 2 |

### 4.2 LiftPoint Light telemetry (AI-relevant fields)

| Source | mooreVIEW tag | AI use |
|--------|---------------|--------|
| `in3_starts` / `in4_starts` | `P1_STARTS` / `P2_STARTS` | **starts_analytics** — all units |
| `in3_runtime` / `in4_runtime` | `P1_RUNTIME_HRS` / `P2_RUNTIME_HRS` | Runtime/start creep |
| Reg 9070 / 9080 | `AI1` / `AI2` | **run_amps_creep** — CT-equipped subset |
| Floats + pump run | `LVL_*`, `P*_RUN_FB` | Short-cycle, alternation, ghost starts |
| `s1p1_total_1hr_flow` | `P1_FLOW_1HR_GAL` | Efficiency / I&I context |

**Key insight:** ~50% of ACE fleet may lack CT wiring, but **every LiftPoint Light reports onboard start counters** — enabling fleet PdM at scale without truck rolls.

### 4.3 PdM tiers (productized)

| Tier | Hardware | mooreVIEW methods | List add-on |
|------|----------|-------------------|-------------|
| **Monitor** | Any LiftPoint Light | Alarms, trends, CMMS reactive | Base renewal **$25/mo** |
| **Predict — Starts** | All units | `starts_analytics` | Included in base (MOU differentiator) |
| **Predict — Electrical** | CT-installed | + `run_amps_creep` | +**$5–10/mo** |
| **Predict — Premium** | EPI triplex + ONNX path | Edge/host MCSA | +**$10/mo** · phase 2 |

### 4.4 Pilots in repo

| Pilot | Sites | Purpose |
|-------|-------|---------|
| **Putnam County** | 6 (1× EPI, 5× LiftPoint) | Municipal fleet MQTT + Nexus register map |
| **ACE scaffold** | 8 sample + CSV for 2,000+ | Bulk import, PdM asset map, `ace-liftpoint-fleet.est.json` |

Regenerate ACE artifacts: `npm run generate:ace-fleet`

---

## 5. Installed-base opportunity — ACE + Nexcomm

### 5.1 Scale

| Metric | Directional value | Source |
|--------|-------------------|--------|
| LiftPoint Light installed (ACE + Nexcomm) | **2,000+** | Field estimate · Jul 2026 |
| ACE CT-equipped subset | **~50%** (planning assumption) | Commissioning mix |
| Starts-only PdM addressable | **~1,000+** | No CT required |
| Florida lift stations (ACE service area) | Multi-county | Hillsborough, Pasco, Hernando, Polk, Pinellas, etc. |

### 5.2 Operator value (ACE)

ACE already sells:

- Remote monitoring on maintenance plans  
- 24/7 human response (not passive SMS)  
- Licensed septic + electrical + plumbing + CB — **one vendor for WO closure**

mooreVIEW adds:

- **Proactive PM work orders** before high-level alarm  
- Fleet view across 2,000 lifts  
- Evidence pack for **monthly inspection logs** (5-year retention)  
- Differentiation vs dialer-only competitors during **Data Flow / Badger** transition

---

## 6. Financial model (directional)

*Not audited forecasts. Based on mooreVIEW Pricing Guide v2.4, Product Market Entry v1.4, Wastewater Business Plan, and ACE installed-base estimate.*

### 6.1 Unit economics — single duplex lift (list)

| Line item | mooreVIEW list | Notes |
|-----------|----------------|-------|
| One-time (new greenfield) | **$2,500** | Often **$0** on ACE retrofit — hardware already installed |
| Monitoring renewal | **$25/mo** (**$300/yr**) | Includes Parc, historian access, CMMS, base PdM |
| Cell (mooreVIEW-managed) | **$3/mo** | Often **Nexcomm-bundled** on existing SIM — pass-through or split |
| PdM premium (CT / MCSA) | **+$5–10/mo** | Optional upsell |
| **Steady-state recurring** | **$28/mo** (**$336/yr**) | With mooreVIEW-managed cell |

**Software gross margin (mooreVIEW mature target):** 75–85%  
**Hardware gross margin (Nexcomm industry typical):** 35–45% on new box sales

### 6.2 Scenario A — ACE installed-base conversion (2,000 lifts)

Assumes **software-only attach** on existing Nexcomm hardware (no new capex).

| Penetration | Subscribing lifts | mooreVIEW gross renewal/yr | @ $25/mo list |
|-------------|-------------------|----------------------------|---------------|
| Year 1 — 10% | 200 | **$60,000** | Pilot counties |
| Year 2 — 35% | 700 | **$210,000** | Florida expansion |
| Year 3 — 60% | 1,200 | **$360,000** | + PdM premium attach |
| Year 5 — 80% | 1,600 | **$480,000** | Mature ACE fleet |

**With PdM premium on 40% of CT sites (+$7.50/mo blended):** add **~$46K/yr** at 1,600 lifts.

**ACE dispatch / service revenue (operator, not mooreVIEW):** Industry typical emergency lift call **$800–2,500**; avoided SSO events and contracted PM routes are the **operator ROI** — mooreVIEW enables ACE to **sell monitoring contracts**, not just emergency response.

### 6.3 Scenario B — Nexcomm net-new sales (co-branded bundle)

Every new LiftPoint Light sold through panel builders with **mooreVIEW monitoring pre-enabled**.

| Year | New Nexcomm lift monitors (channel) | mooreVIEW renewal ARR added | Cumulative lifts on MV |
|------|-------------------------------------|----------------------------|------------------------|
| Y1 | 150 | **$45,000** | 350 |
| Y2 | 400 | **$120,000** | 750 |
| Y3 | 800 | **$240,000** | 1,550 |
| Y5 | 1,500/yr run-rate | **$450,000/yr** incremental | 5,000+ |

*Assumes $25/mo mooreVIEW renewal from month of activation; Nexcomm hardware sale unchanged.*

### 6.4 Scenario C — Combined mooreVIEW 5-year plan acceleration

Published mooreVIEW plan (all verticals): **237 → ~5,300 sites**, lift beachhead **20 → ~451 lifts** by Y5.

| | Plan (standalone) | With Nexcomm MOU (directional) |
|--|-------------------|--------------------------------|
| Y5 lift sites | ~451 | **2,000–5,000+** (ACE + channel) |
| Y5 lift software ARR | ~$135K (451 × $300) | **$600K–$1.5M** |
| Wastewater Y3 revenue (plan) | **$3.9M** total vertical | Lift attach accelerates beachhead |

**Infrastructure cost benefit:** Nexcomm lake as telemetry SOR avoids mooreVIEW scaling hot Mongo to **350 GB–1.3 TB** at 5.3K sites — preserving software margin.

### 6.5 Revenue share framework (MOU negotiation starter)

| Model | mooreVIEW | Nexcomm | Operator (ACE) |
|-------|-----------|---------|----------------|
| **A — Referral** | 85% of software renewal | 15% referral fee on MV renewal | Bundled in service contract |
| **B — OEM resale** | 60% of software renewal | 40% for hardware + cloud + billing | Wholesale monitoring markup |
| **C — Operator-led** | 70% of software renewal | 15% Nexcomm | 15% ACE dispatch/platform fee |

**Example (Model B, 1,600 lifts @ $25/mo):**

| Party | Annual |
|-------|--------|
| Gross software | **$480,000** |
| mooreVIEW (60%) | **$288,000** |
| Nexcomm (40%) | **$192,000** |

Nexcomm retains **hardware margin + SIM + cloud ingest** separately on all new box sales.

### 6.6 One-time / NRE (optional MOU exhibits)

| Item | Directional |
|------|-------------|
| Azure MQTT fan-out + lake read integration | **$0–15K** engineering (shared) |
| White-label Nexus UI coexistence | **$5–10K** |
| Custom `.est` NRE per panel builder | **$5,000–25,000** (existing mooreVIEW OEM schedule) |
| ACE bulk fleet import + commissioning | **$25–50/site** (operator labor, not MV license) |

---

## 7. Five-year joint roadmap

| Phase | Timeline | Nexcomm | mooreVIEW | Commercial |
|-------|----------|---------|-----------|------------|
| **0 — MOU** | Q3 2026 | Data sharing terms, MQTT/lake access | `ace-liftpoint-fleet`, Putnam live | Revenue share letter |
| **1 — Pilot** | Q4 2026 | 50–200 ACE lifts, fan-out MQTT | PdM `starts_analytics` + CMMS WO | Case study: proactive fix before overflow |
| **2 — Florida scale** | 2027 | Panel-builder kit SKU | Fleet Parc, compliance export | Co-branded sell sheet |
| **3 — Multi-tenant** | 2028 | ADLS export per account | Lake → batch PdM at 2K+ scale | Utility + operator pricing tiers |
| **4 — Edge AI** | 2029 | EPI OpenWrt cooperation | MV-ST-OEM, device ONNX | Premium PdM tier |
| **5 — National** | 2030 | Nexcomm hardware standard | mooreVIEW default process layer on lift SKU | Definitive agreement / acquisition option |

---

## 8. Competitive and market context

| Competitor | Risk | Joint response |
|------------|------|----------------|
| **Data Flow / Badger Meter** | Merger distraction | Stable lift-first bundle during customer churn |
| **Autodialer vendors** | Low cost | Starts analytics + fleet — same hardware price band |
| **Ignition / VTScada** | IT-led utilities | Field-service pricing; PdM → CMMS native |
| **Nexus Cloud alone** | Status quo | mooreVIEW upgrades UX without rip-and-replace |

**mooreVIEW lift Year-1 TCO (list):** ~**$2,836** vs autodialer ~**$600–1,200** — justified by **avoided SSO** (single event often **$10K–100K+** liability) and **monitoring contract** revenue for ACE.

---

## 9. Proposed MOU structure (term sheet outline)

*For legal review — non-binding except confidentiality and exclusivity if agreed.*

### 9.1 Purpose

Establish a strategic partnership to deliver **connected lift station monitoring with predictive maintenance and work order integration**, combining Nexcomm field infrastructure with mooreVIEW process software.

### 9.2 Scope

1. **Integration:** MQTT (Azure IoT Hub protocol), optional ADLS read, device serial registry sync  
2. **Products:** LiftPoint Light (priority), LiftPoint, EdgePoint Industrial  
3. **Geography:** United States; **Florida pilot exclusivity** for 12 months (negotiable)  
4. **Channels:** ACE Septic & Waste (reference operator), Nexcomm panel builders, utilities  

### 9.3 Responsibilities

| Nexcomm | mooreVIEW |
|---------|-----------|
| Hardware, firmware, SIM provisioning | SaaS, PdM, CMMS, HMI, `.est` projects |
| Nexus Cloud ingest + lake | Process-layer runtime + AI feature pipeline |
| Tier-1 device support | Tier-2 application support |
| Panel-builder sales training (hardware) | Operator training (PdM, CMMS, F2) |

### 9.4 Data governance

- **Ownership:** Raw telemetry remains customer / Nexcomm account data  
- **mooreVIEW access:** Read via MQTT fan-out and/or lake export; no resale of raw feeds  
- **Retention:** Hot per Nexcomm policy (~72 hr Cosmos); long-term analytics via lake  
- **Security:** Per-tenant isolation; BAA/SLA as required for municipal customers  

### 9.5 Commercial terms (framework)

- Co-branded offering: **"Nexcomm Connected Lift + mooreVIEW Intelligence"** (working title)  
- List software renewal: **$25/mo/station** (mooreVIEW list)  
- Revenue share: **Model B** (60/40 MV/Nexcomm on software) unless otherwise agreed  
- Nexcomm may bundle software into hardware quote; remittance **monthly**, net-30  
- ACE operator fee: negotiated directly with ACE / Purple Standard  

### 9.6 IP and branding

- Each party retains existing IP  
- Joint marketing requires mutual approval  
- `lift_station_epi` register map derived from Nexus Cloud — license to mooreVIEW for integration purposes  

### 9.7 Exclusivity (optional)

- **Soft exclusivity:** Nexcomm recommends mooreVIEW as preferred process layer for lift monitoring  
- **Hard exclusivity (Florida, 12 mo):** No competing process-layer MOU with third party for LiftPoint Light — *in exchange for minimum lift activation commitment*  

### 9.8 Success metrics (Year 1)

| Metric | Target |
|--------|--------|
| Lifts on mooreVIEW (ACE + other) | **≥ 200** |
| Proactive CMMS WO from PdM (not alarm) | **≥ 25** documented |
| SSO / overflow events avoided (case studies) | **≥ 3** |
| Panel-builder LOI | **≥ 1** |
| Combined software ARR | **≥ $60K** |

### 9.9 Term

- **Initial term:** 24 months from signature  
- **Renewal:** Auto-renew 12-month periods  
- **Termination:** 90-day notice; customer subscriptions survive on mooreVIEW SaaS terms  
- **Path to definitive agreement:** MOU contemplates good-faith negotiation of long-form OEM/ reseller agreement by **Month 12**  

---

## 10. Open items for discussion

| # | Topic | mooreVIEW position | Question for Nexcomm |
|---|-------|-------------------|----------------------|
| 1 | MQTT fan-out | Required for live runtime | Can tenants subscribe to device topics, or broker mirror? |
| 2 | ADLS export | Preferred for PdM batch | Per-account read credentials + schema? |
| 3 | SIM billing | Pass-through on existing ACE SIMs | Who bills end customer for cell on retrofit? |
| 4 | Nexus Cloud coexistence | Keep for accounts that want it | White-label or parallel login? |
| 5 | CT commissioning data | `hasCt` flag per device | Available in Nexus device metadata? |
| 6 | Devicebound / control | Phase 2 | C2D policy for mooreVIEW-initiated outputs? |
| 7 | Putnam + ACE tenant IDs | Multi-tenant SaaS | Dedicated Azure subscription or shared? |
| 8 | Exclusivity consideration | Florida pilot | What minimum commitment does Nexcomm need? |

---

## 11. Recommended next steps

1. **Executive working session** — review this document; agree Scenario A vs B priority  
2. **Technical workshop** — MQTT fan-out, 5-device pilot (Putnam + ACE samples), lake schema  
3. **Commercial term sheet** — finalize revenue share model and ACE role  
4. **Draft MOU** — legal review of §9 outline  
5. **Pilot SOW** — 200 ACE lifts, 90-day PdM tune, joint case study  
6. **Panel-builder kit** — Nexcomm SKU + mooreVIEW `.est` preloaded; co-branded PDF  

---

## 12. Appendix — reference documents

| Document | Location |
|----------|----------|
| Nexcomm integration index | `docs/nexcomm/README.md` |
| ACE fleet generator | `scripts/ace-fleet/` · `npm run generate:ace-fleet` |
| Putnam County cloud project | `data/projects/putnam-county-cloud.est.json` |
| LiftPoint Light register map | `st/fixtures/tags.lift_station_epi.json` |
| PdM starts analytics | `src/pdm/failureForecast.js` |
| Product Market Entry v1.4 | `docs/marketing/MooreVIEW-Product-Market-Entry.md` |
| Infrastructure Projections v1.0 | `docs/marketing/MooreVIEW-Infrastructure-Projections.md` |
| Wastewater business plan | `est/docs/marketplace/07-wastewater-lift-atu-wwtp-*.md` |
| Parent marketplace thesis | `est/docs/MooreVIEW-marketplace-business-plan.md` |

---

**Contact / preparation**

| | |
|--|--|
| **mooreVIEW** | The Purple Standard · mooreVIEW technology company |
| **Reference operator** | ACE Septic & Waste · [acesepticandwaste.com](https://www.acesepticandwaste.com) |
| **Nexcomm** | [nexcommsys.com](https://wastewater.nexcommsys.com) · Nexus Cloud |

*This document is prepared for partnership discussion. Financial figures are directional planning estimates, not offers or guarantees.*
