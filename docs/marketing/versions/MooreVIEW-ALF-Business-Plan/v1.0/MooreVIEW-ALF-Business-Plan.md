# mooreVIEW — ALF / Living Campus Business Plan

**Institutional MEP · 60 campuses · $110/asset · 55% net profit · Phase 1 Cloud SaaS · 2026**

**Document version:** 1.0 · Run `npm run build:alf-business-plan-pdf` for build date

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

---

## Executive summary

mooreVIEW **Living Campus** targets **multi-site ALF / assisted-living operators** — facilities/MEP monitoring (HVAC, kitchen cold, generator, DHW, leaks, pool/mechanical) with **MVP Suite on-prem** (full **~4,000 tags/campus**) and **Phase 1 Cloud SaaS** for portfolio fleet view via **site-agent rollup sync**.

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **New campuses** | 12 | 24 | 24 |
| **Cumulative campuses** | 12 | 36 | **60** |
| **Total revenue** | **~$1.09M** | **~$3.78M** | **~$7.26M** |
| **Total cost (45%)** | ~$490K | ~$1.70M | ~$3.27M |
| **Net profit (55%)** | **~$599K** | **~$2.08M** | **~$3.99M** |
| **End-of-year renewal ARR** | ~$1.74M | ~$5.23M | **~$8.71M** |

**Customer pricing (planning default):** **$110 / monitored asset / month** · **~110 billable assets / standard campus** → **$12,100 / campus / month** recurring. **One-time commissioning:** **$110 × 110 assets = $12,100** (aligns with Pricing Guide **standard campus** $12K tier).

**Target margin:** **55% net profit** after install COGS, cloud/cellular, support, sales, and **7% overhead** (Y2+ on total revenue). ALF is **high ACV, low cloud-centrality** — net margin is driven by renewal scale, not droplet cost.

**System impact @ 60 campuses:** **240,000 on-prem tags** (edge) · **~36,000 cloud rollup tags** · **60 site-agent MQTT sessions** · Phase 1 stack **fits with rollup sync** (`MOOREVIEW_MAX_TAGS=65536`, SaaS step to **8 GB**). **Do not** full-mirror 4,000 tags/campus into one SaaS tenant.

---

## Part 1 — Market & product

### Scope

| Layer | Role |
|-------|------|
| **Edge (each campus)** | MVP Suite PC — full Studio, **~4,000 tags**, cameras, 13 mo local historian, CMMS evidence |
| **Cloud (portfolio)** | Phase 1 SaaS :3100 — org login, **site agent**, fleet map, rollup alarms, compliance export |
| **Project** | `assisted-living` / Living Campus `.est` |

### Buyer

| Buyer | Outcome |
|-------|---------|
| **Regional ALF operator (5–60 campuses)** | One fleet tenant; survey-ready MEP evidence |
| **FM / integrator partner** | Portable `.est`; multi-campus Parc |
| **Portfolio owner (PE-backed senior living)** | Proactive CMMS across assets; BMS coexistence |

### vs stacked point solutions

| Approach | Typical campus spend | mooreVIEW |
|----------|---------------------|-----------|
| CMMS + HVAC IoT + kitchen logger + leak | **$14K – $30K / yr** | **~$145K yr-1** then **~$145K/yr** renewal @ 110 assets × $110 |
| mooreVIEW list (standard campus MSRP) | — | **~$22K yr-1** list ($833/mo) — this plan uses **asset-based enterprise contract** |

*Enterprise portfolio pricing at **$110/asset/mo** reflects full-campus template (leak, cold, gen, comfort, mechanical) vs entry MSRP band.*

---

## Part 2 — Pricing model ($110 / asset)

### Definitions

| Term | Value | Notes |
|------|-------|-------|
| **Billable asset** | Customer-facing monitored point | HVAC zone, leak circuit, walk-in, gen, DHW, pool pump, etc. |
| **Assets / campus (avg)** | **~110** | Standard 2–3 building campus; scales with bed count |
| **Tags / campus (technical)** | **~4,000** | Full `.est` template on MVP Suite — **unlimited within template** |
| **Customer rate** | **$110 / asset / mo** | Contract line item |
| **Campus recurring** | **$12,100 / mo** | 110 × $110 |
| **Campus one-time** | **$12,100** | $110 × 110 assets at commissioning |

### Campus profile mix (60-site fleet)

| Profile | Share | Assets | Recurring/mo | One-time |
|---------|-------|--------|--------------|----------|
| **Small** (1 bldg, ≤80 beds) | 25% | ~75 | $8,250 | $8,250 |
| **Standard** (2–3 bldg) | 55% | ~110 | $12,100 | $12,100 |
| **Large** (4+ bldg) | 20% | ~155 | $17,050 | $17,050 |
| **Fleet weighted avg** | 100% | **~110** | **~$12,100** | **~$12,100** |

---

## Part 3 — Phase 1 Cloud SaaS & deployment

