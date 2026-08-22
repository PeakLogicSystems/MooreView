# mooreVIEW — Multifamily / Apartment Business Plan

**Institutional MEP · small operator · 20 properties · ~1,500 assets/property · $110/asset · 55% net profit · 2026**

**Document version:** 1.0 · Run `npm run build:apartment-business-plan-pdf` for build date

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

---

## Executive summary

mooreVIEW **Living Property** targets **small regional multifamily operators** (boutique PM companies, family REITs, **8–25 garden/mid-rise communities**) with **~1,500 billable monitored assets per property** (unit leak/HVAC zones, boiler/chiller plant, garage exhaust, laundry, pool, fire pump, common-area RTUs, domestic water) — **MVP Suite on-prem** (~**4,500 technical tags/property**) and **Phase 1 Cloud SaaS** for portfolio fleet view via **site-agent rollup sync**.

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **New properties** | 4 | 8 | 8 |
| **Cumulative properties** | 4 | 12 | **20** |
| **Billable assets (EOY)** | ~6,000 | ~18,000 | **~30,000** |
| **Total revenue** | **~$2.3M** | **~$15.2M** | **~$31.0M** |
| **Total cost (45%)** | ~$1.0M | ~$6.8M | ~$14.0M |
| **Net profit (55%)** | **~$1.3M** | **~$8.4M** | **~$17.1M** |
| **End-of-year renewal ARR** | ~$7.9M | ~$23.8M | **~$39.6M** |

**Customer pricing:** **$110 / monitored asset / month** × **~1,500 assets** → **$165,000 / property / month** · **$165,000 one-time** commissioning per property.

**Target margin:** **55% net profit** (45% all-in cost: install COGS, cloud, **7% OH** Y2+, support, sales, platform).

**System impact @ 20 properties:** **~90,000 on-prem tags** · **~16,000 – 24,000 cloud rollup tags** · **Phase 1 OK** on single stack with `MOOREVIEW_MAX_TAGS=65536`. **Do not** full-mirror 4,500 tags/property into one tenant.

---

## Part 1 — Market & product

### Scope

| Layer | Role |
|-------|------|
| **Edge (each property)** | MVP Suite **Heavy** — **~4,500 tags**, **~1,500 billable assets**, cameras, 13 mo local historian |
| **Cloud (portfolio)** | SaaS :3100 — site agent, fleet map, **rollup** alarms (building/system — not every unit mirror) |
| **Project** | `multifamily` / Living Property `.est` (garden + mid-rise templates) |

### Asset vs tag

| | Count / property | Purpose |
|--|------------------|---------|
| **Billable asset** | **~1,500** | Contract unit ($110/mo) — unit leak nodes, PTAC/heat-pump zones, walk-in/mailroom, boiler, garage CO, pool, laundry |
| **Technical tag** | **~4,500** | MVP Suite TagStore (~3 tags/asset — state, alarm, trend pen) |
| **Cloud rollup pen** | **~800 – 1,200** | Portfolio dashboard — building/plant rollups only |

### Buyer — small operator profile

| Buyer | Scale |
|-------|-------|
| **Regional PM / owner-operator** | **8 – 25 properties** · **12K – 37K** billable assets at full fleet |
| **Boutique REIT / syndicate GP** | Single-tenant portfolio Parc · **model B rollup** sync |

*Contrast:* National multifamily (Greystar-class) is enterprise ALF-scale; this plan models **small operators** who still deploy **full-campus asset density** per community.

---

## Part 2 — Pricing model ($110 / asset × ~1,500)

### Property default (planning)

| Term | Value |
|------|-------|
| **Assets / property (avg)** | **~1,500** |
| **Rate** | **$110 / asset / mo** |
| **Property recurring** | **$165,000 / mo** |
| **Property one-time** | **$165,000** |
| **Tags / property (technical)** | **~4,500** on MVP Suite |

### Property profile mix (20-property fleet)

| Profile | Share | Units | Assets | Recurring/mo | One-time |
|---------|-------|-------|--------|--------------|----------|
| **Garden (2–3 story)** | 35% | ~180 | ~900 | $99,000 | $99,000 |
| **Mid-rise (4–8 story)** | 50% | ~280 | **~1,500** | **$165,000** | **$165,000** |
| **High-rise / mixed-use** | 15% | ~400+ | ~2,200 | $242,000 | $242,000 |
| **Fleet weighted avg** | 100% | ~280 | **~1,500** | **~$165,000** | **~$165,000** |

