# IoT Condition-Based Monitoring (CBM) — Training Guide

**Version 1.0** · Residential & commercial building systems  
**Platform:** mooreVIEW MVP Suite (`est-pc`)

Source document: [IoT-Condition-Monitoring-Training.pdf](./IoT-Condition-Monitoring-Training.pdf)

In-app help: **Tools → Training (F2)** — same curriculum with mooreVIEW lab pointers.

---

## Start here — plain introduction

Read this first if you are new to mooreVIEW or building monitoring.

| | |
|---|---|
| **Who** | This training is for people who work on buildings and equipment: HVAC and service technicians, electricians, maintenance staff, facility managers, building engineers, sales staff, and anyone learning to set up mooreVIEW. |
| **Where** | You learn in a classroom or on a laptop running mooreVIEW at `http://127.0.0.1:3090` (press **F2** for Training). On real jobs, sensors and controllers sit in mechanical rooms, on rooftops, and inside equipment. Data can stay on-site or go to the cloud through a gateway. |
| **What** | **mooreVIEW** is software that watches building equipment—heaters, air conditioners, pumps, leaks, and power use. This course has two parts: **CBM-1–CBM-13** explains *why* and *when* to monitor equipment health; **M0–M15** shows *how* to set up mooreVIEW (screens, alarms, charts, remote controllers like Arduino Opta, and IP cameras). |
| **Why** | Fix problems *before* equipment fails. Avoid costly emergency repairs and downtime. Keep people comfortable and safe. Catch leaks, overheating, and failing motors early—when fixes are cheaper and easier. |
| **How** | Open **Tools → Training** (F2). Use the **mooreVIEW** tab for hands-on labs, **IoT CBM** for concepts, and **Mapping** to see how they connect. Basic path: connect sensors → gateway → mooreVIEW → set alarms and dashboards → check trends. |

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
- Build dashboards and alarms in **mooreVIEW**  
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

**mooreVIEW tie-in:** **Historian** trends and **PdM (SCADA + Edge)** health index support CBM vs calendar-only PM.

---

## Module 2 — IoT fundamentals

**Components:** sensors · controllers · edge devices · gateways · cloud platform (**mooreVIEW**) · mobile/web clients.

**Communication:** Wi-Fi · Ethernet · Bluetooth · **HaLow** · Cellular (NB-IoT / LTE Cat-1/4 / 5G).

**Activity:** Draw architecture for a commercial building: field sensors → gateway (e.g. LilyGO T-ETH / Parc ST) → cloud Mosquitto → mooreVIEW HMI.

**mooreVIEW tie-in:**

- **Drivers** — Modbus, MQTT, HTTPS, `mqtt_parc`, **`bacnet`** (BACnet/IP, edge appliance), HAL  
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

**mooreVIEW tie-in:** Apply **device templates** under **Drivers** (Datexel, DFRobot, Seeed, Scan, NextCentury, **EZ Meter DDS-RGB**, etc.). Main service **power quality** (V, I, kW, PF, energy, imbalance): two-step apply — full Modbus map then **facility PQ derived measurement set** — see **`docs/facilities/EZMETER_FACILITY_PQ.md`**.

---

## Module 4 — Residential applications

Heat pumps · A/C · furnaces · water heaters · sump pumps · electrical panels · IAQ · leak detection · solar · battery storage · smart-home integration.

**Case study:** Whole-home monitoring — MQTT or Modbus sensors, one gateway, mooreVIEW alarms on high temperature and water leak.

---

## Module 5 — Commercial applications

Commercial HVAC · chillers · cooling towers · boilers · air compressors · pumps · refrigeration · lighting · electrical distribution · BAS · backup generators.

**Facility power quality (mechanical room):** **EZ Meter DDS-RGB** on Modbus RTU at main service — polyphase V/I/W/VA/Hz/PF, import/export kWh, voltage imbalance, undervoltage/overvoltage, low PF, frequency faults. ST program `logic/ezmeter_facility_pq.st` computes `MECH_PQ_*` and asserts **`ALF_MECH_ALM`** on PQ faults. Assisted-living demos may use NextCentury for `MECH_METER_KWH`; EZ Meter is the on-prem Modbus alternative (`facility.driver: "ezmeter"`). See **`docs/facilities/EZMETER_FACILITY_PQ.md`**.

**mooreVIEW tie-in:** On sites with an incumbent **BAS**, add driver type **`bacnet`** on the **edge appliance** (BMS VLAN). Use **Discover devices** → **Browse & import tags** for read-mostly space temps, statuses, and energy points. Coexist with the campus BMS — mooreVIEW layers CMMS, PdM, and fleet views; it does not replace BMS sequences. See `docs/BACNET.md`. MS/TP trunks require an external BACnet/IP router (not native on the appliance RS-485 port).

**Case study:** Multi-site office — centralized mooreVIEW project, per-site `deviceId`, shared alarm escalation; optional BACnet import from each site's BMS head-end.

---

## Module 6 — Installation & commissioning

Site surveys · sensor placement · mounting · wiring · wireless survey · gateway install · calibration · functional test · documentation.

**Lab:** Install sensors on demo skid; map to mooreVIEW tags; verify **Live I/O** and **Force** while debugging ST.

**mooreVIEW tie-in:** **Hardware wizard** (Drivers) · **Tags** scaling/alarms · **Program → Validate → Start**.

---

## Module 7 — Connectivity & networking

IP addressing · DHCP · static IP · Wi-Fi · Ethernet · cellular · VPN · firewalls · cloud communications.

**mooreVIEW tie-in:**

- Opta / gateway: DHCP to local broker or direct cloud MQTT  
- Cellular Parc ST: APN + `/setup` on `192.168.4.1`  
- Cloud: `deploy/cloud` Mosquitto, firewall TCP 1883  

