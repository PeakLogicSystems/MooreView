# mooreVIEW — Wastewater Business Plan

**Lift stations · ATU · WWTP · Phase 1 Cloud SaaS · 2026**

**Document version:** 1.0 · Run `npm run build:wastewater-business-plan-pdf` for build date

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

---

## Executive summary

mooreVIEW enters the **US wastewater and onsite treatment market** as a **field-service monitoring platform** — proactive lift-station, ATU/ATS, and WWTP head-end monitoring with portable `.est` projects, PdM → CMMS, and MQTT Parc fleet uplink to **Phase 1 Cloud SaaS**.

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **Total revenue (directional)** | **~$550K** | **~$1.74M** | **~$3.9M** |
| **Cumulative monitored assets** | ~230 | ~380 | **~500+** |
| **End-of-year renewal ARR** | ~$55K | ~$175K | ~$400K |

**Phase 1 cloud stack** (SaaS + MQTT + Archive + Mongo) supports the full **500-device wastewater fleet** on a single NYC1 topology. At steady state:

| Category | Monthly | Annual |
|----------|---------|--------|
| Renewal revenue (500 assets, list) | **~$10,750** | **~$129,000** |
| DO Phase 1 cloud stack | ~$97 | ~$1,167 |
| Cellular — 500 field assets ($2 SIM + $0.50/50 MB) | **$1,250** | **$15,000** |
| Cellular — 32 WWTP/head-end appliances ($2 SIM + $5/1 GB) | **$224** | **$2,688** |
| **Total infrastructure** | **~$1,571** | **~$18,855** |
| **Contribution after infra** | **~$9,179** | **~$110,145** |
| **Infra as % of renewal revenue** | **~14.6%** | **~14.6%** |

Cloud alone is **~0.9%** of renewal revenue at 500 assets. **Cellular backhaul** is the dominant opex line (~11.6% of renewal at cost; billed to customer at **$3/mo** list = **$1,500/mo** revenue vs **$1,250/mo** cost → **$250/mo** cell margin).

**Serviceable market:** ~**$400M/yr** US wedge (sites without full SCADA). **5-year ARR ceiling (wastewater vertical):** **$15 – 25M** recurring.

**Beachhead channel:** Purple Standard sister operators (**ACE Septic & Waste**) — reference fleet, install crews, first **100–500 sites** without cold national sales.

---

## Part 1 — Market & product

### Vertical scope

| Segment | Asset | Proactive wedge | Project pack | Tier |
|---------|-------|-----------------|--------------|------|
| **Lift stations** | Duplex/triplex pump stations | Level/pump trends before SSO | `duplex-lift-station` | Commercial |
| **ATU / ATS** | Residential & commercial treatment | Blower/UV/pump health; compliance route | ATS Compliance Pack | Res / Com |
| **WWTP head-end** | Small municipal / package plants | Pump/blower PdM; remote operator view | `mle-wastewater` | Commercial |
| **Septic OEM** | Panel-builder embed | Provider fleet Parc | `ATS.est` | OEM |

### Who buys

| Buyer | Wastewater use case |
|-------|---------------------|
| **Service contractors** (ACE-class) | Monitoring contracts on lift + ATU routes |
| **Utilities / collections districts** | Fleet Parc; fewer SSO events; 13 mo compliance archive |
| **OEM panel shops** | Connected ATS panel vs dialer-only skid |
| **Property managers / commercial** | ATU compliance before inspection failure |

### vs legacy

| Solution | Year-1 TCO (duplex lift) | PdM → CMMS |
|----------|--------------------------|------------|
| Autodialer | ~$600 – $1,200 | ○ |
| **mooreVIEW (+ cell)** | **~$2,836** | **●** |
| VTScada (1K I/O) | ~$7K – $12K | ○ |

### List pricing (wastewater assets)

