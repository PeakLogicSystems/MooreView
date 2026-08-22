'use strict';

/**
 * Build HVAC OPTA Parc manufacturing PDF — all configs A–D.
 *
 * Usage:
 *   node scripts/hvac-opta-parc/build-hvac-mfg-pdf.js
 *   node scripts/hvac-opta-parc/build-hvac-mfg-pdf.js --config=C
 *   node scripts/hvac-opta-parc/build-hvac-mfg-pdf.js docs/projects/custom.pdf
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const {
  PROJECT_NAME,
  PROGRAM,
  FIRMWARE,
  MCSA_1P_CAP,
  MCSA_SETUP_B_D,
  WIFI_MFG,
  SHARED_HARDWARE,
  SHARED_WIRING,
  configMatrixRows,
  allConfigs,
  getConfig,
} = require('./hvac-io-map-data');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'projects', 'MooreVIEW-HVAC-Opta-Parc-Mfg.pdf');
const PUBLIC_OUT = path.join(ROOT, 'public', 'docs', 'MooreVIEW-HVAC-Opta-Parc-Mfg.pdf');

const MARGIN = 54;
const PAGE = 'letter';
const TITLE_COLOR = '#0f172a';
const ACCENT = '#0369a1';
const MUTED = '#64748b';

function parseArgs(argv) {
  let config = null;
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith('--config=')) config = arg.slice('--config='.length);
    else positional.push(arg);
  }
  return { config, outPath: positional[0] };
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
    `MooreVIEW — HVAC Opta Parc Manufacturing · Page ${pageNum}`,
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
    doc.rect(left, y, width, rowH).fill(header ? '#e2e8f0' : stripe ? '#f8fafc' : '#ffffff');
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

function renderConfig(doc, cfg) {
  startNewPage(doc);
  doc.fontSize(18).fillColor(TITLE_COLOR).font('Helvetica-Bold');
  doc.text(`Config ${cfg.letter} — ${cfg.label}`, doc.page.margins.left, doc.y, { width: contentWidth(doc) });
  doc.moveDown(0.35);
  doc.fontSize(10).font('Helvetica').fillColor(MUTED);
  doc.text(`HVAC_CFG = ${cfg.cfg} · ${cfg.project}`, { width: contentWidth(doc) });
  doc.text(`MooreVIEW project: ${PROJECT_NAME} · ST: ${PROGRAM}`, { width: contentWidth(doc) });
  doc.text(`Device template: ${cfg.template}`, { width: contentWidth(doc) });
  doc.text(`Device ID(s): ${cfg.deviceIds.join(', ')}`, { width: contentWidth(doc) });
  doc.text(`Hardware: ${cfg.hardware}`, { width: contentWidth(doc) });
  doc.moveDown(0.5);
  doc.fillColor(TITLE_COLOR);

  section(doc, 'Bill of materials / hardware');
  bullets(doc, cfg.hardware);

  section(doc, 'Wiring notes');
  bullets(doc, cfg.wiringNotes);

  if (cfg.mcsaSetup && cfg.mcsaSetup.length) {
    section(doc, '/mcsa setup (1P + start cap)');
    numbered(doc, cfg.mcsaSetup);
  }

  const headers = ['Terminal', 'Point', 'MCSA / wiring', 'MooreVIEW tag', 'Description'];
  const colWidths = [52, 48, 56, 88, 120];
  for (const sec of cfg.sections) {
    section(doc, sec.title);
    table(doc, headers, sec.rows, colWidths);
  }

  section(doc, 'Manufacturing test checklist');
  numbered(doc, cfg.mfgChecklist);
}

function buildPdf(outPath, configs) {
  const generated = new Date().toISOString().slice(0, 10);
  const firmwareVer = readFirmwareVersion();
  let pageNum = 0;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGE, margin: MARGIN, autoFirstPage: false });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.on('pageAdded', () => {
      pageNum += 1;
      footer(doc, pageNum);
    });

    startNewPage(doc);
    doc.y = doc.page.height * 0.18;
    doc.fontSize(24).fillColor(TITLE_COLOR).font('Helvetica-Bold');
    doc.text('HVAC Opta Parc', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(16).font('Helvetica').fillColor(ACCENT);
    doc.text('Manufacturing & Wiring Guide', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor(TITLE_COLOR);
    doc.text('Configs A · B · C · D — 1P + start cap MCSA', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(10).fillColor(MUTED);
    doc.text(`Project: ${PROJECT_NAME}`, { align: 'center' });
    doc.text(`Firmware: MooreviewOptaMqttSt ${firmwareVer}`, { align: 'center' });
    doc.text(`Generated: ${generated}`, { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(9).fillColor(MUTED);
    doc.text('CONFIDENTIAL — Manufacturing use', { align: 'center' });

    startNewPage(doc);
    section(doc, 'Configuration matrix');
    const matrix = configMatrixRows();
    table(
      doc,
      ['Cfg', 'HVAC_CFG', 'Description', 'Hardware', 'MCSA wiring', 'Expansion', 'Opta'],
      matrix.map((r) => [
        r.letter,
        r.hvacCfg,
        r.label,
        r.hardware.replace('Base Opta only', 'Base'),
        r.mcsaWiring,
        r.expansion,
        r.devices,
      ]),
      [24, 40, 72, 72, 88, 44, 40],
    );

    section(doc, 'MCSA — single-phase with start capacitor (all fan & compressor configs)');
    bullets(doc, [
      `${MCSA_1P_CAP.wiring} — not plain 1P (no cap).`,
      `M4 edge AI model: ${MCSA_1P_CAP.edgeModel}.`,
      MCSA_1P_CAP.note,
      'Config A: dedicated run CT (I2) + start-winding CT (I3) on blower.',
      'Configs B/D: HVAC layout — run CT on I1 (compressor) and I2 (fan); start-cap diagnostics via MCSA on run CT.',
    ]);

    section(doc, 'Shared hardware conventions');
    bullets(doc, SHARED_HARDWARE);

    section(doc, 'Shared wiring conventions');
    bullets(doc, SHARED_WIRING);

    section(doc, 'WiFi AP, /setup & MQTT Parc (all configs)');
    bullets(doc, WIFI_MFG);
    paragraph(doc, 'Reference: docs/OPTA_PARC_CLOUD.md · scripts/hvac-opta-parc/README.md');

    section(doc, 'Config summary — I/O counts');
    table(
      doc,
      ['Cfg', 'Motors (1P+cap)', 'Run CT', 'Start CT', 'Leak DI', 'NTC', 'Expansion'],
      [
        ['A', '1 blower', 'I2', 'I3', '1', '2', 'None'],
        ['B', 'comp + fan', 'I1, I2', 'via MCSA', '—', '2', 'None'],
        ['C', '2 blowers', 'I2, I3', '—', '2', '4', 'D1608E'],
        ['D', '2× comp + fan', 'I1, I2 ×2', 'via MCSA', '2 DI', '4', 'D1608E + 2nd Opta'],
      ],
      [28, 56, 44, 44, 40, 32, 72],
    );

    for (const cfg of configs) {
      renderConfig(doc, cfg);
    }

    startNewPage(doc);
    section(doc, 'MooreVIEW project files');
    bullets(doc, [
      `Project: data/projects/${PROJECT_NAME}.est.json`,
      `Generate: node scripts/hvac-opta-parc/generate-est.js`,
      `Tags fixture: st/fixtures/tags.hvac_opta_parc.json`,
      `ST program: st/${PROGRAM}`,
      `Starter manifest: st/fixtures/hvac_opta_parc_starter.json`,
    ]);

    section(doc, 'Revision');
    paragraph(doc, `Document generated ${generated} from scripts/hvac-opta-parc/build-hvac-mfg-pdf.js. Firmware baseline: ${FIRMWARE}.`);

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

async function main() {
  const { config, outPath: argPath } = parseArgs(process.argv.slice(2));
  const outPath = path.resolve(argPath || DEFAULT_OUT);
  const configs = config ? [getConfig(config)] : allConfigs();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await buildPdf(outPath, configs);
  if (!config) {
    fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
    fs.copyFileSync(outPath, PUBLIC_OUT);
    console.log(`Copied to ${PUBLIC_OUT}`);
  }
  console.log(`Wrote ${outPath} (${configs.length} config${configs.length === 1 ? '' : 's'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
