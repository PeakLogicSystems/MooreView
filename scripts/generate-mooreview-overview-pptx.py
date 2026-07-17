#!/usr/bin/env python3
"""Generate MooreVIEW overview PowerPoint for stakeholders."""

from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "MooreVIEW-Overview.pptx"

# MooreVIEW brand colors
NAVY = RGBColor(0x0F, 0x2B, 0x4A)
TEAL = RGBColor(0x00, 0x96, 0x88)
DARK = RGBColor(0x33, 0x33, 0x33)
MUTED = RGBColor(0x66, 0x66, 0x66)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)


def set_title_style(shape, size=32, color=NAVY):
    tf = shape.text_frame
    for p in tf.paragraphs:
        p.font.size = Pt(size)
        p.font.bold = True
        p.font.color.rgb = color


def add_title_slide(prs, title, subtitle):
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
    # accent bar
    bar = slide.shapes.add_shape(1, Inches(0), Inches(0), prs.slide_width, Inches(0.15))
    bar.fill.solid()
    bar.fill.fore_color.rgb = TEAL
    bar.line.fill.background()

    box = slide.shapes.add_textbox(Inches(0.8), Inches(2.2), Inches(8.4), Inches(1.5))
    tf = box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = NAVY

    sub = slide.shapes.add_textbox(Inches(0.8), Inches(3.6), Inches(8.4), Inches(1.2))
    sp = sub.text_frame.paragraphs[0]
    sp.text = subtitle
    sp.font.size = Pt(20)
    sp.font.color.rgb = MUTED

    ver = slide.shapes.add_textbox(Inches(0.8), Inches(6.5), Inches(8), Inches(0.5))
    vp = ver.text_frame.paragraphs[0]
    vp.text = "MooreVIEW MVP Suite  ·  est-pc  ·  v2.3.7"
    vp.font.size = Pt(14)
    vp.font.color.rgb = MUTED
    return slide


