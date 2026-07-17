# MooreVIEW + IoT CBM — Instructor Guide

**Version 1.1** · For trainers delivering the unified MooreVIEW (M0–M15) and IoT Condition-Based Monitoring (CBM-1–CBM-13) curriculum.

**Learner access:** Tools → Training (F2) in MooreVIEW MVP Suite  
**Trainer reference:** This document + Training → Instructor tab (F2)

---

## 0. Opening introduction

Open every new cohort with this **Who / Where / What / Why / How** script (also on F2 → Overview). Keep jargon out; define terms as you go.

| Question | Say this |
|----------|----------|
| **Who** | “This class is for people who fix and watch building equipment—techs, electricians, maintenance, and managers. You do not need to be a programmer to start.” |
| **Where** | “Today we work on your laptop in MooreVIEW. On real sites, sensors sit in mechanical rooms and on roofs. MooreVIEW can run on your computer or talk to equipment through a gateway.” |
| **What** | “MooreVIEW is software that shows if equipment is healthy—temperature, leaks, motor run time, alarms. We learn two things: why monitoring matters (CBM), and how to set up MooreVIEW step by step.” |
| **Why** | “We monitor so we fix problems before something breaks. That saves money, keeps people safe, and avoids midnight emergency calls.” |
| **How** | “We follow lessons in Training (F2). You will connect sensors to MooreVIEW, build a screen operators can use, set alarms, and read trends. Labs are hands-on—ask questions as we go.” |

**Time:** 10–15 minutes + 2–3 student questions. Point students to F2 → Overview table before Module 1 or M0.

---

## 1. How to use this guide

This guide is written for **instructors**, not students. Each module section includes:

| Section | Purpose |
|---------|---------|
| **Time** | Suggested classroom + lab minutes |
| **Prep** | What to verify before class |
| **Teach** | Suggested lecture/demo sequence |
| **Lab facilitation** | Step-by-step while students work |
| **Discussion** | Questions to check understanding |
| **Pitfalls** | Frequent student mistakes |
| **Verify** | Observable pass criteria before moving on |
| **Short / long** | What to cut or extend if off schedule |

**Delivery models:**

| Model | Audience | Duration | Modules |
|-------|----------|----------|---------|
| CBM Basic | Sales, facility staff | 1 day | CBM-1–4 + M0 overview |
| CBM Intermediate | Technicians | 2 days | CBM-1–10 + M6/M8/M9 labs |
| CBM Advanced certification | Integrators | 3 days | Full CBM + capstone |
| MooreVIEW Operator | Plant operators | ~12 h | M0, M1, M3, M6, M8, M9, M13 |
| MooreVIEW Integrator | Commissioners | ~7 days | M0–M15 |
| Combined bootcamp | Mixed cohort | 5–10 days | Map CBM theory to MooreVIEW labs via **Mapping** tab |

Run **F2 → Mapping** on the projector so students see how CBM modules align with MooreVIEW labs.

---

## 2. Instructor qualifications

Trainers should be comfortable with:

- Starting MooreVIEW (`npm install` → `npm run start:pc` → `http://127.0.0.1:3090`)
- Project save/open, Drivers, Tags, Program (ST), HMI, System setup
- At least one field bus (Modbus RTU or mock driver) and one Parc path (Opta MQTT)
- Basic networking: IP, DHCP, broker host/port, cellular APN concept

For **M7/M14**, pre-run the Parc baseline lab yourself within 48 hours of class.

---

## 3. Pre-course checklist (all deliveries)

### 3.1 Software (per student laptop)

- [ ] Node.js LTS installed
- [ ] `est-pc` repo cloned; `npm install` completed
- [ ] `npm run start:pc` reaches MVP Suite without errors
- [ ] Optional: MongoDB running if teaching M8/M10/M11 historian archive
- [ ] Browser: Chrome or Edge (avoid IE)

### 3.2 Instructor machine (master demo)

- [ ] Known-good `.est` project for each vertical you will demo (pool, assisted living, etc.)
- [ ] Motor HOA ST fixture loads and runs
- [ ] F1 Help opens; F2 Training opens all tabs
- [ ] Screen sharing tested (projector resolution ≥ 1920×1080 recommended)

