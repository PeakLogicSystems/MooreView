'use strict';

/**
 * HVAC Opta I/O map comparison chart — PDF.
 *
 * Usage:
 *   node scripts/hvac-io-map/build-io-chart-pdf.js
 *   node scripts/hvac-io-map/build-io-chart-pdf.js docs/projects/custom.pdf
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  CHART_TITLE,
  CHART_COLUMNS,
  PIN_ROWS,
  BASE_PIN_GRID,
  EXPANSION_PIN_GRID,
  DUAL_STACK_ROWS,
  NOTES,
} = require('./chart-data');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'projects', 'MooreVIEW-HVAC-IO-Pin-Chart.pdf');
const PUBLIC_OUT = path.join(ROOT, 'public', 'docs', 'MooreVIEW-HVAC-IO-Pin-Chart.pdf');
const LEGACY_OUT = path.join(ROOT, 'docs', 'projects', 'MooreVIEW-HVAC-IO-Map-Comparison.pdf');
const LEGACY_PUBLIC = path.join(ROOT, 'public', 'docs', 'MooreVIEW-HVAC-IO-Map-Comparison.pdf');

const MARGIN = 44;
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
  doc.addPage({ size: PAGE, layout: 'landscape', margin: MARGIN });
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
    `MooreVIEW — ${CHART_TITLE} · Page ${pageNum}`,
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

function buildPdf(outPath) {
  return new Promise((resolve, reject) => {
    const generated = new Date().toISOString().slice(0, 10);
    const firmwareVer = readFirmwareVersion();
    let pageNum = 0;

    const doc = new PDFDocument({ size: PAGE, layout: 'landscape', margin: MARGIN, autoFirstPage: false });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.on('pageAdded', () => {
      pageNum += 1;
      footer(doc, pageNum);
    });

    startNewPage(doc);
    doc.y = doc.page.height * 0.18;
    doc.fontSize(22).fillColor(TITLE_COLOR).font('Helvetica-Bold');
    doc.text('HVAC Opta I/O Pin Chart', { align: 'center' });
    doc.moveDown(0.35);
    doc.fontSize(15).font('Helvetica').fillColor(ACCENT);
    doc.text('5 configs · one unit per column', { align: 'center' });
    doc.moveDown(0.6);
    doc.fontSize(10).fillColor(MUTED);
    doc.text('Per-unit pin comparison — facility/RTU use D1608E; split unit (res/com) = base Opta only', { align: 'center' });
    doc.text(`MooreviewOptaMqttSt ${firmwareVer} · Generated ${generated}`, { align: 'center' });

    startNewPage(doc);
    section(doc, 'Overview');
    paragraph(
      doc,
      'Five configs: facility dual-unit columns (one unit each), RTU, and res/com split-unit base-Opta templates. Dual boards stack unit 2 on higher base/expansion pins.',
    );
    bullets(doc, NOTES);

    section(doc, 'Chart 1 — Signal map (function → pin)');
    const headers = ['Function', ...CHART_COLUMNS.map((c) => c.label)];
    const colWidths = [108, 68, 68, 68, 68, 68];
    table(
      doc,
      headers,
      PIN_ROWS.map((r) => [r.fn, ...CHART_COLUMNS.map((c) => r[c.key])]),
      colWidths,
    );

    section(doc, 'Chart 2 — Base Opta pin allocation (I1–I8)');
    paragraph(doc, 'Direct mapping of each base analog input for one logical unit. Dual facility boards offset unit 2 to I3/I4/I7/I8 (+ expansion).');
    table(
      doc,
      ['Pin', ...CHART_COLUMNS.map((c) => c.label)],
      BASE_PIN_GRID.map((r) => [r.pin, ...CHART_COLUMNS.map((c) => r[c.key])]),
      [36, ...colWidths.slice(1)],
    );

    section(doc, 'Chart 3 — D1608E expansion (X1_IRAW)');
    paragraph(doc, 'Facility AHU / cond / RTU only. Split unit configs use base Opta only (no expansion row assignments).');
    table(
      doc,
      ['Pin', ...CHART_COLUMNS.map((c) => c.label)],
      EXPANSION_PIN_GRID.map((r) => [r.pin, ...CHART_COLUMNS.map((c) => r[c.key])]),
      [52, ...colWidths.slice(1)],
    );

    section(doc, 'Chart 4 — Dual-unit board stacking');
    table(
      doc,
      ['Board', 'Unit 1 pins', 'Unit 2 pins'],
      DUAL_STACK_ROWS.map((r) => [r.board, r.u1, r.u2]),
      [100, 160, 160],
    );

    section(doc, 'Projects & generators');
    bullets(doc, [
      'facility-hvac-iot-link — dual AHU + dual cond + EZ Meter (npm run build:facility-hvac-iot-link)',
      'hvac-rtu-opta — RTU template (npm run build:hvac-rtu-opta)',
      'hvac-split-unit-ahu — res/com split unit AHU (npm run build:hvac-split-unit-ahu)',
      'hvac-split-unit-cond — res/com split unit condenser (npm run build:hvac-split-unit-cond)',
      'Chart data: scripts/hvac-io-map/chart-data.js · PDF: npm run build:hvac-io-map-chart-pdf',
    ]);

    section(doc, 'Legend');
    table(
      doc,
      ['Term', 'Meaning'],
      [
        ['CT', 'Current transformer input (0–1 V on Opta analog)'],
        ['NTC', '10K thermistor — 24 V divider'],
        ['X1_IRAWn', 'D1608E expansion analog input n'],
        ['Pan leak', 'Spot leak sensor — analog mV, wet threshold on /ahu-env'],
        ['/mcsa', 'MCSA monitor web UI — motor CT + refrigerant NTC'],
        ['/ahu-env', 'AHU env cal — supply/return NTC + pan leak mV'],
      ],
      [80, 320],
    );

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
  fs.copyFileSync(outPath, LEGACY_OUT);
  fs.copyFileSync(outPath, LEGACY_PUBLIC);
  const stat = fs.statSync(outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Copied to ${PUBLIC_OUT}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