```
Portfolio operator ──HTTPS──► SaaS :3100 (Cloud Studio)
                                  │
                    site agent × 60 campuses
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
     Rollup tags ~36,000                    MVP Suite × 60
     Mongo hot ~1 GB                         ~4,000 tags each (local)
              ▲                                       │
              └──────── MQTT :8883 site agent ────────┘
```

| Host | ALF @ 60 campuses |
|------|-------------------|
| SaaS droplet | **8 GB** (step-up from 4 GB at ~12 campuses) |
| MQTT droplet | Phase 1 **2 GB** — 60 connections (headroom >>) |
| Mongo hot | **15 GB base** tier sufficient (rollup historian) |
| Archive | **+50 – 100 GB** volume (~$5 – $10/mo) |
| Sync model | **B — rollup + site agent** (~600 cloud pens/campus) |

Detail: `MooreVIEW-Infrastructure-Projections.md` Part 10 · `Phase1-SaaS-Architecture-Costs.md`

---

## Part 4 — Financial model (60 campuses / 3 years)

### Ramp

**12 campuses Y1 · +24 Y2 · +24 Y3 = 60 cumulative.** (~1/month Y1, ~2/month Y2–Y3). Equivalent to **3/month for 20 months** then hold at 60.

### Revenue

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| New campuses | 12 | 24 | 24 |
| Cumulative (EOY) | 12 | 36 | 60 |
| **One-time ($12,100 × new)** | **$145K** | **$290K** | **$290K** |
| **Renewal (ramped campus-months)** | **$944K** | **$3.48M** | **$6.97M** |
| **Total revenue** | **~$1.09M** | **~$3.78M** | **~$7.26M** |
| **Renewal ARR (EOY run-rate)** | ~$1.74M | ~$5.23M | **~$8.71M** |

*Y1 renewal: 78 campus-months (1+2+…+12) × $12,100. Y2: 12 full-year + 24 half-year avg. Y3: 36 full-year + 24 half-year avg.*

### Cost structure (45% of revenue → 55% net)

| Cost line | Y1 | Y2 | Y3 | Y3 % rev |
|-----------|-----|-----|-----|----------|
| Install hardware COGS (~36% of one-time) | $52K | $105K | $105K | 1.4% |
| Install labor & commissioning | $72K | $144K | $144K | 2.0% |
| Cloud + cellular (Phase 1 + site SIM) | $4K | $8K | $15K | 0.2% |
| **Overhead (7% of revenue, Y2+ policy)** | $30K† | $265K | $508K | 7.0% |
| Customer success & L2 support | $120K | $420K | $800K | 11.0% |
| Sales & partner commission (~8%) | $87K | $302K | $581K | 8.0% |
| Platform / R&D allocation (~5%) | $55K | $189K | $363K | 5.0% |
| Warranty & spares | $20K | $45K | $60K | 0.8% |
| G&A (remainder) | $50K | $120K | $200K | 2.8% |
| **Total cost** | **~$490K** | **~$1.70M** | **~$3.27M** | **45%** |
| **Net profit (55%)** | **~$599K** | **~$2.08M** | **~$3.99M** | **55%** |

†Y1 OH: **$3/device/mo** on monitored field assets where applicable + partial 7% — blended **~$30K** on lower Y1 revenue base (see Wastewater Business Plan OH policy).

### Per-campus unit economics (Y3 steady state)

| | Per campus / mo | Per campus / yr |
|--|-----------------|-----------------|
| **Revenue** (110 × $110) | **$12,100** | **$145,200** |
| **Total cost (45%)** | $5,445 | $65,340 |
| **Net profit (55%)** | **$6,655** | **$79,860** |

| Cost component | Per campus / mo |
|----------------|-----------------|
| Cloud + cell (allocated) | ~$21 |
| Support & success | ~$1,333 |
| Sales commission | ~$968 |
| OH (7%) | ~$847 |
| Install COGS (amortized/new-site blend) | ~$200 |
| Platform / G&A | ~$1,076 |

### 3-year totals

| | 3-year cumulative |
|--|-------------------|
| **Revenue** | **~$12.1M** |
| **Net profit (55%)** | **~$6.7M** |
| **Campuses deployed** | **60** |
| **Billable assets (EOY Y3)** | **~6,600** |
| **On-prem tags (EOY Y3)** | **~240,000** |

---

## Part 5 — System impact @ 60 campuses

### Tag & runtime load

| Resource | Per campus | **@ 60 campuses** | Phase 1 limit | Status |
|----------|------------|-------------------|---------------|--------|
| **On-prem tags (MVP Suite)** | ~4,000 | **~240,000** | Edge (16 GB / 256 GB SSD) | **Size appliance** |
| **Cloud rollup tags** | ~600 | **~36,000** | 70,912 default | **OK** — set `MOOREVIEW_MAX_TAGS=65536` |
| **Full cloud mirror** | 4,000 | 240,000 | 70,912 | **FAIL ~campus 18** |
| **Site-agent MQTT** | 1 | **60** | ~2,000 | **OK** |
| **Cloud ingest (rollup)** | ~25 MB/mo | **~1.5 GB/mo** | — | Low vs wastewater fleet |
| **Hot Mongo (7 d)** | ~17 MB | **~1 GB** | 15 GB base | **OK** |

