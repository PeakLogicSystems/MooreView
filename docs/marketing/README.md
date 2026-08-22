# mooreVIEW marketing & sales docs

**Distribution repo:** [github.com/mooreview/mooreview-docs](https://github.com/mooreview/mooreview-docs) — consolidated help, training, marketing PDFs, and platform guides.

Distribution-ready PDFs and source Markdown for product positioning, pricing, and infrastructure planning. Keep **version numbers in sync** across related docs when updating features.

## Current documents

| Document | Version | PDF build |
|----------|---------|-----------|
| [MooreVIEW-Product-Description.md](./MooreVIEW-Product-Description.md) | 1.4 | `npm run build:product-description-pdf` |
| [MooreVIEW-Pricing-Guide.md](./MooreVIEW-Pricing-Guide.md) | 2.4 | `npm run build:pricing-guide-pdf` |
| [MooreVIEW-Product-Market-Entry.md](./MooreVIEW-Product-Market-Entry.md) | 1.4 | `npm run build:market-entry-pdf` |
| [MooreVIEW-SCADA-Competitive-Comparison.md](./MooreVIEW-SCADA-Competitive-Comparison.md) | 1.0 | `npm run build:scada-comparison-pdf` |
| [MooreVIEW-Subscription-Sell-Sheet.md](./MooreVIEW-Subscription-Sell-Sheet.md) | 1.1 | `npm run build:subscription-sell-sheet-pdf` |
| [MooreVIEW-Infrastructure-Projections.md](./MooreVIEW-Infrastructure-Projections.md) | 1.0 | `npm run build:infrastructure-projections-pdf` |
| [CLOUD_INFRA_PRICING.md](./CLOUD_INFRA_PRICING.md) | 1.0 | `npm run build:cloud-infra-pricing-pdf` |

**Cloud vertical shards (platform):** `docs/CLOUD_VERTICAL_SHARDS.md` · `npm run build:cloud-vertical-shards-pdf`

**Build both cloud planning PDFs:** `npm run build:cloud-planning-pdfs`

**Build all core PDFs + archive:** `npm run build:marketing-pdfs`

Version history: [versions/README.md](./versions/README.md)

## Vertical marketplace plans (est repo)

Industry-specific business plans (summary + detailed + PDF where noted): [marketplace README](https://github.com/mooreview/mooreview-est/blob/master/docs/marketplace/README.md) — **seven verticals** including consolidated **Wastewater (Lift + ATU + WWTP)** #7.

## Training & in-app help

| Resource | Location |
|----------|----------|
| IoT CBM course + mooreVIEW labs M0–M15 | `docs/training/` · **F2** in-product |
| Full help browser | **F1** in-product · `public/js/help.js` |
| Training reference pack (offline) | `docs/training/reference/` · `scripts/sync-training-reference.ps1` |

## Product implementation cross-links

| Topic | Doc |
|-------|-----|
| PdM → proactive CMMS | `docs/pdm/PDM_PROACTIVE_CMMS.md` |
| Integrated CMMS | `docs/CMMS_APPLIANCE.md` |
| Portable `.est.zip` projects | F1 → Projects · `docs/ARCHIVE_EXPORT.md` (cloud historian) |
| BACnet/IP (edge) | `docs/BACNET.md` |
| Facility PQ (EZ Meter) | `docs/facilities/EZMETER_FACILITY_PQ.md` |
| Edge vs cloud parity | `docs/EST_PC_PARITY.md` |
| Cloud vertical shards | `docs/CLOUD_VERTICAL_SHARDS.md` |
| Cloud infra pricing (0–36 mo) | `docs/marketing/CLOUD_INFRA_PRICING.md` |
| Cloud SaaS deploy | `docs/CLOUD_DEPLOY_DO.md` · `docs/CLOUD_USER_GUIDE.md` |
