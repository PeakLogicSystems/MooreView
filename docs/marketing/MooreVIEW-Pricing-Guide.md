# mooreVIEW — Pricing Guide

**Hardware + commissioning once · monitoring renewal monthly**

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

**Document version:** 2.4 · Run `npm run build:pricing-guide-pdf` for build date

---

## Base pricing model

mooreVIEW is sold as **one-time hardware + commissioning** per monitored asset, plus a **monthly monitoring renewal**. Cellular data is a separate line item when the site uses mooreVIEW-managed cell connectivity.

**Core rule:** Price by **asset type**, not I/O tag count. Unlimited tags within the standard site template for that vertical.

**Three tiers:** **Residential** ($1,500 + $18/mo) · **Commercial** ($2,500 + $25/mo) · **Enterprise campus** ($8K–$15K + $417–$2,083/mo institutional)

### List price — hardware + commissioning (one-time)

| Asset type | Tier | One-time |
|------------|------|----------|
| **ATU — residential** | Residential | **$1,500** |
| **Pool — residential** | Residential | **$1,500** |
| **HVAC — residential** | Residential | **$1,500** |
| **ATU — commercial** | Commercial | **$2,500** |
| **Pool — commercial** | Commercial | **$2,500** |
| **HVAC — commercial** | Commercial | **$2,500** |
| **Convenience store** | Commercial | **$2,500** |
| **Lift station — duplex** | Commercial | **$2,500** |
| **Well & pump** | Commercial | **$2,500** |

Includes: edge gateway/appliance, I/O as defined in vertical `.est` template, on-site commissioning, portable project file, operator HMI, alarms, and initial cloud/Parc enrollment.

**Convenience store** includes walk-in/rack refrigeration, RTU/comfort HVAC, and door/temp alarms in one commercial `.est` template.

### List price — monitoring renewal (monthly)

| Asset type | Tier | Renewal / mo | Annual equivalent |
|------------|------|--------------|-------------------|
| **ATU — residential** | Residential | **$18 / mo** | **$216 / yr** |
| **Pool — residential** | Residential | **$18 / mo** | **$216 / yr** |
| **HVAC — residential** | Residential | **$18 / mo** | **$216 / yr** |
| **ATU — commercial** | Commercial | **$25 / mo** | **$300 / yr** |
| **Pool — commercial** | Commercial | **$25 / mo** | **$300 / yr** |
| **HVAC — commercial** | Commercial | **$25 / mo** | **$300 / yr** |
| **Convenience store** | Commercial | **$25 / mo** | **$300 / yr** |
| **Lift station — duplex** | Commercial | **$25 / mo** | **$300 / yr** |
| **Well & pump** | Commercial | **$25 / mo** | **$300 / yr** |

Renewal includes: mooreVIEW software entitlement, fleet Parc uplink, historian, integrated CMMS, PdM feature builds, alarm notification profiles, and platform updates for that site.

### Cellular data (when applicable)

| Line item | Rate |
|-----------|------|
| **Cell data** (mooreVIEW-managed SIM / data plan) | **$3 / mo** per site (**$36 / yr**) |

Bill separately from monitoring renewal when the customer uses mooreVIEW-provided cellular backhaul. Customer-owned WAN or site Ethernet: no cell line item.

---

## Year-1 total (base packages)

Assumes monitoring renewal and cell data start at commissioning.

| Tier | Assets | One-time | Renewal (12 mo) | Cell (12 mo) | **Year-1 total** |
|------|--------|----------|-----------------|--------------|------------------|
| **Residential** | ATU, pool, HVAC | $1,500 | $216 | $36 | **$1,752** |
| **Commercial** | ATU, pool, HVAC, c-store, lift | $2,500 | $300 | $36 | **$2,836** |

**Year-2+ recurring only** (with cell): **$252 / yr** residential · **$336 / yr** commercial.

---

## Enterprise tier — institutional / ALF campus

**Living Campus** pricing for assisted living, memory care, and similar **multi-building campuses** (facilities / MEP only — not clinical EHR or nurse call). Bundles HVAC comfort, kitchen cold, generator exercise, DHW, optional pool/septic/well, leak detection, portfolio Parc, CMMS SLA, and compliance evidence export in one campus `.est`.

### List price — campus (one-time + renewal)

| Campus profile | Buildings / scale | One-time | Renewal / mo | Year-1 total |
|----------------|-------------------|----------|--------------|--------------|
| **Small campus** | 1 building, ≤80 beds | **$8,000** | **$417** (~$5K/yr) | **~$13,000** |
| **Standard campus** | 2–3 buildings | **$12,000** | **$833** (~$10K/yr) | **~$22,000** |
| **Large / multi-system** | 4+ buildings or high attach | **$15,000** | **$2,083** (~$25K/yr) | **~$40,000** |

