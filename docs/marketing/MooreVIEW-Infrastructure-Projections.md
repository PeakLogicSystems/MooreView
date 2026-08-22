# mooreVIEW — Infrastructure Projections by Market Segment

**RAM, storage, and deployment topology · 5-year directional model**

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

**Document version:** 1.0 · Run `npm run build:infrastructure-projections-pdf` for build date

---

## Executive summary

This document translates the mooreVIEW **portfolio growth model** (237 → ~5,300 cumulative sites over five years) into **relative infrastructure load** by marketplace vertical. Numbers are **directional planning estimates** — not audited forecasts or hardware BOMs.

Two deployment archetypes drive the split:

| Archetype | Primary edge | Cloud role | Typical verticals |
|-----------|--------------|------------|-------------------|
| **Cloud-centric route** | IoT-Link cellular gateway (light edge) | Hot historian (7 d), fleet Parc, zstd archive, SaaS Studio | Lift, ATU, pool, HVAC, wells, c-store |
| **Distributed appliance + cloud** | MVP Suite PC per campus (heavy edge) | Fleet dashboard, site agents, portfolio CMMS, remote cameras | Institutional / ALF Living Campus |

**Key insight:** HVAC, lift stations, pools, and distributed wastewater sites push **85–95% of telemetry and archive growth to cloud**. ALF campuses invert the pattern — **most RAM and local storage stay on-site**, with cloud carrying aggregated fleet visibility and compliance rollups.

**Portfolio 5-year ARR ceiling** (marketing): **$50 – 120M** at national scale (~167K–400K sites) — a separate **ceiling scenario** requiring horizontal scale-out beyond the Y1–Y5 plan curve documented here.

---

## Part 1 — Growth baseline (all segments)

*Source: Product Market Entry v1.4, Pricing Guide v2.4 — directional site targets.*

### Portfolio site trajectory

| Year | New sites | Cumulative sites | End-of-year ARR | Total revenue |
|------|-----------|------------------|-----------------|---------------|
| **1** | 237 | **237** | ~$99K | ~$570K |
| **2** | 450 | **687** | ~$320K | ~$1.5M |
| **3** | 800 | **1,487** | ~$780K | ~$3.5M |
| **4** | ~1,400 *(extrapolated)* | **~2,900** | ~$1.4M *(est.)* | ~$6M *(est.)* |
| **5** | ~2,400 *(extrapolated)* | **~5,300** | ~$2.5M *(est.)* | ~$10M *(est.)* |

*Years 4–5 extrapolate the Y1–Y3 install ramp (~1.7× new sites/year). Not published in marketing collateral.*

### Year-1 site mix by vertical (launch model)

| # | Vertical | Tier | Y1 sites | Share of fleet |
|---|----------|------|----------|----------------|
| 1 | **Lift stations** | Commercial | 20 | 8.4% |
| 2 | **ATU — residential** | Residential | 50 | 21.1% |
| 3 | **ATU — commercial** | Commercial | 25 | 10.5% |
| 4 | **Pool — residential** | Residential | 30 | 12.7% |
| 5 | **Pool — commercial** | Commercial | 15 | 6.3% |
| 6 | **HVAC — residential** | Residential | 40 | 16.9% |
| 7 | **HVAC — commercial** | Commercial | 30 | 12.7% |
| 8 | **Convenience store / cold chain** | Commercial | 10 | 4.2% |
| 9 | **Wells & pumps** | Commercial | 15 | 6.3% |
| 10 | **Institutional / ALF campus** | Enterprise | 2 | 0.8% |
| | **Total** | | **237** | **100%** |

*Segment counts for Y2–Y5 scale proportionally from Y1 mix unless noted (ALF grows slower in early years, faster in Y4–Y5 as enterprise references land).*

### Segment cumulative sites (proportional model)

| Vertical | Y1 | Y3 | Y5 |
|----------|-----|------|------|
| Lift stations | 20 | 125 | 451 |
| ATU (res + com) | 75 | 471 | 1,690 |
| Pool (res + com) | 45 | 282 | 1,014 |
| HVAC (res + com) | 70 | 439 | 1,577 |
| Convenience store | 10 | 63 | 226 |
| Wells & pumps | 15 | 94 | 338 |
| ALF / campus | 2 | 13 | 42 |
| **Portfolio total** | **237** | **1,487** | **~5,300** |

