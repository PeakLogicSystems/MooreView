'use strict';

/**
 * Facility HVAC IoT-Link — commissioning & review PDF.
 *
 * Usage:
 *   node scripts/facility-hvac-iot-link/build-review-pdf.js
 *   node scripts/facility-hvac-iot-link/build-review-pdf.js docs/projects/custom.pdf
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  PROJECT,
  AHU_IO,
  AHU_DEVICE_ID,
  COND_DEVICE_ID,
  DEFAULT_AHU_NTC_CAL,
  DEFAULT_AHU_LEAK_CAL,
  COND_IO,
  DEFAULT_COND_MCSA,
} = require('./project-data');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'projects', 'MooreVIEW-Facility-HVAC-IoT-Link-Review.pdf');
const PUBLIC_OUT = path.join(ROOT, 'public', 'docs', 'MooreVIEW-Facility-HVAC-IoT-Link-Review.pdf');

const MARGIN = 54;
const PAGE = 'letter';
const TITLE_COLOR = '#0f172a';
const ACCENT = '#49104F';
const MUTED = '#64748b';

function parseArgs(argv) {
  return { outPath: argv[0] };
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function startNewPage(doc) {
  doc.addPage({ size: PAGE, margin: MARGIN });
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom - 36;
  if (doc.y + height <= bottom) return;
  startNewPage(doc);
}

function footer(doc, pageNum) {
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(8).fillColor(MUTED).font('Helvetica');
  doc.text(
    `MooreVIEW — Facility HVAC IoT-Link Review · Page ${pageNum}`,
    doc.page.margins.left,
    doc.page.height - 36,
    { width: contentWidth(doc), align: 'center', lineBreak: false },
  );
  doc.page.margins.bottom = savedBottom;
  doc.fillColor(TITLE_COLOR).fontSize(10);
  doc.x = doc.page.margins.left;
}

function section(doc, title) {
  ensureSpace(doc, 40);
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(ACCENT).font('Helvetica-Bold');
  doc.text(title, doc.page.margins.left, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.35);
  doc.font('Helvetica').fillColor(TITLE_COLOR).fontSize(10);
  doc.x = doc.page.margins.left;
}

function paragraph(doc, text) {
  ensureSpace(doc, 24);
  doc.fontSize(10).fillColor(TITLE_COLOR).font('Helvetica');
  doc.text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), lineGap: 3 });
  doc.moveDown(0.3);
  doc.x = doc.page.margins.left;
}

function bullets(doc, items) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc) - 12;
  items.forEach((item) => {
    ensureSpace(doc, 18);
    doc.fontSize(9.5).font('Helvetica').fillColor(TITLE_COLOR);
    doc.text(`•  ${item}`, left + 6, doc.y, { width, lineGap: 2 });
    doc.moveDown(0.12);
    doc.x = left;
  });
  doc.moveDown(0.25);
}

function numbered(doc, items) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc) - 12;
  items.forEach((item, i) => {
    ensureSpace(doc, 18);
    doc.fontSize(9.5).font('Helvetica').fillColor(TITLE_COLOR);
    doc.text(`${i + 1}.  ${item}`, left + 6, doc.y, { width, lineGap: 2 });
    doc.moveDown(0.12);
    doc.x = left;
  });
  doc.moveDown(0.25);
}

function cellHeight(doc, text, cellW, font, fontSize) {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(String(text), { width: cellW, lineGap: 1 });
}

function table(doc, headers, rows, colWidths) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const pad = 4;
  const fontSize = 8;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const scaled = colWidths.map((w) => (w / totalW) * width);
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 36;

  function drawRow(cells, y, { header = false, stripe = false } = {}) {
    let rowH = header ? 16 : 14;
    const font = header ? 'Helvetica-Bold' : 'Helvetica';
    cells.forEach((cell, i) => {
      const cellW = Math.max(20, scaled[i] - pad * 2);
      rowH = Math.max(rowH, cellHeight(doc, cell, cellW, font, fontSize) + pad * 2);
    });
    if (y + rowH > bottomLimit()) {
      startNewPage(doc);
      y = doc.page.margins.top;
    }
    doc.rect(left, y, width, rowH).fill(header ? '#efd9f2' : stripe ? '#f8fafc' : '#ffffff');
    let x = left;
    cells.forEach((cell, i) => {
      const cellW = Math.max(20, scaled[i] - pad * 2);
      doc.font(font).fontSize(fontSize).fillColor(TITLE_COLOR);
      doc.text(String(cell), x + pad, y + pad, { width: cellW, lineGap: 1 });
      x += scaled[i];
    });
    doc.x = left;
    return y + rowH;
  }

  ensureSpace(doc, 40);
  let y = doc.y;
  y = drawRow(headers, y, { header: true });
  rows.forEach((row, idx) => {
    y = drawRow(row, y, { stripe: idx % 2 === 0 });
  });
  doc.y = y + 10;
  doc.x = left;
}

function readFirmwareVersion() {
  try {
    const text = fs.readFileSync(
      path.join(ROOT, 'firmware', 'arduino-opta-mqtt-st', 'MooreviewOptaMqttSt', 'mv_version.h'),
      'utf8',
    );
    const match = text.match(/#define\s+MV_FIRMWARE_VERSION\s+"([^"]+)"/);
    return match ? match[1] : 'unknown';
  } catch {
    return 'unknown';
  }
}

function readEstSummary() {
  const fp = path.join(ROOT, 'data', 'projects', `${PROJECT.name}.est.json`);
  if (!fs.existsSync(fp)) return { tags: '—', drivers: '—' };
  const est = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return {
    tags: String(est.tags?.length ?? 0),
    drivers: String(est.drivers?.length ?? 0),
    savedAt: est.savedAt?.slice(0, 10) || '—',
  };
}

function buildPdf(outPath) {
  const generated = new Date().toISOString().slice(0, 10);
  const firmwareVer = readFirmwareVersion();
  const est = readEstSummary();
  let pageNum = 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGE, margin: MARGIN, autoFirstPage: false });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.on('pageAdded', () => {
      pageNum += 1;
      footer(doc, pageNum);
    });

    // Cover
    startNewPage(doc);
    doc.y = doc.page.height * 0.16;
    doc.fontSize(22).fillColor(TITLE_COLOR).font('Helvetica-Bold');
    doc.text('Facility HVAC — IoT-Link', { align: 'center' });
    doc.moveDown(0.35);
    doc.fontSize(15).font('Helvetica').fillColor(ACCENT);
    doc.text('Commissioning & Design Review', { align: 'center' });
    doc.moveDown(0.6);
    doc.fontSize(11).fillColor(TITLE_COLOR);
    doc.text('2 air handlers · 2 condensers · 2 Optas · EZ Meter PQ', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).fillColor(MUTED);
    doc.text(`MooreVIEW project: ${PROJECT.name}`, { align: 'center' });
    doc.text(`ST program: st/${PROJECT.programFile}`, { align: 'center' });
    doc.text(`Firmware: MooreviewOptaMqttSt ${firmwareVer}`, { align: 'center' });
    doc.text(`Project tags: ${est.tags} · drivers: ${est.drivers} · saved ${est.savedAt}`, { align: 'center' });
    doc.text(`Generated: ${generated}`, { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(9).fillColor(MUTED);
    doc.text('DRAFT FOR REVIEW — Private LAN / Starlink site', { align: 'center' });

    // Architecture
    startNewPage(doc);
    section(doc, 'Site architecture');
    paragraph(doc, 'Phase 1: WiFi Opta Parc devices on wired LAN behind Starlink. MQTT to IoT-Link hub only — no inbound ports required. Air handlers and condensers are grouped independently (not matched AHU+cond pairs).');
    table(
      doc,
      ['Pocket', 'Device ID', 'Hardware', 'MooreVIEW driver'],
      [
        ['Dual AHU', AHU_DEVICE_ID, 'Opta + D1608E', 'opta_ahu (remote ST)'],
        ['Dual condenser', COND_DEVICE_ID, 'Opta + D1608E', 'opta_cond (/mcsa)'],
        ['Main meter', 'dds_rgb', 'EZ Meter DDS-RGB RS-485', 'dds_rgb Modbus RTU'],
        ['Hub', 'IoT-Link', 'MooreVIEW appliance', 'MQTT Parc + runtime'],
      ],
      [72, 72, 88, 88],
    );

    section(doc, 'Network & MQTT');
    bullets(doc, [
      'Opta MQTT broker = IoT-Link LAN IP (never 127.0.0.1 on field devices).',
      'Topic prefix: mooreview/v1 · global site key: 1.',
      'Import data/projects/facility-hvac-iot-link.est.zip on IoT-Link; enable MQTT Parc hub; start runtime.',
    ]);

    section(doc, 'EZ Meter — facility PQ');
    table(
      doc,
      ['Setting', 'Value'],
      [
        ['Serial port (IoT-Link PORT A)', '/dev/ttyLP6'],
        ['Modbus RTU', '19200 8N1, slave ID 1'],
        ['Service', 'Single-phase 240 V @ 400 A'],
        ['PQ nominal / UV / OV', '240 V / 216 V / 264 V'],
        ['Rollups', 'MECH_PQ_* tags + FACILITY_ALM on MECH_PQ_ALM'],
      ],
      [120, 200],
    );

    // AHU I/O
    startNewPage(doc);
    section(doc, `AHU Opta — ${AHU_DEVICE_ID}`);
    paragraph(doc, 'Base Opta I1–I4 blower CT (/ct-cal). Base I5–I8 supply/return NTC. D1608E X1_IRAW1–2 pan leak analog (/ahu-env threshold mV).');

    section(doc, 'Blower CT — calibrate on /ct-cal');
    table(
      doc,
      ['Input', 'Function', 'MooreVIEW tag', 'Cal page'],
      AHU_IO.ct.map((r) => [r.input, r.label, r.tag, '/ct-cal']),
      [40, 120, 88, 48],
    );

    section(doc, 'NTC — calibrate on /ahu-env (point selector)');
    table(
      doc,
      ['Point ID', 'Input', 'Label', 'Default Vsupply', 'Rfixed', 'R25', 'Beta', 'Tag'],
      DEFAULT_AHU_NTC_CAL.map((p) => [
        p.id,
        p.input,
        p.label,
        `${p.vsupply} V`,
        `${p.rfixed} Ω`,
        `${p.r25} Ω`,
        String(p.beta),
        AHU_IO.ntc.find((n) => n.input === p.input)?.tag || '—',
      ]),
      [36, 32, 56, 44, 36, 36, 28, 72],
    );

    section(doc, 'Leak detection — D1608E analog (/ahu-env)');
    table(
      doc,
      ['Point ID', 'Input', 'Label', 'Threshold mV', 'Wet tag'],
      DEFAULT_AHU_LEAK_CAL.map((p) => {
        const leak = AHU_IO.leak.find((l) => l.input === p.input);
        return [p.id, p.input, p.label, String(p.thresholdMv), leak?.tag || '—'];
      }),
      [36, 56, 72, 56, 120],
    );

    section(doc, 'AHU env calibration workflow (/ahu-env)');
    numbered(doc, [
      'Flash MooreviewOptaMqttSt; set device ID hvac_ahu_01; broker = IoT-Link LAN IP.',
      '/setup → scan D1608E in expansion slot 1.',
      'Open /ahu-env → enable AHU env processor (NV).',
      'Select each NTC point (ntc0–ntc3); verify live °F; adjust Vsupply, Rfixed, R25, Beta, offset; Save.',
      'Select each leak point (leak0–leak1); set threshold mV and wet-when polarity; Save.',
      'Open /ct-cal → zero/span I1–I4 blower run and start CT.',
      'Deploy logic/facility_hvac_iot_link.st via IoT-Link remote execution on opta_ahu.',
    ]);

    // Condenser — single Opta, dual unit
    startNewPage(doc);
    section(doc, `Condenser Opta — ${COND_DEVICE_ID} (dual unit)`);
    paragraph(doc, 'One Opta + D1608E monitors both condenser units. Base I1–I8: fan and compressor run/start CT (1P+cap ×4 motors). Refrigerant NTC on D1608E X1_IRAW1–4 → T1_C–T4_C.');
    table(
      doc,
      ['Motor', 'Run CT', 'Start CT', 'MCSA asset'],
      DEFAULT_COND_MCSA.motors.map((m, i) => [
        ['U1 fan', 'U1 comp', 'U2 fan', 'U2 comp'][i],
        m.ctRun,
        m.ctStart,
        m.assetId,
      ]),
      [72, 40, 48, 120],
    );
    table(
      doc,
      ['D1608E', 'Function', 'Device tag', 'Project tag'],
      COND_IO.ntc.map((n) => [n.input, n.label, n.channel, n.hiTag]),
      [56, 100, 56, 120],
    );

    section(doc, 'MCSA setup — Preset: facility condenser');
    numbered(doc, [
      `Flash Opta, set device ID ${COND_DEVICE_ID}, broker = IoT-Link LAN IP.`,
      '/setup → scan D1608E slot 1.',
      '/mcsa → Preset: facility condenser (4 motors, 4 NTC on D1608E).',
      'Verify COND1/COND2 fan+comp amps and T1_C–T4_C in telemetry.',
    ]);

    // ST & alarms
    startNewPage(doc);
    section(doc, 'Structured text — facility_hvac_iot_link.st');
    bullets(doc, [
      'AHU1/2: CT overload (H_CT_AMPS), leak (AHU*_PAN_LEAK), supply high temp (H_SUPPLY_HI_F) → AHU*_FAIL_ALM.',
      'Condenser: MCSA faults + refrigerant temp trips → COND*_FAIL_ALM.',
      'SITE_ALM = any HVAC fail; FACILITY_ALM = SITE_ALM or MECH_PQ_ALM.',
      'EZ Meter PQ: undervolt, overvolt, phase loss, imbalance, low PF, frequency → MECH_PQ_ALM.',
    ]);

    section(doc, 'Alarm rollup');
    table(
      doc,
      ['Alarm', 'Sources'],
      [
        ['AHU1_FAIL_ALM', 'Pan leak, blower run/start CT fault, supply temp high'],
        ['AHU2_FAIL_ALM', 'Same pattern for AHU 2'],
        ['COND1_FAIL_ALM', 'MCSA fan/comp fault, refrigerant temp trip'],
        ['COND2_FAIL_ALM', 'MCSA faults, temp trip'],
        ['SITE_ALM', 'Any AHU or condenser fail alarm'],
        ['MECH_PQ_ALM', 'EZ Meter PQ thresholds'],
        ['FACILITY_ALM', 'SITE_ALM or MECH_PQ_ALM'],
      ],
      [72, 280],
    );

    section(doc, 'Default thresholds (commissioning constants)');
    table(
      doc,
      ['Tag', 'Default', 'Purpose'],
      [
        ['H_CT_AMPS', '18 A', 'Blower CT overload'],
        ['H_SUPPLY_HI_F', '105 °F', 'Supply air high temp'],
        ['H_COND_HI_F', '350 °F', 'Condenser high-side trip'],
        ['H_COND_LO_F', '30 °F', 'Condenser low-side trip'],
        ['MECH_PQ_CFG_NOM_V', '240 V', 'PQ nominal'],
        ['MECH_PQ_CFG_UV_V', '216 V', 'Undervoltage (90%)'],
        ['MECH_PQ_CFG_OV_V', '264 V', 'Overvoltage (110%)'],
      ],
      [88, 56, 200],
    );

    // Checklist
    section(doc, 'End-to-end commissioning checklist');
    numbered(doc, [
      'Build project: node scripts/facility-hvac-iot-link/generate-est.js',
      'Import facility-hvac-iot-link.est.zip on IoT-Link',
      'Wire EZ Meter RS-485 to PORT A; confirm Modbus reads at addr 1 / 19200',
      'Commission hvac_ahu_01: D1608E, /ct-cal, /ahu-env',
      'Commission hvac_cond_01: D1608E, /mcsa facility condenser preset (dual unit)',
      'Start runtime; verify all tags GOOD; confirm SITE_ALM and FACILITY_ALM clear at rest',
      'Document calibrated NTC/leak values from /ahu-env API for site records',
    ]);

    section(doc, 'Project artifacts');
    bullets(doc, [
      `JSON: data/projects/${PROJECT.name}.est.json`,
      `Import zip: data/projects/${PROJECT.name}.est.zip`,
      `Fixtures: st/fixtures/tags.facility_hvac_iot_link.json`,
      `Starter: st/fixtures/facility_hvac_iot_link_starter.json`,
      `Generator: node scripts/facility-hvac-iot-link/generate-est.js`,
      `Tests: node --test test/facilityHvacIotLink.test.js`,
      `This PDF: node scripts/facility-hvac-iot-link/build-review-pdf.js`,
    ]);

    section(doc, 'Revision');
    paragraph(doc, `Document generated ${generated}. Firmware baseline MooreviewOptaMqttSt ${firmwareVer}. Reference: scripts/facility-hvac-iot-link/README.md · docs/facilities/EZMETER_FACILITY_PQ.md`);

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

async function main() {
  const { outPath: argPath } = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(argPath || DEFAULT_OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await buildPdf(outPath);
  fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
  fs.copyFileSync(outPath, PUBLIC_OUT);
  const stat = fs.statSync(outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Copied to ${PUBLIC_OUT}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