### 3.3 Hardware bench (integrator / advanced tracks)

| Item | Modules | Notes |
|------|---------|-------|
| Arduino Opta + MQTT Parc ST firmware | M7, M14, capstone | Flash before class; note deviceId on label |
| USB/Ethernet to Opta | M7 | Bench DHCP or static |
| Local MQTT broker | M7, M14 | Mosquitto on instructor PC or Pi |
| LilyGO T-HaLow (optional) | M14 | Template #2 pre-selected if possible |
| LilyGO T-ETH gateway (optional) | M14, CBM-7 | SIM activated; cloud broker creds in gateway only |
| ONVIF IP camera (Reolink) | M15 | ONVIF + RTSP enabled; on same LAN as laptops |
| go2rtc binary | M15 | Run `npm run go2rtc:download` before class |
| Modbus device or mock | M4 | Datexel template or internal mock |
| CT, leak rope, thermistor demo | CBM-3, CBM-6 | For sensor ID exercise |
| DMM, network tester | CBM-6, CBM-12 | |

### 3.4 Network

- [ ] Classroom Wi-Fi or wired LAN; students can reach instructor broker IP
- [ ] Firewall allows MQTT 1883 on lab VLAN (or document workaround)
- [ ] If cellular gateway demo: verify LTE signal at venue

### 3.5 Printed / shared materials

- [ ] Role track handout (Operator vs Integrator module list)
- [ ] Checkpoint rubrics (Section 5)
- [ ] Capstone team assignment sheet (Section 16)

---

## 4. Classroom layout

**Recommended:** Lecture facing screen; lab in pairs (two laptops per bench device).

| Phase | Layout |
|-------|--------|
| Concept (CBM-1–5) | Rows; slides or F2 Overview |
| MooreVIEW UI (M0–M2) | Follow-along on own laptops |
| Drivers/ST (M3–M6) | Pairs; one “driver” laptop per bench I/O |
| Parc (M7, M14) | Rotating queue to shared Opta bench |
| Capstone | Teams of 3–4 with assigned roles: lead, network, HMI, documentation |

**Projector rule:** Instructor drives demo project; students use **their own** projects for labs unless sharing hardware.

---

## 5. Assessment rubrics

### 5.1 CBM certification weights

| Component | Weight | Instructor notes |
|-----------|--------|------------------|
| Module quizzes | 20% | One quiz per day; open-book allowed for MooreVIEW UI paths |
| Installation lab | 20% | CBM-6; observe mounting, wiring, tag mapping |
| Dashboard configuration | 15% | CBM-8 / M6; bindings must show live values |
| Alarm configuration | 15% | CBM-9 / M9; must trip, display, and ack |
| Troubleshooting exercise | 10% | CBM-12; inject one fault (broker down, wrong slave ID) |
| Final capstone | 20% | CBM-13; use rubric below |

### 5.2 MooreVIEW checkpoints

| Gate | Format | Pass (all required) | Fail triggers |
|------|--------|---------------------|---------------|
| **A** (after M2) | Oral + screen | Names template vs fixture vs composite; opens saved `.est` | Cannot find Project menu or confuses template with tag |
| **B** (after M6) | Lab | Tags live; ST running; HMI composite bound; starting screen set | HMI shows `???` bindings; runtime stopped |
| **C** (after M7) | Lab | Parc hub enabled; Opta telemetry; remote Download & Start | No telemetry; cmd timeout |
| **D** (after M14) | Lab | T-HaLow tags in hub **or** T-ETH cloud bridge forwarding | Wrong deviceId; broker on wrong interface |
| **E** (after M15, optional) | Lab | Camera probed; HMI popup live; one GridFS snapshot | ONVIF off; no Mongo URI |
| **Final** | Demo 10 min | Vertical walkthrough: HMI + alarm ack + one trend | Cannot ack alarm or explain tag source |

### 5.3 Capstone rubric (100 points)