---

## Part 2 — Deployment archetypes (relative terms)

### Cloud-centric route (distributed assets)

**Verticals:** Lift stations · ATU / septic · Pools · HVAC · Wells · Convenience store / refrigeration

| Layer | Relative role | Typical hardware |
|-------|---------------|------------------|
| **Edge** | Alarm logic, local I/O, cellular uplink, short spool | Compulab **IoT-Link** (2–4 GB RAM, 32–64 GB storage) |
| **Cloud hot** | 7-day Mongo telemetry, fleet Parc, SaaS Studio | DO Managed Mongo + SaaS droplet(s) |
| **Cloud archive** | zstd JSONL blobs, 3–10 yr retention | Archive server (no Mongo) |

**Relative load split (per monitored asset):**

| Resource | Edge share | Cloud share |
|----------|------------|-------------|
| **RAM (ongoing)** | **15–25%** | **75–85%** |
| **Storage (steady state)** | **10–20%** | **80–90%** |
| **Telemetry volume** | Spool + config only | **~100%** of historian after uplink |

*Field buses (Modbus, serial, subnet) stay on edge; cloud never runs LAN discovery.*

### Distributed appliance + cloud (campus)

**Verticals:** Institutional / ALF Living Campus

| Layer | Relative role | Typical hardware |
|-------|---------------|------------------|
| **Edge (campus)** | Full Studio, LAN I/O, cameras, local historian, CMMS evidence, ONNX optional | **MVP Suite** PC (8–16 GB RAM, 128–256 GB SSD) per campus |
| **Cloud** | Multi-building fleet view, site agents, remote operator UI, portfolio Parc | SaaS :3100 + site pairing |
| **Cloud archive** | Campus rollups + selected uplinked tags | Lower per-building than cloud-centric |

**Relative load split (per campus — multi-building):**

| Resource | Edge (appliance) share | Cloud share |
|----------|------------------------|-------------|
| **RAM (ongoing)** | **55–70%** | **30–45%** |
| **Storage (steady state)** | **60–75%** | **25–40%** |
| **Telemetry volume** | **50–65%** local historian | **35–50%** uplinked rollups |

*ALF bundles pool, kitchen cold, generator, DHW, leak detection — high local I/O and camera load stays on appliance.*

---

## Part 3 — Segment profiles (relative indexes)

*Index **1.0** = one commercial HVAC site (IoT-Link + cloud uplink). Higher = more resource-intensive.*

### Edge RAM index (appliance / gateway)

| Vertical | Edge profile | RAM index | Notes |
|----------|--------------|-----------|-------|
| Lift stations | IoT-Link + Opta MQTT | **0.4** | Cellular; ST on Opta firmware |
| ATU — residential | IoT-Link | **0.3** | Minimal I/O |
| ATU — commercial | IoT-Link | **0.5** | Blower/UV/pump tags |
| Pool — residential | IoT-Link | **0.4** | RS-485 pump/chemistry |
| Pool — commercial | IoT-Link | **0.6** | Dual bus, more tags |
| HVAC — residential | IoT-Link | **0.3** | Thermostat / RTU gateway |
| HVAC — commercial | IoT-Link | **0.5** | Multi-RTU Modbus |
| Convenience store | IoT-Link | **0.5** | Cold chain + RTU |
| Wells & pumps | IoT-Link | **0.3** | Yield/dry-run only |
| **ALF / campus** | **MVP Suite × 1–2** | **6.0 – 10.0** | Full campus stack per site |

### Cloud RAM index (fleet + hot ingest per asset)

