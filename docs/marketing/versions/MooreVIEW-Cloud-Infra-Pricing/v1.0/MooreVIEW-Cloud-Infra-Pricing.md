# mooreVIEW — Cloud Infrastructure Pricing Model

**RAM, COGS, and subscription pricing guidance · 0–36 month plan**

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

**Document version:** 1.0 · Run `npm run build:cloud-infra-pricing-pdf` for build date

---

## Executive summary

This document translates the **vertical-shard cloud architecture** into **directional DigitalOcean COGS** and **subscription pricing guidance** for three planning periods: **0–12**, **12–24**, and **24–36 months**.

**Key finding:** Cloud infrastructure COGS is **$0.05–0.13 per site per month** at scale — **under 1% of list subscription MRR**. Pricing should **not** be driven by tag count or Mongo droplets. Hold **$18 / $25** field list prices; use **fleet tiers** and **ALF campus bands** from the Subscription Sell Sheet.

**Companion doc:** `docs/CLOUD_VERTICAL_SHARDS.md` (architecture and shard plumbing).

---

## 1. Fleet ramp (end-of-period)

Linear ramp to **~54K sites / 5M cloud tags @ M36**. **M18** matches the detailed planning fleet (~4,550 sites, ~415K tags).

| Metric | **M12** | **M18** | **M24** | **M36** |
|--------|--------:|--------:|--------:|--------:|
| Lift / septic / WWTP | 2,000 | 3,000 | 13,100 | 30,100 |
| Pools | 667 | 1,000 | 4,380 | 10,000 |
| C-store / grocery | 333 | 500 | 2,568 | 6,600 |
| ALF campus | 33 | 50 | 256 | 660 |
| **Total sites** | **3,033** | **4,550** | **21,304** | **54,360** |
| **Cloud tags** | **277K** | **415K** | **1.94M** | **5.0M** |

**Assumptions:** 5 min + exception reporting; ALF slim mirror (~400 cloud tags/campus); pools lift-like I/O (~85 tags/site).

---

## 2. Architecture snapshot by period

### 2.1 Period 1 — 0–12 months

| Component | M0–M6 | M6–M12 |
|-----------|-------|--------|
| SaaS | 1× 4 GB | LB + 2× 4 GB |
| Ingest | 1× 16 GB (field) | 1× 16 GB field + 1× 8 GB retail |
| MQTT | 1× 4 GB | 1× 4 GB |
| Mongo | entry tier | 4 GB RAM / ~80 GB disk |
| Archive | — | 128 GB block (from M6) |

### 2.2 Period 2 — 12–24 months

| Milestone | Ingest cells | Notes |
|-----------|-------------|-------|
| **M18** (~415K tags) | 2 (field 32 GB + retail 16 GB) | Detailed planning fleet |
| **M24** (~1.94M tags) | 6 vertical cells | 3× lift + pool + c-store + ALF |

### 2.3 Period 3 — 24–36 months

| Component | @ 5M tags |
|-----------|-----------|
| Ingest | 11 cells (6 lift + 2 pool + 2 c-store + 1 ALF) |
| MQTT | 2× 16 GB or EMQX HA |
| Mongo | 32–64 GB RAM tier, 400–600 GB disk |
| Archive | 1–2 TB |
| SaaS | 2–3× 4 GB + LB |

---

## 3. Monthly cloud COGS (DigitalOcean, directional)

| Line item | **M12** | **M18** | **M24** | **M36** |
|-----------|--------:|--------:|--------:|--------:|
| SaaS + LB | $60 | $60 | $60 | $84 |
| Ingest (vertical shards) | $144 | $288 | $912 | $1,632 |
| MQTT | $48 | $48 | $96 | $192 |
| Managed Mongo | $70 | $122 | $284 | $540 |
| Archive storage | $13 | $26 | $51 | $200 |
| Egress / misc | $20 | $30 | $75 | $150 |
| **Total COGS / mo** | **~$355** | **~$574** | **~$1,478** | **~$2,798** |

### Period averages (annual budget)

| Period | Avg sites | Avg COGS / mo | **Annual cloud spend** |
|--------|----------:|--------------:|-----------------------:|
| **0–12 mo** | ~1,500 | **~$220** | **~$2,600** |
| **12–24 mo** | ~12,500 | **~$900** | **~$10,800** |
| **24–36 mo** | ~38,000 | **~$2,100** | **~$25,200** |

*Directional only — confirm in DO pricing calculator before customer quotes.*

---

## 4. COGS per site

| Period end | Sites | COGS / mo | **COGS / site / mo** |
|------------|------:|----------:|---------------------:|
| M12 | 3,033 | $355 | **$0.12** |
| M18 | 4,550 | $574 | **$0.13** |
| M24 | 21,304 | $1,478 | **$0.07** |
| M36 | 54,360 | $2,798 | **$0.05** |

---

## 5. Fully loaded COGS (pricing floor)

| Add-on | Per site / mo | Notes |
|--------|--------------:|-------|
| Cellular (list pass-through) | **$3.00** | Subscription Sell Sheet |
| Cloud platform (above) | $0.05–0.13 | Shrinks with scale |
| Ops / monitoring (~15% cloud) | ~$0.01–0.02 | — |
| Support allocation | **$1.50–4.00** | Tier by vertical |
| **Loaded COGS — field site** | **~$5–8 / mo** | Lift, pool, c-store |
| **Loaded COGS — ALF campus** | **~$15–25 / mo** | Slim cloud; edge carries bulk |

