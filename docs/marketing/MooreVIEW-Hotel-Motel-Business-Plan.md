# mooreVIEW — Hotel / Motel Business Plan

**Institutional MEP · small operator · 12 properties · ~1,500 assets/property · $110/asset · 55% net profit · 2026**

**Document version:** 1.0 · Run `npm run build:hotel-motel-business-plan-pdf` for build date

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

---

## Executive summary

mooreVIEW **Living Hospitality** targets **small regional hotel and motel operators** (family chains, franchisee groups, **6–15 properties**) with **~1,500 billable monitored assets per property** (guest-room HVAC zones, kitchen walk-ins, laundry, pool/spa, boiler/DHW, genset, ice machines, elevator, back-of-house MEP) — **MVP Suite on-prem** (~**4,500 technical tags/property**) and **Phase 1 Cloud SaaS** for portfolio fleet view via **site-agent rollup sync**.

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **New properties** | 2 | 5 | 5 |
| **Cumulative properties** | 2 | 7 | **12** |
| **Billable assets (EOY)** | ~3,000 | ~10,500 | **~18,000** |
| **Total revenue** | **~$825K** | **~$7.3M** | **~$17.2M** |
| **Total cost (45%)** | ~$371K | ~$3.3M | ~$7.7M |
| **Net profit (55%)** | **~$454K** | **~$4.0M** | **~$9.5M** |
| **End-of-year renewal ARR** | ~$4.0M | ~$13.9M | **~$23.8M** |

**Customer pricing:** **$110 / monitored asset / month** × **~1,500 assets** → **$165,000 / property / month** · **$165,000 one-time** commissioning per property.

**Target margin:** **55% net profit** (45% all-in cost: install COGS, cloud, **7% OH** Y2+, support, sales, platform).

**System impact @ 12 properties:** **~54,000 on-prem tags** · **~9,600 – 14,400 cloud rollup tags** · **Phase 1 OK** on single stack. **Do not** full-mirror 4,500 tags/property into one tenant.

---

## Part 1 — Market & product

### Scope

| Layer | Role |
|-------|------|
| **Edge (each property)** | MVP Suite **Heavy** — **~4,500 tags**, **~1,500 billable assets**, cameras, 13 mo local historian |
| **Cloud (portfolio)** | SaaS :3100 — site agent, fleet map, **rollup** alarms (property/system — not every guest room mirror) |
| **Project** | `hospitality` / Living Hospitality `.est` (select-service + extended-stay templates) |

### Asset vs tag

| | Count / property | Purpose |
|--|------------------|---------|
| **Billable asset** | **~1,500** | Contract unit ($110/mo) — PTAC/VTAC zones, walk-ins, boiler, laundry extract, pool, genset, ice, elevator summary |
| **Technical tag** | **~4,500** | MVP Suite TagStore (~3 tags/asset) |
| **Cloud rollup pen** | **~800 – 1,200** | Portfolio dashboard — building/plant rollups only |

### Buyer — small operator profile

| Buyer | Scale |
|-------|-------|
| **Regional hotel/motel owner** | **6 – 15 properties** · **9K – 22K** billable assets at full fleet |
| **Franchisee (2–3 brands)** | Single tenant · **model B rollup** · brand-mandated PM evidence |

*Note:* Select-service and full-service properties at **~1,500 assets**; economy motels in fleet mix may run **~900 assets** at **$99K/mo** — weighted fleet still plans at **~1,500** for mid-scale properties.

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

### Property profile mix (12-property fleet)

| Profile | Share | Keys | Assets | Recurring/mo | One-time |
|---------|-------|------|--------|--------------|----------|
| **Economy motel** (1–2 story) | 40% | ~60 | ~900 | $99,000 | $99,000 |
| **Select-service hotel** | 45% | ~120 | **~1,500** | **$165,000** | **$165,000** |
| **Full-service / resort** | 15% | ~200+ | ~2,200 | $242,000 | $242,000 |
| **Fleet weighted avg** | 100% | ~110 | **~1,500** | **~$165,000** | **~$165,000** |

### Comparison to legacy spend

| Model | Per property / mo | Notes |
|-------|-------------------|-------|
| BMS + kitchen PM + pool vendor (reactive) | **$6K – $18K** | Guest-event driven truck rolls |
| **mooreVIEW (1,500 × $110)** | **$165,000** | Full-property proactive MEP + CMMS + brand audit trail |

