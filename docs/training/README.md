# Training materials

MooreVIEW includes a structured **IoT Condition-Based Monitoring (CBM)** curriculum for operations, service, installation, and sales personnel.

## Reference pack (all materials in one place)

**`reference/`** — copies of curriculum + every guide cited in training (cameras, Parc, CMMS, Opta, MV Draw, etc.). Regenerate:

```powershell
powershell -File scripts/sync-training-reference.ps1
```

## Files

| File | Description |
|------|-------------|
| [iot-cbm-training.md](./iot-cbm-training.md) | Full course (13 modules) with MooreVIEW lab pointers |
| [instructor-guide.md](./instructor-guide.md) | **Instructor guide** — prep, schedules, rubrics, module-by-module teaching notes |
| [quizzes-answer-key.md](./quizzes-answer-key.md) | **Module quiz answer key** (29 quizzes, 5 questions each) |
| [../CAMERAS.md](../CAMERAS.md) | IP camera integration — ONVIF, go2rtc, GridFS, vision AI |
| [IoT-Condition-Monitoring-Training.pdf](./IoT-Condition-Monitoring-Training.pdf) | Original PDF (if present in repo) |

## In-app access

1. Start MooreVIEW (`npm start`)
2. Press **F2** or click **Tools → Training**
3. Learners: Overview, MooreVIEW, IoT CBM, Mapping, Parc, **Quizzes**, Assessments, Glossary
4. Trainers: **Instructor** tab (abbreviated guide; full text in `instructor-guide.md`)

## Suggested lab environment

- MooreVIEW MVP Suite on a laptop (`http://127.0.0.1:3090`)
- Optional MongoDB for Modules 8–10 (historian + PdM) and **M15** (GridFS camera archive + AI history)
- One ONVIF IP camera on classroom LAN for **M15** (Reolink recommended)
- Field hardware for Modules 6–7 and capstone: Arduino Opta MQTT Parc ST, LilyGO T-ETH / T-HaLow peers

## Course levels

| Level | Duration | Modules |
|-------|----------|---------|
| Basic | 1 day | 1–4, 8 (overview) |
| Intermediate | 2 days | 1–10 |
| Advanced | 3 days | Full course + capstone |