| Asset | One-time | Renewal/mo | Cell (list) | Year-1 total |
|-------|----------|------------|-------------|--------------|
| **ATU — residential** | $1,500 | $18 | $3 | **$1,752** |
| **ATU — commercial** | $2,500 | $25 | $3 | **$2,836** |
| **Lift station — duplex** | $2,500 | $25 | $3 | **$2,836** |
| **Well & pump** (adjacent) | $2,500 | $25 | $3 | **$2,836** |

Renewal includes Parc uplink, historian, CMMS, PdM, alarm profiles, platform updates.

---

## Part 2 — Phase 1 Cloud SaaS platform

### Production topology (NYC1)

```
                         Internet
                             │
              ┌──────────────┼──────────────┐
              │              │              │
        DO FW SaaS     DO FW MQTT     DO FW Archive
        22/80/443      22+1883/8883   22+8090 (SaaS IP)
              │              │              │
       ┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
       │ saas        │ │ mqtt       │ │ archive    │
       │ nginx→3100  │ │ Mosquitto  │ │ Node :8090 │
       │ 4 GB        │ │ 2 GB       │ │ 2 GB+disk  │
       └──────┬──────┘ └─────▲──────┘ └─────▲──────┘
              │ mongodb+srv  │              │
       ┌──────▼──────┐       │              │
       │ Managed     │  IoT-Link / Opta     │ 7-day hot
       │ MongoDB     │  ──MQTT 8883──►      │ → zstd archive
       └─────────────┘                      │
```

| Host | Role | Size |
|------|------|------|
| `mooreview-saas` | nginx → Cloud Studio :3100 | 4 GB / 2 vCPU |
| `mooreview-mqtt` | Mosquitto TLS :8883 | 2 GB / 1 vCPU |
| `mooreview-archive` | Cold historian API :8090 | 2 GB + block volume |
| Managed MongoDB | Hot historian (7-day rolling) | 10–20 GB tier |

**Edge path:** IoT-Link or Arduino Opta (cellular) → `mqtts://mqtt.mooreview.io:8883` → SaaS Parc ingest → Mongo hot → day-7 zstd export to archive.

**WWTP head-ends (32 units):** MVP Suite appliance on **3090** with site agent + optional cameras; cellular uplink for inventory sync and remote operator view — credentials and LAN I/O stay on-site.

Deploy runbook: `CLOUD_DEPLOY_DO_PHASE1_ATL-MQTT.md` · Architecture detail: `Phase1-SaaS-Architecture-Costs.md`

---

## Part 3 — Capacity limits @ wastewater fleet

### Platform maximums (Phase 1 single stack)

| Resource | Phase 1 max | Wastewater @ 500 assets | Headroom |
|----------|-------------|-------------------------|----------|
| **Devices per tenant** | 1,000 | 500 | 50% |
| **Sites / locations** | 1,000 | ~120 contractors + 32 WWTP | 87% |
| **Tags (`MOOREVIEW_MAX_TAGS`)** | 70,912 (cloud default) | **~7,500** est. | 89% |
| **MQTT connections** | ~2,000 | 532 (500 + 32) | 73% |
| **Hot Mongo (7-day)** | 15 GB base plan | **~6.5 GB** | fits base tier |

### Tag budget by asset type

| Asset type | Typical tags/site | PdM pens | Sample rate |
|------------|-------------------|----------|-------------|
| Duplex lift station | 18 – 28 | Pump runtime, starts, amp imbalance | 5 s (PdM) |
| ATU — residential | 8 – 12 | Blower, UV hours, high water | 5 – 30 s |
| ATU — commercial | 12 – 18 | Blower, UV, pumps, compliance | 5 s |
| WWTP head-end (appliance) | 40 – 120 | Blower, clarifier, pumps (local) | Rollups to cloud |

**500-asset tag estimate:** (120 lifts × 22) + (250 ATU res × 10) + (130 ATU com × 15) ≈ **2,640 + 2,500 + 1,950 = ~7,090 tags** — set `MOOREVIEW_MAX_TAGS=8192` for wastewater tenant.

### Data ingest @ 500 field assets

Lift stations run **higher-rate PdM** (cloud storage index **1.4×** per Infrastructure Projections). ATU sites are moderate.