| Vertical | Cloud centrality | Cloud RAM index | Notes |
|----------|------------------|-----------------|-------|
| Lift stations | ●●●●● | **1.3** | High sample rate, PdM features |
| ATU — residential | ●●●●○ | **0.9** | Compliance route, moderate pens |
| ATU — commercial | ●●●●● | **1.2** | More assets per site |
| Pool — residential | ●●●●○ | **1.0** | Seasonal; chemistry trends |
| Pool — commercial | ●●●●● | **1.2** | Schedule + health compliance |
| HVAC — residential | ●●●●● | **1.0** | Largest volume vertical |
| HVAC — commercial | ●●●●○ | **1.1** | Runtime/amp anomaly features |
| Convenience store | ●●●●● | **1.4** | Cold chain — product-loss sensitivity |
| Wells & pumps | ●●●●● | **0.8** | Sparse telemetry |
| **ALF / campus** | ●●●○○ | **0.7** | Aggregated; less per-tag cloud |

**Cloud centrality key:** ●●●●● = 85–95% of asset telemetry in cloud · ●●●○○ = 35–50%

### Edge storage index (local disk, steady state)

| Vertical | Edge storage index | Retention pattern |
|----------|-------------------|-------------------|
| Lift stations | **0.3** | Config + 24–48 h spool |
| ATU (res/com) | **0.2 – 0.4** | Compliance buffer local |
| Pool (res/com) | **0.3 – 0.5** | Mechanical room logs |
| HVAC (res/com) | **0.2 – 0.3** | Minimal local |
| Convenience store | **0.4** | Slightly higher event log |
| Wells & pumps | **0.2** | Minimal |
| **ALF / campus** | **5.0 – 8.0** | Cameras, 13+ mo historian, evidence |

### Cloud storage index (hot 7 d + archive per asset)

| Vertical | Hot Mongo (7 d) | Archive (annual) | Cloud storage index |
|----------|-----------------|------------------|---------------------|
| Lift stations | High | High (PdM) | **1.4** |
| ATU — residential | Medium | Medium | **1.0** |
| ATU — commercial | Medium-high | Medium-high | **1.2** |
| Pool — residential | Medium | Medium | **1.0** |
| Pool — commercial | Medium-high | Medium-high | **1.2** |
| HVAC — residential | Medium | Medium | **0.9** |
| HVAC — commercial | Medium-high | Medium-high | **1.1** |
| Convenience store | High | High | **1.5** |
| Wells & pumps | Low | Low | **0.7** |
| **ALF / campus** | Low (rollup) | Medium (compliance) | **0.6** |

*Default historian sample interval: **5 s** (`MONGODB_SAMPLE_MS`). Archive compaction at day 7 → zstd on archive server.*

---

## Part 4 — Portfolio resource mix by year (relative)

*Percent of total portfolio **cloud** RAM and storage load by vertical. Based on (sites × segment index) / portfolio sum.*

### Cloud RAM load share (% of portfolio)

| Vertical | Y1 | Y3 | Y5 |
|----------|-----|------|------|
| Lift stations | 9% | 11% | 12% |
| ATU (res + com) | 22% | 21% | 20% |
| Pool (res + com) | 14% | 14% | 14% |
| **HVAC (res + com)** | **20%** | **21%** | **22%** |
| Convenience store | 6% | 7% | 8% |
| Wells & pumps | 5% | 4% | 4% |
| **ALF / campus** | **2%** | **3%** | **4%** |
| *Cloud-centric subtotal* | *98%* | *97%* | *96%* |

### Cloud storage load share (% of portfolio)

| Vertical | Y1 | Y3 | Y5 |
|----------|-----|------|------|
| Lift stations | 10% | 12% | 13% |
| ATU (res + com) | 21% | 20% | 19% |
| Pool (res + com) | 14% | 14% | 14% |
| **HVAC (res + com)** | **19%** | **20%** | **21%** |
| **Convenience store** | **6%** | **8%** | **9%** |
| Wells & pumps | 4% | 4% | 4% |
| **ALF / campus** | **2%** | **3%** | **5%** |
| *Cloud-centric subtotal* | *98%* | *97%* | *95%* |

### Edge (appliance/gateway) storage load share (% of portfolio)

| Vertical | Y1 | Y3 | Y5 |
|----------|-----|------|------|
| Lift stations | 8% | 7% | 6% |
| ATU (res + com) | 18% | 16% | 14% |
| Pool (res + com) | 12% | 11% | 10% |
| HVAC (res + com) | 16% | 14% | 12% |
| Convenience store | 5% | 5% | 5% |
| Wells & pumps | 6% | 5% | 4% |
| **ALF / campus** | **35%** | **42%** | **49%** |

