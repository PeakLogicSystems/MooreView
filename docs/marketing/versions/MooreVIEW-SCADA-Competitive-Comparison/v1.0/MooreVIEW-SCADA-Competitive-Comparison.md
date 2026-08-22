# mooreVIEW vs Legacy SCADA — Pricing & Feature Comparison

**Proactive, portable monitoring for field-service fleets — not plant-floor DCS replacement**

**A company powered by The Purple Standard** · [purple-standard.com](https://purple-standard.com)

**Document version:** 1.0 · Run `npm run build:scada-comparison-pdf` for build date

---

## Executive summary

Traditional SCADA/HMI platforms — **VTScada**, **AVEVA Wonderware InTouch**, **GE CIMPLICITY**, **Inductive Automation Ignition**, and **Rockwell FactoryTalk View** — were built primarily for **in-plant** supervisory control: tag-count or seat-count licensing, integrator-led projects, and **reactive** alarm response.

**mooreVIEW** targets a different buyer: **service contractors, utilities, and OEM panel shops** monitoring distributed mechanical assets (lift stations, septic/ATU, wells, **pools**, **HVAC**, **convenience stores**, refrigeration) who need **proactive PdM → CMMS**, **portable `.est` projects**, and **fleet Parc** — often at **subscription economics** aligned to monitoring contracts, not six-figure integrator SCADA quotes.

This document compares **published vendor list pricing** (where available) and **capability fit**, not a claim that mooreVIEW replaces a refinery DCS.

---

## Pricing at a glance (USD, list / MSRP)

| Platform | License model | Published entry / typical single-site | Scaling driver | Typical annual recurring |
|----------|---------------|----------------------------------------|----------------|--------------------------|
| **mooreVIEW** | **Hardware + commissioning** once; **monthly renewal** | **$1,500–$2,500** install + **$18–$25/mo** renewal (+ **$3/mo** cell) | Per asset type | Monitoring renewal; optional fleet discount |
| **VTScada** | Perpetual, **per PC**, **I/O tag bands** | **$3,395** base Runtime (≤1K I/O, Jul 2025 US list) | Tag band, dev seat, thin-client concurrency, HA servers | **SupportPlus ~15%**/yr of purchase |
| **Wonderware InTouch** | Perpetual or AVEVA Flex tokens | **$1,850** Workstation (1K tags, 1 web client); **$12,360** Unlimited Standard; **$20,600** Unlimited Pro | Edition, historian tag caps, subscription tokens | ~20% support (legacy perpetual); Flex subscription |
| **CIMPLICITY** | Perpetual, **I/O points**, Dev vs Runtime | **$721+** (50 pt Dev list via distributor); **~$16,307** Dev unlimited (2024 list part CI2024SPDUNLIMEN) | Point count, dev vs runtime-only | Emerson support plans (varies) |
| **Ignition** | Perpetual **per Gateway**, unlimited tags | **$1,200** Platform only; **~$14,700+** typical SCADA (Platform + Application Building suite) | Modules/suites, redundant gateway, Edge nodes | **16–24%** support tiers (Basic/Total/Priority Care) |
| **FactoryTalk View SE** | Perpetual or **subscription** bundles | No public fixed list; distributor quotes common (**~$4K–$8K+** per component reported; SE bundles often **$10K–$20K+**) | SE bundle size (5/10/25 clients), Studio, Logix stack | Subscription incl. support, or maintenance on perpetual |

### mooreVIEW base list (hardware + commissioning + renewal)

**Residential tier:** **$1,500** + **$18/mo** · **Commercial tier:** **$2,500** + **$25/mo** · **Cell:** **$3/mo**

| Asset type | Tier | One-time | Renewal |
|------------|------|----------|---------|
| ATU — residential | Residential | **$1,500** | **$18/mo** |
| Pool — residential | Residential | **$1,500** | **$18/mo** |
| HVAC — residential | Residential | **$1,500** | **$18/mo** |
| ATU — commercial | Commercial | **$2,500** | **$25/mo** |
| Pool — commercial | Commercial | **$2,500** | **$25/mo** |
| HVAC — commercial | Commercial | **$2,500** | **$25/mo** |
| Convenience store | Commercial | **$2,500** | **$25/mo** |
| Lift station — duplex | Commercial | **$2,500** | **$25/mo** |

**Included in renewal:** MVP Suite entitlement, Parc, historian, PdM, integrated CMMS, `.est` project — no separate SCADA + historian + alarm line items.

---

## Example TCO — one lift station, ~500 I/O tags, 3 operators, proactive maintenance goal

Illustrative **year-1** software-only comparison for a **greenfield** single-site lift station with historian, alarms, remote web access, and work-order integration. Hardware, integrator labor, and PLC costs excluded.

| Line item | mooreVIEW | VTScada (1K band) | InTouch Unlimited Std | Ignition (SCADA-ish) | CIMPLICITY (300pt Dev) | FactoryTalk View SE |
|-----------|-----------|-------------------|----------------------|----------------------|------------------------|---------------------|
| Base license | **$2,500** install + **$25/mo** renewal | **$3,395** Runtime | **$12,360** | **$1,200** Platform + **$13,500** App Building ≈ **$14,700** | **~$7,526** (300pt Dev list) | Quote (~**$10K–$18K** bundle) |
| Dev / engineering seat | Included (Studio) | +**$3,000** Dev Runtime (typ.) | Included | Included in suite | Dev license above | + Studio Enterprise (quoted) |
| Historian | Included (Mongo) | Included (vendor claim) | 500 tags on Standard | +**$3,500** if not in suite | Often + Proficy Historian | Often separate FT Historian |
| Web / mobile clients | Included | + thin-client packs | 1 on Workstation; unlimited on Unlimited | Unlimited (Perspective) | Web client options | ViewPoint included in SE bundle |
| CMMS / work orders | **Integrated `/cmms`** | Third-party | Third-party / MES | Module / external | External | External |
| PdM / failure forecast | **Built-in** | Not standard | Not standard | Not standard | Not standard | Not standard |
| Year-1 support | In SaaS or optional | **~$510** (15% × $3,395) | ~**$2,500** (est. 20%) | **~$2,350** (16% × $14,700) | Support plan (quoted) | Subscription or maintenance |
| **Directional year-1 total** | **~$1,752 – $2,836** (install + renewal + cell) | **~$7K–$12K+** | **~$15K+** | **~$17K–$20K+** | **~$8K–$12K+** | **~$12K–$25K+** (quoted) |

*Competitor add-ons (VTScada alarm notification, Ignition MQTT modules, Wonderware Operations Control SaaS, FactoryTalk Linx, etc.) can increase totals materially.*

---

## Feature comparison matrix

Legend: **●** included / native · **◐** optional / module / partner · **○** not core · **★** mooreVIEW differentiator

| Capability | mooreVIEW | VTScada | Wonderware InTouch | CIMPLICITY | Ignition | FactoryTalk View SE |
|------------|-----------|---------|-------------------|------------|----------|---------------------|
| **Primary fit** | Distributed field assets, service fleets | Water/wastewater, utilities | Process/manufacturing HMI | High-performance plant SCADA | Flexible SCADA/IIoT platform | Rockwell Logix plants |
| **Licensing** | Install once + **monthly renewal** | Per PC + I/O tags | Per edition / Flex tokens | Per I/O points | Per gateway, unlimited tags | Per bundle / subscription |
| **Tag / I/O limits** | Practical scan-engine limits | Explicit tag bands | Unlimited (upper editions) | Point tiers | Unlimited per gateway | Unlimited displays (SE server) |
| **HMI / graphics** | ● Integrated composer | ● Native | ● Industry leader | ● High-performance | ● Vision + Perspective | ● Logix-integrated |
| **PLC / edge logic** | ★ **ST runtime** (Opta, edge) | ◐ Scripts | ◐ | ● | ● Scripting | ◐ Logix primary |
| **Historian / trends** | ● MongoDB | ● Built-in | ◐ Edition limits | ◐ Proficy Historian | ◐ Module / suite | ◐ FT Historian separate |
| **Alarms & annunciation** | ● | ● | ● | ● | ◐ Alarm module | ● |
| **MQTT / IoT fleet** | ★ **Parc hub native** | ◐ | ◐ MQTT drivers | ◐ | ◐ MQTT modules ($) | ◐ |
| **Multi-site fleet view** | ★ Cloud SaaS + Parc | ◐ | ◐ | ◐ Enterprise | ◐ Enterprise module | ◐ |
| **Predictive maintenance** | ★ **PdM + RUL forecast** | ○ | ○ | ○ | ○ | ○ |
| **Integrated CMMS** | ★ **PdM + alarm → WO** | ○ | ○ | ○ | ○ | ○ |
| **Proactive vs reactive** | ★ **PdM before alarm** | ○ Alarm-centric | ○ Alarm-centric | ○ Alarm-centric | ○ Alarm-centric | ○ Alarm-centric |
| **Portable project file** | ★ **`.est` / `.mvbundle`** | ◐ Export | ◐ | ◐ | ● Project export | ◐ |
| **IP cameras / vision AI** | ★ ONVIF + inference | ○ | ○ | ○ | ◐ | ○ |
| **Cellular / remote site** | ★ IoT-Link, cellular SIM mgmt | ● Telemetry drivers | ◐ | ◐ | ◐ Edge | ◐ |
| **Built-in training** | ★ IoT CBM + M0–M15 | ○ | ○ | ○ | ◐ Inductive U (free) | ○ |
| **Windows + Linux appliance** | ● MVP Suite / IoT-Link | ● Windows | ● Windows | ● Windows | ● Cross-platform | ● Windows |
| **Cloud multi-tenant SaaS** | ● Cloud Studio :3100 | ◐ Hosted options | ● AVEVA Connect / Flex | ◐ | ● Ignition Cloud Edition | ◐ |
| **Vendor lock-in** | Open MQTT + Modbus; portable `.est` | VTScada stack | AVEVA ecosystem | GE/Emerson Proficy | Open architecture | **Rockwell-centric** |

---

## Platform notes (pricing sources)

### VTScada (Trihedral)

- **Model:** One-time license per installed PC, sized by **I/O tag count**; thin clients licensed per **concurrent user**.
- **US list (Jul 1, 2025):** 1K I/O Runtime from **$3,395**; 50K I/O from **$7,195** (base server only).
- **Add-ons:** Development Runtime, Alarm Notification, Runtime Connectivity, thin-client packs, multi-server HA bundles.
- **Support:** SupportPlus **15%**/year of software purchase.
- **Strength vs mooreVIEW:** Mature utility SCADA, integrated historian/dialer in base license.
- **Gap vs mooreVIEW:** No native PdM → CMMS loop; tag-band TCO grows with fleet; project portability across edge/cloud is integrator-defined.

*Source: [vtscada.com/scada-software-pricing](https://www.vtscada.com/scada-software-pricing), VTScada US Pricing PDF (Jul 2025)*

### AVEVA Wonderware InTouch

- **Model:** Perpetual MSRP tiers or **AVEVA Flex** subscription tokens.
- **MSRP:** Workstation **$1,850** (1K tags); Unlimited Standard **$12,360**; Unlimited Professional **$20,600**.
- **Historian limits:** Standard includes 500 historian tags; Professional 5,000 (per AVEVA comparison sheets).
- **Strength vs mooreVIEW:** Deep process HMI, situational awareness libraries, enterprise AVEVA stack.
- **Gap vs mooreVIEW:** CMMS and proactive PdM are external; distributed field-service fleet is not the core story; subscription/token TCO at scale.

*Source: [aveva.com InTouch pricing](https://www.aveva.com/en/info/intouch-hmi-pricing/)*

### GE CIMPLICITY (GE Vernova / Emerson)

- **Model:** **Development** vs **Runtime** licenses in **I/O point** bands; unlimited-point SKUs available.
- **Published distributor list (2024 parts):** e.g. 300-point Development **~$7,526** (CI2024SPD00300EN); Development unlimited **~$16,307** (CI2024SPDUNLIMEN); Runtime unlimited **~$10,286** (CI2024SPRUNLIMEN).
- **Strength vs mooreVIEW:** Large fast-moving SCADA sites, automotive/power gen, scripting depth.
- **Gap vs mooreVIEW:** Enterprise integrator sale; no bundled CMMS/PdM; point upgrades are a recurring commercial motion.

*Source: GE Vernova CIMPLICITY part numbers via authorized distributors (Motion World, Jul 2025 listings)*

### Inductive Automation Ignition

- **Model:** **One license per Gateway**; **unlimited tags, clients, connections** on that gateway.
- **Published list:** Platform **$1,200**; **Application Building** suite **$13,500** (Perspective, Vision, Reporting, etc.); à la carte modules $695–$11,225 each.
- **Realistic SCADA stack:** Platform + suite or modules → commonly **$15K–$25K+** per gateway before redundancy, Edge nodes, MES modules.
- **Support:** 16–20–24% annual tiers; major version upgrade **65%** of retail without support.
- **Strength vs mooreVIEW:** Unlimited tag story, modern web (Perspective), huge integrator ecosystem.
- **Gap vs mooreVIEW:** PdM/CMMS/proactive WO not included; module sprawl; multi-site redundancy = multiple gateways/licenses.

*Source: [inductiveautomation.com/pricing/list](https://inductiveautomation.com/pricing/list)*

### Rockwell FactoryTalk View SE

- **Model:** **Subscription** or **perpetual + maintenance**; SE **server bundles** (5 / 10 / 25 clients + unlimited ViewPoint web clients + unlimited displays).
- **Pricing:** Not published as fixed MSRP; Rockwell Commerce and distributors quote by bundle, support tier (8×5 vs 24×7), and agreement type. Forum/distributor reports often cite **$4K–$8K** per component and **$10K–$20K+** for SE bundle + Studio combinations.
- **Strength vs mooreVIEW:** Best-in-class **Logix** integration, plant-standard HMI for Rockwell installs.
- **Gap vs mooreVIEW:** Not built for septic/lift-station contractor fleet economics; no proactive CMMS; multi-vendor Modbus/MQTT field fleets are secondary.

*Source: [FactoryTalk View Ordering Guide](https://literature.rockwellautomation.com/idc/groups/literature/documents/qr/ftalk-qr003_-en-p.pdf), Rockwell Commerce*

---

## Where mooreVIEW wins (commercially and technically)

| Buyer question | Legacy SCADA answer | mooreVIEW answer |
|----------------|--------------------|------------------|
| “What does monitoring cost per site?” | Quote tag bands, seats, integrator hours | **$1,500–$2,500** + **$18–$25/mo** (+ **$3/mo** cell) |
| “Can we fix pumps before overflow?” | Alarms after high level | **PdM forecast → proactive PM WO** days/weeks earlier |
| “Who creates the work order?” | Operator calls dispatch | **Integrated CMMS** (`/cmms`) — PdM, PM, alarm sources |
| “Can we hand the site to another contractor?” | Export tags/screens; often re-engineer | **Portable `.est` project** — program, HMI, PdM context, CMMS |
| “Do we need a SCADA integrator for every site?” | Usually yes | **Vertical `.est` packs** + built-in training (F2) |
| “Cloud fleet for 200 sites?” | Enterprise project + licensing | **Cloud SaaS** + MQTT Parc + site agents |

---

## Where legacy SCADA still leads

Be direct with prospects:

| Requirement | Prefer |
|-------------|--------|
| Large in-plant DCS-style HMI, SIL-rated control room | Wonderware, CIMPLICITY, FactoryTalk |
| Unlimited tags on one plant gateway, SQL-centric IT | Ignition |
| Municipal water/wastewater SCADA with 20-year utility integrator | VTScada |
| All-Rockwell Logix site standard | FactoryTalk View SE + Studio 5000 |
| Refinery / automotive high-channel-count deterministic SCADA | CIMPLICITY, Wonderware System Platform |

mooreVIEW is complementary: it **modernizes the long tail** of underserved distributed assets that cannot justify traditional SCADA economics.

---

## Summary table

| | VTScada | Wonderware | CIMPLICITY | Ignition | FactoryTalk SE | **mooreVIEW** |
|--|---------|------------|------------|----------|----------------|---------------|
| **List price transparency** | High | High (MSRP) | Medium (distributor) | High | Low (quote) | **Published list (v2.1)** |
| **Typical single-site yr 1** | $7K–$15K+ | $12K–$21K+ | $8K–$17K+ | $15K–$25K+ | $10K–$25K+ (quoted) | **~$1,752–$2,836** |
| **Typical recurring** | Support % | Support % | Support % | 16–24% support | Maintenance | **$252–$336/yr** + cell |
| **Tag economics** | Per tag band | Unlimited (upper) | Per point | Unlimited / gateway | Bundle-based | **Not tag-taxed** |
| **Proactive PdM + CMMS** | No | No | No | No | No | **Yes ★** |
| **Portable project** | Partial | Partial | Partial | Yes | Partial | **`.est` ★** |
| **Field-service fleet** | Add-on | Add-on | Add-on | Possible | Rockwell-first | **Native ★** |

---

## Market revenue potential (mooreVIEW vs SCADA economics)

At **$1,752 – $2,836** year-1 per site (list) vs **$7K – $25K+** SCADA software-only, mooreVIEW unlocks **volume** the legacy vendors cannot pursue:

| mooreVIEW metric | Directional target |
|------------------|-------------------|
| Year-1 portfolio revenue (237 sites) | **~$570K** |
| Year-3 portfolio revenue (~1,500 sites) | **~$3.5M** |
| 5-year recurring ARR (wastewater SAM) | **$15 – 25M** |
| 5-year recurring ARR (all verticals) | **$50 – 120M** |
| Steady recurring per commercial site | **$336/yr** |

**Implication:** Competitors need **integrator margin + tag licensing**; mooreVIEW needs **monitoring-contract attach at scale** — different revenue math, same proactive outcome.

---

## Disclaimer

Competitor prices are **public list, MSRP, or distributor-published figures** as of **2025–2026** and **exclude** integrator labor, hardware, taxes, and discounts. Rockwell and Emerson/GE quotes vary by region and agreement. mooreVIEW list prices from **Pricing Guide v2.4** — contact The Purple Standard / mooreVIEW for formal quotes.

**mooreVIEW** is a company powered by [The Purple Standard](https://purple-standard.com). © Purple Standard Holdings.
