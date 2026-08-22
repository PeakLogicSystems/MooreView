# mooreVIEW — Product Market Entry

**Proactive operations. Portable everywhere. Priced for monitoring contracts.**

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

**Document version:** 1.2 · Run `npm run build:market-entry-pdf` for build date

---

## Executive summary — market entry thesis

**mooreVIEW** enters the market as a **field-service monitoring platform** — not plant-floor SCADA. We sell **proactive, portable** operations for distributed mechanical assets: lift stations, septic/ATU, wells, **residential and commercial pools**, **residential and commercial HVAC**, **convenience stores**, refrigeration, and institutional campuses (facilities/MEP only).

| Pillar | mooreVIEW |
|--------|-----------|
| **Proactive** | PdM detects degradation; CMMS schedules fix **before** failure — alarms are the last line |
| **Portable** | One **`.est` project** moves office → edge → cloud → next contractor |
| **Priced for routes** | **Hardware + commissioning once** · **monthly renewal** · no tag-count tax |

**One line:** mooreVIEW turns distributed mechanical assets from breakdown businesses into condition-based, contracted monitoring businesses.

**Parent company:** [The Purple Standard](https://purple-standard.com) — mooreVIEW is the technology company in a portfolio of field-service operators (flagship: **ACE Septic & Waste**). Sister trades hold septic, electric, well, and on-site licenses; mooreVIEW provides fleet visibility, PdM, CMMS, and portable projects.

---

## Part 1 — Product

### At a glance

mooreVIEW is an integrated automation, condition monitoring, and maintenance platform:

- **Structured Text (ST) runtime** — edge logic on pumps, compressors, blowers, wells  
- **Tag database & drivers** — Modbus, MQTT, serial, HTTP (incl. NextCentury leak cloud)  
- **Integrated HMI** — no separate SCADA license stack  
- **Historian & trends** — MongoDB-backed history  
- **MQTT Parc fleet hub** — multi-site contractor / utility / OEM visibility  
- **Predictive maintenance (PdM)** — health index, RUL, failure forecast  
- **Integrated CMMS** — PdM, alarm, and PM → work orders in one app  
- **IP cameras & vision AI** — ONVIF, optional inference  
- **Training (F2)** — IoT CBM + mooreVIEW labs M0–M15  

**Deployments:** MVP Suite (Windows/Linux appliance) · IoT-Link (edge/cellular) · Cloud SaaS (:3100) · MV Client (remote UI) — one codebase, one API, one `.est` format.

### The reactive trap

| What happens today | What it costs |
|--------------------|---------------|
| Assets run until failure or complaint | Emergency dispatch, overtime, spoilage, overflow |
| Alarms = local dialers or siloed OEM apps | No fleet view, no history, no work order |
| “Preventive” = calendar guesswork | Labor spent whether the asset needs it or not |
| Every site = custom snowflake | Knowledge trapped; handoffs mean starting over |

Legacy SCADA vendors optimize the **reactive loop**. mooreVIEW changes the **model**.

### Proactive workflow

```
Edge sensing + historian
  → PdM feature windows
  → Failure forecast (warning / critical / failed)
  → CMMS proactive PM work order (source: pdm)
  → Technician completes planned route
  → Service history → next forecast
```

| Layer | Timing | Outcome |
|-------|--------|---------|
| **Predictive (PdM)** | Days–weeks before failure | Proactive PM work order |
| **Preventive (PM)** | Calendar interval | Routine service |
| **Reactive (alarm)** | Out of limits | Urgent WO — **last line**, not the strategy |

### Marketplace verticals

| # | Space | Proactive wedge | Bundled project |
|---|--------|-----------------|-----------------|
| 1 | **Lift stations** | Level/pump trends before SSO | `duplex-lift-station` |
| 2 | **Wastewater / ATU** | Blower/UV/pump health; compliance route | Wastewater / ATS packs |
| 3 | **Septic / ATS OEM** | White-label panel + provider fleet | `ATS.est` |
| 4 | **Wells & pumps** | Dry-run/yield → scheduled pull | Well Guard |
| 5 | **Refrigeration / convenience store** | Walk-in/rack drift before product loss | Cold Chain / c-store pack |
| 6 | **HVAC — residential** | Band drift before occupant call | Comfort residential |
| 7 | **HVAC — commercial** | RTU runtime/amp anomalies; filter DP | Comfort commercial |
| 8 | **Pool — residential** | Filter/chemistry/backwash before green water | Pool residential |
| 9 | **Pool — commercial** | Pump health, chemistry, schedule compliance | Pool commercial |
| 10 | **Institutional / ALF** | Campus leaks, pool/kitchen/mechanical; survey evidence | `assisted-living` |

**Go-to-market beachhead:** Lift stations + convenience store cold chain (high cost of being late) → pools + HVAC (contractor route attach) → septic OEM embed + institutional campuses.

### Portable `.est` projects

One archive holds program, tags, drivers, HMI, alarms, PdM context, CMMS data, cameras, and site plan. **Open, save, deploy, hand off** — no silent re-commissioning.

### Who buys

| Buyer | Why mooreVIEW |
|-------|---------------|
| **Service contractors** | Monitoring contracts + planned routes |
| **Utilities / operators** | Fleet Parc; fewer SSO events |
| **OEM panel shops** | Connected panel vs dialer-only skid |
| **Asset owners** | Vendor-independent continuity via `.est` |

### Proof of market entry

- Work orders created **before** customer complaint  
- Partners sell **monitoring agreements**, not only T&M breakdowns  
- Reference stories: **avoided** overflow, food loss, pump burn-up, pool failure, warm box — not “faster response”  

---

## Part 2 — Pricing

### Base model

**One-time hardware + commissioning** per asset + **monthly monitoring renewal**. Cell data billed separately when mooreVIEW-managed.

**Rule:** Price by **asset type**, not I/O tag count.

### List price — one-time (hardware + commissioning)

**Residential tier** · **Commercial tier** (includes lift station and convenience store)

| Asset type | One-time |
|------------|----------|
| **ATU — residential** | **$1,500** |
| **Pool — residential** | **$1,500** |
| **HVAC — residential** | **$1,500** |
| **ATU — commercial** | **$2,500** |
| **Pool — commercial** | **$2,500** |
| **HVAC — commercial** | **$2,500** |
| **Convenience store** | **$2,500** |
| **Lift station — duplex** | **$2,500** |

Includes edge gateway, vertical `.est` template I/O, commissioning, HMI, alarms, initial Parc enrollment.

### List price — monitoring renewal

| Asset type | Renewal / mo | Annual |
|------------|--------------|--------|
| **ATU — residential** | **$18** | **$216** |
| **Pool — residential** | **$18** | **$216** |
| **HVAC — residential** | **$18** | **$216** |
| **ATU — commercial** | **$25** | **$300** |
| **Pool — commercial** | **$25** | **$300** |
| **HVAC — commercial** | **$25** | **$300** |
| **Convenience store** | **$25** | **$300** |
| **Lift station — duplex** | **$25** | **$300** |

Renewal includes software, Parc, historian, CMMS, PdM, updates. **PdM → proactive CMMS included** — not an upsell.

### Cellular data

| Line item | Rate |
|-----------|------|
| **Cell data** (mooreVIEW-managed SIM) | **$3 / mo** (**$36 / yr**) |

No cell charge when customer provides WAN/Ethernet.

### Year-1 totals (with cell)

| Asset type | One-time | Renewal (12 mo) | Cell (12 mo) | **Year-1 total** |
|------------|----------|-----------------|----------------|------------------|
| **Residential tier** (ATU, pool, HVAC) | $1,500 | $216 | $36 | **$1,752** |
| **Commercial tier** (ATU, pool, HVAC, c-store, lift) | $2,500 | $300 | $36 | **$2,836** |

**Year-2+ recurring (with cell):** **$252/yr** residential (**$21/mo**) · **$336/yr** commercial (**$28/mo**).

### Annual prepay (2 months free)

| Tier | Annual prepay renewal | + cell | **Total recurring** |
|------|----------------------|--------|---------------------|
| **Residential** (ATU, pool, HVAC) | $180 | $36 | **$216** |
| **Commercial** (ATU, pool, HVAC, c-store, lift) | $250 | $36 | **$286** |

### Fleet volume discounts (renewal only)

| Fleet size | Discount |
|------------|----------|
| **10–49 sites** | 10% off monthly renewal |
| **50–199 sites** | 15% off monthly renewal |
| **200+ sites** | Custom enterprise |

**Example — 20 duplex lift stations:** **$50,000** one-time + **$6,720/yr** recurring (renewal + cell).

### Optional add-ons

| Add-on | Directional |
|--------|-------------|
| PdM premium | +$5–$10 / mo / site |
| Extended historian | +$5–$15 / mo / site |
| Camera + vision AI | +$10–$25 / mo / site |
| Cloud SaaS extra seats | +$50–$150 / user / mo |

### OEM channel

| Model | Price |
|-------|-------|
| Panel embed | List one-time **or** OEM discount |
| Custom `.est` NRE | **$5,000 – $25,000** |
| Renewal resale | OEM bills customer; remits list or share |

### Sales quick reference

| Buyer | Quote |
|-------|-------|
| Residential ATU, pool, or HVAC | **$1,500** + **$18/mo** (+ **$3/mo** cell) |
| Commercial ATU, pool, HVAC, or convenience store | **$2,500** + **$25/mo** (+ **$3/mo** cell) |
| Duplex lift station | **$2,500** + **$25/mo** (+ **$3/mo** cell) |
| Convenience store (cold chain + RTU) | Same **commercial tier** — walk-in, rack, HVAC in one `.est` |

---

## Part 3 — Competitive landscape

### mooreVIEW vs legacy SCADA — positioning

Traditional platforms — **VTScada**, **Wonderware InTouch**, **CIMPLICITY**, **Ignition**, **FactoryTalk View SE** — target **in-plant** supervisory control: tag/seat licensing, integrator projects, **reactive** alarms.

mooreVIEW targets **dispersed field assets** and **monitoring-contract economics**.

### Competitor pricing at a glance (USD list / MSRP)

| Platform | Model | Typical single-site | Recurring |
|----------|-------|---------------------|-----------|
| **mooreVIEW** | Install + monthly renewal | **$1,752 – $2,836** yr 1 | **$252 – $336/yr** + cell |
| **VTScada** | Per PC + I/O tags | **$3,395+** runtime (1K I/O) | ~15% SupportPlus |
| **Wonderware InTouch** | Perpetual / Flex | **$1,850 – $20,600** | ~20% support / tokens |
| **CIMPLICITY** | Per I/O points | **$721 – $16,307+** | Support plans |
| **Ignition** | Per gateway | **~$14,700+** SCADA stack | 16–24% support |
| **FactoryTalk View SE** | Quote / subscription | **~$10K – $25K+** | Subscription or maintenance |

### Year-1 TCO — one duplex lift station

| Solution | Year-1 | PdM → CMMS |
|----------|--------|------------|
| Autodialer | **~$600 – $1,200** | ○ |
| **mooreVIEW (+ cell)** | **~$2,836** | **●** |
| VTScada (1K + add-ons) | **~$7K – $12K** | ○ |
| Wonderware Unlimited Std | **~$15K+** | ○ |
| Ignition (Platform + suite) | **~$17K – $20K+** | ○ |
| FactoryTalk SE (quoted) | **~$10K – $25K+** | ○ |

*Competitor figures exclude integrator labor and hardware unless noted.*

### Feature comparison matrix

Legend: **●** native · **◐** module/integrator · **○** not core · **★** mooreVIEW differentiator

| Capability | mooreVIEW | VTScada | Wonderware | CIMPLICITY | Ignition | FactoryTalk |
|------------|-----------|---------|------------|------------|----------|-------------|
| **Primary fit** | Field-service fleets | Utilities/water | Process/plant | High-speed plant | Flexible SCADA/IIoT | Rockwell plants |
| **Licensing** | Install + renewal | Per PC + tags | Edition / Flex | Per points | Per gateway | Bundle / quote |
| **HMI** | ● | ● | ● | ● | ● | ● |
| **Edge ST logic** | ★ ● | ◐ | ◐ | ◐ | ◐ | ◐ Logix |
| **Historian** | ● | ● | ◐ | ◐ | ◐ | ◐ |
| **MQTT fleet (Parc)** | ★ ● | ◐ | ◐ | ◐ | ◐ $ | ◐ |
| **PdM + RUL** | ★ ● | ○ | ○ | ○ | ○ | ○ |
| **Integrated CMMS** | ★ ● | ○ | ○ | ○ | ○ | ○ |
| **Portable `.est`** | ★ ● | ◐ | ◐ | ◐ | ◐ | ◐ |
| **Cameras / vision AI** | ★ ● | ○ | ○ | ○ | ◐ | ○ |
| **Built-in training** | ★ ● | ○ | ○ | ○ | ◐ | ○ |
| **Field-service pricing** | ★ ● | ○ | ○ | ○ | ◐ | ○ |

### Use-case readiness — mooreVIEW verticals vs competitors

**●** strong · **◐** integrator/custom · **○** poor fit

| Use case | mooreVIEW | VTScada | Wonderware | CIMPLICITY | Ignition | FactoryTalk |
|----------|-----------|---------|------------|------------|----------|-------------|
| **Lift stations** | **● ★** | **●** | ◐ | ◐ | ◐ | ○ |
| **ATU / wastewater** | **● ★** | ◐ | ◐ | ◐ | ◐ | ○ |
| **Septic OEM embed** | **● ★** | ○ | ○ | ○ | **◐** | ○ |
| **Wells & pumps** | **● ★** | ◐ | ○ | ○ | ◐ | ○ |
| **Convenience store** (cold + HVAC) | **● ★** | ○ | **◐** plant | **◐** plant | **◐** | ○ |
| **Refrigeration / cold chain** | **● ★** | ◐ | **●** plant | **●** plant | **◐** plant | ◐ |
| **HVAC — residential** | **● ★** | ○ | ◐ | ◐ | ◐ | ○ |
| **HVAC — commercial** | **● ★** | ○ | ◐ | ◐ | ◐ | ○ |
| **Pool — residential** | **● ★** | ○ | ◐ | ○ | ◐ | ○ |
| **Pool — commercial** | **● ★** | ◐ | ◐ | ○ | ◐ | ○ |
| **Institutional / ALF campus** | **● ★** | ○ | ◐ | ○ | **◐** | ○ |
| **Multi-site contractor fleet** | **● ★** | ◐ | ◐ | ◐ | **◐** | ◐ |
| **Proactive PdM → CMMS** | **● ★** | ○ | ○ | ○ | ○ | ○ |

**Closest competitor overall:** **Ignition** (adaptable, unlimited tags) — every vertical is a custom SI project without PdM/CMMS/portable pricing.

**Closest by vertical:** **VTScada** for lift/water utility; **Wonderware/CIMPLICITY** for in-plant cold chain; **FactoryTalk** rarely for mooreVIEW use cases.

### Where mooreVIEW wins (sales answers)

| Question | Legacy SCADA | mooreVIEW |
|----------|--------------|-----------|
| Cost per site (pool, HVAC, c-store)? | Tag bands + integrator | **$1,500–$2,500** + **$18–$25/mo** + **$3/mo** cell |
| Fix before overflow / warm box / green pool? | Alarm after failure | **PdM → proactive PM WO** |
| Who creates the WO? | Phone dispatch | **Integrated `/cmms`** |
| Hand off to new contractor? | Re-engineer | **Portable `.est`** |
| Need integrator every site? | Usually | **Vertical template + F2 training** |

### Where legacy SCADA still leads

| Requirement | Prefer |
|-------------|--------|
| Large in-plant DCS / control room | Wonderware, CIMPLICITY, FactoryTalk |
| Unlimited tags, SQL-centric IT (one plant) | Ignition |
| 20-year municipal utility integrator SCADA | VTScada |
| All-Rockwell Logix standard | FactoryTalk |
| Refinery / automotive high-channel SCADA | CIMPLICITY, Wonderware |

mooreVIEW **complements** — it modernizes the long tail of distributed assets that cannot justify traditional SCADA economics.

---

## Part 4 — Market revenue potential

*Directional planning estimates — not financial forecasts. Based on list MSRP (v2.1), marketplace site targets, and US SAM wedges from vertical business plans.*

### Revenue per site (list pricing)

| Tier | Assets | Year-1 (install + renewal + cell) | Steady-state recurring / yr |
|------|--------|-------------------------------------|----------------------------|
| **Residential** | ATU, pool, HVAC | **$1,752** | **$252** |
| **Commercial** | ATU, pool, HVAC, c-store, lift | **$2,836** | **$336** |

**Blended rule of thumb:** ~**$2,200** average year-1 per monitored site · ~**$300/yr** recurring at maturity.

**Institutional / ALF campus** (multi-building): **$5,000 – $25,000 / yr** enterprise — priced above single-site commercial tier when bundling pool, kitchen, mechanical, and leak fleet on one campus `.est`.

---

### Addressable market (United States, directional)

| Vertical | Market indicator | Serviceable wedge (mooreVIEW) | 5-year ARR potential |
|----------|------------------|-------------------------------|----------------------|
| **Lift stations & wastewater** | ~$2.5B/yr US monitoring/control | ~**$400M/yr** sites without full SCADA | **$15 – 25M** recurring (wastewater plan) |
| **Septic / ATU** | Millions of ATS/ATU systems; compliance-driven | Licensed providers + OEM embed | **$5 – 12M** recurring |
| **Pools — residential** | ~10M US pools; service-contract attach | Contractor/OEM monitoring routes | **$3 – 8M** recurring |
| **Pools — commercial** | Hotels, HOAs, aquatic centers | Proactive before guest/health event | **$2 – 6M** recurring |
| **HVAC — residential** | Huge installed base; thermostat clouds | HVAC contractor PM agreement attach | **$5 – 15M** recurring |
| **HVAC — commercial** | Light commercial RTU portfolios | Multi-site property managers | **$8 – 20M** recurring |
| **Convenience stores** | ~150,000 US c-stores | Cold chain + RTU; product-loss avoidance | **$10 – 30M** recurring |
| **Refrigeration / cold chain** | Grocery, restaurant, food service | Overlaps c-store; contractor Parc | *(included in c-store/HVAC-R)* |
| **Wells & pumps** | Rural/ag/commercial wells | Installer fleet monitoring | **$2 – 5M** recurring |
| **Institutional / ALF** | Thousands of campuses | Facilities/MEP only; BMS coexist | **$3 – 10M** recurring |

**Portfolio 5-year ARR ceiling (all verticals):** **$50 – 120M** recurring at scale — dominated by **convenience retail**, **HVAC commercial**, and **wastewater** if fleet attach succeeds.

**Purple Standard channel:** Sister operators (ACE Septic & Waste and portfolio companies) provide **reference fleet**, **install capacity**, and **first 100–500 sites** without cold national sales — accelerating year 1–2 revenue vs standalone SaaS launch.

---

### 12-month launch model (directional)

Site targets for market entry year 1 — assumes Purple Standard + contractor channel ramp.

| Vertical | Tier | Y1 site target | Y1 revenue (list) | Y1 recurring ARR added |
|----------|------|----------------|-------------------|------------------------|
| Lift station — duplex | Commercial | 20 | $56,720 | $6,720 |
| ATU — residential | Residential | 50 | $87,600 | $12,600 |
| ATU — commercial | Commercial | 25 | $70,900 | $8,400 |
| Pool — residential | Residential | 30 | $52,560 | $7,560 |
| Pool — commercial | Commercial | 15 | $42,540 | $5,040 |
| HVAC — residential | Residential | 40 | $70,080 | $10,080 |
| HVAC — commercial | Commercial | 30 | $85,080 | $10,080 |
| Convenience store | Commercial | 10 | $28,360 | $3,360 |
| Wells & pumps | Commercial | 15 | $42,540 | $5,040 |
| ALF / campus (enterprise) | Enterprise | 2 | $30,000 | $30,000 |
| **Total** | | **237 sites** | **~$566,380** | **~$98,880 ARR** |

**Year-1 total revenue (directional):** **~$550K – $600K** — aligns with wastewater vertical financial plan; mix shifts toward pools, HVAC, and c-store vs lift/ATU-only.

**End of year 1 installed base:** ~**237 monitored sites** · **~$99K** annual recurring run-rate entering year 2 (before renewals from earlier installs in-year).

---

### 3-year portfolio revenue model (directional)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| **New sites installed** | 237 | 450 | 800 |
| **Cumulative monitored sites** | 237 | 687 | 1,487 |
| **Recurring ARR (end of year)** | ~$99K | ~$320K | ~$780K |
| **One-time (hardware + commissioning)** | ~$470K | ~$900K | ~$1.6M |
| **Total revenue (directional)** | **~$570K** | **~$1.5M** | **~$3.5M** |

*Year 2–3 assume 10–15% fleet renewal discounts on larger operators; institutional campuses at enterprise ACV pull totals upward.*

**Wastewater-only benchmark (from vertical plan):** Year 1 **$550K** · Year 2 **$1.74M** · Year 3 **$3.9M** — full portfolio model reaches similar year-3 scale with **broader vertical mix** and **lower per-site recurring** than legacy SaaS bands ($1.5K–$6K/station), compensated by **higher site volume** at accessible price points.

---

### Unit economics (targets at scale)

| Metric | Target |
|--------|--------|
| **Software / renewal gross margin** | 75 – 85% |
| **Hardware + commissioning margin** | 35 – 45% |
| **Blended year-1 payback on install COGS** | Under 14 months |
| **Net revenue retention (fleet operators)** | > 110% |
| **Logo churn (annual)** | < 5% |
| **Revenue per installed site (steady state)** | ~**$300/yr** recurring + replacement hardware cycle every 7–10 yr |

**LTV sketch (commercial tier, 7-year life):** $2,500 install + ($336 × 7) ≈ **$4,850** gross · **LTV:CAC target > 3:1** on contractor-led installs.

---

### Revenue by sales channel

| Channel | Revenue mix (mature) | mooreVIEW advantage |
|---------|---------------------|---------------------|
| **Purple Standard sister operators** | 25 – 35% early; 10 – 15% at scale | Built-in fleet, brand, install crews |
| **Contractor monitoring contracts** | 40 – 50% | Attach on PM renewals; Parc fleet |
| **OEM / panel embed** | 15 – 25% | One-time + per-panel renewal resale |
| **Utility / municipal** | 5 – 15% | Longer cycle; higher logo value |
| **Institutional / ALF enterprise** | 5 – 10% | High ACV; reference for FM market |

---

## Part 5 — Market entry summary

| | Industry default | mooreVIEW market entry |
|--|------------------|------------------------|
| **Problem** | Reactive breakdown loop | Proactive monitoring contracts |
| **Buyer** | Plant IT / integrator | Field-service contractor, OEM, operator |
| **Pricing** | Tag / seat / gateway | **$1,500–$2,500** once + **$18–$25/mo** |
| **Differentiator** | Alarms | **PdM → CMMS + `.est` + Parc** |
| **vs dialer** | — | ~5× recurring, 10× capability |
| **vs SCADA** | — | ~3–10× lower year-1 on typical field site |
| **Competition** | Optimize reactive loop | **Change the model** |
| **Year-1 revenue target** | — | **~$550K – $600K** (~237 sites) |
| **Year-3 revenue target** | — | **~$3.5M** (~1,500 cumulative sites) |
| **5-year ARR ceiling (portfolio)** | — | **$50 – $120M** recurring at national scale |

**Positioning line:** *Less than one emergency truck roll per year. None of the SCADA integrator quote.*

**Contact:** The Purple Standard / mooreVIEW sales · [purple-standard.com](https://purple-standard.com)

---

*Product Market Entry v1.2 — combines product description, pricing guide v2.1, SCADA competitive analysis, and directional revenue model.*

*mooreVIEW is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.*
