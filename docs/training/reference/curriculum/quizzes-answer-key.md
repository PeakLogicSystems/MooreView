# Module quizzes — instructor answer key

**Pass score:** 80% (4 of 5 correct) · **Open-book** allowed (F1, F2)  
**Student access:** Tools → Training (F2) → **Quizzes** tab  
**Source data:** `public/js/training-quizzes.js`

Distractors are designed as: **right answer**, **almost right**, **could be plausible**, **similar**. Correct choice text is listed below for each question (1–5). Order on screen may differ — match by wording.

---

## mooreVIEW (M0–M15)

### M0 — Product map & first launch
1. A local engineering appliance you run on a laptop  
2. F2  
3. .est  
4. Operator and engineering reference while you work  
5. Start MVP Suite and open Training  

### M1 — UI layout, roles & projects
1. Project ▾ menu  
2. Program, Tags, Drivers, Training, Help, and more  
3. Copy or back up a portable project file  
4. HMI, alarms, trends — less driver editing  
5. Lets you choose a new filename/path  

### M2 — Commissioning path
1. Preset driver + tags for an instrument type  
2. Sample ST plus matching tags/drivers  
3. A pre-wired faceplate widget with default bindings  
4. Project (New/Open/Save)  
5. Template vs fixture vs composite  

### M3 — Tags, Force & Live I/O
1. ST logic and driver mapping  
2. Handing a system to operators  
3. Current tag values from drivers/runtime  
4. Raw counts to real-world units  
5. ST trace react if logic uses that tag  

### M4 — Drivers & field buses
1. Verify communication before relying on tags  
2. Activates configuration to the runtime  
3. Wrong COM port or slave ID  
4. MQTT Parc edge devices like Opta  
5. Creates driver(s) and tags for that product  
6. **`bacnet`** — BACnet/IP on edge appliance; Discover → Browse → import tags alongside campus BAS (`docs/BACNET.md`)  
7. **EZ Meter facility PQ** — apply full Modbus map first, then derived measurement set; ST `logic/ezmeter_facility_pq.st` (`docs/facilities/EZMETER_FACILITY_PQ.md`)

### M5 — ST program & runtime
1. Syntax and compile errors before run  
2. Read drivers → run ST → write outputs  
3. Stops logic updates while keeping state  
4. Hand-Off-Auto control patterns  
5. See tag values as ST executes  

### M6 — HMI composer
1. Widgets to live tags  
2. Apply HMI changes  
3. The first screen operators see  
4. A reusable faceplate  
5. Tags live, ST running, HMI bound  

### M7 — MQTT Parc hub & Opta
1. mooreview/v1/{deviceId}/telemetry  
2. Project → System setup → MQTT Parc  
3. The MQTT identity of the physical device  
4. ST bytecode to a remote Opta over Parc  
5. Sync tags from device on the driver card  

### M8 — Historian & reports
1. Enables logging that tag  
2. Which tags appear on trend charts  
3. CSV or PDF  
4. Hist not enabled or runtime stopped  
5. Long-term historian archive (when configured)  

### M9 — Alarms & CMMS
1. Trips when value rises above setpoint  
2. Operators or techs in the Alarms panel  
3. Integrated `/cmms` work orders: **alarm auto-WO** (reactive) and **PdM proactive PM WO** (early warning); optional external MQTT bridge  
4. Severity and response urgency — proactive PdM WO fires days before alarm  
5. Trip an alarm and Ack it; contrast with PdM-sourced WO (`source: pdm`)  

### M10 — MV Draw
1. Site plans and symbol placement  
2. Matching drawing units to real-world size  
3. Equipment and sensor locations  
4. Project plus embedded draw assets  
5. Save and reload placed symbols  

### M11 — PdM & ROI
1. Predictive maintenance — fix before failure, not after alarm  
2. Summarizes equipment condition (health index, edge score, SCADA trends)  
3. Remaining useful life (RUL) — warning/critical triggers proactive CMMS PM WO  
4. Justify monitoring investment cost vs savings (ROI calculator)  
5. PdM asset setup, forecast banner, CMMS work order with `source: pdm`, service history on WO complete  

### M12 — Cloud Studio
1. mooreVIEW cloud engineering/hosting tier  
2. Edge runtime at the site  
3. Which cloud features a tenant may use  
4. Signing into Cloud Studio  
5. Some functions run on-site vs in data center  

### M13 — Vertical lab
1. Commission a domain demo end-to-end  
2. HMI, alarm ack, and one trend  
3. Product templates / generate-est scripts  
4. M2–M6 minimum  
5. 10 minutes per team  

### M14 — Parc edge peers
1. M7 Opta Parc baseline  
2. HaLow (802.11ah)  
3. 192.168.1.1:1883  
4. Client room sensors  
5. T-HaLow telemetry and/or T-ETH cloud bridge  

