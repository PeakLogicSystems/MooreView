# mooreVIEW — ALF / Living Campus Business Plan

**Institutional MEP · 60 campuses · ~1,500 assets/campus · $110/asset · 55% net profit · 2026**

**Document version:** 1.1 · Run `npm run build:alf-business-plan-pdf` for build date

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

---

## Executive summary

mooreVIEW **Living Campus** targets **multi-site ALF / assisted-living operators** with **~1,500 billable monitored assets per campus** (leak circuits, HVAC zones, cold chain, DHW, generator, pool/mechanical, room/floor rollups) — **MVP Suite on-prem** (~**4,500 technical tags/campus**) and **Phase 1 → Phase 2 Cloud SaaS** for portfolio fleet view via **site-agent rollup sync**.

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **New campuses** | 12 | 24 | 24 |
| **Cumulative campuses** | 12 | 36 | **60** |
| **Billable assets (EOY)** | ~18,000 | ~54,000 | **~90,000** |
| **Total revenue** | **~$14.9M** | **~$51.5M** | **~$99M** |
| **Total cost (45%)** | ~$6.7M | ~$23.2M | ~$44.6M |
| **Net profit (55%)** | **~$8.2M** | **~$28.3M** | **~$54.5M** |
| **End-of-year renewal ARR** | ~$23.8M | ~$71.3M | **~$118.8M** |

**Customer pricing:** **$110 / monitored asset / month** × **~1,500 assets** → **$165,000 / campus / month** · **$165,000 one-time** commissioning per campus.

**Target margin:** **55% net profit** (45% all-in cost: install COGS, cloud, **7% OH** Y2+, support at scale, sales, platform).

**System impact @ 60 campuses:** **~270,000 on-prem tags** · **~48,000 – 72,000 cloud rollup tags** · **Phase 1 exceeded at ~24+ campuses** — plan **tenant shard or Phase 2 SaaS (16 GB × 2)** + **Mongo 50 – 250 GB** before full 60. **Do not** full-mirror 4,500 tags/campus into one tenant.

---

## Part 1 — Market & product

### Scope

| Layer | Role |
|-------|------|
| **Edge (each campus)** | MVP Suite **Heavy** — **~4,500 tags**, **~1,500 billable assets**, cameras, 13 mo local historian |
| **Cloud (portfolio)** | SaaS :3100 — site agent, fleet map, **rollup** alarms (not 1:1 asset mirror) |
| **Project** | `assisted-living` / Living Campus `.est` (scaled template) |

### Asset vs tag

| | Count / campus | Purpose |
|--|----------------|---------|
| **Billable asset** | **~1,500** | Customer contract unit ($110/mo each) — leak nodes, RTU zones, walk-ins, genset, floor summaries |
| **Technical tag** | **~4,500** | MVP Suite TagStore (~3 tags/asset avg — state, alarm, trend pen) |
| **Cloud rollup pen** | **~800 – 1,200** | Fleet dashboard — building/system rollups only |

### Buyer

| Buyer | Scale |
|-------|-------|
| **Regional ALF operator** | 5–60 campuses · **750K – 4.5M** billable assets at full fleet |
| **PE-backed senior living** | Portfolio Parc · single operator tenant or **per-campus org** (model C) |

---

## Part 2 — Pricing model ($110 / asset × ~1,500)

### Fleet default (planning)

| Term | Value |
|------|-------|
| **Assets / campus (avg)** | **~1,500** |
| **Rate** | **$110 / asset / mo** |
| **Campus recurring** | **$165,000 / mo** |
| **Campus one-time** | **$165,000** |
| **Tags / campus (technical)** | **~4,500** on MVP Suite |

### Campus profile mix (60-site fleet)

| Profile | Share | Assets | Recurring/mo | One-time |
|---------|-------|--------|--------------|----------|
| **Small** (1 bldg) | 20% | ~900 | $99,000 | $99,000 |
| **Standard** (2–3 bldg) | 55% | **~1,500** | **$165,000** | **$165,000** |
| **Large** (4+ bldg) | 25% | ~2,200 | $242,000 | $242,000 |
| **Fleet weighted avg** | 100% | **~1,500** | **~$165,000** | **~$165,000** |

### Comparison to list MSRP

| Model | Per campus / mo | Notes |
|-------|-----------------|-------|
| Pricing Guide standard campus | $833 | Entry MSRP · few hundred I/O |
| **This plan (1,500 × $110)** | **$165,000** | Full-campus leak + MEP + cold + gen @ asset granularity |

---

## Part 3 — Cloud deployment & scaling path

```
Portfolio operator ──HTTPS──► SaaS :3100 (1–2 nodes @ scale)
                                  │
                    site agent × 60 (rollup ~800–1,200 pens each)
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
     Cloud rollup ~48K–72K tags              MVP Suite Heavy × 60
     Mongo 50–250 GB tier                     ~4,500 tags · ~1,500 assets each
              ▲                                       │
              └──────── MQTT :8883 ───────────────────┘
```