*Despite low site count (0.8% → 0.8% of sites), ALF drives **~35–49% of edge storage** by Y5 due to cameras, extended historian, and compliance evidence on MVP Suite.*

---

## Part 5 — Absolute planning estimates (portfolio totals)

*Mid-range assumptions: ~6 historian pens per cloud-centric site, 5 s sample, 7 d hot Mongo, zstd archive ~3 MB/day/site compressed.*

### Cloud infrastructure (portfolio aggregate)

| Year | Cumulative sites | Hot Mongo (7 d) | New archive / yr | Cumulative archive | SaaS compute |
|------|------------------|-----------------|------------------|--------------------|--------------|
| **Y1** | 237 | **15 – 60 GB** | **0.3 – 0.7 TB** | **0.3 – 0.7 TB** | 1× **4 GB** droplet |
| **Y2** | 687 | **45 – 175 GB** | **0.8 – 2.0 TB** | **1 – 2.5 TB** | 1–2× **4–8 GB** |
| **Y3** | 1,487 | **100 – 375 GB** | **1.6 – 4.3 TB** | **3 – 8 TB** | 2× **8 GB** + archive **1–2 TB** |
| **Y4** | ~2,900 | **200 – 725 GB** | **3 – 8 TB** | **8 – 20 TB** | 2–3× **8–16 GB** |
| **Y5** | ~5,300 | **350 GB – 1.3 TB** | **6 – 15 TB** | **15 – 40 TB** | 3–5× **8–16 GB** nodes |

**Managed MongoDB tier (directional):** 10 GB (Y1) → 50 GB (Y2) → 250 GB (Y3) → 500 GB–1 TB (Y5).

### Edge infrastructure (portfolio aggregate)

| Year | IoT-Link gateways | MVP Suite (ALF) | Edge RAM (fleet) | Edge storage (fleet) |
|------|-------------------|-----------------|------------------|----------------------|
| **Y1** | ~235 | ~2 campuses | ~**0.5 TB·GB*** | ~**0.5 – 1 TB** |
| **Y3** | ~1,474 | ~13 campuses | ~**3 TB·GB** | ~**4 – 8 TB** |
| **Y5** | ~5,258 | ~42 campuses | ~**11 TB·GB** | ~**18 – 35 TB** |

*\*RAM×devices shorthand: e.g. 235 gateways × ~2 GB ≈ 470 GB aggregate edge RAM.*

### Segment contribution to Y5 cloud hot storage (relative)

```
HVAC ████████████████████░░  21%
Lift ████████████░░░░░░░░░░  13%
ATU  █████████████████░░░░░  19%
Pool ██████████████░░░░░░░░  14%
C-store █████████░░░░░░░░░░░   9%
Wells ████░░░░░░░░░░░░░░░░░░   4%
ALF   ███░░░░░░░░░░░░░░░░░░░   5%
Other/cloud overhead █████░░   15%
```

---

## Part 6 — Infrastructure by deployment model (summary matrix)

| Vertical | Model | Edge unit | Edge RAM | Edge storage | Cloud centrality | Y5 sites (est.) |
|----------|-------|-----------|----------|--------------|------------------|-----------------|
| **Lift stations** | Cloud-centric | IoT-Link | 2–4 GB | 32–64 GB | **90%** | ~451 |
| **ATU / septic** | Cloud-centric | IoT-Link | 2–4 GB | 32–64 GB | **85%** | ~1,690 |
| **Pool** | Cloud-centric | IoT-Link | 2–4 GB | 32–128 GB | **85%** | ~1,014 |
| **HVAC** | Cloud-centric | IoT-Link | 2–4 GB | 32–64 GB | **88%** | ~1,577 |
| **C-store / cold** | Cloud-centric | IoT-Link | 2–4 GB | 64–128 GB | **90%** | ~226 |
| **Wells & pumps** | Cloud-centric | IoT-Link | 2–4 GB | 32 GB | **92%** | ~338 |
| **ALF / campus** | **Appliance + cloud** | MVP Suite | **8–16 GB** | **128–256 GB** | **40%** | ~42 |