*Positioning:* Avoids **guest comfort events, walk-in failures, and pool health-department hits** — priced as **asset monitoring**, not per-key franchise fees.

---

## Part 3 — Cloud deployment & scaling path

```
Small operator (12 props) ──HTTPS──► SaaS :3100 (Phase 1)
                                        │
                      site agent × 12 (rollup ~800–1,200 pens each)
                                        │
                ┌───────────────────────┴───────────────────────┐
                ▼                                               ▼
       Cloud rollup ~9.6K–14.4K tags                  MVP Suite Heavy × 12
       Mongo 15 GB                                    ~4,500 tags · ~1,500 assets each
                ▲                                               │
                └──────── MQTT :8883 ───────────────────────────┘
```

| Stage | Properties | Cloud rollup tags | Infrastructure |
|-------|------------|-------------------|----------------|
| **Phase 1 OK** | 1 – 12 | **~9,600 – 14,400** | 4 GB SaaS · 15 GB Mongo · `MAX_TAGS=65536` |
| **Growth path** | 13 – 25 | ~20K – 30K | 8 GB SaaS |
| **Full mirror (avoid)** | 5+ | **>54,000** | Off Phase 1 — per-property tenant |

**Recommended sync:** **Model B** — rollup **~800 pens/property**. **Model C** — **per-property tenant** for multi-brand franchisee orgs.

---

## Part 4 — Financial model (12 properties / 3 years)

### Ramp

**2 + 5 + 5 = 12 properties** over 3 years · **~1,500 assets each** · **$110/asset/mo**.

### Revenue

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| New properties | 2 | 5 | 5 |
| Cumulative (EOY) | 2 | 7 | 12 |
| New assets (approx.) | ~3,000 | ~7,500 | ~7,500 |
| **One-time ($165K × new)** | **$330K** | **$825K** | **$825K** |
| **Renewal (ramped property-months × $165K)** | **$495K** | **$6.44M** | **$16.34M** |
| **Total revenue** | **~$825K** | **~$7.3M** | **~$17.2M** |
| **Renewal ARR (EOY run-rate)** | ~$4.0M | ~$13.9M | **~$23.8M** |

*Y1 renewal: 3 property-months (1+2) × $165,000. Y2: 2 full-year + 5 ramped (39 property-months). Y3: 7 full-year + 5 ramped (99 property-months).*

### Cost structure (45% → **55% net profit**)

| Cost line | Y1 | Y2 | Y3 | Y3 % rev |
|-----------|-----|-----|-----|----------|
| Install hardware COGS (~35% of one-time) | $116K | $289K | $289K | 1.7% |
| Install labor (~$25K/property × new) | $50K | $125K | $125K | 0.7% |
| Cloud + cellular (Phase 1) | $15K | $45K | **$70K** | 0.4% |
| **Overhead (7% of revenue)** | $58K | $511K | **$1.20M** | 7.0% |
| Customer success & L2 (~11%) | $91K | $803K | **$1.89M** | 11.0% |
| Sales & commission (~8%) | $66K | $584K | **$1.38M** | 8.0% |
| Platform / R&D (~5%) | $41K | $365K | **$860K** | 5.0% |
| Warranty, spares, G&A (~5%) | $44K | $553K | **~1.59M** | ~9.2% |
| **Total cost** | **~$371K** | **~$3.3M** | **~$7.7M** | **~45%** |
| **Net profit (55%)** | **~$454K** | **~$4.0M** | **~$9.5M** | **~55%** |

### Per-property unit economics (Y3 steady state)

| | Per property / mo | Per property / yr |
|--|-------------------|-------------------|
| **Revenue** (1,500 × $110) | **$165,000** | **$1,980,000** |
| **Total cost (45%)** | $74,250 | $891,000 |
| **Net profit (55%)** | **$90,750** | **$1,089,000** |

### 3-year totals

| | Cumulative |
|--|------------|
| **Revenue** | **~$25.2M** |
| **Net profit (55%)** | **~$13.9M** |
| **Properties** | **12** |
| **Billable assets deployed** | **~18,000** |
| **On-prem tags** | **~54,000** |

---

## Part 5 — System impact @ 12 properties × ~1,500 assets