---

## 6. Revenue vs COGS @ list prices

List prices from **MooreVIEW Subscription Sell Sheet v1.2**:

| Vertical | List subscription |
|----------|------------------:|
| Home ATU, pool, HVAC | **$18 / mo** |
| Business lift, ATU, pool, c-store, well | **$25 / mo** |
| ALF small / standard / large | **$417 / $833 / $2,083 / mo** |
| Cell data (optional) | **+$3 / mo** |

### Estimated MRR @ list (end-of-period)

| Period end | Est. MRR | Cloud COGS | COGS as % of MRR |
|------------|----------:|-----------:|-----------------:|
| **M12** | **~$100K / mo** | $355 | **0.4%** |
| **M18** | **~$150K / mo** | $574 | **0.4%** |
| **M24** | **~$696K / mo** | $1,478 | **0.2%** |
| **M36** | **~$1.67M / mo** | $2,798 | **0.2%** |

**Gross margin on cloud COGS alone:** ~99%.  
**After $5 loaded COGS on $25 subscription:** ~**80%** gross before field labor.

---

## 7. Pricing guidance by period

### 7.1 Field sites (lift, septic, ATU, pool, c-store)

| Period | Sites | Recommendation |
|--------|------:|----------------|
| **0–12 mo** | 0 → 3K | **Hold list** ($18 / $25). Max **10–15%** discount for ≥50-site fleet LOI. |
| **12–24 mo** | 3K → 21K | **Hold list**; introduce fleet tiers (below). |
| **24–36 mo** | 21K → 54K | Volume tiers; optional **+$2–5/mo** PdM/ONNX lift premium. |

### 7.2 Fleet discount tiers (subscription only)

| Customer cumulative sites | Discount | Floor (com $25 list) |
|--------------------------:|---------:|---------------------:|
| 1–49 | 0% | $25.00 |
| 50–199 | 10% | $22.50 |
| 200–999 | 15% | $21.25 |
| 1,000+ | 20% | $20.00 |

At **20% off** ($20) with **~$5 loaded COGS** → **~75% gross margin** remains.

### 7.3 ALF campus

| Tier | List / mo | Loaded COGS | Pricing floor |
|------|----------:|------------:|--------------:|
| Small | $417 | ~$20 | **$350** |
| Standard | $833 | ~$25 | **$700** |
| Large | $2,083 | ~$35 | **$1,750** |

**Do not discount ALF on cloud grounds** — appliance and commissioning dominate cost.

### 7.4 Multi-tenant platform fee (optional)

| Period | Model |
|--------|-------|
| **0–12 mo** | **$500/mo** platform min + per-site subscription |
| **12–24 mo** | **$1,500/mo** + $0.50/active device/mo (cap $5K) |
| **24–36 mo** | **$5K/mo** + $0.25/device/mo or rev-share |

---

## 8. Setup fees (one-time)

| Vertical | List setup | Cloud onboarding share |
|----------|----------:|------------------------:|
| Field (home) | $1,500 | < $50 |
| Field (business) | $2,500 | < $50 |
| ALF campus | $8,000 – $15,000 | < $200 |

**Hold setup fees** all three periods — hardware and labor drive cost, not cloud.

---

## 9. Period summary card

| | **0–12 months** | **12–24 months** | **24–36 months** |
|--|-----------------|------------------|------------------|
| **End sites** | ~3,000 | ~21,000 | ~54,000 |
| **End cloud tags** | ~277K | ~1.94M | ~5M |
| **Ingest shards** | 1 → 2 | 2 → 6 | 11 |
| **Monthly cloud COGS** | ~$355 | ~$574 → $1,478 | ~$2,798 |
| **COGS / site** | ~$0.12 | ~$0.07–0.13 | ~$0.05 |
| **List MRR potential** | ~$100K | ~$150K → $696K | ~$1.67M |
| **Pricing stance** | Hold list | Fleet tiers | Volume + platform fee |
| **Binding cost** | Cell + install | + shard ops | MQTT HA + Mongo tier |

---

## 10. CFO one-liner

> **Year 1 cloud spend ~$2.6K · Year 2 ~$11K · Year 3 ~$25K** — immaterial vs subscription revenue at list. Price for **cellular, support, and edge**; use cloud COGS only to validate fleet discounts stay above **~75% gross**.

---

## Appendix — Sources

| Item | Source |
|------|--------|
| Vertical shard architecture | `docs/CLOUD_VERTICAL_SHARDS.md` |
| List subscription prices | `docs/marketing/MooreVIEW-Subscription-Sell-Sheet.md` v1.2 |
| Archive pipeline | `docs/ARCHIVE_EXPORT.md` |
| DO deploy runbook | `docs/CLOUD_DEPLOY_DO.md` |
| Fleet historian interval | 300 s (5 min) — match report cadence |

**Disclaimer:** Directional planning document for capacity and pricing discussion. Not a financial forecast, customer quote, or SLA commitment.

---

*Cloud Infrastructure Pricing v1.0 — mooreVIEW marketing / platform planning.*

*© Purple Standard Holdings.*