| Layer | 500 assets × 50 MB/mo (weighted avg) | 32 WWTP × ~100 MB/mo | Combined |
|-------|--------------------------------------|----------------------|----------|
| Monthly ingest | **~25 GB** | **~3.2 GB** | **~28 GB** |
| Hot Mongo (7-day) | ~5.8 GB | ~0.7 GB | **~6.5 GB** |
| Archive Year 1 | ~300 GB | ~38 GB | **~338 GB** |

Archive volume: start **200 GB** ($20/mo), expand to **~350 GB** (~$35/mo) by month 12.

### Scale triggers (wastewater fleet)

| Signal | Threshold | Action |
|--------|-----------|--------|
| Fleet devices | > **1,000** | Second MQTT broker or tenant shard |
| Tags | > **8,192** per tenant | Raise `MOOREVIEW_MAX_TAGS`; scale Mongo compute |
| Archive | > **500 GB** | Expand block volume; evaluate object storage |
| Lift PdM ingest | > **40 GB/mo** fleet | Step SaaS to 8 GB droplet; Mongo 50 GB tier |
| WWTP appliances | > **50** head-ends | Dedicated site-agent relay or regional MQTT |

---

## Part 4 — Financial model

### 3-year revenue (wastewater vertical)

Directional model — **wastewater-focused** channel (ACE + utility + OEM). Aligns with portfolio wastewater benchmark.

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **New assets installed** | ~230 | ~150 | ~120 |
| **Cumulative assets** | ~230 | ~380 | **~500** |
| **One-time (install + commissioning)** | ~$460K | ~$375K | ~$300K |
| **Renewal + cell (in-year + ARR build)** | ~$90K | ~$365K | ~$600K |
| **Total revenue** | **~$550K** | **~$1.74M** | **~$3.9M** |
| **End-of-year renewal ARR** | ~$55K | ~$175K | ~$400K |

*Year 2–3 assume 10–15% fleet renewal discount on operators above 50 sites; WWTP head-ends at commercial tier ACV.*

### Year-1 site mix (wastewater launch)

| Segment | Tier | Y1 target | Y1 revenue (list) | Y1 recurring added |
|---------|------|-----------|-------------------|--------------------|
| Lift station — duplex | Commercial | 40 | $113,440 | $13,440 |
| ATU — residential | Residential | 100 | $175,200 | $25,200 |
| ATU — commercial | Commercial | 60 | $170,160 | $20,160 |
| WWTP / package plant head-end | Commercial | 8 | $22,688 | $2,688 |
| Wells & pumps (adjacent) | Commercial | 22 | $62,392 | $7,392 |
| **Total** | | **~230** | **~$543,880** | **~$68,880 ARR** |

*Rounded to **~$550K** year-1 total with in-year renewal recognition and OEM NRE.*

### Steady-state fleet @ 500 assets (Year 3 end)

Reference mix for Phase 1 capacity and infra cost model:

| Segment | Count | Renewal/mo | Monthly renewal |
|---------|-------|------------|-----------------|
| Lift station — duplex | 120 | $25 | $3,000 |
| ATU — residential | 250 | $18 | $4,500 |
| ATU — commercial | 100 | $25 | $2,500 |
| WWTP head-end (no per-asset renewal)* | 32 | — | — |
| **Total billable assets** | **470** | | **$10,000** |

*WWTP head-ends billed as commercial sites ($25/mo) in operator contracts; 32 appliances share tenant fleet view. Full 500-device MQTT count = 470 field + 32 head-end + overhead.*

**With 32 WWTP @ $25/mo:** total renewal **~$10,800/mo (~$129,600/yr)**.

---

## Part 5 — Infrastructure & cellular cost (2026)

### Actual carrier costs (planning basis)

| Fleet class | SIM | Data plan | **Cost/asset/mo** | List to customer |
|-------------|-----|-----------|-------------------|------------------|
| **Field assets** (lift, ATU, IoT-Link) | $2.00 | $0.50 / 50 MB | **$2.50** | **$3.00** |
| **WWTP head-end appliances** (cameras, site agent) | $2.00 | $5.00 / 1 GB | **$7.00** | Pass-through or bundled |