| Criterion | Points |
|-----------|--------|
| Site survey / sensor plan documented | 10 |
| Gateway commissioned (Parc or Modbus path) | 20 |
| MooreVIEW project: drivers + tags correct | 15 |
| ST or logic running; outputs respond | 15 |
| HMI usable by operator | 15 |
| Alarms configured and demonstrated | 10 |
| Historian or trend shown | 10 |
| Team presentation clear | 5 |

---

## 6. Delivery schedules

### 6.1 CBM certification — 3 days

| Day | AM | PM |
|-----|----|----|
| 1 | CBM-1, CBM-2, CBM-3 + quiz | CBM-4, CBM-5; M0 demo |
| 2 | CBM-6 install lab | CBM-7, CBM-8 + M6 dashboard lab |
| 3 | CBM-9, CBM-10 | CBM-11, CBM-12; CBM-13 capstone presentations |

### 6.2 MooreVIEW integrator — 7 days

| Day | Modules | Checkpoint |
|-----|---------|------------|
| 1 | M0, M1, M2 | A |
| 2 | M3, M4 | — |
| 3 | M5, M6 | B |
| 4 | M7 | C |
| 5 | M8, M9 | — |
| 6 | M14 | D |
| 7+ | M10–M13, M15 | E (optional) / Final |
| 7+ | M10, M11, M12, M13 | Final |

### 6.3 One-day executive overview

M0 (30 m) → CBM-1 (45 m) → CBM-2 architecture (45 m) → live M6 HMI demo (30 m) → M11 PdM demo (30 m) → Q&A.

---

## 7. MooreVIEW modules — instructor notes

### M0 — Product map & first launch (60 min)

**Prep:** Clean `data/projects/` on demo machine; verify port 3090 free.

**Teach (30 min):**

1. MooreVIEW product family: MVP Suite (local appliance) vs Cloud Studio vs embedded `.est` on edge.
2. Live start: terminal `npm run start:pc`, browser URL, top bar Project ▾ / Tools ▾.
3. F1 Help vs F2 Training — students will use both all week.
4. Show one vertical `.est` (assisted living or pool) — do not commission yet.

**Lab (25 min):** Each student starts suite, opens F1 Getting started, creates empty project, saves as `training-{name}.est`.

**Discussion:** Where does ST run? (PC runtime vs Opta remote vs cloud)

**Pitfalls:** Students open wrong port; npm not in PATH; confuse repo folder with project file.

**Verify:** Every student has MVP Suite home screen and saved project.

**Short:** Skip Cloud Studio mention. **Long:** Open `docs/ARCHITECTURE.md` skim.

---

### M1 — UI layout, roles & projects (90 min)

**Prep:** Prepare sample exported `.est.json` on USB/share.

**Teach (40 min):**

1. Screen regions: top bar, canvas, popups (Program, Tags, Drivers…).
2. Project lifecycle: New, Open, Save, Save as, Export.
3. Roles concept: operator vs technician vs integrator (site policy; show user-facing features only).
4. Tools menu tour — match to commissioning spine on F2 Overview.

**Lab (45 min):** New project → Save as → Export → reopen from `data/projects/`.

**Discussion:** Why portable `.est`? (backup, version control, site handoff)

**Pitfalls:** Save vs Save as; export path confusion.

**Verify:** Student reopens their exported file; title bar shows correct project name.

---

### M2 — Commissioning path (120 min)

**Prep:** Pre-load device template (Datexel or mock); one HMI composite ready in scratch project.

**Teach (35 min):**

1. Walk F1 Commissioning tutorial on projector — **do not skip** template vs fixture vs composite.
2. Commissioning spine: Project → Drivers → Tags → Program → Force → HMI → System setup.
3. “Apply” semantics — driver Apply vs HMI Apply vs System setup Apply.

**Lab (75 min):** Students follow F1 tutorial with template + one composite.

**Discussion:** What order would you change for a site with no ST? (Drivers → Tags → HMI)

**Pitfalls:** Skipping Validate; forgetting System setup Apply; composite bindings left default.

**Verify — Checkpoint A:** Oral quiz + show saved `.est`.

---

### M3 — Tags, scaling, Force & Live I/O (120 min)

**Prep:** ST program that reacts to digital input (motor HOA fixture).

**Teach (30 min):**