### Comparison to legacy spend

| Model | Per property / mo | Notes |
|-------|-------------------|-------|
| BMS + leak vendor + pool service (reactive) | **$8K – $25K** | Multiple vendors · no unified Parc |
| **mooreVIEW (1,500 × $110)** | **$165,000** | Full-property proactive MEP + CMMS + evidence |

*Positioning:* Replaces **emergency truck rolls, water-damage deductibles, and idle HVAC truck visits** — priced as **asset monitoring**, not rent per door.

---

## Part 3 — Cloud deployment & scaling path

```
Small operator (20 props) ──HTTPS──► SaaS :3100 (Phase 1)
                                         │
                       site agent × 20 (rollup ~800–1,200 pens each)
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
        Cloud rollup ~16K–24K tags                    MVP Suite Heavy × 20
        Mongo 15–50 GB                              ~4,500 tags · ~1,500 assets each
                 ▲                                               │
                 └──────── MQTT :8883 ───────────────────────────┘
```

| Stage | Properties | Cloud rollup tags | Infrastructure |
|-------|------------|-------------------|----------------|
| **Phase 1 OK** | 1 – 20 | **~16,000 – 24,000** | 4 – 8 GB SaaS · 15 GB Mongo · `MAX_TAGS=65536` |
| **Growth path** | 21 – 40 | ~34K – 48K | 8 GB SaaS · Mongo 50 GB |
| **Full mirror (avoid)** | 8+ | **>90,000** | Off Phase 1 — per-property tenant |

**Recommended sync:** **Model B** — rollup **~800 pens/property**. **Model C** — **per-property tenant** if operator requires unit-level cloud visibility for investors.

---

## Part 4 — Financial model (20 properties / 3 years)

### Ramp

**4 + 8 + 8 = 20 properties** over 3 years · **~1,500 assets each** · **$110/asset/mo**.

### Revenue

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| New properties | 4 | 8 | 8 |
| Cumulative (EOY) | 4 | 12 | 20 |
| New assets (approx.) | ~6,000 | ~12,000 | ~12,000 |
| **One-time ($165K × new)** | **$660K** | **$1.32M** | **$1.32M** |
| **Renewal (ramped property-months × $165K)** | **$1.65M** | **$13.86M** | **$29.70M** |
| **Total revenue** | **~$2.3M** | **~$15.2M** | **~$31.0M** |
| **Renewal ARR (EOY run-rate)** | ~$7.9M | ~$23.8M | **~$39.6M** |

*Y1 renewal: 10 property-months (1+2+3+4) × $165,000. Y2: 4 full-year + 8 ramped (84 property-months). Y3: 12 full-year + 8 ramped (180 property-months).*

### Cost structure (45% → **55% net profit**)

| Cost line | Y1 | Y2 | Y3 | Y3 % rev |
|-----------|-----|-----|-----|----------|
| Install hardware COGS (~35% of one-time) | $231K | $462K | $462K | 1.5% |
| Install labor (~$25K/property × new) | $100K | $200K | $200K | 0.6% |
| Cloud + cellular (Phase 1) | $25K | $75K | **$120K** | 0.4% |
| **Overhead (7% of revenue)** | $161K | $1.06M | **$2.17M** | 7.0% |
| Customer success & L2 (~11%) | $253K | $1.67M | **$3.41M** | 11.0% |
| Sales & commission (~8%) | $184K | $1.22M | **$2.48M** | 8.0% |
| Platform / R&D (~5%) | $115K | $760K | **$1.55M** | 5.0% |
| Warranty, spares, G&A (~5%) | $131K | $1.36M | **~2.81M** | ~9.1% |
| **Total cost** | **~$1.0M** | **~$6.8M** | **~$14.0M** | **~45%** |
| **Net profit (55%)** | **~$1.3M** | **~$8.4M** | **~$17.1M** | **~55%** |

### Per-property unit economics (Y3 steady state)

| | Per property / mo | Per property / yr |
|--|-------------------|-------------------|
| **Revenue** (1,500 × $110) | **$165,000** | **$1,980,000** |
| **Total cost (45%)** | $74,250 | $891,000 |
| **Net profit (55%)** | **$90,750** | **$1,089,000** |

### 3-year totals

