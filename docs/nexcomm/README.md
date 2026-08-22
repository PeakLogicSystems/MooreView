# Nexcomm + mooreVIEW — Integration & Partnership

Integration briefs and **partnership discussion** for **Nexcomm Systems** hardware/cloud and the **mooreVIEW** process layer (PdM → CMMS, fleet HMI, AI).

| Document | Purpose |
|----------|---------|
| **[Partnership Discussion & MOU Brief](MooreVIEW-Nexcomm-Partnership-Discussion-MOU.md)** | Executive alignment · financials · MOU term sheet · ACE 2,000+ lift base · [PDF](MooreVIEW-Nexcomm-Partnership-Discussion-MOU.pdf) |
| **[Putnam County integration](putnam-county-integration.md)** | Live pilot — 6 Nexcomm lifts + MLE WWTP · Track A MQTT · Azure bridge |
| [ALF Living Campus](alf-halow-story.md) | HaLow MDU / campus story |
| [Convenience store / gas station](cstore-halow-story.md) | HaLow c-store story |

**Lift station (MQTT):** `lift_station_epi` template · **`npm run generate:putnam-fleet`** (Putnam County pilot) · **`npm run generate:ace-fleet`** (ACE LiftPoint Light scaffold).

**Azure ingest bridge:** [Service Bus → MQTT](../../services/nexcomm-sb-mqtt-bridge/README.md) — forwards Nexcomm / IoT Hub queue telemetry to mooreVIEW Mosquitto without changing MV drivers.

**Source deck:** `Nexcomm Applications 260114-1.pptx` (Jan 2026) — HaLow applications for gas station/c-store, MDU room, MDU facility, and HVAC split-system monitoring.
| Story | Nexcomm slide | MV vertical | PDF |
|-------|---------------|-------------|-----|
| [ALF Living Campus](alf-halow-story.md) | MDU facility + HVAC | Institutional / ALF (#10) | [PDF](MooreVIEW-Nexcomm-ALF-HaLow-Story.pdf) |
| [Convenience store / gas station](cstore-halow-story.md) | Gas station / c-store | Cold chain / c-store (#5) | [PDF](MooreVIEW-Nexcomm-CStore-HaLow-Story.pdf) |

**Shared stack:** HaLow sensors → site gateway (IoT-Link / Nexcomm Nexus AP) → optional cellular → Parc MQTT (`mooreview/v1`) + Nexcomm MQTT topics → mooreVIEW historian · HMI · CMMS · PdM · cloud fleet.

**Device templates:** `src/devices/templates/nexcomm_*.json` · **`lift_station_epi`** (EdgePoint Industrial / LiftPoint — Nexus Cloud register map, MQTT) · **Generators:** `npm run generate:putnam-fleet` · `npm run generate:ace-fleet` · `npm run generate:alf-halow` · `npm run generate:cstore-halow` · **PDFs:** `npm run build:nexcomm-story-pdfs`
**Marketplace context:** [est/docs/marketplace](../../est/docs/marketplace/README.md) · [MooreVIEW product description](../marketing/MooreVIEW-Product-Description.md)
