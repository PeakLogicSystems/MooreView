# IoT Condition-Based Monitoring (CBM) — Training Guide

**Version 1.0** · Residential & commercial building systems  
**Platform:** MooreVIEW MVP Suite (`est-pc`)

Source document: [IoT-Condition-Monitoring-Training.pdf](./IoT-Condition-Monitoring-Training.pdf)

In-app help: **Tools → Training (F2)** — same curriculum with MooreVIEW lab pointers.

---

## Start here — plain introduction

Read this first if you are new to MooreVIEW or building monitoring.

| | |
|---|---|
| **Who** | This training is for people who work on buildings and equipment: HVAC and service technicians, electricians, maintenance staff, facility managers, building engineers, sales staff, and anyone learning to set up MooreVIEW. |
| **Where** | You learn in a classroom or on a laptop running MooreVIEW at `http://127.0.0.1:3090` (press **F2** for Training). On real jobs, sensors and controllers sit in mechanical rooms, on rooftops, and inside equipment. Data can stay on-site or go to the cloud through a gateway. |
| **What** | **MooreVIEW** is software that watches building equipment—heaters, air conditioners, pumps, leaks, and power use. This course has two parts: **CBM-1–CBM-13** explains *why* and *when* to monitor equipment health; **M0–M15** shows *how* to set up MooreVIEW (screens, alarms, charts, remote controllers like Arduino Opta, and IP cameras). |
| **Why** | Fix problems *before* equipment fails. Avoid costly emergency repairs and downtime. Keep people comfortable and safe. Catch leaks, overheating, and failing motors early—when fixes are cheaper and easier. |
| **How** | Open **Tools → Training** (F2). Use the **MooreVIEW** tab for hands-on labs, **IoT CBM** for concepts, and **Mapping** to see how they connect. Basic path: connect sensors → gateway → MooreVIEW → set alarms and dashboards → check trends. |

---

## Course overview

This course introduces **Internet of Things (IoT)** technology for **Condition-Based Monitoring (CBM)** of residential and commercial building systems. Participants learn how connected sensors, gateways, cloud software, and analytics improve equipment reliability, reduce maintenance cost, and support predictive maintenance.

### Intended audience

- Service technicians · HVAC technicians · Electricians  
- Maintenance personnel · Facility managers · Building engineers  
- Sales engineers · Operations managers  

### Duration

| Level | Duration |
|-------|----------|
| Basic | 1 day |
| Intermediate | 2 days |
| Advanced certification | 3 days |

### Learning objectives

Upon completion, participants can:

- Explain CBM concepts and maintenance strategies  
- Describe IoT system architecture (edge → gateway → cloud)  
- Select sensors for monitoring applications  
- Install and commission IoT devices  
- Configure gateways and cloud connectivity  
- Build dashboards and alarms in **MooreVIEW**  
- Interpret equipment health data and PdM forecasts  
- Apply cybersecurity best practices  
- Troubleshoot communication and hardware issues  

---

## Module 1 — Introduction to condition-based monitoring

**Topics:** equipment reliability, asset life cycle, maintenance strategies, downtime costs, predictive maintenance, remote monitoring, ROI.

| Strategy | Description |
|----------|-------------|
| Reactive | Fix after failure — highest downtime cost |
| Preventive | Fixed-interval service — may over- or under-maintain |
| Condition-based | Act when measured condition warrants it |
| Predictive | Trend + analytics → forecast failure (see **Help → PdM**) |

**Exercise:** Compare annual cost for reactive vs preventive vs CBM on one pump or air handler.

**MooreVIEW tie-in:** **Historian** trends and **PdM (SCADA + Edge)** health index support CBM vs calendar-only PM.

---

## Module 2 — IoT fundamentals

**Components:** sensors · controllers · edge devices · gateways · cloud platform (**MooreVIEW**) · mobile/web clients.

**Communication:** Wi-Fi · Ethernet · Bluetooth · **HaLow** · Cellular (NB-IoT / LTE Cat-1/4 / 5G).