One-time includes campus gateway(s), critical-path commissioning (gen, cold, sample comfort, DHW), HMI, alarms, and initial Parc enrollment. Renewal includes unlimited tags within campus template, CMMS, PdM, historian, evidence export, and platform updates.

**Add-ons:** Additional building **+$2,500** one-time + **$125/mo** · compliance premium tier **+$200–$500/mo** · managed FM partner rev-share (custom).

**Portfolio operators (5+ campuses):** Custom MSA — typically **10–15%** renewal discount; single Parc tenant across sites.

---

## What's included in base renewal

| Capability | Base renewal |
|------------|--------------|
| Alarms & annunciation | ● |
| Operator HMI | ● |
| Tag historian & trends | ● |
| Portable `.est.zip` project | ● |
| MQTT Parc fleet uplink | ● |
| BACnet/IP import (edge appliance) | ● |
| Integrated CMMS (alarm → WO) | ● |
| PdM + proactive PM work orders | ● |
| Training (F2 in-product) | ● |
| IP cameras / vision AI | ○ add-on |
| Extended historian / compliance PDF | ○ add-on |

**●** included · **○** optional upgrade

---

## Vertical quick reference (all ten spaces)

| # | Vertical | Proactive focus | Tier | Year-1 (list) |
|---|----------|-----------------|------|---------------|
| 1 | **Lift station** | Level/pump trends before SSO | Commercial | **$2,836** |
| 2 | **Wastewater / ATU** | Blower/UV/pump; compliance route | Res / Com | **$1,752 / $2,836** |
| 3 | **Septic / ATS OEM** | Panel embed + provider fleet | OEM | Per-panel + provider SaaS |
| 4 | **Well & pump** | Dry-run/yield → scheduled pull | Commercial | **$2,836** |
| 5 | **Convenience store** | Walk-in/rack/RTU before product loss | Commercial | **$2,836** |
| 6 | **HVAC — residential** | Comfort drift before complaint | Residential | **$1,752** |
| 7 | **HVAC — commercial** | RTU runtime/amp; filter DP | Commercial | **$2,836** |
| 8 | **Pool — residential** | Filter/chemistry/backwash | Residential | **$1,752** |
| 9 | **Pool — commercial** | Multi-pump; health/guest compliance | Commercial | **$2,836** |
| 10 | **Institutional / ALF** | Campus MEP + survey evidence | Enterprise | **~$13K – $40K** |

---

## Institutional pricing — industry study (2025–2026)

*Directional US benchmarks for **facilities / MEP** spend in senior living and similar campuses. mooreVIEW Living Campus is **not** clinical EHR, eMAR, or nurse call.*

### How the market prices today

| Category | Representative vendors | Typical US pricing (directional) | What you get | mooreVIEW fit |
|----------|------------------------|----------------------------------|--------------|---------------|
| **Clinical / resident ops software** | ALIS, WellSky, August Health, MatrixCare | **$8 – $150 / resident / mo**; **$700 – $5,000+ / mo / community**; onboarding **$650 – $15,000+** | Care plans, billing, eMAR | **Out of scope** — different buyer |
| **Senior-living CMMS** | Maintenance Care, TheWorxHub, Zapium, M1, eWorkOrders | **$0 – $500 / mo / site**; Enterprise CMMS often **$100 – $225 / mo** (unlimited users) | Work orders, PM, assets — **no live MEP telemetry** | CMMS **included** in mooreVIEW renewal |
| **Point IoT (HVAC, energy, leak)** | Verdant, SiteSage, sensor gateways | **$3 – $15 / device / mo**; **$200 – $600 / mo / site** for gateways | Single-purpose alerts | **Unified** in campus `.est` |
| **Kitchen / HACCP loggers** | Compliance SaaS | **$50 – $200 / mo / kitchen** | Temperature logging | Kitchen cold in campus bundle |
| **Leak detection SaaS** | NextCentury-class per unit | **$3 – $8 / unit / mo** + hardware | Bath/leak alerts only | Integrated in `assisted-living` tags |
| **Enterprise BMS / BAS** | Johnson, Honeywell, Siemens | **$15K – $100K+** install; **$3K – $10K / mo** service | Plant-style BMS | **Coexist** — mooreVIEW is MEP glue + CMMS |
| **Outsourced FM (MEP slice)** | Regional FM providers | **$10K – $30K / yr / campus** monitoring + labor | Vendor portal + trucks | Platform for **in-house or FM partner** |