| | Cumulative |
|--|------------|
| **Revenue** | **~$48.5M** |
| **Net profit (55%)** | **~$26.7M** |
| **Properties** | **20** |
| **Billable assets deployed** | **~30,000** |
| **On-prem tags** | **~90,000** |

---

## Part 5 — System impact @ 20 properties × ~1,500 assets

### Load summary

| Resource | Per property | **@ 20 properties** | Limit / action |
|----------|--------------|---------------------|----------------|
| **Billable assets** | ~1,500 | **~30,000** | Contract/pricing unit |
| **On-prem tags (MVP Suite)** | ~4,500 | **~90,000** | **Heavy appliance** 32 GB / 512 GB |
| **Cloud rollup tags** | ~800 – 1,200 | **~16K – 24K** | **Phase 1 OK** |
| **Full cloud mirror** | ~4,500 | **~90,000** | **Not on Phase 1** |
| **Site-agent MQTT** | 1 | **20** | OK on Phase 1 MQTT |
| **Cloud ingest (rollup)** | ~80 – 150 MB/mo | **~1.6 – 3 GB/mo** | Mongo 15 GB OK |
| **Hot Mongo (7 d)** | ~40 – 80 MB | **~0.8 – 1.6 GB** | OK |

### Edge fleet @ 20 properties (Heavy profile)

| Resource | Per property | Fleet total |
|----------|------------|-------------|
| MVP Suite RAM | **32 GB** | **~640 GB** |
| Local SSD | **512 GB** | **~10 TB** |
| Commissioning touchpoints | ~1,500 assets | **~30,000** |

### Cloud opex @ 20 properties (Phase 1)

| Line | Monthly (Y3) | Annual | % of $3.3M/mo renewal |
|------|--------------|--------|------------------------|
| SaaS **8 GB** | ~$48 | ~$576 | 0.001% |
| Mongo **15 – 50 GB** | ~$75 – 200 | ~$900 – 2.4K | 0.01% |
| MQTT + archive | ~$97 | ~$1,164 | 0.003% |
| Cellular — 20 site agents ($7) | $140 | $1,680 | 0.004% |
| **Total cloud/cell** | **~$360 – 485** | **~$4.3 – 5.8K** | **~0.01%** |

**Cloud remains ≪1% of renewal** — **edge hardware, leak-matrix install, and L2 support** dominate the 45% cost stack.

---

## Part 6 — Go-to-market

| Phase | Properties | Assets (cum.) | Focus |
|-------|------------|---------------|-------|
| **Y1** | 4 | ~6K | Pilot 1 garden + 1 mid-rise @ full 1,500 · prove 55% margin |
| **Y2** | 12 | ~18K | Regional MSA · FM partner install · portfolio Parc |
| **Y3** | **20** | **~30K** | Reference operator · expand to second small PM logo |

**Sales line:** *1,500 monitored assets per community — proactive MEP at **$110/asset**, not per-unit rent.*

---

## Part 7 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Operator expects **$/door** pricing | Contract on **monitored assets** — leak, HVAC, plant only |
| Renter turnover vs asset count | Assets are **infrastructure**, not leaseholds |
| Water-damage ROI narrative | Bundle leak matrix + CMMS evidence for insurance/carrier |
| Appliance undersized | **32 GB / 512 GB Heavy** minimum @ 1,500 assets |

---

## Appendix — assumptions

| Item | Value |
|------|-------|
| Properties | **20** over 3 years (**4 + 8 + 8**) — **small operator** |
| **Assets / property** | **~1,500** (billable) |
| **Tags / property** | **~4,500** (technical) |
| Customer price | **$110 / asset / mo** |
| Property recurring | **$165,000 / mo** |
| Net profit target | **55%** |
| OH | $3/device/mo Y1 · **7% of revenue Y2+** |
| Cloud sync | Rollup **~800 – 1,200 pens/property** |
| Edge profile | MVP Suite **Heavy** 32 GB / 512 GB |

**Disclaimer:** Directional model for small multifamily operators — not a forecast, quote, or SLA.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `MooreVIEW-ALF-Business-Plan.md` | Same metrics @ 60-campus enterprise scale |
| `MooreVIEW-Hotel-Motel-Business-Plan.md` | Hospitality small-operator parallel |
| `MooreVIEW-Infrastructure-Projections.md` | Part 11 multifamily / hospitality |
| `Phase1-SaaS-Architecture-Costs.md` | Phase 1 topology |

---

*Apartment Business Plan v1.0 — mooreVIEW / The Purple Standard.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