50 MB/mo per lift/ATU is sufficient for 5 s Parc telemetry + alarm events. 1 GB/mo supports site-agent heartbeat, inventory sync, and occasional camera proxy — not continuous HD streaming.

### Cloud infrastructure (Phase 1 @ 500 assets)

| Component | Monthly | Annual |
|-----------|---------|--------|
| SaaS 4 GB droplet | $24 | $288 |
| MQTT 2 GB droplet | $12 | $144 |
| Archive 2 GB droplet | $12 | $144 |
| Archive volume (~338 GB Y1 avg) | ~$34 | ~$408 |
| Managed Mongo (15 GB base) | $15.23 | $183 |
| **Cloud subtotal** | **~$97** | **~$1,167** |

### Cellular @ 500 + 32

| Line | Calculation | Monthly | Annual |
|------|-------------|---------|--------|
| Field fleet (500 × $2.50) | SIM + 50 MB | **$1,250** | **$15,000** |
| WWTP head-ends (32 × $7.00) | SIM + 1 GB | **$224** | **$2,688** |
| **Cellular subtotal** | | **$1,474** | **$17,688** |

### Combined P&L — infrastructure layer (Year 3 steady state)

| | Monthly | Annual | % of ~$10,800 renewal |
|--|---------|--------|------------------------|
| Renewal revenue (500 assets, list) | $10,800 | $129,600 | 100% |
| DO Phase 1 cloud | −$97 | −$1,167 | 0.9% |
| Cellular — field (cost) | −$1,250 | −$15,000 | 11.6% |
| Cellular — WWTP (cost) | −$224 | −$2,688 | 2.1% |
| **Total infrastructure (cost)** | **−$1,571** | **−$18,855** | **14.5%** |
| **Contribution after infra cost** | **$9,229** | **$110,745** | **85.5%** |

### Cell pass-through margin

| | Monthly |
|--|---------|
| Cell billed (500 × $3 list) | $1,500 |
| Cell cost (500 × $2.50) | −$1,250 |
| **Cell margin** | **$250** |
| WWTP cell (32 × $7 cost; often bundled in site fee) | −$224 |

### Per-asset economics (commercial lift station)

| | Per asset/mo | Per asset/yr |
|--|--------------|--------------|
| Renewal revenue | $25.00 | $300.00 |
| Cell billed (list) | $3.00 | $36.00 |
| Cell cost | $2.50 | $30.00 |
| Cloud infra (allocated, 500 fleet) | ~$0.19 | ~$2.33 |
| WWTP uplink (allocated) | ~$0.04 | ~$0.54 |
| **Contribution after infra** | **~$22.27** | **~$267.13** |

**Gross margin on renewal + cell (list):** ($25 + $3 − $2.50 − $0.23) / $28 ≈ **89%** before sales, install labor, and hardware COGS.

### Infrastructure cost by year (ramp)

| Year | Cumulative assets | Cloud/mo | Cell/mo (field) | WWTP cell/mo | Total infra/mo |
|------|-------------------|----------|-----------------|----------------|----------------|
| **Y1** | ~230 | ~$93 | ~$575 | ~$112 (16 units) | **~$780** |
| **Y2** | ~380 | ~$95 | ~$950 | ~$168 (24 units) | **~$1,213** |
| **Y3** | ~500 | ~$97 | ~$1,250 | ~$224 (32 units) | **~$1,571** |

Phase 1 stack is **largely fixed** from launch — margin improves with fleet density until archive/Mongo tier step-up (~600+ high-rate lift assets).

### Break-even (infrastructure only)

| Cost covered | Assets @ $25/mo renewal |
|--------------|-------------------------|
| Cloud stack alone (~$97/mo) | **~4 assets** |
| Cloud + field cell (~$1,347/mo) | **~54 assets** |
| Full stack incl. 32 WWTP (~$1,571/mo) | **~63 assets** |

---

## Part 6 — Unit economics & targets