### Infrastructure opex @ 60 campuses

| Line | Monthly | Annual | % of $727K/mo renewal |
|------|---------|--------|------------------------|
| SaaS 8 GB droplet | $48 | $576 | 0.007% |
| MQTT + Mongo + archive (Phase 1) | ~$160 | ~$1,920 | 0.02% |
| Cellular — 60 site agents ($7 cost) | $420 | $5,040 | 0.06% |
| **Total cloud/cell** | **~$628** | **~$7,536** | **~0.09%** |

**Cloud is not the constraint.** Edge hardware (**60 × MVP Suite**), commissioning capacity, and **support labor** dominate — consistent with Infrastructure Projections: *“Size the appliance, not the droplet.”*

### Ramp — system milestones (3 campuses / month equivalent)

| EOY year | Campuses | Cloud tags (rollup) | Infra action |
|----------|----------|---------------------|--------------|
| Y1 | 12 | ~7,200 | Phase 1 4 GB OK |
| Y2 | 36 | ~21,600 | SaaS → **8 GB** · `MAX_TAGS=65536` |
| Y3 | **60** | **~36,000** | Archive +50 GB · Mongo stays base |

### Edge fleet @ 60 campuses

| Resource | Per campus | Fleet total |
|----------|------------|-------------|
| MVP Suite RAM | 16 GB recommended | **~960 GB** |
| Local SSD (historian + cameras) | 256 GB | **~15.4 TB** |
| On-prem tag database | ~4,000 | **~240,000** |

### Coexistence with wastewater on same Phase 1 stack

If **one mooreVIEW Cloud** hosts **ALF 60 + wastewater 500 IoT-Link**:

| Load | ALF (60) | Wastewater (500) | Combined |
|------|----------|------------------|----------|
| MQTT connections | 60 | 532 | **~592** OK |
| Cloud tags | ~36,000 | ~7,000 | **~43,000** OK |
| Hot Mongo | ~1 GB | ~6.5 GB | **~7.5 GB** OK on 15 GB tier |
| SaaS RAM pressure | Low (rollup) | Moderate | Step **8 → 16 GB** if WW PdM ingest heavy |
| Dominant opex | Support labor | **Cellular ~$1,250/mo** | WW drives cell; ALF drives **support** |

**Recommendation:** ALF + WW on one Phase 1 tenant is **technically feasible** with rollup sync; **monitor SaaS RAM** when combined hot Mongo exceeds **10 GB** or WW fleet adds high-rate lift PdM.

---

## Part 6 — Go-to-market

| Phase | Campuses | Focus |
|-------|----------|-------|
| **Y1** | 12 | Reference campus · Purple Standard / FM partner · prove 55% margin on 2 pilots |
| **Y2** | 36 | Regional operator MSAs · **$110/asset** enterprise schedule |
| **Y3** | **60** | National portfolio · single Parc tenant · optional per-campus org (model C) |

**Sales line:** *Survey-ready every day — $110 per monitored asset, not per software seat.*

---

## Part 7 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Full tag mirror to cloud | **Enforce rollup site-agent sync** (model B) |
| Support cost erodes 55% margin | Cap assets/campus in contract; tier L2 at 110 assets |
| Edge appliance undersized | **16 GB / 256 GB** minimum; heavy vision = 512 GB |
| Long install cycle | Partner FM crews; template `assisted-living` clone |
| Clinical software confusion | Facilities/MEP only — not eMAR / nurse call |

---

## Appendix — assumptions

| Item | Value |
|------|-------|
| Campuses | 60 over 3 years (12 + 24 + 24) |
| Customer price | **$110 / billable asset / mo** |
| Assets / campus (avg) | **~110** |
| Tags / campus (technical) | **~4,000** on MVP Suite |
| Net profit target | **55%** of total revenue |
| OH | $3/device/mo Y1 blend · **7% of revenue Y2+** |
| Cloud sync | Rollup ~600 pens/campus |
| Phase 1 topology | NYC1 SaaS + MQTT + Archive + Mongo |
| List MSRP cross-check | Pricing Guide v2.4 standard campus **$12K + $833/mo** |

**Disclaimer:** Directional business plan for enterprise ALF portfolio modeling. Not a financial forecast, quote, or SLA.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `MooreVIEW-Pricing-Guide.md` | Living Campus list MSRP |
| `MooreVIEW-Infrastructure-Projections.md` | Part 10 ALF large-tag scaling |
| `MooreVIEW-Wastewater-Business-Plan.md` | OH policy · Phase 1 cost comparison |
| `MooreVIEW-Product-Market-Entry.md` | Portfolio context |
| `Phase1-SaaS-Architecture-Costs.md` | Phase 1 topology |
| `assisted-living` project pack | `data/projects/assisted-living.est.json` |

---

*ALF Business Plan v1.0 — mooreVIEW / The Purple Standard.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
