# Training materials

mooreVIEW includes a structured **IoT Condition-Based Monitoring (CBM)** curriculum for operations, service, installation, and sales personnel.

## Reference pack (all materials in one place)

**`reference/`** — copies of curriculum + every guide cited in training (cameras, Parc, CMMS, Opta, MV Draw, etc.). Regenerate:

```powershell
powershell -File scripts/sync-training-reference.ps1
```

## Files

| File | Description |
|------|-------------|
| [iot-cbm-training.md](./iot-cbm-training.md) | Full course (13 modules) with mooreVIEW lab pointers |
| [instructor-guide.md](./instructor-guide.md) | **Instructor guide** — prep, schedules, rubrics, module-by-module teaching notes |
| [quizzes-answer-key.md](./quizzes-answer-key.md) | **Module quiz answer key** (mooreVIEW M4/M5 include BACnet items; most quizzes 5 questions each) |
| [../CAMERAS.md](../CAMERAS.md) | IP camera integration — ONVIF, go2rtc, GridFS, vision AI |
| [../CLOUD_SAAS.md](../CLOUD_SAAS.md) | Cloud SaaS overview (port 3100) |
| [../CLOUD_DEPLOY_DO.md](../CLOUD_DEPLOY_DO.md) | DigitalOcean droplet install runbook |
| [../CLOUD_USER_GUIDE.md](../CLOUD_USER_GUIDE.md) | Tenant operator guide |
| [../CMMS_APPLIANCE.md](../CMMS_APPLIANCE.md) | Integrated CMMS (`/cmms`) on appliance and cloud |
| [../pdm/PDM_PROACTIVE_CMMS.md](../pdm/PDM_PROACTIVE_CMMS.md) | PdM → proactive CMMS PM work orders |
| [../pdm/LIFT-STATION-PDM-TRAINING-REVIEW.md](../pdm/LIFT-STATION-PDM-TRAINING-REVIEW.md) | Lift-station PdM asset setup and training data |
| [../testing/FULL_SYSTEM_TEST.md](../testing/FULL_SYSTEM_TEST.md) | Full UI/system validation checklist (PDF: `npm run build:full-system-test-pdf`) |
| [../BACNET.md](../BACNET.md) | BACnet/IP driver — discovery, browse, tag import (edge appliance) |
| [../facilities/EZMETER_FACILITY_PQ.md](../facilities/EZMETER_FACILITY_PQ.md) | EZ Meter DDS-RGB Modbus — full map + facility PQ derived measurement set |
| [../ARCHIVE_EXPORT.md](../ARCHIVE_EXPORT.md) | Cloud historian: 7-day hot Mongo → zstd archive server |
| [../EST_PC_PARITY.md](../EST_PC_PARITY.md) | Edge appliance vs Cloud SaaS feature matrix |
| [../UPDATES.md](../UPDATES.md) | Push updates to GitHub and Linux targets |
| [../MV-WORKSTATION-CURSAVES.md](../MV-WORKSTATION-CURSAVES.md) | MV-workstation setup + Cursor chat sync (cursaves) |
| [../marketing/README.md](../marketing/README.md) | Sales PDFs — product description, pricing, sell sheet, infrastructure |
| [IoT-Condition-Monitoring-Training.pdf](./IoT-Condition-Monitoring-Training.pdf) | Original PDF (if present in repo) |

## In-app access

1. Start mooreVIEW (`npm start`)
2. Press **F2** or click **Tools → Training**
3. Learners: Overview, mooreVIEW, IoT CBM, Mapping, Parc, **Quizzes**, Assessments, Glossary
4. Trainers: **Instructor** tab (abbreviated guide; full text in `instructor-guide.md`)

## Suggested lab environment

- mooreVIEW MVP Suite on a laptop (`http://127.0.0.1:3090`) or Cloud SaaS locally (`npm run start:saas` → `http://127.0.0.1:3100`)
- Optional MongoDB for Modules 8–10 (historian + PdM) and **M15** (GridFS camera archive + AI history)
- One ONVIF IP camera on classroom LAN for **M15** (Reolink recommended)
- Field hardware for Modules 6–7 and capstone: Arduino Opta MQTT Parc ST, LilyGO T-ETH / T-HaLow peers
- Optional **M4/M5 BACnet lab:** edge appliance on a BMS VLAN or BACnet/IP simulator — driver type `bacnet`, **Discover devices**, **Browse & import tags** (see `docs/BACNET.md`)
- Optional **M4 EZ Meter PQ lab:** USB-RS485 to EZ Meter or Modbus simulator — full map template then **facility PQ derived measurement set** (see `docs/facilities/EZMETER_FACILITY_PQ.md`)

## Course levels

| Level | Duration | Modules |
|-------|----------|---------|
| Basic | 1 day | 1–4, 8 (overview) |
| Intermediate | 2 days | 1–10 |
| Advanced | 3 days | Full course + capstone |
