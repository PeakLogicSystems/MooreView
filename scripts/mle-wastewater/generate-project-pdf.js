'use strict';

/**
 * Generate MLE WWTP project design PDF from project config.
 * Usage:
 *   node scripts/mle-wastewater/generate-project-pdf.js [projectId] [outputPath]
 *   projectId: mle-2000gpd (default) | pasco-rv-120kgpd | mle-poc-50gpd
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { getProjectConfig, fmtGpd, fmtMoney } = require('./project-configs');
const { createDiagramSheets } = require('./diagram-sheets');
const {
  SCAN_VENDOR,
  getScanPorts,
  getMeasurementTableRows,
  getAiInputRows,
  getScanEquipmentDescription,
  getScanCapex,
} = require('./scan-instrumentation');

const ROOT = path.join(__dirname, '../..');
const projectId = process.argv[2] || 'mle-2000gpd';
const CFG = getProjectConfig(projectId);
const DEFAULT_OUT = path.join(ROOT, 'docs', 'projects', CFG.pdfFile);

const MARGIN = 54;
const PAGE = 'letter';
const FOOTER_COLOR = '#64748b';
const TITLE_COLOR = '#0f172a';
const ACCENT = '#0369a1';

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawPageFooter(doc, pageNum) {
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const y = doc.page.height - 36;
  doc.fontSize(8).fillColor(FOOTER_COLOR).font('Helvetica');
  doc.text(
    `${CFG.footerTitle} — Project Design Document · Page ${pageNum}`,
    doc.page.margins.left,
    y,
    { width: contentWidth(doc), align: 'center', lineBreak: false }
  );
  doc.page.margins.bottom = savedBottom;
  doc.fillColor(TITLE_COLOR).fontSize(10);
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

/** Absolute-positioned diagram text without triggering PDFKit auto-pagination */
function diagramText(doc, text, x, y, opts = {}) {
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.fontSize(opts.size || 7).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(opts.color || '#475569');
  doc.text(text, x, y, {
    width: opts.width,
    align: opts.align || 'left',
    lineGap: opts.lineGap || 0,
    lineBreak: opts.lineBreak !== false,
  });
  doc.page.margins.bottom = savedBottom;
}

function startNewPage(doc, opts = {}) {
  doc.addPage({
    size: opts.size || PAGE,
    layout: opts.layout || 'portrait',
    margin: MARGIN,
  });
  doc.x = doc.page.margins.left;
  doc.y = doc.page.margins.top;
}

function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom - 28;
  if (doc.y + height <= bottom) return;
  startNewPage(doc);
}

function section(doc, title) {
  ensureSpace(doc, 36);
  doc.moveDown(0.6);
  doc.fontSize(13).fillColor(ACCENT).font('Helvetica-Bold');
  doc.text(title, doc.page.margins.left, doc.y, { width: contentWidth(doc), lineGap: 2 });
  doc.moveDown(0.35);
  doc.font('Helvetica').fillColor(TITLE_COLOR).fontSize(10);
  doc.x = doc.page.margins.left;
}

function paragraph(doc, text, opts = {}) {
  doc.fontSize(opts.size || 10).fillColor(TITLE_COLOR).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
  const width = contentWidth(doc);
  const blockH = doc.heightOfString(text, { width, lineGap: 3 }) + (opts.after || 0.35) * 12 + 8;
  if (!opts.noEnsure) ensureSpace(doc, blockH);
  doc.text(text, doc.page.margins.left, doc.y, {
    width,
    align: opts.align || 'left',
    lineGap: 3,
  });
  doc.moveDown(opts.after || 0.35);
  doc.x = doc.page.margins.left;
}

function bullet(doc, items) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc) - 16;
  items.forEach((item) => {
    ensureSpace(doc, 18);
    doc.fontSize(10).font('Helvetica').fillColor(TITLE_COLOR);
    doc.text(`•  ${item}`, left + 8, doc.y, { width, lineGap: 2 });
    doc.moveDown(0.15);
    doc.x = left;
  });
  doc.moveDown(0.2);
}

function cellHeight(doc, text, cellW, font, fontSize) {
  doc.font(font).fontSize(fontSize);
  return doc.heightOfString(String(text), { width: cellW, lineGap: 1 });
}