1. Tag id vs Label; data types; engineering units.
2. Scaling linear; alarm limits preview (detail in M9).
3. Force: safety — commissioning only; always clear before handoff.
4. Live I/O panel.

**Lab (80 min):** Force input; watch ST in Program trace; clear Force.

**Discussion:** When is Force dangerous in production?

**Pitfalls:** Forcing outputs on live equipment; wrong tag id in ST.

**Verify:** Trace shows forced value; ST logic responds.

---

### M4 — Drivers, templates & field buses (150 min)

**Prep:** Modbus RTU USB adapter or mock; know COM port on instructor machine.

**Teach (45 min):**

1. Driver card: Edit, Test, Apply, Sync.
2. Apply device template — what it creates (driver + tags).
3. Modbus RTU troubleshooting tree — F1 Serial port troubleshooting.
4. Brief: MQTT, HTTPS, `mqtt_parc` preview for M7.

**Lab (95 min):** Apply template → Test driver → verify tags.

**Discussion:** Difference between driver scan and template?

**Pitfalls:** Wrong COM port; slave ID mismatch; Apply without Test.

**Verify:** Test passes; tag values update (or mock simulates).

---

### M5 — ST program & scan-cycle runtime (180 min)

**Prep:** Motor HOA fixture; intentional syntax error for Validate demo.

**Teach (50 min):**

1. ST editor: Validate, download to **local** runtime.
2. Scan cycle: read → execute ST → write.
3. Start / Pause / Stop; live trace.
4. Remote execution preview (M7).

**Lab (120 min):** Load fixture, Validate, Start, Force HOA inputs.

**Discussion:** What happens on Pause?

**Pitfalls:** Editing while running without re-validate; confusing program with driver.

**Verify:** Runtime status Running; trace moves each scan.

---

### M6 — HMI composer & operator display (150 min)

**Prep:** Tags from M5 named consistently for bindings.

**Teach (40 min):**

1. HMI Setup… grid; composites palette.
2. Bindings — tag picker; Apply.
3. Starting screen; operator vs technician refresh.

**Lab (100 min):** Motor/HOA composite, bind, Apply, set starting screen.

**Discussion:** What makes an HMI “operator grade”?

**Pitfalls:** Unbound `???`; forgot Apply; wrong starting screen.

**Verify — Checkpoint B:** Full commission path on student project.

---

### M7 — MQTT Parc hub & Arduino Opta (180 min)

**Prep:** Opta flashed with `arduino-opta-mqtt-st`; broker running; `docs/BASELINE_TEST.md` steps numbered on whiteboard.

**Teach (45 min):**

1. Parc topic map (F2 → Parc tab) — draw on whiteboard.
2. System setup → MQTT Parc: enable hub, broker URL.
3. `mqtt_parc` driver; deviceId vs Position ID.
4. Sync tags from device; Program → Remote → Download & Start.

**Lab (120 min):** Students rotate on Opta bench; pairs trace telemetry in MQTT Explorer optional.

**Discussion:** Where do credentials live for cloud? (gateway vs Opta)

**Pitfalls:** Hub not enabled; wrong broker IP; deviceId typo; forgot Sync tags.

**Verify — Checkpoint C:** Telemetry + successful remote start.

**Short:** Skip Position ID. **Long:** OTA demo via `/api/firmware`.

---

### M8 — Historian, pens & reports (120 min)

**Prep:** MongoDB optional; two tags with changing values (sim or Force).

**Teach (35 min):**

1. Hist flag on tag vs Pen config for display.
2. Logger; live buffer vs archive.
3. Report export CSV/PDF.

**Lab (75 min):** Enable Hist on two tags; 5 min capture; export CSV.

**Pitfalls:** Hist not checked; runtime stopped; Mongo URI blank when expecting archive.

**Verify:** CSV contains timestamps and values.

---

### M9 — Alarms, notifications & CMMS (120 min)

**Prep:** Tag with IH limit; CMMS_INTEGRATION.md example visible.

**Teach (35 min):**

1. Alarm limits on Tags; active alarm list.
2. Ack workflow; operator responsibility.
3. CMMS MQTT bridge overview (conceptual).

**Lab (75 min):** Trip high limit; Ack; read CMMS doc.