---

## Module 8 — Cloud platforms & dashboards (mooreVIEW)

| Task | Where in mooreVIEW |
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

**mooreVIEW tie-in:** **Integrated CMMS** (`/cmms`) — alarm auto-WO (reactive last line) **and** PdM proactive PM WO (early warning). See `docs/CMMS_APPLIANCE.md` and `docs/pdm/PDM_PROACTIVE_CMMS.md`.

**Lab in mooreVIEW:**

1. **Tags** — set OL/IL/IH/OH for INT/REAL; BOOL conditions  
2. **Alarms** panel — acknowledge active alarms  
3. Configure high temperature, high vibration (edge score), water leak, power failure  
4. Open **CMMS** — verify alarm-sourced WO; contrast with PdM proactive WO (Module 10)
---

## Module 10 — Data analysis & predictive maintenance

Baseline measurements · trend analysis · equipment health · predictive analytics · RUL · energy · maintenance recommendations.

**mooreVIEW tie-in:** **Help → PdM (predictive maintenance)** — motor/pump/fan/compressor asset setup, feature windows, health index, failure forecast, **proactive CMMS PM work orders** when forecast shows pending failure. **M15** adds camera vision AI: inference results in `edge_inference_ts`, asset id `cam:{cameraId}`.

**Proactive workflow (not reactive):**

1. Configure asset in **Historian → Logger config… → PdM** (motor type, location, install/service history)
2. **Seed demo data** or collect live edge + historian samples
3. **Build features now** — forecast banner shows warning/critical when RUL is short
4. **CMMS** auto-issues **Proactive PM** work order (`source: pdm`) — fix before breakdown
5. Complete WO → service history updates → next forecast reflects repair

**Exercise:** Seed 180-day duplex pump demo; run **Build features now**; open CMMS and find proactive PM WO; complete WO and verify service history on PdM asset tab. Optional: **Download PdM PDF**.

**Lift-station lab:** Use bundled duplex-lift-station project; configure `pump-1` / `pump-2` with location class and service history. See `docs/pdm/LIFT-STATION-PDM-TRAINING-REVIEW.md`.

---

## Module 11 — Cybersecurity

Strong passwords · MFA · encryption · secure remote access · firmware updates · device authentication · network segmentation · data privacy.

**mooreVIEW / field:** MQTT credentials on gateway only; TLS where deployed; rotate `MOSQUITTO_USER` / `MOSQUITTO_PASS`; segment OT VLAN.

---

## Module 12 — Troubleshooting

Offline devices · sensor failures · gateway issues · network · incorrect readings · calibration · cloud connectivity · firmware recovery.

| Symptom | Check |
|---------|--------|
| Parc device offline | `online` retained topic, WAN/cellular, broker auth |
| Stale MQTT tag | Topic spelling, runtime **Start** |
| Modbus timeout | COM port, slave ID, wiring — **Help → Serial port troubleshooting** |
| EZ Meter derived apply fails | Apply **full map** template first; confirm driver `dds_rgb` and live `DDS_*` tags — **`docs/facilities/EZMETER_FACILITY_PQ.md`** |
| Flat `MECH_PQ_*` tags | Start ST runtime; program `logic/ezmeter_facility_pq.st` must be active |
| BACnet discover empty | Edge appliance on BMS VLAN; UDP 47808 not blocked; bind interface if multi-homed — **`docs/BACNET.md`** |
| BACnet read BAD quality | Wrong host/device instance/object; confirm with **Browse**; keep **Allow writes** off until ownership agreed |
| Flat historian | **Hist** checked, MongoDB URI, runtime running |

---

## Module 13 — Hands-on capstone

Teams:

1. Site survey  
2. Select sensors + gateway  
3. Install and wire I/O (e.g. Sequent SM-I-010 on T-ETH Parc ST)  
4. Configure cloud MQTT + mooreVIEW `mqtt_parc` driver  
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
- mooreVIEW web UI (commissioning)  
- Network tester · DMM · hand tools · PPE  

---

## Appendix A — Common IoT devices

See **Help → Device guides** for mooreVIEW templates: Datexel, DFRobot, Seeed, Scan, Arduino Opta, EdgePoint, LilyGO Parc ST, **EZ Meter DDS-RGB (Modbus PQ)**, etc. Facility PQ: **`docs/facilities/EZMETER_FACILITY_PQ.md`**. IP cameras: **Help → Cameras & video**, `docs/CAMERAS.md` (**M15**).

## Appendix C — Cloud SaaS (mooreVIEW M12)

Multi-tenant hosted Studio on port **3100** (DigitalOcean droplet):

| Task | Reference |
|------|-----------|
| Local dev | `npm run start:saas`, `npm run seed`, `/login` org `demo` |
| DO production install | `docs/CLOUD_DEPLOY_DO.md`, `deploy/cloud/debian/INSTALL-SAAS.txt` |
| Tenant operator guide | `docs/CLOUD_USER_GUIDE.md` |
| Edge vs cloud buses | `docs/EST_PC_PARITY.md` |
| BACnet/IP (edge) | `docs/BACNET.md` |
| In-app help | F1 → Cloud Studio, Cloud deploy (DO) |

Lab: sign in, open **Sites** and **All devices**, pair an edge appliance via cloud remote uplink.

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
| Parc | mooreVIEW MQTT remote programming protocol |
| BACnet/IP | Building automation protocol over UDP; mooreVIEW `bacnet` driver on edge appliances |
| MS/TP | BACnet serial trunk — use an IP router; not native on appliance Modbus RS-485 |
| ONVIF | IP camera discovery and control (UDP 3702) |
| go2rtc | Local RTSP→WebRTC streaming for camera live view |
| GridFS | MongoDB file storage for snapshots and project assets |