| Metric | Target |
|--------|--------|
| **Renewal gross margin** (after cloud + cell cost) | **85 – 90%** |
| **Hardware + commissioning margin** | 35 – 45% |
| **Blended year-1 payback on install COGS** | Under 14 months |
| **Net revenue retention (fleet operators)** | > 110% |
| **Logo churn (annual)** | < 5% |
| **LTV (commercial lift, 7 yr)** | $2,500 + ($336 × 7) ≈ **$4,852** |

**LTV:CAC target > 3:1** on contractor-led installs. ACE channel reduces CAC vs cold national sales.

---

## Part 7 — Go-to-market

### Phase roadmap

| Phase | Assets | Focus | Cloud |
|-------|--------|-------|-------|
| **Launch (Y1)** | ~230 | ACE reference fleet; lift + ATU routes | Deploy Phase 1; 10 GB Mongo |
| **Growth (Y2)** | ~380 | Utility pilots; OEM panel embed | Archive expand 200→300 GB |
| **Scale (Y3)** | **~500** | Fleet discounts; municipal RFP | Phase 1 at capacity; plan ingest shard |

### Sales channels (wastewater)

| Channel | Y1 mix | Advantage |
|---------|--------|-----------|
| **Purple Standard / ACE** | 40 – 50% | Install crews, brand, first 500 sites |
| **Contractor monitoring contracts** | 30 – 40% | Attach on PM routes |
| **OEM / panel embed** | 10 – 15% | ATS panel + provider Parc |
| **Utility / municipal** | 5 – 10% | Longer cycle; 13 mo compliance archive |

### Compliance & retention drivers

- **13-month historian archive** on lift/ATU (regulatory route documentation)
- **PdM → proactive CMMS** — service due before inspection failure
- **Portable `.est`** — contractor owns project; no vendor lock-in on recommission

---

## Part 8 — Risk & scale path

| Risk | Mitigation |
|------|------------|
| Cellular outage at lift station | Local alarm logic on Opta; spool on IoT-Link; SSO dialer as last line |
| MQTT broker load | Dedicated Phase 1 MQTT droplet; lock pilot IPs; scale at 2K connections |
| Archive growth (lift PdM) | 7-day hot → zstd; expand block volume $0.10/GiB |
| Tenant tag overflow | Size `MOOREVIEW_MAX_TAGS=8192` for wastewater; monitor dashboard |
| National scale (>5K assets) | VM split: ingestion · alarms · GUI · AI (`ARCHITECTURE.md`) |

---

## Appendix — assumptions

| Item | Value |
|------|-------|
| Fleet reference | 500 field assets + 32 WWTP head-ends |
| Field cellular cost | $2/SIM + $0.50 per 50 MB/mo |
| WWTP cellular cost | $2/SIM + $5 per 1 GB/mo |
| Field cellular list | $3/mo (Pricing Guide v2.4) |
| Cloud topology | Phase 1 NYC1 (SaaS + MQTT + Archive + Mongo) |
| Revenue benchmarks | Wastewater vertical plan Y1–Y3 |
| Tag estimate | ~7,090 @ 500 assets; cap 8,192 |
| Ingest | 50 MB/mo/field asset; ~100 MB/mo/WWTP head-end |
| DO pricing | Aug 2026 list |

**Disclaimer:** Directional business plan for capacity, pricing, and opex review. Not a financial forecast, hardware quote, or SLA commitment.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `Phase1-SaaS-Architecture-Costs.md` | Phase 1 topology + generic 500-device cost model |
| `DO-Phase1-Storage-Cost-Review.md` | Storage-only deep dive |
| `MooreVIEW-Pricing-Guide.md` | List MSRP v2.4 |
| `MooreVIEW-Product-Market-Entry.md` | Portfolio launch model |
| `MooreVIEW-Infrastructure-Projections.md` | 5-year segment scaling |
| `CLOUD_DEPLOY_DO_PHASE1_ATL-MQTT.md` | Production deploy runbook |

---

*Wastewater Business Plan v1.0 — mooreVIEW / The Purple Standard.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