**Pitfalls:** Limits on wrong tag; BOOL vs REAL alarm types confused.

**Verify:** Alarm appears, ack clears or documents per site policy.

---

### M10 — MV Draw site plans (120 min)

**Prep:** Assisted-living plan asset; `mv-draw/README.md` open.

**Teach (30 min):** Open plan, scale, symbols, save in bundle context.

**Lab (85 min):** Place symbols; save/reload.

**Short:** Skip bundle packaging. **Long:** `.mvbundle` export demo.

---

### M11 — PdM & ROI (90 min)

**Prep:** Demo project with historian or edge inference samples.

**Teach (30 min):** PdM asset map, health index, forecast banner, ROI calculator.

**Lab (50 min):** F1 PdM walkthrough; simulate motor start if no edge device.

**Pitfalls:** No data — use Simulate motor start in UI.

---

### M12 — Cloud Studio & entitlements (120 min)

**Prep:** Cloud seed script run; test login with organization ID `demo`.

**Teach (40 min):**

1. **Organization ID** at sign-in (UI label) vs API field `tenantSlug`.
2. **Sites** (`/sites`) — locations, station codes, online/firmware badges.
3. **All devices** (`/sites/devices`) — sort/filter by SIM, serial, online, commissioning.
4. **Assets map** (`/fleet`) — pump symbols: green OK, yellow warning, red alarm, gray offline.
5. Edge vs cloud field buses; Modbus stays on edge appliances.
6. **Studio** — Deploy project / Share project for MV Cloud catalog per site.

**Lab (70 min):**

1. Sign in with organization ID, email, password.
2. Open **Sites** and **All devices**; explain one row (type, SIM, commission state).
3. Open **Assets** map; identify alarm colors on the legend.
4. Open **Studio**; pick a site; run **Deploy project…** or **Share project…**.
5. Document one edge-only feature (e.g. Modbus driver).

**Verify:** Student explains organization ID, device inventory, and map symbology.

**Short:** Slides only if cloud unavailable.

---

### M13 — Vertical lab (180 min)

**Prep:** One vertical `.est` per team; generate script tested.

**Teach (20 min):** Assign vertical: pool, wastewater, assisted living, duplex pump.

**Lab (150 min):** M2–M6 path on vertical; peer demo.

**Verify — Final:** 10 min demo per team.

---

### M14 — Parc edge peers (180 min)

**Prep:** M7 must be complete on bench; T-HaLow AP charged; gateway SIM active.

**Teach (40 min):**

1. LilyGO as Parc peers — same topics, different platform ids.
2. T-HaLow: setup AP vs HaLow data path.
3. T-ETH: local broker 192.168.1.1 → cellular cloud forward.

**Lab (130 min):** Template #2 on T-HaLow; or gateway bridge demo.

**Verify — Checkpoint D:** HaLow tags in MooreVIEW or cloud sees Opta telemetry via bridge.

---

### M15 — IP cameras & vision AI (150 min)

**Prep:** One ONVIF camera on classroom LAN (Reolink recommended); `npm run go2rtc:download` run; MongoDB optional but needed for GridFS lab.

**Teach (30 min):**

1. ONVIF discover/probe workflow — Tools → Cameras.
2. go2rtc vs MJPEG fallback — when each applies.
3. GridFS snapshot archive — same Mongo as historian.
4. I/O overlay registry — map BOOL tags to video positions; tag bridge snapshots on edges.
5. Vision AI paths: post-capture, live edge, ONVIF motion; stub vs HTTP backend.

**Lab (110 min):** Set credentials → Discover → Probe → Detail overlays → HMI **Camera + I/O overlays** tile → Capture snapshot → Run infer (stub). Optional: enable go2rtc and verify player.

**Verify — Checkpoint E:** Live HMI embedded video with at least one overlay reacting to a BOOL tag + one snapshot in GridFS (or manual capture if Mongo unavailable — explain limitation).

**Reference:** `docs/CAMERAS.md`, F1 → Cameras & video.

---

## 8. IoT CBM modules — instructor notes

### CBM-1 — Introduction to CBM (60 min)