| Stage | Campuses | Cloud rollup tags | Infrastructure |
|-------|----------|-------------------|----------------|
| **Phase 1 OK** | 1 – 12 | ~14,400 | 4 GB SaaS · 15 GB Mongo · `MAX_TAGS=65536` |
| **Phase 1 stretch** | 13 – 24 | ~28,800 | 8 GB SaaS · archive expand |
| **Phase 2 required** | 25 – **60** | **~48,000 – 72,000** | **2× 16 GB SaaS** or **tenant shard** · **Mongo 50 – 250 GB** |
| **Full mirror (avoid)** | 18+ | **>270,000** | Off Phase 1 — VM split / per-campus tenant |

**Recommended sync:** **Model B** — rollup **~800 pens/campus** (not 1,500) for fleet alarms/trends. **Model C** — **per-campus tenant** (4,500 tags each) + partner portfolio UI if operator requires asset-level cloud visibility.

---

## Part 4 — Financial model (60 campuses / 3 years)

### Ramp

**12 + 24 + 24 = 60 campuses** over 3 years · **~1,500 assets each** · **$110/asset/mo**.

### Revenue

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| New campuses | 12 | 24 | 24 |
| Cumulative (EOY) | 12 | 36 | 60 |
| New assets (approx.) | ~18,000 | ~36,000 | ~36,000 |
| **One-time ($165K × new)** | **$1.98M** | **$3.96M** | **$3.96M** |
| **Renewal (ramped campus-months × $165K)** | **$12.87M** | **$47.52M** | **$95.04M** |
| **Total revenue** | **~$14.9M** | **~$51.5M** | **~$99M** |
| **Renewal ARR (EOY run-rate)** | ~$23.8M | ~$71.3M | **~$118.8M** |

*Y1 renewal: 78 campus-months (1+2+…+12) × $165,000. Y2: 12 full-year + 24 half-year campuses. Y3: 36 full-year + 24 half-year.*

### Cost structure (45% → **55% net profit**)

| Cost line | Y1 | Y2 | Y3 | Y3 % rev |
|-----------|-----|-----|-----|----------|
| Install hardware COGS (~35% of one-time) | $693K | $1.39M | $1.39M | 1.4% |
| Install labor (~$25K/campus × new) | $300K | $600K | $600K | 0.6% |
| Cloud + cellular (Phase 1 → 2) | $80K | $350K | **$650K** | 0.7% |
| **Overhead (7% of revenue)** | $1.04M | $3.60M | **$6.93M** | 7.0% |
| Customer success & L2 (~11%) | $1.64M | $5.66M | **$10.9M** | 11.0% |
| Sales & commission (~8%) | $1.19M | $4.12M | **$7.92M** | 8.0% |
| Platform / R&D (~5%) | $745K | $2.57M | **$4.95M** | 5.0% |
| Warranty, spares, G&A (~5%) | $1.20M | $4.96M | **~11.2M** | ~11.3% |
| **Total cost** | **~$6.7M** | **~$23.2M** | **~$44.6M** | **~45%** |
| **Net profit (55%)** | **~$8.2M** | **~$28.3M** | **~$54.5M** | **~55%** |

*Y1 also tracks **$3/device/mo OH** on billable assets during launch (~$351K embedded in support/OH blend). At 1,500 assets/campus, per-device Y1 OH ≈ **$4,500/mo/campus** at EOY — transitions to **7% of total revenue** in Y2+ per portfolio OH policy.*

### Per-campus unit economics (Y3 steady state)

| | Per campus / mo | Per campus / yr |
|--|-----------------|-----------------|
| **Revenue** (1,500 × $110) | **$165,000** | **$1,980,000** |
| **Total cost (45%)** | $74,250 | $891,000 |
| **Net profit (55%)** | **$90,750** | **$1,089,000** |

### 3-year totals

| | Cumulative |
|--|------------|
| **Revenue** | **~$165M** |
| **Net profit (55%)** | **~$91M** |
| **Campuses** | **60** |
| **Billable assets deployed** | **~90,000** |
| **On-prem tags** | **~270,000** |

---

## Part 5 — System impact @ 60 campuses × ~1,500 assets

### Load summary

| Resource | Per campus | **@ 60 campuses** | Limit / action |
|----------|------------|-------------------|----------------|
| **Billable assets** | ~1,500 | **~90,000** | Contract/pricing unit |
| **On-prem tags (MVP Suite)** | ~4,500 | **~270,000** | **Heavy appliance** 32 GB / 512 GB |
| **Cloud rollup tags** | ~800 – 1,200 | **~48K – 72K** | **Phase 2** · shard or `MAX_TAGS=131072` |
| **Full cloud mirror** | ~4,500 | **~270,000** | **Not on Phase 1** |
| **Site-agent MQTT** | 1 | **60** | OK on Phase 1 MQTT |
| **Cloud ingest (rollup)** | ~80 – 150 MB/mo | **~5 – 9 GB/mo** | Mongo tier step @ Y2 |
| **Hot Mongo (7 d)** | ~40 – 80 MB | **~2 – 5 GB** | OK → 50 GB tier Y2 |