function table(doc, headers, rows, colWidths) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const pad = 4;
  const fontSize = 8.5;
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const scaled = colWidths.map((w) => (w / totalW) * width);
  const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 28;

  function drawRow(cells, y, { header = false, stripe = false } = {}) {
    let rowH = header ? 16 : 14;
    const font = header ? 'Helvetica-Bold' : 'Helvetica';
    cells.forEach((cell, i) => {
      const cellW = Math.max(24, scaled[i] - pad * 2);
      const h = cellHeight(doc, cell, cellW, font, fontSize) + pad * 2;
      rowH = Math.max(rowH, h);
    });

    if (y + rowH > bottomLimit()) {
      startNewPage(doc);
      y = doc.page.margins.top;
    }

    doc.rect(left, y, width, rowH).fill(header ? '#e2e8f0' : stripe ? '#f8fafc' : '#ffffff');

    let x = left;
    cells.forEach((cell, i) => {
      const cellW = Math.max(24, scaled[i] - pad * 2);
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
  doc.y = y + 8;
  doc.x = left;
}

function wrapMonoLines(doc, lines, maxWidth) {
  doc.font('Courier').fontSize(7.5);
  const out = [];
  for (const line of lines) {
    if (!line) {
      out.push('');
      continue;
    }
    if (doc.widthOfString(line) <= maxWidth) {
      out.push(line);
      continue;
    }
    let rest = line;
    while (rest.length > 0) {
      let cut = rest.length;
      while (cut > 1 && doc.widthOfString(rest.slice(0, cut)) > maxWidth) cut -= 1;
      if (cut <= 1 && rest.length > 1) cut = Math.max(1, Math.floor(maxWidth / doc.widthOfString('M')));
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }
  return out;
}

function monoBlock(doc, lines) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);
  const innerW = width - 16;
  const wrapped = wrapMonoLines(doc, lines, innerW);
  const lineH = 9.5;
  const blockH = wrapped.length * lineH + 14;
  ensureSpace(doc, blockH);
  const y0 = doc.y;
  doc.rect(left, y0, width, blockH).fill('#f1f5f9');
  doc.font('Courier').fontSize(7.5).fillColor('#334155');
  wrapped.forEach((line, i) => {
    doc.text(line, left + 8, y0 + 7 + i * lineH, { width: innerW, lineGap: 0 });
  });
  doc.font('Helvetica').fontSize(10).fillColor(TITLE_COLOR);
  doc.y = y0 + blockH + 6;
  doc.x = left;
}

function drawArrow(doc, x1, y1, x2, y2, opts = {}) {
  const color = opts.color || '#334155';
  const lw = opts.width || 1.3;
  const head = opts.head || 8;
  doc.save();
  doc.strokeColor(color).lineWidth(lw);
  if (opts.dash) doc.dash(opts.dash, { space: opts.dashSpace || opts.dash });
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  if (opts.dash) doc.undash();
  const angle = Math.atan2(y2 - y1, x2 - x1);
  doc.moveTo(x2, y2)
    .lineTo(x2 - head * Math.cos(angle - 0.45), y2 - head * Math.sin(angle - 0.45))
    .moveTo(x2, y2)
    .lineTo(x2 - head * Math.cos(angle + 0.45), y2 - head * Math.sin(angle + 0.45))
    .stroke();
  doc.restore();
}

function drawFlowLabel(doc, text, x, y, opts = {}) {
  doc.save();
  doc.fontSize(opts.size || 7.5).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
  doc.fillColor(opts.color || '#475569');
  doc.text(text, x, y, { width: opts.width || 120, align: opts.align || 'center' });
  doc.restore();
}

function drawUnitBox(doc, x, y, w, h, opts = {}) {
  const r = opts.radius || 5;
  doc.save();
  doc.lineWidth(1.2).strokeColor(opts.stroke || '#334155');
  if (opts.fill) doc.roundedRect(x, y, w, h, r).fillAndStroke(opts.fill, opts.stroke || '#334155');
  else doc.roundedRect(x, y, w, h, r).stroke(opts.stroke || '#334155');

  doc.fillColor(opts.titleColor || TITLE_COLOR);
  doc.font('Helvetica-Bold').fontSize(opts.titleSize || 9);
  doc.text(opts.title, x + 5, y + 7, { width: w - 10, align: 'center' });

  if (opts.lines) {
    doc.font('Helvetica').fontSize(7).fillColor('#475569');
    let ly = y + 22;
    opts.lines.forEach((line) => {
      doc.text(line, x + 5, ly, { width: w - 10, align: 'center' });
      ly += 9;
    });
  }
  doc.restore();
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}

function drawPumpSymbol(doc, x, y, label) {
  doc.save();
  doc.circle(x, y, 11).lineWidth(1).stroke('#334155');
  doc.moveTo(x - 6, y).lineTo(x + 6, y).stroke();
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#334155');
  doc.text(label, x - 18, y + 14, { width: 36, align: 'center' });
  doc.restore();
}

function drawInstrumentBubble(doc, x, y, tag) {
  doc.save();
  doc.circle(x, y, 10).lineWidth(0.8).stroke('#0369a1');
  doc.fontSize(5.5).font('Helvetica-Bold').fillColor('#0369a1');
  doc.text(tag, x - 9, y - 4, { width: 18, align: 'center' });
  doc.restore();
}

/** ISA-style online analyzer on process line */
function drawAnalyzer(doc, x, y, tag, analyte, opts = {}) {
  const w = opts.w || 40;
  const h = opts.h || 30;
  doc.save();
  doc.roundedRect(x, y, w, h, 3).lineWidth(0.9).fillAndStroke(opts.fill || '#eff6ff', '#0369a1');
  doc.fontSize(5).font('Helvetica-Bold').fillColor('#0369a1');
  doc.text('AT', x + 2, y + 3, { width: w - 4, align: 'center' });
  doc.fontSize(4.8).font('Helvetica-Bold');
  doc.text(tag, x + 2, y + 11, { width: w - 4, align: 'center' });
  doc.fontSize(4.5).font('Helvetica').fillColor('#475569');
  doc.text(analyte, x + 2, y + 19, { width: w - 4, align: 'center' });
  doc.restore();
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}

function drawSampleLine(doc, x1, y1, x2, y2, color = '#0369a1') {
  doc.save().strokeColor(color).lineWidth(0.7).dash(2, { space: 2 });
  doc.moveTo(x1, y1).lineTo(x2, y2).stroke();
  doc.undash().restore();
}

/** TSS / solids analyzer — distinct from NH3/NO3 for PFD clarity */
function drawTssAnalyzer(doc, x, y, tag, opts = {}) {
  const w = opts.w || 40;
  const h = opts.h || 28;
  doc.save();
  doc.roundedRect(x, y, w, h, 3).lineWidth(0.9).fillAndStroke(opts.fill || '#fffbeb', '#b45309');
  doc.fontSize(5).font('Helvetica-Bold').fillColor('#b45309');
  doc.text('AT', x + 2, y + 3, { width: w - 4, align: 'center' });
  doc.fontSize(4.8).font('Helvetica-Bold');
  doc.text(tag, x + 2, y + 11, { width: w - 4, align: 'center' });
  doc.fontSize(4.5).font('Helvetica').fillColor('#475569');
  doc.text('TSS', x + 2, y + 19, { width: w - 4, align: 'center' });
  doc.restore();
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}

function drawLegendAnalyzer(doc, x, y) {
  doc.save();
  doc.roundedRect(x, y, 18, 12, 2).lineWidth(0.8).stroke('#0369a1');
  doc.fontSize(4).font('Helvetica-Bold').fillColor('#0369a1');
  doc.text('AT', x + 2, y + 2, { width: 14, align: 'center' });
  doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
  doc.text('NH3 / NO3', x + 22, y + 1, { width: 70 });
  doc.restore();
}

function drawLegendTssAnalyzer(doc, x, y) {
  doc.save();
  doc.roundedRect(x, y, 18, 12, 2).lineWidth(0.8).stroke('#b45309');
  doc.fontSize(4).font('Helvetica-Bold').fillColor('#b45309');
  doc.text('AT', x + 2, y + 2, { width: 14, align: 'center' });
  doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
  doc.text('TSS', x + 22, y + 1, { width: 40 });
  doc.restore();
}

function drawLegendItem(doc, x, y, color, dash, label) {
  doc.save();
  doc.lineWidth(2).strokeColor(color);
  if (dash) doc.dash(dash, { space: dash });
  doc.moveTo(x, y + 4).lineTo(x + 22, y + 4).stroke();
  if (dash) doc.undash();
  doc.fontSize(7.5).font('Helvetica').fillColor('#475569');
  doc.text(label, x + 28, y, { width: 140 });
  doc.restore();
}

const { drawAllDiagramPages } = createDiagramSheets({
  CFG,
  fmtGpd,
  ACCENT,
  FOOTER_COLOR,
  TITLE_COLOR,
  startNewPage,
  helpers: {
    diagramText,
    drawArrow,
    drawFlowLabel,
    drawUnitBox,
    drawPumpSymbol,
    drawInstrumentBubble,
    drawAnalyzer,
    drawTssAnalyzer,
    drawSampleLine,
    drawLegendItem,
    drawLegendAnalyzer,
    drawLegendTssAnalyzer,
  },
});

function coverPage(doc) {
  const left = doc.page.margins.left;
  const w = contentWidth(doc);
  doc.x = left;
  doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold');
  doc.text('PROJECT DESIGN DOCUMENT', left, 120, { align: 'center', width: w });
  doc.moveDown(1.2);
  doc.fontSize(22).fillColor(TITLE_COLOR);
  doc.text(CFG.coverTitle, left, doc.y, { align: 'center', width: w });
  doc.fontSize(16).fillColor('#475569');
  doc.text(CFG.coverSubtitle, left, doc.y, { align: 'center', width: w });
  doc.moveDown(1.5);
  doc.fontSize(12).fillColor(TITLE_COLOR);
  doc.text('Effluent Target: ≤10 mg/L NO₃-N', left, doc.y, { align: 'center', width: w });
  doc.moveDown(3);
  doc.fontSize(10).font('Helvetica').fillColor('#475569');
  const meta = [
    `Site: ${CFG.siteName} · ${CFG.county}, ${CFG.state}`,
    'Document type: Preliminary / Owner Budget Package',
    `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    'Process: MLE + Fixed PVA IFAS + CRS NBG + NH3/NO3/TSS + AI optimization',
    'Prepared for: Design, permitting, vendor RFQ, and MooreVIEW SCADA integration',
  ];
  meta.forEach((line) => {
    doc.text(line, left, doc.y, { align: 'center', width: w });
    doc.moveDown(0.3);
  });
  doc.fontSize(9).fillColor(FOOTER_COLOR);
  doc.text(
    'Estimates are planning-level (±25–35%) until site-specific engineering and vendor quotes are obtained.',
    left,
    doc.page.height - 100,
    { align: 'center', width: w }
  );
  doc.x = left;
}

function buildPdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: PAGE, margin: MARGIN, autoFirstPage: false });
    let physicalPage = 0;
    doc.on('pageAdded', () => {
      physicalPage += 1;
      if (physicalPage <= 1) return;
      drawPageFooter(doc, physicalPage - 1);
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.addPage({ size: PAGE, margin: MARGIN });
    coverPage(doc);
    startNewPage(doc);

    section(doc, '1. Executive Summary');
    paragraph(
      doc,
      `This document defines a ${CFG.isPoc ? 'proof-of-concept (POC) ' : ''}wastewater treatment plant (WWTP) for ${CFG.siteName} (${CFG.county}, ${CFG.state}), rated for ${CFG.flowAvgGpm} GPM (${fmtGpd(CFG.flowAvgGpd)} GPD average flow). The biological process is Modified Ludzack-Ettinger (MLE) biological nitrogen removal configured as hybrid integrated fixed-film activated sludge (IFAS) with fixed PVA foam carriers, CRS (Chemical Reduction Systems) nanobubble generators, s::can recirculating optical measurements (BOD, NH₃, NO₃, TSS, pH, ORP per phase), and AI-based process optimization.`
    );
    if (CFG.isPoc) {
      paragraph(
        doc,
        CFG.layout === 'poc-tote'
          ? `POC scope: demonstrate ≤10 mg/L NO₃-N effluent, CRS nanobubble oxygen transfer, and s::can optical analytics with AI-based IR/WAS/DO optimization at ${fmtGpd(CFG.flowAvgGpd)} GPD (${CFG.flowAvgGpm} gpm) before scaling to production. Physical skid: ${fmtGpd(CFG.anoxicGal)} gal anoxic + ${fmtGpd(CFG.aerobicGal)} gal aerobic process tanks (${fmtGpd(CFG.reactorGal)} gal bio), ${fmtGpd(CFG.clarifierGal)} gal chemical tote (IBC) secondary clarifier, and ${fmtGpd(CFG.finalTankGal)} gal low-profile final tank for polishing and effluent sampling.`
          : `POC scope: demonstrate ≤10 mg/L NO₃-N effluent, CRS nanobubble oxygen transfer, and s::can optical analytics with AI-based IR/WAS/DO optimization at ${fmtGpd(CFG.flowAvgGpd)} GPD (${CFG.flowAvgGpm} gpm) before scaling to production. Bench-scale ~${fmtGpd(CFG.reactorGal)} gal reactor with full MooreVIEW historian architecture.`
      );
    }
    paragraph(
      doc,
      `Configuration: ${CFG.trainLabel}. The design target is ≤10 mg/L nitrate-nitrogen (NO₃-N) in the final effluent, with ammonia-nitrogen (NH₃-N) <1 mg/L and secondary quality BOD₅/TSS ≤10 mg/L.`
    );
    table(
      doc,
      ['Metric', 'Value'],
      [
        ['Design average flow', `${fmtGpd(CFG.flowAvgGpd)} GPD (${CFG.flowAvgGpm} gpm)`],
        ['Design peak flow', `${fmtGpd(CFG.flowPeakGpd)} GPD`],
        ['Biological volume', `${fmtGpd(CFG.reactorGal)} gal`],
        ...(CFG.layout === 'poc-tote'
          ? [
              ['Clarifier (IBC tote)', `${fmtGpd(CFG.clarifierGal)} gal`],
              ['Final treatment tank', `${fmtGpd(CFG.finalTankGal)} gal`],
            ]
          : []),
        ['Footprint (approx.)', `${CFG.footprintSqFt} ft²`],
        ['Mid-tier installed CAPEX', fmtMoney(CFG.midCapex)],
        ['Total project budget (with contingency)', fmtMoney(CFG.totalBudget)],
        ['Annual OPEX (mid)', `$${CFG.annualOpex}`],
      ],
      [2, 3]
    );

    section(doc, '2. Design Basis');
    table(
      doc,
      ['Parameter', 'Value', 'Notes'],
      [
        ['Average flow (Q)', `${CFG.flowAvgGpm} GPM (${fmtGpd(CFG.flowAvgGpd)} GPD)`, `${CFG.flowAvgGpm} gpm design`],
        ['Peak flow', `${fmtGpd(CFG.flowPeakGpd)} GPD`, 'Diurnal / seasonal peaking'],
        ['Influent BOD₅', `${CFG.influentBod} mg/L`, 'Carbon for denitrification'],
        ['Influent BOD₅', `${CFG.influentBod} mg/L`, 's::can INF_BOD · C:N ratio for denitrification'],
        ['Influent TSS', `${CFG.influentTss} mg/L`, 's::can INF_TSS · AI baseline'],
        ['Influent TKN', `${CFG.influentTkn} mg/L`, CFG.layout === 'dual-125k' ? 'RV resort strength' : 'Typical municipal strength'],
        ['Influent NH₃-N', `${CFG.influentNh3} mg/L`, ''],
        ['Influent total nitrogen', `${CFG.influentTn} mg/L`, 'Includes organic N'],
        ['Design minimum temperature', `${CFG.designMinTempC}°C`, CFG.state === 'Florida' ? 'Florida winter design' : 'Winter nitrification driver'],
        ['Effluent NO₃-N limit', '≤10 mg/L', 'Monthly average permit target'],
        ['Effluent NH₃-N', '<1 mg/L', 'Design objective'],
        ['Effluent BOD₅ / TSS', '≤10 / ≤10 mg/L', 'Secondary treatment standard'],
      ],
      [1.4, 1.2, 1.4]
    );

    section(doc, '3. Process Description');
    paragraph(
      doc,
      'Wastewater passes through preliminary screening (if required by local code), then enters the pre-anoxic zone of the MLE reactor. Return activated sludge (RAS) is mixed with influent in the anoxic zone where denitrification occurs using influent readily biodegradable COD (rbCOD). Mixed liquor underflows to the aerobic IFAS zone where autotrophic nitrifiers oxidize ammonia on both suspended floc and fixed PVA biofilm. Internal recycle (IR) pumps return nitrified mixed liquor from the aerobic zone to the anoxic zone.'
    );
    paragraph(
      doc,
      'Oxygen is supplied primarily through a continuous sidestream loop: mixed liquor is pumped through a CRS Nanobubble Generator (NBG) and returned to the aerobic zone. A small fine-bubble diffuser and trim blower maintains dissolved oxygen (DO) setpoint during peak load or cold weather. Nano-bubbles are not applied in the anoxic zone.'
    );
    paragraph(
      doc,
      'Online measurements use a recirculating s::can optical analyzer package (spectro::lyser, pH::lyser, ORP in flow cell, sam::spector sequencer) that cycles sample ports at each MLE phase: influent (BOD, COD, TSS, NH₃, pH, UV254), pre-anoxic (NO₃, ORP, pH, TSS, residual COD), IR stream, aerobic outlet, and final effluent. Influent BOD enables carbon-limited denitrification detection alongside NH₃/NO₃/TSS. Aerobic DO remains on dedicated continuous probes for blower PID. All phase tags historize in MooreVIEW; effluent NO₃-N drives IR VFD trim; AI optimizer uses INF_BOD, C:N ratio, and phase pH/ORP within operator bounds.'
    );
    if (CFG.layout === 'poc-tote') {
      paragraph(
        doc,
        `POC physical layout: screened influent feeds T-100 (${fmtGpd(CFG.anoxicGal)} gal pre-anoxic) and T-110 (${fmtGpd(CFG.aerobicGal)} gal aerobic IFAS) as separate process tanks on a skid. Mixed liquor overflows to T-200, a ${fmtGpd(CFG.clarifierGal)} gal chemical tote (IBC) used as the secondary clarifier. A 3-zone bottom insert separates hydraulic functions: Zone 1 (RAS sump at cone apex), Zone 2 (WAS draw on cone wall), and Zone 3 (center standpipe overflow for clarified supernatant only via L-210) to T-210, a ${fmtGpd(CFG.finalTankGal)} gal low-profile tank for final hold, polishing, and permit-grade effluent sampling (s::can port SV-105) before discharge.`
      );
    } else {
      paragraph(doc, 'Treated mixed liquor flows to an integrated lamella/tube settler. Clarified effluent is discharged; RAS returns to anoxic; waste activated sludge (WAS) is removed on an SRT schedule.', { bold: false });
    }

    drawAllDiagramPages(doc);

    section(doc, '7a. Process Flow Summary');
    paragraph(
      doc,
      'Refer to the drawing set on the preceding landscape pages: Sheet 1 (P&ID) includes the s::can recirculating sample loop (L-SCAN, P-SCAN, SV-101…106) to each phase; Sheet 2 (Mechanical) shows the analyzer shelter; Sheet 3 (Instrumentation) lists optical parameters per sequencer port. Main process: influent enters pre-anoxic with RAS; denitrified mixed liquor passes to aerobic IFAS; nitrified liquor is settled and discharged. IR (3.5× Q) returns nitrate-rich liquor to anoxic. CRS sidestream provides nanobubble oxygen in the aerobic zone only.'
    );

    section(doc, '7b. Process Measurement Points (s::can Recirculating Loop)');
    table(
      doc,
      ['Tag', 'Sample Port', 'Parameter', 'Target / Alarm', 'Control Use'],
      getMeasurementTableRows(CFG),
      [0.75, 0.95, 0.55, 1, 1.75]
    );
    paragraph(
      doc,
      `${SCAN_VENDOR} package: spectro::lyser V3 (UV-Vis BOD, COD, NO₃, NH₃, TSS, SAC254), pH::lyser in flow cell, ORP at anoxic-phase dwells, con::sole controller, sam::spector ${getScanPorts(CFG).length}-port sequencer, P-SCAN recirculation pump with Y-strainer and 10 L buffer. Sample return to source. Dwell ${CFG.scanDwellMin || 8} min/port; full cycle ~${(CFG.scanDwellMin || 8) * getScanPorts(CFG).length} min. Calibrate BOD/COD vs lab grab monthly; derive INF_BOD_TKN in MooreVIEW ST. Modbus TCP to edge historian at 1-min scan during active port.`
    );

    section(doc, '7c. s::can Sequencer Port Schedule');
    table(
      doc,
      ['Port', 'Valve', 'Phase', 'Optical Parameters', 'Notes'],
      getScanPorts(CFG).map((p) => [String(p.port), p.valve, p.phase, p.params.join(', '), p.notes]),
      [0.4, 0.55, 0.85, 1.4, 1.8]
    );

    section(doc, '7d. AI-Based Process Optimization');
    paragraph(
      doc,
      'The s::can multivariate data stream enables supervised ML that predicts optimal IR ratio, WAS rate, and DO setpoint. INF_BOD and INF_COD quantify carbon available for denitrification; when EFF_NO3 is high but INF_BOD/TKN is low, the model sets AI_CARBON_LIM rather than increasing IR. Phase pH and anoxic ORP provide redox context at each MLE step.'
    );
    table(
      doc,
      ['AI Input Tag / Feature', 'Role in Model'],
      getAiInputRows(CFG),
      [1.2, 2.8]
    );
    paragraph(doc, 'Recommended AI outputs (constrained setpoints written to MooreVIEW tags):');
    bullet(doc, [
      'AI_IR_SP — suggested IR ratio (bounded 2.5–4.5× Q); suppressed when AI_CARBON_LIM = 1.',
      'AI_WAS_SP — suggested WAS mL/min from ANOX_TSS trend vs target MLSS band.',
      'AI_DO_SP — suggested aerobic DO mg/L when AER_NH3 rising and ANOX_TSS stable.',
      'AI_CARBON_LIM — flag when INF_BOD/TKN < 3.5 or ANOX_COD residual high with ANOX_NO3 > 8 mg/L.',
      'AI_ALARM — anomaly score when INF_TSS or phase pH deviates >2σ from 7-day baseline.',
    ]);
    paragraph(
      doc,
      'Deployment path: (1) collect 90 days historian data with rule-based IR trim; (2) train regression/gradient model offline on NH₃/NO₃/TSS features; (3) run inference on edge PC alongside MooreVIEW ST program; (4) validate AI vs manual operation for 30 days before permit reliance. AI never bypasses hard limits on EFF_NO3 >10 mg/L or EFF_NH3 >2 mg/L — those trigger immediate rule-based IR increase and operator alert.'
    );

    section(doc, '8. Reactor Sizing');
    const reactorRows =
      CFG.layout === 'dual-125k'
        ? [
            ['Train 1 — Pre-anoxic', `${fmtGpd(CFG.perTrainAnoxicGal)} gal`, '35%', 'Denitrification per train'],
            ['Train 1 — Aerobic IFAS', `${fmtGpd(CFG.perTrainAerobicGal)} gal`, '65%', 'Nitrification + PVA + CRS'],
            ['Train 2 — Pre-anoxic', `${fmtGpd(CFG.perTrainAnoxicGal)} gal`, '35%', 'Parallel redundant train'],
            ['Train 2 — Aerobic IFAS', `${fmtGpd(CFG.perTrainAerobicGal)} gal`, '65%', 'Parallel redundant train'],
            ['EQ basin (recommended)', `${fmtGpd(CFG.eqBasinGal)} gal`, '—', 'Seasonal / diurnal flow equalization'],
            ['Total biological', `${fmtGpd(CFG.reactorGal)} gal`, '100%', `HRT ≈ ${CFG.hrtDays} days @ avg flow`],
          ]
        : CFG.layout === 'poc-tote'
          ? [
              ['T-100 Pre-anoxic (separate tank)', `${fmtGpd(CFG.anoxicGal)} gal`, '35%', 'HDPE/poly · mixer only'],
              ['T-110 Aerobic IFAS (separate tank)', `${fmtGpd(CFG.aerobicGal)} gal`, '65%', 'PVA + CRS sidestream'],
              ['T-200 Secondary clarifier (IBC tote)', `${fmtGpd(CFG.clarifierGal)} gal`, '—', '3-zone bottom insert · Detail A'],
              ['T-210 Final treatment / sampling', `${fmtGpd(CFG.finalTankGal)} gal`, '—', 'Low profile · effluent port SV-105'],
              ['Total biological', `${fmtGpd(CFG.reactorGal)} gal`, '100%', `HRT ≈ ${CFG.hrtDays} days @ avg flow`],
            ]
          : [
            ['Pre-anoxic', `${fmtGpd(CFG.anoxicGal)} gal`, '35%', 'Denitrification; mixer only, no aeration'],
            ['Aerobic IFAS', `${fmtGpd(CFG.aerobicGal)} gal`, '65%', 'Nitrification; fixed PVA + CRS sidestream'],
            ['Settling (integrated)', `${fmtGpd(CFG.settlerGal)} gal`, '—', 'Solids separation, RAS/WAS'],
            ['Total biological', `${fmtGpd(CFG.reactorGal)} gal`, '100%', `HRT ≈ ${CFG.hrtDays} days @ avg flow`],
          ];
    table(doc, ['Zone', 'Volume', '% of Total', 'Function'], reactorRows, [0.9, 0.8, 0.7, 1.6]);
    paragraph(doc, `PVA foam media (fixed in SS cages, 5 mm max slot) — total fill ~${fmtGpd(CFG.pvaFt3)} ft³:`);
    bullet(doc, [
      `Fill fraction: 50% of aerobic volume (~${fmtGpd(Math.round(CFG.aerobicGal * 0.5))} gal displaced)`,
      'Media type: PVA foam cubes/blocks, 10–20 mm',
      'Surface area: 400–600 m²/m³ (vendor-specific)',
      'Effective biofilm SRT: 30–60+ days on carriers',
    ]);

    section(doc, '9. CRS Nanobubble Aeration System');
    paragraph(
      doc,
      'Equipment: CRS Nanobubble Generator (NBG) by Chemical Reduction Systems (chemicalreduction.com). The CRS NBG is a passive inline/sidestream device using hydrodynamic cavitation and ionization of entrained gases. It requires no electricity, no external gas input, and has no moving parts. Housing: 316 or 304 stainless steel; core alloy suitable for NSF/ANSI 61 applications. Factory warranty: 5 years; design service life: 10+ years.'
    );
    table(
      doc,
      ['Component', 'Specification'],
      [
        ['CRS NBG model', `${CFG.crsLineSize} line, sidestream per train`],
        ['Sidestream flow', `${CFG.crsSidestreamGpm} continuous`],
        ['Sidestream pump', `${CFG.sidestreamPumpHp} HP, 24/7 duty`],
        ['Aerobic DO setpoint', '2.0 mg/L'],
        ['Backup aeration', `${CFG.backupBlowerHp} HP fine-bubble (DO trim)`],
        ['Anoxic mixing', `${CFG.anoxicMixerHp} HP submersible mixer per train`],
        ['Estimated O₂ demand', `${CFG.o2DemandLbD} lb O₂/d`],
      ],
      [1.5, 2.5]
    );

    section(doc, '10. Recycle & Solids Management');
    table(
      doc,
      ['Stream', 'Rate', 'Equipment'],
      [
        ['Internal recycle (IR)', `${CFG.irRatio}× Q = ${fmtGpd(CFG.irGpd)} GPD (~${CFG.irGpm} gpm)`, 'VFD centrifugal per train'],
        ['RAS', `${CFG.rasPct}% Q = ${fmtGpd(CFG.rasGpd)} GPD (~${CFG.rasGpm} gpm)`, 'Return to anoxic'],
        ['WAS', `${CFG.wasGpd} gal/d`, 'Timed valve; SRT 12–20 d'],
        ['MLSS target', `${CFG.mlss} mg/L`, 'Suspended + biofilm biomass'],
      ],
      [1.2, 1.5, 1.3]
    );
    paragraph(doc, 'IR ratio is trimmed on effluent NO₃-N: increase IR when NO₃-N >10 mg/L (max 4.5×); decrease when NO₃-N <6 mg/L (min 2.5×).');

    if (CFG.layout === 'poc-tote' && CFG.toteBottomInsert) {
      section(doc, '10a. T-200 IBC Bottom Insert — Three Hydraulic Zones');
      paragraph(
        doc,
        `Standard flat-bottom IBC totes lack a cone sump and a dedicated overflow weir. For the POC clarifier, install an HDPE funnel insert (${CFG.toteBottomInsert.coneInsert}) plus a ${CFG.toteBottomInsert.standpipe}. This creates three physically separated draw points so RAS thickened sludge, WAS blanket waste, and clarified overflow cannot short-circuit. See Detail A on P&ID Sheet 1 and Mechanical Sheet 2.`
      );
      table(
        doc,
        ['Zone', 'Name', 'Port', 'Size / elevation', 'Service'],
        CFG.toteBottomInsert.zones.map((z) => [z.id, z.name, z.port, `${z.size} · ${z.elevation}`, z.service]),
        [0.35, 0.75, 0.55, 1.35, 1.5]
      );
      bullet(doc, [
        'Commissioning: set standpipe rim 2–4" above observed sludge interface after 7–10 days of settle; only supernatant should enter Zone 3.',
        'Never route overflow through Zone 1 (RAS apex) — that port is for thickened return sludge only.',
        'WAS (Zone 2) is timed via TV-WAS; draw duration sized for target SRT without draining the RAS sump.',
      ]);

      if (CFG.toteBottomInsert.bom) {
        section(doc, '10b. T-200 Bottom Insert — Fabrication BOM & Assembly');
        paragraph(
          doc,
          `Fabricate for ${CFG.toteBottomInsert.ibcFootprint} IBC. Insert rim ${CFG.toteBottomInsert.insertRim}; funnel apex ${CFG.toteBottomInsert.funnelApexDrop}; WAS port ${CFG.toteBottomInsert.wasOffset}; standpipe rim ${CFG.toteBottomInsert.standpipeRim}. Standpipe assembly: vertical 2" pipe → tee branch (L-210) at 12–16" above floor → union above tee for rim adjustment. Support standpipe to cage; do not hang weight on bulkheads.`
        );
        table(
          doc,
          ['Item', 'Qty', 'Specification', 'Install notes'],
          CFG.toteBottomInsert.bom.map((r) => [r.item, r.qty, r.spec, r.notes]),
          [1.1, 0.45, 1.35, 1.6]
        );
        paragraph(doc, 'Assembly sequence:', { bold: true });
        bullet(doc, CFG.toteBottomInsert.assembly || []);
      }
    }

    section(doc, '11. Expected Performance');
    table(
      doc,
      ['Parameter', 'Expected Effluent'],
      [
        ['BOD₅', '5–8 mg/L'],
        ['TSS', '5–10 mg/L'],
        ['NH₃-N', '<1 mg/L'],
        ['NO₃-N', '6–10 mg/L (with IR trim)'],
        ['Total nitrogen (TN)', '10–14 mg/L'],
      ],
      [1.5, 1.5]
    );
    paragraph(
      doc,
      'Nitrogen balance: ~35–40 mg/L NO₃-N formed after full nitrification must be reduced ~75–80% via MLE denitrification to achieve ≤10 mg/L NO₃-N. At BOD 200 mg/L and TKN 40 mg/L, influent rbCOD (~100–120 mg/L) is adequate without supplemental carbon under normal conditions.'
    );

    section(doc, '12. Equipment Schedule');
    const equipRows =
      CFG.layout === 'dual-125k'
        ? [
            ['Integrated MLE tank (125K gal)', '2', 'Parallel trains; 35/65 anoxic/aerobic'],
            ['EQ basin', '1', `${fmtGpd(CFG.eqBasinGal)} gal FRP/concrete`],
            ['PVA foam + retention cages', '2 lots', `~${fmtGpd(Math.round(CFG.pvaFt3 / 2))} ft³ per train`],
            ['CRS NBG sidestream unit', '2', `${CFG.crsLineSize} SS per train; RFQ from CRS`],
            ['Sidestream recirculation pump', '2', `${CFG.crsSidestreamGpm}; ${CFG.sidestreamPumpHp} HP`],
            ['Centrifugal blower farm', '1 lot', `3× ${CFG.backupBlowerHp} HP duty/standby`],
            ['Anoxic submersible mixer', '2', `${CFG.anoxicMixerHp} HP per train`],
            ['IR pump (VFD)', '2', `~${CFG.irGpmPerTrain || Math.round(CFG.irGpm / 2)} gpm per train`],
            ['RAS pump system', '2', `~${Math.round(CFG.rasGpm / 2)} gpm per train`],
            [CFG.clarifierNote || 'Secondary clarifier', '1–2', 'Per hydraulic load'],
            ['s::can recirculating analyzer package', '1', getScanEquipmentDescription(CFG).join('; ')],
            ['MooreVIEW edge SCADA + AI module', '1', `Project: ${CFG.mooreviewProject || 'mle-wastewater'}`],
          ]
        : CFG.layout === 'poc-tote'
          ? [
              ['T-100 Anoxic process tank', '1', `${fmtGpd(CFG.anoxicGal)} gal HDPE/poly`],
              ['T-110 Aerobic IFAS process tank', '1', `${fmtGpd(CFG.aerobicGal)} gal HDPE/poly`],
              ['PVA foam + retention cages', '1 lot', `~${fmtGpd(CFG.pvaFt3)} ft³; 50% aerobic fill`],
              ['T-200 Secondary clarifier', '1', `${fmtGpd(CFG.clarifierGal)} gal chemical tote (IBC)`],
              ['T-200 3-zone bottom insert kit', '1', 'HDPE funnel + RAS/WAS bulkheads + standpipe/tee — §10b BOM'],
              ['T-210 Final / sampling tank', '1', `${fmtGpd(CFG.finalTankGal)} gal low-profile`],
              ['CRS NBG sidestream unit', '1', `${CFG.crsLineSize} SS; RFQ from CRS`],
              ['Sidestream recirculation pump', '1', `${CFG.crsSidestreamGpm}; ${CFG.sidestreamPumpHp} HP`],
              ['Backup fine-bubble blower', '1', `${CFG.backupBlowerHp} HP with DO control`],
              ['Anoxic submersible mixer', '1', `${CFG.anoxicMixerHp} HP`],
              ['IR pump (VFD)', '1', `${CFG.irGpm} gpm @ 8 ft TDH`],
              ['RAS pump (tote sludge)', '1', `${CFG.rasGpm} gpm`],
              ['s::can recirculating analyzer package', '1', `${SCAN_VENDOR} · ${getScanPorts(CFG).length}-port loop · BOD/pH/ORP`],
              ['AER_DO probe (dedicated)', '1', 'Continuous · blower PID — not on scan loop'],
              ['MooreVIEW edge SCADA + AI module', '1', `Project: ${CFG.mooreviewProject || 'mle-wastewater'}`],
            ]
          : [
            ['FRP/concrete package tank', '1', `${fmtGpd(CFG.reactorGal)} gal`],
            ['PVA foam + retention cages', '1 lot', `~${fmtGpd(CFG.pvaFt3)} ft³; 50% aerobic fill`],
            ['CRS NBG sidestream unit', '1', `${CFG.crsLineSize} SS; RFQ from CRS`],
            ['Sidestream recirculation pump', '1', `${CFG.crsSidestreamGpm}; ${CFG.sidestreamPumpHp} HP`],
            ['Backup fine-bubble blower', '1', `${CFG.backupBlowerHp} HP with DO control`],
            ['Anoxic submersible mixer', '1', `${CFG.anoxicMixerHp} HP`],
            ['IR pump (VFD)', '1', `${CFG.irGpm} gpm @ 8 ft TDH`],
            ['RAS pump', '1', `${CFG.rasGpm} gpm`],
            ['Lamella / tube settler module', '1', `${fmtGpd(CFG.settlerGal)} gal equivalent`],
            ['s::can recirculating analyzer package', '1', `${SCAN_VENDOR} · ${getScanPorts(CFG).length}-port loop · BOD/pH/ORP`],
            ['AER_DO probe (dedicated)', '1', 'Continuous · blower PID — not on scan loop'],
            ['MooreVIEW edge SCADA + AI module', '1', `Project: ${CFG.mooreviewProject || 'mle-wastewater'}`],
          ];
    table(doc, ['Item', 'Qty', 'Size / Model'], equipRows, [1.2, 0.35, 1.45]);
    paragraph(
      doc,
      `s::can installed budget ~$${Math.round(getScanCapex(CFG) / 1000)}k (included in Section 16 CAPEX). Monthly lab verification of spectro::lyser BOD/COD vs Standard Methods required for permit-grade reporting.`
    );

    section(doc, '13. Instrumentation & Control');
    const scanControlRows = getMeasurementTableRows(CFG).map((r) => [r[0], r[1], r[4]]);
    table(
      doc,
      ['Tag', 'Sample Port', 'Function'],
      [
        ...scanControlRows,
        ['SCAN_ACTIVE_PORT', 'Sequencer', 'Current port 1–N'],
        ['SCAN_RUN / SCAN_FAULT', 'P-SCAN loop', 'Pump status / system fault'],
        ['AER_DO', 'Aerobic basin', 'Continuous DO 2.0 mg/L; blower PID'],
        ['AI_IR_SP', 'AI Optimizer out', 'Suggested IR setpoint (Auto mode)'],
        ['AI_WAS_SP', 'AI Optimizer out', 'Suggested WAS rate from TSS trend'],
        ['AI_CARBON_LIM', 'AI Optimizer out', 'Carbon-limited denitrification flag'],
        ['IR_FLOW / IR_RATIO', 'IR pump', 'Flow and ratio monitoring'],
        ['TANK_LVL', 'Reactor', 'Level alarm'],
        ['NANO_LOOP_RUN', 'Sidestream pump', 'CRS loop runtime / fault'],
      ],
      [0.8, 1, 1.2]
    );
    paragraph(doc, 'Control logic summary:');
    bullet(doc, [
      'Sidestream CRS loop: run continuous (24/7).',
      's::can sequencer: run continuous; alarm SCAN_FAULT; log all ports each cycle.',
      'IF EFF_NO3 > 10 mg/L AND NOT AI_CARBON_LIM → increase IR +0.2×/hr (max 4.5×).',
      'IF AI_CARBON_LIM = 1 → hold IR; alarm operator; evaluate supplemental carbon.',
      'IF EFF_NO3 < 6 mg/L → decrease IR −0.2×/hr (min 2.5×).',
      'IF AER_NH3 > 2 mg/L OR EFF_NH3 > 1 mg/L → increase DO or reduce WAS.',
      'IF ANOX_TSS > 4,000 mg/L for 4 hr → increase WAS per AI_WAS_SP; check settler.',
      'IF INF_BOD/TKN < 3.5 (derived tag) → set AI_CARBON_LIM; do not raise IR.',
      'IF ANOX_ORP > +100 mV at anoxic port dwell → alarm: denitrification lost.',
      'IF phase pH < 6.2 or > 8.8 at any port → process pH alarm.',
    ]);

    section(doc, '14. Tank Layout (Section)');
    if (CFG.layout === 'poc-tote') {
      monoBlock(doc, [
        '[Influent] -> [T-100 Anoxic 35 gal] -> [T-110 Aerobic IFAS 65 gal]',
        '                              |',
        '                              v',
        '                    [T-200  270 gal IBC tote clarifier]',
        '                              | bottom drain L-210',
        '                              v',
        '              [T-210  200 gal low-profile final / sampling]',
        '                              |',
        '                              v',
        '                         [Effluent discharge]',
        'RAS: tote sludge -> T-100 anoxic    IR: T-110 -> T-100',
      ]);
    } else {
      monoBlock(doc, [
        `+--- ANOXIC ${fmtGpd(CFG.anoxicGal)} gal -----+--- AEROBIC ${fmtGpd(CFG.aerobicGal)} gal + PVA ---+`,
        '| Influent + RAS -> Mixer  | Fixed PVA foam cages (50% fill)|',
        '| <- IR from aerobic       | CRS sidestream + backup diff.  |',
        '| ORP probe                | DO probe                       |',
        '+--------------------------+----------------> Settler -> Eff',
      ]);
    }

    section(doc, '15. Startup & Commissioning');
    bullet(doc, [
      'Fill reactor; seed with nitrifying return sludge or commercial culture.',
      'Install and cage PVA media permanently — floating media causes clarifier carryover.',
      'Commission anoxic mixer and IR/RAS loops before enabling CRS sidestream.',
      'Start CRS sidestream at 50% pump speed; ramp while monitoring AER_DO and ANOX_ORP.',
      CFG.isPoc
        ? `POC: operate at ${fmtGpd(CFG.flowAvgGpd)} GPD steady flow for 14 days before step-load tests; log all s::can tags at 1-min scan.`
        : 'Allow 2–3 weeks biofilm growth on PVA before enforcing 10 mg/L NO₃-N limit.',
      'Tune IR trim after 30 days of stable operation and seasonal temperature data.',
    ]);

    section(doc, '16. Capital Cost Estimate (CAPEX)');
    paragraph(doc, 'Planning-level installed costs, USD, 2025–2026. ±25–35% until vendor quotes received.');
    const capexLow = Math.round(CFG.midCapex * 0.65);
    const capexHigh = Math.round(CFG.midCapex * 1.55);
    table(
      doc,
      ['Category', 'Budget', 'Mid', 'High'],
      [
        [`MLE reactor tanks (${CFG.trains}×125K or ${fmtGpd(CFG.reactorGal)} gal)`, `$${Math.round(capexLow * 0.2 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.22 / 1000)}k`, `$${Math.round(capexHigh * 0.25 / 1000)}k`],
        ['Fixed PVA foam + cages', `$${Math.round(capexLow * 0.05 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.08 / 1000)}k`, `$${Math.round(capexHigh * 0.1 / 1000)}k`],
        ['CRS sidestream aeration (all trains)', `$${Math.round(capexLow * 0.06 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.07 / 1000)}k`, `$${Math.round(capexHigh * 0.09 / 1000)}k`],
        ['Pumps, mixers, clarifiers', `$${Math.round(capexLow * 0.12 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.15 / 1000)}k`, `$${Math.round(capexHigh * 0.18 / 1000)}k`],
        ['Instrumentation + AI', `$${Math.round(capexLow * 0.08 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.12 / 1000)}k`, `$${Math.round(capexHigh * 0.15 / 1000)}k`],
        ['Controls / SCADA', `$${Math.round(capexLow * 0.05 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.06 / 1000)}k`, `$${Math.round(capexHigh * 0.08 / 1000)}k`],
        ['Electrical + piping + site', `$${Math.round(capexLow * 0.15 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.18 / 1000)}k`, `$${Math.round(capexHigh * 0.22 / 1000)}k`],
        ['Install + commissioning', `$${Math.round(capexLow * 0.1 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.12 / 1000)}k`, `$${Math.round(capexHigh * 0.14 / 1000)}k`],
        ['Engineering + FDEP permits', `$${Math.round(capexLow * 0.08 / 1000)}k`, `$${Math.round(CFG.midCapex * 0.1 / 1000)}k`, `$${Math.round(capexHigh * 0.12 / 1000)}k`],
        ['TOTAL INSTALLED', `$${Math.round(capexLow / 1000)}k`, `$${Math.round(CFG.midCapex / 1000)}k`, `$${Math.round(capexHigh / 1000)}k`],
      ],
      [1.8, 0.7, 0.7, 0.7]
    );

    section(doc, '17. Project Budget Summary');
    table(
      doc,
      ['Line Item', 'Amount'],
      [
        ['Construction (mid installed)', fmtMoney(CFG.midCapex)],
        ['Owner contingency (15%)', fmtMoney(Math.round(CFG.midCapex * 0.15))],
        ['Collection / EQ / site civil (allowance)', fmtMoney(Math.round(CFG.midCapex * 0.15))],
        ['First-year OPEX reserve', fmtMoney(Math.round(CFG.midCapex * 0.02))],
        ['TOTAL PROJECT BUDGET', fmtMoney(CFG.totalBudget)],
      ],
      [2, 1]
    );
    paragraph(doc, 'Excluded from above: land acquisition, long collection systems, enclosed buildings, effluent UV/chlorination, and septage receiving.');

    section(doc, '18. Operating Cost Estimate (OPEX)');
    table(
      doc,
      ['Item', 'Annual Cost'],
      [
        ['Power (CRS loop + trim blower)', '$120 – $180'],
        ['Lab / compliance sampling', '$800 – $2,500'],
        ['Analyzer consumables', '$0 – $1,500'],
        ['WAS hauling', '$200 – $600'],
        ['PVA media replacement reserve', '$300 – $800'],
        ['Maintenance contract', '$500 – $2,000'],
        ['Contract O&M visits', '$1,000 – $3,000'],
        ['TOTAL ANNUAL OPEX', `$${CFG.annualOpex}`],
      ],
      [2, 1]
    );

    section(doc, '19. CRS Vendor RFQ Template');
    monoBlock(doc, [
      'To: Chemical Reduction Systems (CRS) — chemicalreduction.com',
      `Subject: RFQ — CRS NBG for ${fmtGpd(CFG.flowAvgGpd)} GPD MLE-IFAS WWTP (${CFG.siteName})`,
      '',
      `Application: ${fmtGpd(CFG.flowAvgGpd)} GPD MLE-IFAS, ${CFG.trainLabel},`,
      'fixed PVA biofilm carriers, effluent target <=10 mg/L NO3-N.',
      '',
      `Request: ${CFG.trains}× CRS NBG sidestream unit(s), ${CFG.crsLineSize} line, 316 SS,`,
      `${CFG.crsSidestreamGpm} continuous recirculation on mixed liquor per train.`,
      '',
      'Please quote: unit price, min/max flow, pressure drop, lead time, warranty,',
      'WWTP reference installations, and recommendation for backup aeration at 10°C.',
    ]);

    section(doc, '20. Permitting & Design Notes');
    bullet(doc, CFG.notes);

    section(doc, '21. Document Revision');
    table(
      doc,
      ['Rev', 'Date', 'Description'],
      [
        ['0', new Date().toISOString().slice(0, 10), 'Initial preliminary design package'],
      ],
      [0.5, 1, 2.5]
    );

    doc.end();
  });
}

async function main() {
  const outArg = process.argv.slice(3).find((a) => a.endsWith('.pdf'));
  const outPath = path.resolve(outArg || DEFAULT_OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const buf = await buildPdf();
  fs.writeFileSync(outPath, buf);
  console.log(`Project: ${CFG.id}`);
  console.log(`Wrote ${outPath} (${buf.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