### Load summary

| Resource | Per property | **@ 12 properties** | Limit / action |
|----------|--------------|---------------------|----------------|
| **Billable assets** | ~1,500 | **~18,000** | Contract/pricing unit |
| **On-prem tags (MVP Suite)** | ~4,500 | **~54,000** | **Heavy appliance** 32 GB / 512 GB |
| **Cloud rollup tags** | ~800 – 1,200 | **~9.6K – 14.4K** | **Phase 1 OK** |
| **Full cloud mirror** | ~4,500 | **~54,000** | **Not on Phase 1** |
| **Site-agent MQTT** | 1 | **12** | OK on Phase 1 MQTT |
| **Cloud ingest (rollup)** | ~80 – 150 MB/mo | **~1 – 1.8 GB/mo** | Mongo 15 GB OK |
| **Hot Mongo (7 d)** | ~40 – 80 MB | **~0.5 – 1 GB** | OK |

### Edge fleet @ 12 properties (Heavy profile)

| Resource | Per property | Fleet total |
|----------|------------|-------------|
| MVP Suite RAM | **32 GB** | **~384 GB** |
| Local SSD | **512 GB** | **~6 TB** |
| Commissioning touchpoints | ~1,500 assets | **~18,000** |

### Cloud opex @ 12 properties (Phase 1)

| Line | Monthly (Y3) | Annual | % of $1.98M/mo renewal |
|------|--------------|--------|-------------------------|
| SaaS **4 – 8 GB** | ~$24 – 48 | ~$288 – 576 | 0.002% |
| Mongo **15 GB** | ~$75 | ~$900 | 0.004% |
| MQTT + archive | ~$97 | ~$1,164 | 0.005% |
| Cellular — 12 site agents ($7) | $84 | $1,008 | 0.004% |
| **Total cloud/cell** | **~$280 – 304** | **~$3.4 – 3.6K** | **~0.015%** |

**Cloud remains ≪1% of renewal** — **kitchen cold chain, guest-room HVAC matrix, and L2 support** dominate the 45% cost stack.

---

## Part 6 — Go-to-market

| Phase | Properties | Assets (cum.) | Focus |
|-------|------------|---------------|-------|
| **Y1** | 2 | ~3K | Pilot 1 select-service + 1 motel · prove 55% margin |
| **Y2** | 7 | ~10.5K | Regional MSA · brand PM compliance export |
| **Y3** | **12** | **~18K** | Second operator logo · franchisee reference |

**Sales line:** *1,500 monitored assets per property — proactive MEP at **$110/asset**, not per-key PMS pricing.*

---

## Part 7 — Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Franchise brand IT friction | **Model C** per-property tenant + partner portfolio view |
| Guest comfort vs asset scope | Contract covers **MEP assets** — not PMS or door locks |
| Motel asset count lower than 1,500 | Profile mix table · economy tier at **~900 assets** |
| Seasonal occupancy | Assets are **always-on plant** — not occupancy-metered |

---

## Appendix — assumptions

| Item | Value |
|------|-------|
| Properties | **12** over 3 years (**2 + 5 + 5**) — **small operator** |
| **Assets / property** | **~1,500** (billable; motels ~900 in mix) |
| **Tags / property** | **~4,500** (technical) |
| Customer price | **$110 / asset / mo** |
| Property recurring | **$165,000 / mo** |
| Net profit target | **55%** |
| OH | $3/device/mo Y1 · **7% of revenue Y2+** |
| Cloud sync | Rollup **~800 – 1,200 pens/property** |
| Edge profile | MVP Suite **Heavy** 32 GB / 512 GB |

**Disclaimer:** Directional model for small hospitality operators — not a forecast, quote, or SLA.

---

## Related documents

| Document | Purpose |
|----------|---------|
| `MooreVIEW-ALF-Business-Plan.md` | Same metrics @ 60-campus enterprise scale |
| `MooreVIEW-Apartment-Business-Plan.md` | Multifamily small-operator parallel |
| `MooreVIEW-Infrastructure-Projections.md` | Part 11 multifamily / hospitality |
| `Phase1-SaaS-Architecture-Costs.md` | Phase 1 topology |

---

*Hotel / Motel Business Plan v1.0 — mooreVIEW / The Purple Standard.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