### Stacked “reactive sprawl” vs mooreVIEW campus

| Approach | Typical monthly stack (directional) | Annual | Gap |
|----------|-------------------------------------|--------|-----|
| CMMS only (Maintenance Care Enterprise) | **~$225 / mo** | **~$2,700** | No live MEP monitoring |
| CMMS + HVAC IoT + kitchen logger + leak | **~$1,200 – $2,500 / mo** | **~$14K – $30K** | Fragmented apps; survey fire drill |
| **mooreVIEW Living Campus (standard list)** | **~$833 / mo** renewal + amortized install | **~$22K yr-1** | **One ops picture + PdM + CMMS + evidence** |

### mooreVIEW positioning vs industry bands

| Band | Industry range | mooreVIEW list |
|------|----------------|----------------|
| Campus MEP monitoring + CMMS (facilities-only) | **$5K – $30K / yr** (pieced together) | **$5K – $25K / yr** renewal + **$8K – $15K** one-time |
| Full clinical + ops platform | **$50K – $180K+ / yr** (100-bed community) | **Not comparable** — out of scope |
| Enterprise BMS + service | **$36K – $120K+ / yr** | **Coexist** at lower tier for MEP long tail |

**Sales line:** *Survey-ready every day — not the week before.* Campus list sits **below** stacked point solutions and **far below** clinical platforms or full BMS — while delivering proactive PdM → CMMS and portable `.est` continuity.

*Sources: public vendor pricing pages and industry summaries (Maintenance Care, ALIS, August Health, ITQlick senior-living software benchmarks, marketplace plan `06-institutional-detailed.md`) — verify on quote.*

---

## Optional add-ons (beyond base)

| Add-on | Directional price | Notes |
|--------|-------------------|-------|
| **PdM premium** | +$5 – $10 / mo / site | Advanced models, scheduled PdM PDF |
| **Extended historian** | +$5 – $15 / mo / site | Multi-year Mongo retention |
| **Cloud SaaS extra seats** | +$50 – $150 / user / mo | Multi-tenant Studio beyond base entitlements |
| **Camera + vision AI** | +$10 – $25 / mo / site | ONVIF, inference, snapshots |
| **Fleet platform fee** (50+ sites) | Custom | Volume renewal discounts; dedicated support |

---

## Fleet volume (renewal discounts)

Base list applies to **1–49 sites**. For larger operators, discount **monthly renewal** only — hardware + commissioning list holds unless OEM agreement.

| Fleet size | Renewal discount (typical) |
|------------|----------------------------|
| **10–49 sites** | 10% off monthly renewal |
| **50–199 sites** | 15% off monthly renewal |
| **200+ sites** | Custom enterprise agreement |

Example — **20 convenience stores** (with cell):

| | Amount |
|--|--------|
| One-time (20 × $2,500) | **$50,000** |
| Renewal (20 × $25/mo × 12) | **$6,000 / yr** |
| Cell data (20 × $3/mo × 12) | **$720 / yr** |
| **Recurring total** | **$6,720 / yr** |

---

## OEM & panel-builder channel

| Model | Price |
|-------|-------|
| Panel embed (hardware BOM + mooreVIEW stack) | Same list **or** OEM discount on one-time |
| Custom `.est` template NRE | **$5,000 – $25,000** (once) |
| Renewal resale | OEM bills end customer; remits list or agreed share |

---

## Year-1 TCO vs competition (commercial site)

Illustrative comparison for one proactive monitored commercial site (lift, c-store, or commercial pool).

| Solution | Year-1 total | Proactive PdM → CMMS |
|----------|--------------|----------------------|
| **Autodialer / cellular dialer** | **~$600 – $1,200** | ○ |
| **mooreVIEW commercial (+ cell)** | **~$2,836** | ● |
| **VTScada** (1K I/O + typical add-ons) | **~$7,000 – $12,000** SW only | ○ |
| **Ignition** (Platform + App Building) | **~$14,700+** SW only | ○ |
| **FactoryTalk View SE** (quoted bundle) | **~$10,000 – $25,000** SW only | ○ |

**Positioning line:** *About three months of monitoring renewal pays for itself if you avoid one emergency truck roll.*

---

## Contract & billing policy

