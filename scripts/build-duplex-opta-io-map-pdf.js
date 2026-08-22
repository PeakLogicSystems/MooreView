'use strict';

/**
 * Build duplex lift station Opta physical I/O map PDF.
 * Usage: node scripts/build-duplex-opta-io-map-pdf.js [outputPath]
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const map = require('./duplex-lift-station/opta-io-map-data');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'docs', 'projects', 'duplex-lift-station-opta-io-map.pdf');
const PUBLIC_OUT = path.join(ROOT, 'public', 'docs', 'duplex-lift-station-opta-io-map.pdf');

const MARGIN = 54;
const PAGE = 'letter';
const TITLE_COLOR = '#0f172a';
const ACCENT = '#0369a1';
const MUTED = '#64748b';

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
    `MooreVIEW — ${map.project} — Opta Physical I/O Map · Page ${pageNum}`,
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

function buildPdf(outPath) {
  const generated = new Date().toISOString().slice(0, 10);
  const firmware = readFirmwareVersion();
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
    doc.y = doc.page.height * 0.28;
    doc.fontSize(24).fillColor(TITLE_COLOR).font('Helvetica-Bold');
    doc.text('Opta Physical I/O Map', { align: 'center' });
    doc.moveDown(0.8);
    doc.fontSize(14).font('Helvetica').fillColor(ACCENT);
    doc.text(map.project, { align: 'center' });
    doc.moveDown(1.2);
    doc.fontSize(11).fillColor(MUTED);
    doc.text(`ST program: ${map.program}`, { align: 'center' });
    doc.text(`MooreVIEW Opta firmware: ${firmware}`, { align: 'center' });
    doc.text(`Generated: ${generated}`, { align: 'center' });

    startNewPage(doc);
    section(doc, 'Hardware');
    bullets(doc, map.hardware);

    section(doc, 'Wiring notes');
    bullets(doc, map.wiringNotes);

    const headers = ['Terminal / tag', 'Point', 'Type', 'Driver channel', 'Logic tag', 'Description'];
    const colWidths = [72, 52, 36, 72, 72, 120];

    for (const sec of map.sections) {
      section(doc, sec.title);
      table(doc, headers, sec.rows, colWidths);
    }

    section(doc, 'Related documents');
    paragraph(doc, 'Live values: MooreVIEW Tags → Live I/O, or Opta http://<opta-ip>/io-map when on Ethernet.');
    paragraph(doc, 'ST logic reference: st/logic/36_duplex_lift_station.st (PHYSICAL I/O MAP header).');

    doc.end();
    stream.on('finish', () => resolve(outPath));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

async function main() {
  const outPath = path.resolve(process.argv[2] || DEFAULT_OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await buildPdf(outPath);
  fs.mkdirSync(path.dirname(PUBLIC_OUT), { recursive: true });
  fs.copyFileSync(outPath, PUBLIC_OUT);
  console.log(`Wrote ${outPath}`);
  console.log(`Copied to ${PUBLIC_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