### Edge fleet @ 60 campuses (Heavy profile)

| Resource | Per campus | Fleet total |
|----------|------------|-------------|
| MVP Suite RAM | **32 GB** | **~1.9 TB** |
| Local SSD | **512 GB** | **~30 TB** |
| On-prem tags | ~4,500 | **~270,000** |
| Commissioning touchpoints | ~1,500 assets | **~90,000** |

**Sizing rule:** At **~1,500 assets**, use **Heavy** MVP Suite (16 GB+ RAM, 512 GB SSD minimum; **32 GB** recommended for vision AI + 13 mo historian + full leak matrix).

### Cloud opex @ 60 campuses (Phase 2 planning)

| Line | Monthly (Y3) | Annual | % of $9.9M/mo renewal |
|------|--------------|--------|------------------------|
| SaaS **2× 16 GB** nodes | ~$160 | ~$1,920 | 0.002% |
| Mongo **50 – 250 GB** tier | ~$400 – 800 | ~$4.8 – 9.6K | 0.05% |
| MQTT + archive (Phase 1+) | ~$200 | ~$2,400 | 0.002% |
| Cellular — 60 site agents ($7) | $420 | $5,040 | 0.004% |
| **Total cloud/cell** | **~$1,200 – 1,600** | **~$14 – 19K** | **~0.02%** |

**Cloud remains <1% of renewal** even at 1,500 assets/campus — **edge hardware, install labor, and L2 support** dominate the 45% cost stack.

### Ramp — when Phase 1 breaks

| EOY year | Campuses | Assets | Cloud rollup tags | Action |
|----------|----------|--------|-------------------|--------|
| Y1 | 12 | ~18,000 | ~14,400 | Phase 1 · 8 GB SaaS |
| Y2 | 36 | ~54,000 | ~43,200 | **Mongo 50 GB** · evaluate shard |
| Y3 | **60** | **~90,000** | **~48K – 72K** | **Phase 2 SaaS** · partner tenant model if needed |

*At **~800 rollup pens/campus**, Phase 1 tag cap (**70,912**) is exceeded between **campus 24 – 30** — plan Phase 2 before Y2 end.*

### Coexistence with wastewater (500 devices) on shared cloud

| Load | ALF 60 (1,500 assets) | WW 500 | Combined |
|------|------------------------|--------|----------|
| Cloud tags (rollup) | ~48K – 72K | ~7K | **~55K – 79K** |
| Hot Mongo | ~2 – 5 GB | ~6.5 GB | **~8 – 12 GB** |
| MQTT | 60 | 532 | ~592 OK |
| **Verdict** | **Phase 2 required** | Phase 1 OK alone | **Dedicated ALF SaaS node** recommended |

---

## Part 6 — Go-to-market

| Phase | Campuses | Assets (cum.) | Focus |
|-------|----------|---------------|-------|
| **Y1** | 12 | ~18K | Pilot 2 campuses @ full 1,500 · prove 55% margin · Heavy appliance BOM |
| **Y2** | 36 | ~54K | Regional MSA · **$110/asset** schedule · Phase 2 cloud cutover |
| **Y3** | **60** | **~90K** | National portfolio · tenant shard · FM partner L2 bench |

**Sales line:** *1,500 monitored assets per campus — survey-ready MEP at **$110/asset**, not clinical per-resident pricing.*

---

## Part 7 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Phase 1 tag cap @ 24+ campuses | **Rollup-only** (~800 pens) or **per-campus tenant** |
| Support cost vs 55% margin | Tier L2 per **1,500 assets** in contract; FM partner delivery |
| Appliance undersized for 4,500 tags | **32 GB / 512 GB Heavy** minimum |
| 90K asset commissioning backlog | Phased floors · template clone · partner install crews |
| Confusion with eMAR / $/resident clinical pricing | Facilities/MEP assets only — separate SKU from clinical software |

---

## Appendix — assumptions

| Item | Value |
|------|-------|
| Campuses | 60 over 3 years (12 + 24 + 24) |
| **Assets / campus** | **~1,500** (billable) |
| **Tags / campus** | **~4,500** (technical, ~3 tags/asset) |
| Customer price | **$110 / asset / mo** |
| Campus recurring | **$165,000 / mo** |
| Net profit target | **55%** |
| OH | $3/device/mo Y1 · **7% of revenue Y2+** |
| Cloud sync | Rollup **~800 – 1,200 pens/campus** |
| Edge profile | MVP Suite **Heavy** 32 GB / 512 GB |

**Disclaimer:** Directional enterprise model — not a forecast, quote, or SLA.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `MooreVIEW-Infrastructure-Projections.md` | Part 10 ALF scaling |
| `MooreVIEW-Wastewater-Business-Plan.md` | OH policy · Phase 1 costs |
| `MooreVIEW-Pricing-Guide.md` | Living Campus MSRP |
| `Phase1-SaaS-Architecture-Costs.md` | Phase 1 topology |

---

*ALF Business Plan v1.1 — mooreVIEW / The Purple Standard.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