**Teach:** Maintenance strategies table; downtime cost story; ROI narrative.  
**Exercise:** Small groups compare costs for one pump — report back.  
**MooreVIEW link:** Show Historian trend + PdM screenshot (M11 preview).  
**Quiz:** 5 questions — define CBM, name three strategies.

---

### CBM-2 — IoT fundamentals (75 min)

**Teach:** Sensor → gateway → cloud → app diagram; link to Parc `mooreview/v1`.  
**Activity:** Draw architecture for commercial building — compare to F2 Parc tab.  
**MooreVIEW link:** Drivers overview; mention `mqtt_parc`, Modbus, HTTPS.

---

### CBM-3 — Sensors (90 min)

**Teach:** Sensor table (temp, vibration, CT, leak…).  
**Exercise:** Match sensor to asset — use physical samples pass around.  
**MooreVIEW link:** Device templates in Drivers.

---

### CBM-4 — Residential applications (60 min)

**Case study:** Whole-home — leak + temp alarms.  
**MooreVIEW link:** Residential tags in assisted-living demo.

---

### CBM-5 — Commercial applications (60 min)

**Case study:** Multi-site office — centralized alarms.  
**MooreVIEW link:** Position ID vs deviceId (M7 concept).

---

### CBM-6 — Installation & commissioning (120 min)

**Lab:** Mount sensors on demo skid; map to tags; Live I/O check.  
**Safety:** PPE, de-energize before wiring demos.  
**MooreVIEW link:** M2 spine + M4 drivers.

---

### CBM-7 — Connectivity & networking (90 min)

**Teach:** DHCP, static IP, VLAN, cellular APN, VPN.  
**Exercise:** Plan IP table for classroom bench.  
**MooreVIEW link:** M7 broker IP; gateway `/setup` on 192.168.4.1.

---

### CBM-8 — Cloud & dashboards (120 min)

**Exercise:** HVAC dashboard — supply air, fan HOA, high temp alarm.  
**MooreVIEW link:** M6 lab — same session if schedule allows.

---

### CBM-9 — Alarm management (90 min)

**Lab:** Four alarm types — temp, vibration, leak, power fail.  
**MooreVIEW link:** M9 lab.

---

### CBM-10 — Data analysis & PdM (90 min)

**Exercise:** Interpret six-month trend; discuss RUL.  
**MooreVIEW link:** M8 + M11; Build features now.

---

### CBM-11 — Cybersecurity (60 min)

**Teach:** MFA, segmentation, credentials on gateway not field device.  
**Exercise:** Review roles on sample project.

---

### CBM-12 — Troubleshooting (90 min)

**Format:** Fault injection — instructor breaks one thing per team.

| Injected fault | Expected diagnosis |
|----------------|-------------------|
| Broker stopped | Parc offline; check hub |
| Wrong Modbus slave | Test fails |
| Hist disabled | Flat trend |
| ST stopped | Outputs frozen |

**MooreVIEW link:** F1 device guides + driver Test.

---

### CBM-13 — Capstone (240 min + presentations)

See **Section 16**. Teams present last 30 min of day.

---

## 9. Parc hardware labs — facilitator script

### 9.1 Opta baseline (M7 / Checkpoint C)

1. Confirm Mosquitto listening; firewall open.
2. Opta `/setup` — broker IP, unique `deviceId`, save, reboot if required.
3. MooreVIEW: System setup → MQTT Parc → enable → Apply.
4. Drivers → Apply template **Arduino Opta — MQTT Parc ST runtime** — set deviceId to match.
5. Wait for telemetry (~30 s); **Sync tags from device**.
6. Program → Remote → Connect → **Download & Start**.
7. Confirm `runtime_start` in trace or status tags.

**If stuck:** Ping broker from Opta subnet; `mosquitto_sub -t 'mooreview/v1/#' -v`.

### 9.2 T-HaLow (M14)

1. Join `MooreVIEW-T-HaLow` AP only for provisioning.
2. `http://192.168.4.1:8080/setup` — HaLow broker IP, deviceId, template **2**.
3. Pair HaLow to site AP per LilyGO doc.
4. MooreVIEW: add driver with matching deviceId; Sync tags.