### M15 — IP cameras & vision AI
1. UDP 3702 (ONVIF WS-Discovery)  
2. ONVIF port 8000 and RTSP port 554  
3. H.264 live streaming via WebRTC/MSE  
4. `camera_snapshots` GridFS bucket  
5. Stub backend for dev/lab without external model  
6. **Tools → Cameras → Detail** — I/O overlay registry (tag + X/Y % on video)

---

## IoT CBM (CBM-1–CBM-13)

### CBM-1 — Introduction to CBM
1. Maintaining when measured condition warrants it  
2. Fix after failure  
3. Fixed-interval service whether needed or not  
4. Catching problems early  
5. Staff see issues without always being on-site  

### CBM-2 — IoT fundamentals
1. Connects field devices to the network/cloud  
2. Cloud/HMI and analytics platform  
3. Long-range Wi-Fi for sensor networks  
4. MQTT topics under mooreview/v1  
5. No reliable site Ethernet/Wi-Fi to cloud  

### CBM-3 — Sensors
1. Alternating current  
2. Water leak detection along a line  
3. Supply/return air or coil temp  
4. Wear and imbalance early  
5. Water or gas usage pulses  

### CBM-4 — Residential
1. HVAC, water heater, leak, sump, IAQ  
2. Catch failure before flooding  
3. CO₂, humidity, VOC, PM  
4. Alarms on temp and leak tags  
5. Generation and storage health  

### CBM-5 — Commercial
1. HVAC, lighting, access — mooreVIEW can complement  
2. Consistent deviceId/Position ID strategy; optional **BACnet/IP import** per site (`bacnet` driver)  
3. Temperature, pressure, current, flow  
4. Run hours, fuel, fault alarms  
5. Centralized alarms and escalation; BACnet read-mostly alongside incumbent BAS  
6. Import selected BMS points on edge appliance via **`bacnet`** driver (coexist, not rip-replace)  

### CBM-6 — Installation
1. Locations, access, power, network paths  
2. What failure mode you need to detect  
3. Values make sense in mooreVIEW Live I/O  
4. Electrical and mechanical hazards exist  
5. M2 commissioning + M4 drivers  

### CBM-7 — Connectivity
1. Assigns IP automatically  
2. TCP 1883 (or TLS port if used)  
3. Secure remote access to OT network  
4. Gateway device (e.g. T-ETH), not always on every sensor  
5. M7 Parc, M12 cloud, M14 cellular  

### CBM-8 — Dashboards
1. Drivers + templates; Parc deviceId  
2. Historian / live buffer pens  
3. Key temps, states, and alarms  
4. REST / MQTT per mooreVIEW deployment  
5. M6 HMI dashboard exercise  

### CBM-9 — Alarm management
1. A value crosses a configured limit  
2. Notify additional people if unresolved  
3. Reduce nuisance alarms during known events  
4. High temp, vibration, leak, power fail  
5. M9 Alarms panel  

### CBM-10 — Data analysis & PdM
1. Normal operating signature for comparison  
2. Gradual degradation over time  
3. Remaining useful life before likely failure — proactive CMMS PM WO before alarm  
4. PdM forecast → CMMS (`source: pdm`); alarm bridge is reactive last line  
5. M8 historian + M11 PdM (seed demo, build features, proactive check)  

### CBM-11 — Cybersecurity
1. Multi-factor authentication  
2. On gateway, not copied into every sensor unnecessarily  
3. Separates OT from office IT  
4. Planned and authenticated  
5. M1 roles + M12 cloud tenancy  

### CBM-12 — Troubleshooting
1. Broker reachability and online topic  
2. Wrong port, baud, or slave ID  
3. Hist enabled and runtime running  
4. Systematic diagnosis  
5. M4 driver Test + M7 Parc + F1 guides; BACnet: VLAN/UDP 47808, object addressing — `docs/BACNET.md`  

### CBM-13 — Capstone
1. Survey → install → mooreVIEW → alarms → presentation  
2. 20% of CBM certification grade  
3. Recommendations from trend/alarm data  
4. M13 + M2–M9 + M14 integrated  
5. Lead, network, HMI, documentation  

---

## Distractor design note

Wrong options often reflect real misconceptions, e.g.:

| Trap | Example |
|------|---------|
| Almost right | F1 vs F2 for Training |
| Could be | `.mvbundle` vs `.est` for projects |
| Similar | Hist flag vs Pen config |
| Workflow confusion | Apply driver vs Apply HMI vs System setup Apply |

## Suggested quiz schedule (CBM certification)

| Day | Quizzes to assign |
|-----|------------------|
| 1 | CBM-1, CBM-2, CBM-3; optional M0 |
| 2 | CBM-4–CBM-8 as modules complete |
| 3 | CBM-9–CBM-13; integrator track adds M quizzes after labs |

mooreVIEW integrator path: assign quiz after each module lab (M0–M15).