def add_content_slide(prs, title, bullets, notes=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    # title bar background
    title_bg = slide.shapes.add_shape(
        1, Inches(0), Inches(0), prs.slide_width, Inches(1.1)
    )
    title_bg.fill.solid()
    title_bg.fill.fore_color.rgb = NAVY
    title_bg.line.fill.background()

    title_box = slide.shapes.add_textbox(Inches(0.6), Inches(0.25), Inches(8.8), Inches(0.7))
    tp = title_box.text_frame.paragraphs[0]
    tp.text = title
    tp.font.size = Pt(28)
    tp.font.bold = True
    tp.font.color.rgb = WHITE

    body = slide.shapes.add_textbox(Inches(0.7), Inches(1.4), Inches(8.6), Inches(5.5))
    tf = body.text_frame
    tf.word_wrap = True
    for i, item in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if isinstance(item, tuple):
            text, level = item
            p.text = text
            p.level = level
            p.font.size = Pt(16 if level == 0 else 14)
        else:
            p.text = item
            p.level = 0
            p.font.size = Pt(17)
        p.font.color.rgb = DARK
        p.space_after = Pt(8)

    if notes:
        slide.notes_slide.notes_text_frame.text = notes
    return slide


def build():
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)
    titles = []

    def slide(title, bullets, notes=None):
        add_content_slide(prs, title, bullets, notes)
        titles.append(title)

    add_title_slide(
        prs,
        "MooreVIEW",
        "PC HMI & SCADA Suite\nAll-in-one ST programming, runtime, historian, alarms, and operator graphics",
    )
    titles.append("MooreVIEW — PC HMI & SCADA Suite")

    slide(
        "What is MooreVIEW?",
        [
            "Single-page industrial automation app — browser UI + Node.js server in one process",
            "Integrated dashboard: ST editor, tag database, I/O drivers, HMI composer, historian, alarms, Parc",
            "Targets Windows and Linux PCs (MVP Suite); portable .est project files",
            "Live data via HTTP polling (~800 ms) — GET /api/dashboard",
            "Press F1 for in-app help; contextual Help buttons on every tool window",
        ],
        "MooreVIEW is the desktop/PC product fork from the est embedded tree. "
        "One npm start launches everything — no separate SCADA server and IDE.",
    )

    slide(
        "Architecture Overview",
        [
            "server.js — Express boot, scan engine, API routes, static assets",
            "src/ — engine (ST parser/executor), runtime (scan cycle), drivers, HMI, PdM, Parc, reports",
            "views/dashboard.ejs — integrated UI shell; public/js/ — client polling & HMI rendering",
            "st/ — Structured Text programs (.st) and demo fixtures",
            "data/ — runtime persistence (tags, drivers, settings, projects)",
            "Scan loop: read drivers → execute ST → update timers/counters/PID → write outputs → sample historian",
        ],
        "Key modules: TagStore, DriverManager, ScanEngine, GraphHistory. "
        "Optional MongoDB for long-term historian archive and PdM edge inference.",
    )

    slide(
        "Getting Started",
        [
            "cd est-pc  (or mooreview-mvp-suite distributable copy)",
            "npm install",
            "npm start",
            "Open http://127.0.0.1:3090  (default PORT=3090)",
            "npm run green — full unit test suite before release",
            "npm run build-native — Linux HAL native addon (embedded boards only)",
        ],
        "Node.js 18+ required. On embedded Linux with plugin drivers, build native HAL separately.",
    )

    slide(
        "Main Screen Layout",
        [
            "Top bar — MooreVIEW brand, Project menu, Tools menu",
            ("Project ▾ — Status, System setup, New/Open/Save project, Save workspace", 0),
            ("Tools ▾ — Program, Tags, Alarms, Drivers, Historian, Report, Help", 0),
            "Main workspace — live HMI operator display (composed tiles, multi-screen nav)",
            "Floating tool windows — draggable, resizable, Front/Back stacking",
            "Modal popups — Drivers, Report, System setup, Help",
        ],
    )

    slide(
        "Projects & Workspace",
        [
            "Open project — load full .est / JSON bundle (tags, drivers, program)",
            "Save project — download portable project file (format: mooreview-est v1)",
            "Save workspace — server-side copy to data/workspace.est.json",
            "Project snapshots stored under data/projects/",
            "Legacy import: tags-only JSON or bundle without format field",
            "Always verify tag count after opening a project file",
        ],
    )

    slide(
        "ST Program Editor",
        [
            "Edit Structured Text programs under st/ — logic/, modbus/, mqtt/ libraries",
            "Toolbar: New, Open, Import, Save, Load fixtures, Create tags from program",
            "Validate — parse ST and verify tag names exist in database",
            "Load for runtime — validate and load into scan engine without saving to disk",
            "Remote mode — deploy ST to Arduino Opta via opta_remote HTTP driver",
            "Live trace overlay while running: ✓/✗ on BOOL conditions, red outputs when ON",
        ],
        "Tab = two-space indent; Ctrl+S saves. Unsaved edits are protected from polling overwrite.",
    )

    slide(
        "ST Language Highlights",
        [
            "IEC 61131-3 inspired Structured Text — BOOL, INT, REAL, timers, counters, PID",
            "Function blocks: TMR (timers), CTR (counters), PID loops, AVG (averagers)",
            "Actions: TurnON/TurnOFF, SetInt, SetReal, SetArray, PID wiring",
            "Sample programs: motor HOA, TPO irrigation, Modbus I/O, MQTT telemetry",
            "Load fixtures — replace all tags/drivers with st/fixtures/ demo bundles",
            "Create tags from program — add missing tag ids without overwriting existing tags",
        ],
    )

    slide(
        "Runtime & Scan Cycle",
        [
            "Start — runs scan loop at scanMs (default 100 ms, configurable in System setup)",
            "Local mode: read drivers → execute ST on PC → update FBs → write dirty outputs",
            "Remote mode: deploy ST to Opta, scan cycles on device, poll values back",
            "Pause — freeze scan; Resume continues; forces persist across Pause",
            "Stop — halt loop; last values remain visible",
            "Project → Status — runtime state, serial/Modbus health, tag count, validity",
        ],
        "ScanEngine in src/runtime/scanEngine.js orchestrates each cycle. "
        "Overrun stats tracked when cycle exceeds scan interval.",
    )

    slide(
        "Tag Database",
        [
            "Up to 1024 named variables shared by ST program, drivers, and HMI",
            "Roles: input (from driver), output (to driver), memory (internal), fb (function blocks)",
            "Types: BOOL, INT, REAL, TIMER, COUNTER, PID, AVG",
            "Each I/O tag: Driver id, Link (Modbus/MQTT/HTTPS/Simulator), Addr (register/topic/URL)",
            "Labels — display-only names for HMI; ST always uses raw Tag id",
            "32-bit arrays: Bits=32, array length >1, Modbus FC3 read / FC16 write",
        ],
    )

    slide(
        "Scaling, Alarms & Force I/O",
        [
            "Scaling (INT/REAL): engineering = raw × scale + offset",
            "Alarms on Tags table — Alm checkbox + limits (OL/IL/IH/OH for analog; When ON/OFF for BOOL)",
            "Force I/O — override values in Tags table (Force + Force val columns)",
            ("input force — skip driver read; output/memory force — override logic", 1),
            "Forced rows highlight yellow with F badge; Clear forces releases all",
            "Open Program + Tags together for commissioning with live trace",
        ],
    )

    slide(
        "Drivers & I/O",
        [
            "mock — simulation (no hardware)",
            "hal — built-in I/O abstraction (DI/DO/AI/AO/CNT pins; Linux native plugins)",
            "modbus_rtu / modbus_tcp / modbus_bridge — field bus I/O",
            "mqtt — broker subscribe/publish per tag topic",
            "https — REST GET/POST with payload templates",
            "serial, native_so, opta_remote — advanced / remote execution profiles",
        ],
    )

    slide(
        "Modbus & Device Templates",
        [
            "Tag addresses: HR:n, IR:n, DI:n, CO:n (optional per-tag slave override)",
            "Device templates — one-click driver + tag creation from src/devices/templates/",
            "Templates hot-reload without server restart; auto-increment slave address per apply",
            "One modbus_rtu driver per COM port; Refresh ports rescans USB serial",
            "Drivers → Modbus RTU ↔ TCP — commissioning tool for register block copies",
            "Supported templates: Waveshare, Datexel, S::CAN, DFRobot, JXCT, Seeed, Arduino Opta, …",
        ],
    )

    slide(
        "MQTT, HTTPS & Parc",
        [
            "MQTT driver — broker URL, auto-subscribe mapped topics, publish dirty outputs",
            "HTTPS driver — base URL, poll interval, bearer token, per-tag path + template",
            "Payload templates: bool, number, raw, json:field, json",
            "MQTT Parc — Arduino Opta telemetry hub; sync tags from device report",
            "Firmware under firmware/arduino-opta-mqtt-st/ for edge ST + MQTT",
            "Edge AI payloads (edgeAi) logged to MongoDB for PdM integration",
        ],
    )

    slide(
        "Alarms",
        [
            "Active alarm list — floating Alarms window from top bar",
            "Configured entirely in Tags table — no separate alarm editor",
            "INT/REAL: five states (Outer low → Inner low → Normal → Inner high → Outer high)",
            "BOOL: alarm when ON or when OFF (operator-selectable condition)",
            "Per-row Ack; Ack all; Show/hide acknowledged; badge on Alarms tab",
            "Runtime must be Started for live alarm state updates",
        ],
    )

    slide(
        "Historian & Trending",
        [
            "Floating Historian window — up to 32 pens, BOOL plots as 0/1",
            "Live buffer — in-memory samples during runtime (default 600 points/pen)",
            "MongoDB archive — long-term pen_sample documents (optional)",
            "PdM view — combined SCADA + edge AI trends per asset",
            "Time axis with presets (1 h – 30 d) or custom From/To range",
            "Historian → Configuration — pen colors, scale/offset, Y min/max, Auto Y",
        ],
    )

    slide(
        "MongoDB Logging",
        [
            "System setup → Logging — URI, database, SCADA + Edge AI collections",
            "Sample interval (default 5000 ms) while runtime runs",
            "Document types: pen_sample, pen_selection, edge_inference",
            "Seed 90-day demo data — 4 digital + 6 analog tags for archive testing",
            "Purge range or purge all archive documents",
            "Env vars: MONGODB_URI, MONGODB_DB, MONGODB_COLLECTION, MONGODB_SAMPLE_MS",
        ],
    )

    slide(
        "Reports & PDF Export",
        [
            "Report tool — export from live buffer, MongoDB archive, or PdM view",
            "Download PDF — server-generated with chart, pen table, statistics (pdfkit)",
            "Export CSV — timestamp + values per pen",
            "Export PdM CSV — feature-window series when PdM source loaded",
            "PDF layout sections — title, company, orientation, failure forecast (PdM)",
            "Print preview — browser print dialog",
        ],
    )

    slide(
        "PdM — Predictive Maintenance",
        [
            "Combines SCADA historian tags with edge AI inference for health trending",
            "System setup → PdM — asset → SCADA tag map, window size, failure threshold",
            "Feature windows aligned from MongoDB SCADA + edge_inference collections",
            "Health index = 1 − max(edge score); failure forecast banner with RUL estimate",
            "Nightly batch scheduler rebuilds features for all mapped assets",
            "Motor start simulation — 90-day degrading demo for asset motor-202",
        ],
        "View in Historian or Report with Source = PdM (SCADA + Edge). "
        "Pens include HEALTH_IDX, EDGE_SCORE, and mapped SCADA tag averages.",
    )

    slide(
        "HMI — Live Operator Display",
        [
            "Main-page HMI panel — composed tiles without grid lines",
            "Tag-driven colors, text, rotation, trends update each scan cycle",
            "Multi-screen navigation bar when 2+ screens configured",
            "Starting HMI screen — System setup → General (hmi.activeScreen)",
            "Setup… opens composer; Reload screen refreshes live view",
            "Symbol library: SVG, PNG, GIF, composites under public/hmi/svg/library/",
        ],
    )

    slide(
        "HMI Composer",
        [
            "Vertical section menu + large Screen grid for editing",
            "Sections: Screen, Symbols, Object type, Recently used, Project layout, Display size, Bindings",
            "Place symbols — click or drag onto grid cells; Z layers 0–4 (stack up to 5 per cell)",
            "Col/row span for oversized graphics; 8×8 default grid at 128×100 px cells",
            "Object types: static image/text, dynamic image/text, navigation button",
            "Apply HMI settings — saves layout and bindings to data/settings.json",
        ],
    )

    slide(
        "HMI Bindings",
        [
            "Connect tag values to SVG element properties per screen/cell/layer",
            "Properties: fill, stroke, text, rotation, trend, visibility, opacity, fill5, state3, fill8",
            "Test values in composer — per-row Test + Test screen preview",
            "Live HMI uses real scan-cycle values, not composer test values",
            "Text formats: int, fixed0–4, state3 (HOA), state5 (motor), tpoSta, hhmm",
            "Click-to-edit on composite faceplates (TPO schedule, HOA, offline toggles)",
        ],
    )

    slide(
        "Gauges, Strip Charts & Composites",
        [
            "Analog gauges — dial background (Z0) + needle (Z1) with rotation binding",
            "Composites — one placement adds layers + default bindings (gauge_analog, motor_hoa, tpo_daily, pid_loop_standard)",
            "Strip chart — up to 8 pens (trend_pen1…8), Y-axis scale, tag OL/OH scaling, hover crosshair",
            "Gauge column — up to 8 columns (gauge_col1…8), fill height by tag value",
            "Motor HOA faceplate — status lamp, HOA switch, START/STOP/RESET, run hours meter",
            "PID faceplate — PV/SP/OUT readouts + built-in 3-pen strip chart",
        ],
    )

    slide(
        "Controls: Push Buttons, Pilots & HOA",
        [
            "Push buttons — momentary (active while pressed) or latched (toggle on click)",
            "Pilot lights — simple BOOL (fill on/off colors) or complex 5-state INT (Off/On/Warn/Fault/Offline)",
            "HOA switch — INT 0=Auto, 1=Off, 2=Hand; click-to-cycle on live HMI",
            "Navigation buttons — jump between screens; Add page buttons (bottom row, Z4)",
            "Canonical symbols: push_button_*.svg, pilot_light_*.svg in Controls library",
            "Color palettes configurable per symbol in Object type panels",
        ],
    )

    slide(
        "System Setup",
        [
            "Project → System setup… — persisted to data/settings.json on Apply all settings",
            ("General — project name, active ST program, scan interval, starting HMI screen", 0),
            ("Hardware — default serial port, baud, Modbus slave, device template", 0),
            ("Logging — MongoDB connection, sample interval, demo seed, archive purge", 0),
            ("PdM — asset map, feature windows, nightly batch, motor simulation", 0),
            ("HMI — summary + Open HMI composer; Projects — snapshot management", 0),
        ],
    )

    slide(
        "Data Storage & File Layout",
        [
            "data/tags.json — tag database",
            "data/drivers.json — driver configurations",
            "data/settings.json — scan rate, HMI layout, historian pens, PdM, MongoDB",
            "data/projects/ — saved project snapshots",
            "st/*.st — Structured Text programs; st/fixtures/ — demo tag/driver bundles",
            "MOOREVIEW_DATA env var overrides default ./data directory",
        ],
    )

    slide(
        "Supported Hardware (Brief)",
        [
            "Waveshare Modbus RTU 8 DI / 8 DO",
            "Datexel DAT10148 — 16 DI Modbus RTU",
            "S::CAN spectro::lyser and con::cube — water quality Modbus",
            "DFRobot RS485 probes — EC, ORP, turbidity, chlorine, ammonia/pH, dissolved O₂",
            "JXCT soil 7-in-1, Seeed H₂S sensor, Arduino Opta (Modbus RTU / MQTT Parc)",
            "Raspberry Pi 4 + Sequent SM-I-001 via HAL native plugin",
        ],
        "Full wiring and register maps in in-app Help → Device guides (F1).",
    )

    slide(
        "Commissioning Workflow",
        [
            "1. Drivers — connect hardware or apply device template",
            "2. Tags — verify I/O mapping, scaling, and alarm limits",
            "3. Program — edit ST, Validate, Start runtime",
            "4. Tags → Force — override I/O while debugging with Program trace open",
            "5. HMI — compose screens and bindings; Apply HMI settings",
            "6. Historian — configure pens; optional MongoDB for archive",
            "7. Save project — export .est for deployment or backup",
        ],
        "Recommended: keep Program and Tags windows open together during commissioning.",
    )

    slide(
        "Product Variants",
        [
            "MVP Suite (est-pc) — full desktop app, Windows/Linux",
            "ST MVP (mooreview-st-mvp) — embedded Linux, API only",
            "MV Client (mooreview-client) — UI only, connects to remote server",
            "Cloud server (mooreview-cloud) — headless Linux server",
            "Create forks: powershell -File scripts/create-product-forks.ps1",
            "vs embedded est — OpenWrt edge PLC with LuCI/minimal GUI and WebSocket",
        ],
    )

    slide(
        "Summary & Next Steps",
        [
            "MooreVIEW MVP Suite — one app for PLC logic, I/O, HMI, historian, alarms, and PdM",
            "Browser-based operator UI with professional HMI composer and symbol library",
            "Modbus, MQTT, HTTPS, HAL, and device templates for rapid hardware integration",
            "Portable .est projects for backup, migration, and version control",
            "Next: npm start → configure drivers → validate ST → compose HMI → go live",
            "Documentation: README.md, docs/HAL.md, docs/PRODUCT_FORKS.md, in-app Help (F1)",
        ],
        "Thank you. Questions welcome — explore the live app at http://127.0.0.1:3090 after npm start.",
    )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(str(OUTPUT))
    return titles, len(titles) + 1  # +1 for title slide


if __name__ == "__main__":
    toc, count = build()
    print(f"Created: {OUTPUT}")
    print(f"Slide count: {count}")
    print("Table of contents:")
    for i, t in enumerate(toc, 1):
        print(f"  {i:2}. {t}")