| Policy | Rule |
|--------|------|
| **One-time** | Due at install / commissioning sign-off |
| **Renewal** | Monthly auto-pay default; **annual prepay** = 2 months free (≈17% discount) |
| **Cell data** | Monthly; tied to active SIM on mooreVIEW plan |
| **Lapse** | Renewal lapse → read-only historian grace 30 days, then suspend uplink |
| **Tag pricing** | **Not published** — unlimited tags within vertical template |
| **Utility / municipal** | 3-year renewal prepay; additional volume discount |

### Annual prepay renewal (2 months free)

| Tier | Monthly list | **Annual prepay** (+ cell) |
|------|--------------|----------------------------|
| **Residential** (ATU, pool, HVAC) | $18 | **$216** |
| **Commercial** (ATU, pool, HVAC, c-store, lift) | $25 | **$286** |

---

## Sales quick reference

| Buyer | Quote |
|-------|-------|
| Residential ATU, **pool**, or **HVAC** | **$1,500** install + **$18/mo** (+ **$3/mo** cell) |
| Commercial ATU, **pool**, **HVAC**, or **convenience store** | **$2,500** install + **$25/mo** (+ **$3/mo** cell) |
| Duplex lift station | **$2,500** install + **$25/mo** (+ **$3/mo** cell) |
| Well & pump (commercial) | **$2,500** install + **$25/mo** (+ **$3/mo** cell) |
| ALF / campus (enterprise) | **$8K – $15K** install + **$417 – $2,083/mo** (see Enterprise tier) |
| “What does year 2 cost?” | **$21/mo** residential · **$28/mo** commercial (+ cell) |
| Fleet operator (20+ sites) | Volume discount on **renewal** |

---

## Market revenue potential

*Directional US planning estimates — not audited forecasts.*

### Per-site economics (list MSRP)

| Tier | Year-1 total | Steady recurring / yr | 7-yr LTV (directional) |
|------|--------------|----------------------|-------------------------|
| **Residential** (ATU, pool, HVAC) | **$1,752** | **$252** | ~**$3,264** |
| **Commercial** (ATU, pool, HVAC, c-store, lift) | **$2,836** | **$336** | ~**$4,852** |

### SAM and 5-year ARR potential by vertical

| Vertical | 5-yr ARR potential (directional) |
|----------|----------------------------------|
| Lift stations & wastewater | **$15 – 25M** |
| Convenience stores (cold + HVAC) | **$10 – 30M** |
| HVAC — commercial | **$8 – 20M** |
| HVAC — residential | **$5 – 15M** |
| Septic / ATU | **$5 – 12M** |
| Pools (res + commercial) | **$5 – 14M** |
| Institutional / ALF | **$3 – 10M** |
| Wells & pumps | **$2 – 5M** |
| **Portfolio total** | **$50 – 120M** recurring at scale |

### Launch-year model (237 sites → ~$570K total)

| Vertical | Y1 sites | Y1 revenue |
|----------|----------|------------|
| Lift · ATU · pool · HVAC · c-store · wells | 235 | ~$536K |
| ALF / campus (enterprise) | 2 | ~$30K |
| **Total** | **237** | **~$566K** (+ **~$99K** ARR run-rate) |

### 3-year trajectory

| Year | Cumulative sites | Total revenue | End-of-year ARR |
|------|------------------|---------------|-----------------|
| 1 | 237 | **~$570K** | **~$99K** |
| 2 | 687 | **~$1.5M** | **~$320K** |
| 3 | 1,487 | **~$3.5M** | **~$780K** |

**Purple Standard channel** accelerates year 1–2 through sister-operator fleet attach (ACE Septic & Waste and portfolio companies) before national contractor scale.

---

## Summary

| Element | mooreVIEW base model |
|---------|----------------------|
| **Residential tier** | **$1,500** + **$18/mo** — ATU, pool, HVAC |
| **Commercial tier** | **$2,500** + **$25/mo** — ATU, pool, HVAC, c-store, lift, **well** |
| **Enterprise campus** | **$8K – $15K** + **$417 – $2,083/mo** — institutional / ALF Living Campus |
| **Connectivity** | **$3 / mo** cell data (when mooreVIEW-managed) |
| **Differentiator** | PdM → proactive CMMS included in renewal |

**Questions or quotes:** contact The Purple Standard / mooreVIEW sales.

---

*List MSRP for sales enablement. Final quotes may vary by OEM agreement, fleet volume, and contract term.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*

**Related docs:** [Product Description v1.4](MooreVIEW-Product-Description.md) · [Subscription Sell Sheet v1.1](MooreVIEW-Subscription-Sell-Sheet.md) · [Product Market Entry v1.4](MooreVIEW-Product-Market-Entry.md) · [Infrastructure Projections v1.0](MooreVIEW-Infrastructure-Projections.md)