### MVP Suite sizing (ALF / campus only)

| Profile | RAM | Storage | Workload |
|---------|-----|---------|----------|
| Minimum | 8 GB | 128 GB SSD | Single building, no cameras |
| Recommended | 16 GB | 256 GB SSD | Multi-building, cameras, 13 mo historian |
| Heavy | 16 GB+ | 512 GB SSD | Vision AI, extended compliance export |

### IoT-Link sizing (all cloud-centric verticals)

| Profile | RAM | Storage | Workload |
|---------|-----|---------|----------|
| Minimum | 2 GB | 32 GB | Uplink + basic I/O |
| Recommended | 4 GB | 64 GB | Mongo spool, local alarms, Modbus |

---

## Part 7 — Ceiling scenario ($50 – 120M ARR)

At **national scale** (~167K–400K sites, marketing ARR ceiling), infrastructure diverges from the Y5 plan:

| Layer | Plan scenario (Y5 ~5.3K sites) | Ceiling scenario (100K+ sites) |
|-------|-------------------------------|--------------------------------|
| SaaS | 3–5 monolith droplets | Horizontally scaled ingest + GUI tiers |
| Hot Mongo | 0.5–1.3 TB | Sharded TB+ cluster |
| Archive | 15–40 TB | **PB-class** object storage |
| Edge | ~5K IoT-Link + ~40 MVP Suite | **100K+ gateways**, **500+ campuses** |
| Architecture | Single codebase, 2-server archive | VM split: ingestion · alarms · GUI · AI |

*Reference: ARCHITECTURE.md — cloud target **10M devices, 10K users**.*

---

## Part 8 — Planning recommendations

### By go-to-market phase

| Phase | Sites | Cloud focus | Edge focus |
|-------|-------|-------------|------------|
| **Launch (Y1)** | ~237 | 4 GB SaaS droplet, 10–20 GB Mongo, optional archive VPS | IoT-Link standard image; 2 ALF MVP Suite pilots |
| **Growth (Y2–Y3)** | 687–1,487 | Scale Mongo 50–250 GB; dedicated archive 2–8 TB | Fleet IoT-Link provisioning; ALF reference campus template |
| **Scale (Y4–Y5)** | 3K–5K | Multi-node SaaS; Mongo 500 GB–1 TB; archive 15–40 TB | ALF drives MVP Suite storage — **not** cloud |
| **National ceiling** | 100K+ | Full platform split | OEM embed at scale |

### Vertical-specific notes

| Vertical | Infrastructure priority |
|----------|-------------------------|
| **Lift / wastewater** | Cloud PdM archive; cellular reliability; 13 mo compliance |
| **HVAC / pool** | Cloud fleet Parc for contractor routes; minimal edge |
| **C-store** | Highest cloud storage index — cold-chain sensitivity |
| **ALF** | **Size the appliance**, not the droplet — cameras + evidence local |
| **Wells** | Lowest cloud load; sparse telemetry |

---

## Appendix — Sources and assumptions

| Item | Source |
|------|--------|
| Y1–Y3 site counts & revenue | mooreVIEW Product Market Entry v1.4 |
| 5-yr ARR ceiling ($50–120M) | Pricing Guide v2.4, Product Description v1.4 |
| Appliance profiles | `deploy/appliance/`, IoT-Link README |
| Cloud SaaS minimums | CLOUD_DEPLOY_DO.md (≥2 GB, 4 GB recommended) |
| Archive pipeline | ARCHIVE_EXPORT.md (7 d hot → zstd archive) |
| Historian sample rate | Default 5 s (`MONGODB_SAMPLE_MS`) |
| Y4–Y5 site extrapolation | ~1.7× prior-year new installs (not in marketing docs) |
| Relative indexes | Derived from deployment topology + I/O/camera load |

**Disclaimer:** Directional planning document for capacity and capex discussion. Not a financial forecast, hardware quote, or SLA commitment.

---

*Infrastructure Projections v1.0 — mooreVIEW marketing / platform planning.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