**Activity:** Draw architecture for a commercial building: field sensors → gateway (e.g. LilyGO T-ETH / Parc ST) → cloud Mosquitto → MooreVIEW HMI.

**MooreVIEW tie-in:**

- **Drivers** — Modbus, MQTT, HTTPS, `mqtt_parc`, HAL  
- **Parc** — remote programming and telemetry (`mooreview/v1/{deviceId}/…`)  
- Field gateways: `cellular-parc-st`, `cellular-opta-gateway` (see firmware READMEs)  

---

## Module 3 — Sensors for condition monitoring

| Category | Examples | Typical assets |
|----------|----------|----------------|
| Temperature | RTD, thermistor, digital | HVAC, boilers, motors, bearings, refrigeration |
| Vibration / MCSA | Accelerometer, current signature | Pumps, motors, fans, compressors |
| Current | CT clamps | Motor load, runtime, overcurrent, extended start |
| Voltage | Phase monitors | Brownout, phase loss, power quality |
| Pressure | 4–20 mA, digital | Compressors, water, refrigeration |
| Flow | Pulse, mag, ultrasonic | Water, gas, air |
| Environmental | RH, CO₂, VOC, PM2.5, CO | IAQ, occupancy comfort |
| Leak | Rope, spot, refrigerant | Mechanical rooms, ceilings |
| Occupancy | PIR, ultrasonic, radar | Scheduling, ventilation |

**Exercise:** Match each sensor type to the correct asset (pump bearing → vibration; sump pit → leak rope).

**MooreVIEW tie-in:** Apply **device templates** under **Drivers** (Datexel, DFRobot, Seeed, Scan, NextCentury, etc.).

---

## Module 4 — Residential applications

Heat pumps · A/C · furnaces · water heaters · sump pumps · electrical panels · IAQ · leak detection · solar · battery storage · smart-home integration.

**Case study:** Whole-home monitoring — MQTT or Modbus sensors, one gateway, MooreVIEW alarms on high temperature and water leak.

---

## Module 5 — Commercial applications

Commercial HVAC · chillers · cooling towers · boilers · air compressors · pumps · refrigeration · lighting · electrical distribution · BAS · backup generators.

**Case study:** Multi-site office — centralized MooreVIEW project, per-site `deviceId`, shared alarm escalation.

---

## Module 6 — Installation & commissioning

Site surveys · sensor placement · mounting · wiring · wireless survey · gateway install · calibration · functional test · documentation.

**Lab:** Install sensors on demo skid; map to MooreVIEW tags; verify **Live I/O** and **Force** while debugging ST.

**MooreVIEW tie-in:** **Hardware wizard** (Drivers) · **Tags** scaling/alarms · **Program → Validate → Start**.

---

## Module 7 — Connectivity & networking

IP addressing · DHCP · static IP · Wi-Fi · Ethernet · cellular · VPN · firewalls · cloud communications.

**MooreVIEW tie-in:**

- Opta / gateway: DHCP to local broker or direct cloud MQTT  
- Cellular Parc ST: APN + `/setup` on `192.168.4.1`  
- Cloud: `deploy/cloud` Mosquitto, firewall TCP 1883  

---

## Module 8 — Cloud platforms & dashboards (MooreVIEW)

| Task | Where in MooreVIEW |
|------|-------------------|
| Device registration | **Drivers** + device templates; Parc `deviceId` |
| Dashboard design | **HMI → Setup…** composer, bindings, gauges |
| Trend charts | **Historian** — live buffer or MongoDB archive |
| Asset management | **Logger config → PdM asset map** |
| User permissions | Project files, deployment policy (site-specific) |
| Reports | **Report** — CSV / PDF from historian or PdM |
| IP cameras | **Tools → Cameras** — ONVIF discover, live view, HMI popup (**M15**) |
| API | `GET /api/dashboard`, Parc MQTT, REST drivers, `/api/cameras/*` |