### 9.3 T-ETH cellular bridge (M14)

1. Gateway AP `MooreVIEW-Gateway` → cloud broker + APN.
2. Opta broker = `192.168.1.1:1883`.
3. Confirm cloud broker receives `mooreview/v1/#` from Opta deviceId.

### 9.4 IP cameras (M15 / Checkpoint E)

1. On camera web UI: enable **ONVIF** (port 8000) and **RTSP** (554).
2. MooreVIEW: **Tools → Cameras → Settings** — default credentials → **Save**.
3. **Discover ONVIF** → select camera → **Probe** (confirm `probeStatus: ok`).
4. Optional: enable go2rtc in camera settings; verify `/api/cameras/{id}/player`.
5. **Tools → Cameras → Detail** — add I/O overlay (BOOL tag, X/Y %, snapshot on rising).
6. **HMI Setup** — place **Camera + I/O overlays** tile (span 2×2, Z0); pick from inventory → **Apply HMI settings**.
7. Live HMI: verify embedded video + overlay color follows tag; toggle BOOL to trigger snapshot if enabled.
8. **Capture snapshot** — confirm GridFS if Mongo enabled; **Run infer** with stub backend.

**If stuck:** Same VLAN as camera; check UDP 3702 firewall; Reolink ONVIF user must match Settings; overlay tile needs registry in Detail; see `docs/CAMERAS.md`.

---

## 10. Discussion question bank

Use between modules:

- What maintenance strategy fits a rooftop AHU with vibration sensors?
- Who should receive critical alarms — operator or CMMS?
- When would you use Modbus RTU vs Parc MQTT on the same site?
- What is the risk of leaving Force enabled?
- How does Position ID help when replacing failed hardware?

---

## 11. Common student mistakes (quick reference)

| Symptom | Likely cause | Instructor fix |
|---------|--------------|----------------|
| Blank HMI values | Bindings not Applied | HMI Apply |
| Driver Test fail | COM/slave/IP | F1 serial guide |
| No Parc telemetry | Hub disabled | System setup |
| Remote download timeout | deviceId mismatch | Compare Opta `/setup` vs driver |
| No historian data | Hist unchecked or runtime stopped | Tags + Start |
| Alarm never trips | Wrong limit or tag type | Tags alarm column |

---

## 12. Equipment master list

- Arduino Opta (MQTT Parc ST firmware)
- LilyGO T-ETH gateway + activated SIM (optional)
- LilyGO T-HaLow node (optional)
- USB Modbus adapter + sensor or mock
- Current transformers, leak rope, thermistor samples
- Laptops (1 per student) + 1 instructor demo machine
- Tablet for operator-role demo
- MQTT broker (Mosquitto on Pi or PC)
- Network switch, Ethernet cables
- DMM, network tester, hand tools, PPE

---

## 13. Day-before instructor runbook

1. Run `npm run start:pc` on every student image/laptop if imaged.
2. Flash Opta; record deviceId on tape label.
3. Run BASELINE_TEST end-to-end; time it (aim &lt; 45 min for skilled student).
4. Export “gold” `.est` for recovery if student project corrupts.
5. Print checkpoint rubrics and team roster.
6. Test projector HDMI; open F2 Training → Instructor tab.

---

## 14. After course

- Collect capstone `.est` files for portfolio.
- Issue completion against checkpoint log.
- Survey: which module needed more time?
- Update local `docs/training/` notes with venue-specific IP/broker cheatsheet.

---

## 15. Source references

| Material | Location |
|----------|----------|
| Learner curriculum | F2 Training; `docs/training/iot-cbm-training.md` |
| CBM PDF | `IoT Condition monitoring training.pdf` |
| Parc / Opta | `firmware/arduino-opta-mqtt-st/README.md` |
| T-HaLow | `halow-xiao-sta/README.md` |
| Cellular gateway | `cellular-opta-gateway/README.md` |
| Commissioning | F1 → Commissioning tutorial |
| CMMS | `docs/CMMS_INTEGRATION.md` |

---

*MooreVIEW Instructor Guide v1.1 — aligns with Training tab M0–M15 + CBM-1–CBM-13.*