**Exercise:** Build an HVAC dashboard — supply air temp trend, fan HOA, high-temp alarm. Optional: add **Camera** popup button on mechanical room screen.

---

## Module 9 — Alarm management

Thresholds · warning vs critical · escalation · notifications · suppression · workflows · documentation.

**Lab in MooreVIEW:**

1. **Tags** — set OL/IL/IH/OH for INT/REAL; BOOL conditions  
2. **Alarms** panel — acknowledge active alarms  
3. Configure high temperature, high vibration (edge score), water leak, power failure  

---

## Module 10 — Data analysis & predictive maintenance

Baseline measurements · trend analysis · equipment health · predictive analytics · RUL · energy · maintenance recommendations.

**MooreVIEW tie-in:** **Help → PdM (predictive maintenance)** — feature windows, health index, failure forecast, `edgeAi` from Parc devices, motor start simulation lab. **M15** adds camera vision AI: inference results in `edge_inference_ts`, asset id `cam:{cameraId}`.

**Exercise:** Load six months of historian data; run **Build features now**; interpret forecast banner. Optional: review camera inference history from **Tools → Cameras**.

---

## Module 11 — Cybersecurity

Strong passwords · MFA · encryption · secure remote access · firmware updates · device authentication · network segmentation · data privacy.

**MooreVIEW / field:** MQTT credentials on gateway only; TLS where deployed; rotate `MOSQUITTO_USER` / `MOSQUITTO_PASS`; segment OT VLAN.

---

## Module 12 — Troubleshooting

Offline devices · sensor failures · gateway issues · network · incorrect readings · calibration · cloud connectivity · firmware recovery.

| Symptom | Check |
|---------|--------|
| Parc device offline | `online` retained topic, WAN/cellular, broker auth |
| Stale MQTT tag | Topic spelling, runtime **Start** |
| Modbus timeout | COM port, slave ID, wiring — **Help → Serial port troubleshooting** |
| Flat historian | **Hist** checked, MongoDB URI, runtime running |

---

## Module 13 — Hands-on capstone

Teams:

1. Site survey  
2. Select sensors + gateway  
3. Install and wire I/O (e.g. Sequent SM-I-010 on T-ETH Parc ST)  
4. Configure cloud MQTT + MooreVIEW `mqtt_parc` driver  
5. Download ST program (**Download & Start**)  
6. Build HMI + historian pens  
7. Configure alarms  
8. Analyze trends / PdM  
9. Present recommendations  

---

## Assessment

| Component | Weight |
|-----------|--------|
| Module quizzes | 20% |
| Installation lab | 20% |
| Dashboard configuration | 15% |
| Alarm configuration | 15% |
| Troubleshooting exercise | 10% |
| Final capstone | 20% |

---

## Equipment list

- IoT gateway (LilyGO T-ETH-ELITE-A7670X or Raspberry Pi + Sequent HAT)  
- Wireless / wired sensors (temp, pressure, leak, CTs)  
- Laptop · tablet  
- MooreVIEW web UI (commissioning)  
- Network tester · DMM · hand tools · PPE  

---

## Appendix A — Common IoT devices

See **Help → Device guides** for MooreVIEW templates: Datexel, DFRobot, Seeed, Scan, Arduino Opta, EdgePoint, LilyGO Parc ST, etc. IP cameras: **Help → Cameras & video**, `docs/CAMERAS.md` (**M15**).

## Appendix B — Glossary

| Term | Meaning |
|------|---------|
| CBM | Condition-based monitoring |
| IoT | Internet of Things |
| BAS | Building automation system |
| CMMS | Computerized maintenance management system |
| CT | Current transformer |
| VPN | Virtual private network |
| MFA | Multi-factor authentication |
| RUL | Remaining useful life |
| Parc | MooreVIEW MQTT remote programming protocol |
| ONVIF | IP camera discovery and control (UDP 3702) |
| go2rtc | Local RTSP→WebRTC streaming for camera live view |
| GridFS | MongoDB file storage for snapshots and project assets |
