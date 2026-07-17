#!/usr/bin/env node
'use strict';

/**
 * Generate searchable TEAS-ready PDF for MooreVIEW USPTO Class 9 & 42 summary.
 * Usage: node scripts/generate-mooreview-trademark-pdf.js
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'trademark');
const OUT_FILE = path.join(OUT_DIR, 'MOOREVIEW-USPTO-Class-9-42-TEAS.pdf');

const MARGIN = 72;

const TEAS_FIELDS = [
  ['Mark', 'MOOREVIEW'],
  ['Display form', 'mooreVIEW (stylistic: moore + VIEW)'],
  ['Mark type', 'Standard character mark (recommended)'],
  ['Related marks', 'TPS CMMS, Purple Standard'],
  ['Color claim', 'None for standard characters; or Purple #49104F if stylized'],
  ['Disclaimer', 'Consider disclaimer of VIEW if Examiner cites descriptiveness'],
];

const MARK_DESC = [
  'Integrated industrial automation, AI-enabled analytics, and maintenance-management platform',
  'Offered as downloadable software, embedded appliance software, and cloud SaaS',
  'Pre-configured or custom-built control systems under the mark',
  'White-label and co-branded OEM and integrator arrangements',
];

const MARK_SPECIMENS = [
  'Engineering and operator UIs',
  'MooreVIEW Cloud Studio',
  'Installers and appliance bundles',
  'Technical documentation and MQTT integration specs',
  'Equipment nameplates, enclosure labels, and HMI bezels',
  'System documentation on custom or white-label industrial products',
];

const PRODUCT_OVERVIEW = {
  'Core SCADA / HMI': [
    'Structured Text (ST) programming and scan-cycle runtime',
    'Tag database, alarms, and I/O drivers (Modbus, MQTT, serial, API)',
    'HMI composer, historian, and MQTT Parc edge connectivity',
    'Portable .est project files',
  ],
  'AI / PdM': [
    'Edge AI ingest (edgeAi payloads)',
    'Database edge inference collection',
    'Time-windowed features, health index, failure forecast and RUL estimates',
    'Asset-to-tag mapping and nightly batch builds',
  ],
  CMMS: [
    'Integrated work orders, assets, facilities, and users',
    'MooreVIEW CMMS Integration v1 MQTT (alarms, alarm-notify)',
    'Cloud tenant CMMS entitlement',
    'Standalone MQTT bridge to external CMMS',
  ],
  'White-label / custom systems': [
    'Product templates and appliance profiles',
    'Pre-wired driver, HMI, and ST fixtures',
    'Hardware badging on gateways, panels, and packaged skids',
    'OEM co-brand deployments',
  ],
};

const CLASS9_IDS = {
  broad: [
    'Downloadable computer software for industrial automation, supervisory control and data acquisition (SCADA), human-machine interface (HMI) design, programmable logic controller (PLC) programming, process visualization, real-time data acquisition, alarm management, operational historian recording, computerized maintenance management (CMMS), and predictive maintenance analytics',
    'Downloadable computer software for artificial intelligence-based anomaly detection, edge inference ingestion, health indexing, and failure forecasting in industrial assets',
    'Downloadable computer software for creating work orders, managing facilities and maintenance assets, and publishing maintenance-related alarm events via message queuing telemetry transport (MQTT)',
    'Downloadable software development tools for structured text (ST) programming and logic validation',
    'Downloadable firmware integration utilities for connecting industrial edge controllers and I/O modules to a central automation platform',
    'Downloadable project files containing automation and maintenance configuration data',
  ],
  hardware: [
    'Industrial computers, programmable automation controllers, edge gateways, and industrial control panels preloaded with software for industrial automation, SCADA, HMI, CMMS, and AI-enabled predictive maintenance',
    'Custom-configured industrial control systems and packaged equipment skids comprising industrial controllers, I/O modules, networking components, and embedded automation software for monitoring and controlling industrial processes',
    'Equipment nameplates, labels, and graphical user interface assets bearing the mark and identifying the source of embedded automation software in white-label, private-label, and custom-manufactured industrial products',
  ],
  narrow: [
    'Downloadable SCADA, HMI, CMMS, and AI-enabled predictive maintenance software for programming, monitoring, controlling, and maintaining industrial equipment',
    'Industrial edge gateways and control panels preloaded with such software',
  ],
};

const CLASS42_IDS = {
  broad: [
    'Providing temporary use of non-downloadable computer software for industrial automation, SCADA, HMI design, PLC runtime execution, process visualization, real-time monitoring, alarm management, historian services, computerized maintenance management (CMMS), and AI-enabled predictive maintenance analytics',
    'Software as a service (SaaS) featuring software for industrial control engineering, tag and asset management, device driver configuration, remote deployment of control programs to edge devices, work order and facility management, and MQTT-based maintenance alarm integration',
    'Platform as a service (PaaS) featuring computer software platforms for multi-tenant industrial IoT data ingestion, edge AI inference logging, MQTT telemetry routing, and cloud-based operator and maintenance workspaces',
  ],
  ai: [
    'Providing online non-downloadable software using artificial intelligence and machine learning for industrial asset health monitoring, anomaly scoring, time-series feature extraction, remaining useful life estimation, and maintenance prioritization based on SCADA historian data and edge inference results',
    'Data analytics services in the field of industrial equipment performance and predictive maintenance',
  ],
  cmms: [
    'Providing temporary use of non-downloadable computerized maintenance management system (CMMS) software for creating and tracking work orders, managing maintenance assets and facilities, assigning maintenance personnel, routing alarm notifications, and integrating operational technology (OT) alarm events from SCADA systems into maintenance workflows',
    'Software as a service (SaaS) featuring CMMS software integrated with industrial automation platforms',
  ],
  whitelabel: [
    'Custom configuration and integration of industrial automation, SCADA, HMI, CMMS, and AI analytics software for third-party OEMs, integrators, and end users',
    'Platform as a service (PaaS) and software as a service (SaaS) provided under white-label and private-label arrangements featuring industrial automation and maintenance management software',
    'Design and engineering of custom industrial control systems incorporating non-downloadable automation and maintenance software',
    'Technical support, software maintenance, and cloud hosting for the aforesaid software and platforms',
  ],
  narrow: [
    'Software as a service (SaaS) featuring SCADA, HMI, CMMS, and AI-based predictive maintenance software',
    'Providing temporary use of non-downloadable automation and maintenance software',
    'Custom integration and white-label platform services for industrial control and asset maintenance systems',
  ],
};

const ATTORNEY_BULLETS = [
  'Integrated industrial automation and maintenance platform: SCADA/HMI/runtime, AI-enabled predictive maintenance, and CMMS',
  'AI: edge inference ingest, health indexing, failure forecasting',
  'CMMS: work orders, assets, facilities, MQTT alarm-to-maintenance workflows',
  'Class 9: downloadable and pre-installed software; badged hardware systems',
  'Class 42: hosted multi-tenant SaaS/PaaS, AI analytics, CMMS, integration, white-label platform, custom engineering',
  'Custom-configured and white-label systems: gateways, control panels, packaged equipment with mark on UI, docs, or equipment badging',
];

const COORDINATION = [
  ['MVP Suite installer', 'Class 9'],
  ['Cloud Studio / multi-tenant', 'Class 42'],
  ['Historian + database', 'Class 9 software / Class 42 hosted'],
  ['Edge AI / PdM / RUL forecast', 'Class 9 module / Class 42 AI SaaS'],
  ['CMMS work orders / assets', 'Class 9 embedded / Class 42 CMMS SaaS'],
  ['MQTT alarm to CMMS', 'Class 9 publisher / Class 42 integration'],
  ['IOT-LINK / Opta appliances', 'Class 9 preloaded / Class 42 hosting'],
  ['White-label OEM systems', 'Class 9 badged hardware / Class 42 white-label SaaS'],
  ['Custom control panels / skids', 'Class 9 goods / Class 42 engineering'],
];

const SPECIMENS = [
  ['Cl. 9 software', 'Installer, package metadata, download page with mark'],
  ['Cl. 9 hardware', 'Nameplate or HMI bezel photo; appliance datasheet'],
  ['Cl. 9 white-label', 'OEM agreement; dual-brand label; About screen'],
  ['Cl. 42 SaaS', 'Cloud login + Studio dashboard'],
  ['Cl. 42 CMMS', 'Work orders / assets UI in MooreVIEW shell'],
  ['Cl. 42 AI / PdM', 'Historian PdM chart / failure forecast UI'],
  ['Cl. 42 white-label', 'Integrator SOW or white-label partner agreement'],
];

const RELATED_CLASSES = [
  ['Class 37', 'On-site installation/service of custom control systems'],
  ['Class 35', 'SaaS subscription retail under the mark'],
  ['Class 41', 'Training services under the mark'],
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function leftX(doc) {
  return doc.page.margins.left;
}

function contentW(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function resetX(doc) {
  doc.x = leftX(doc);
}

function writeText(doc, text, opts = {}) {
  const w = contentW(doc);
  const x = leftX(doc);
  const y = doc.y;
  doc.text(text, x, y, {
    width: w,
    align: opts.align || 'left',
    lineGap: opts.lineGap ?? 2,
    ...opts,
  });
  resetX(doc);
}

function createDoc() {
  return new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGIN, bottom: MARGIN + 18, left: MARGIN, right: MARGIN },
    info: {
      Title: 'MooreVIEW USPTO Trademark Summary - Classes 9 and 42',
      Author: 'MooreVIEW / TPS',
      Subject: 'TEAS-ready identification of goods and services for trademark filing',
      Keywords: 'MooreVIEW, USPTO, trademark, TEAS, Class 9, Class 42, SCADA, HMI, CMMS, AI, predictive maintenance, white-label, OEM, industrial automation',
      CreationDate: new Date(),
    },
    autoFirstPage: true,
  });
}

function addFooter(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 2;
    doc.font('Helvetica').fontSize(8).fillColor('#666666')
      .text(
        `MooreVIEW USPTO Class 9 & 42 - TEAS Ready - Page ${i + 1} of ${range.count}`,
        leftX(doc),
        y,
        { width: contentW(doc), align: 'center', lineGap: 0 },
      );
  }
}

function heading1(doc, text) {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#212529');
  writeText(doc, text, { lineGap: 1 });
  doc.moveDown(0.25);
}

function subheading(doc, text) {
  doc.moveDown(0.15);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#49104F');
  writeText(doc, text, { lineGap: 1 });
  doc.moveDown(0.1);
}

function heading3(doc, text) {
  doc.moveDown(0.2);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#212529');
  writeText(doc, text, { lineGap: 1 });
  doc.moveDown(0.1);
}

function bullets(doc, items, opts = {}) {
  const bullet = opts.bullet || '\u2022';
  const indent = opts.indent ?? 14;
  const fontSize = opts.size || 9.5;
  doc.font('Helvetica').fontSize(fontSize).fillColor(opts.color || '#212529');
  for (const item of items) {
    maybePageBreak(doc, 36);
    writeText(doc, `${bullet}  ${item}`, { lineGap: 2, indent, paragraphGap: 4 });
  }
  doc.moveDown(0.15);
}

function labeledBullets(doc, pairs) {
  for (const [label, value] of pairs) {
    maybePageBreak(doc, 40);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#212529');
    writeText(doc, `${label}`, { lineGap: 1 });
    doc.font('Helvetica').fontSize(9).fillColor('#333333');
    writeText(doc, value, { lineGap: 2, indent: 14 });
    doc.moveDown(0.12);
  }
}

function sectionBullets(doc, sections) {
  for (const [title, items] of Object.entries(sections)) {
    subheading(doc, title);
    bullets(doc, items);
  }
}

function teasBlock(doc, label, items) {
  heading3(doc, label);
  bullets(doc, items, { size: 9.5 });
  doc.moveDown(0.08);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#49104F');
  writeText(doc, 'TEAS copy (single paragraph - join with semicolons):', { lineGap: 1 });
  doc.moveDown(0.06);
  doc.font('Helvetica').fontSize(9).fillColor('#111111');
  writeText(doc, items.join('; ') + '.', { lineGap: 2 });
  doc.moveDown(0.1);
  const x = leftX(doc);
  const w = contentW(doc);
  doc.strokeColor('#49104F').lineWidth(0.5)
    .moveTo(x, doc.y).lineTo(x + w, doc.y).stroke();
  doc.moveDown(0.28);
}

function maybePageBreak(doc, need = 90) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y > bottom - need) {
    doc.addPage();
    resetX(doc);
  }
}

function buildPdf(doc) {
  resetX(doc);

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#49104F');
  writeText(doc, 'MOOREVIEW', { align: 'center', lineGap: 0 });
  doc.moveDown(0.15);
  doc.font('Helvetica').fontSize(13).fillColor('#212529');
  writeText(doc, 'USPTO Trademark Summary', { align: 'center' });
  doc.moveDown(0.1);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#49104F');
  writeText(doc, 'International Classes 9 & 42', { align: 'center' });
  doc.moveDown(0.35);
  doc.font('Helvetica').fontSize(10).fillColor('#444444');
  writeText(doc, 'TEAS-Ready - Searchable PDF', { align: 'center' });
  writeText(doc, 'AI, CMMS, White-Label & Custom Equipment Systems', { align: 'center' });
  doc.moveDown(0.7);
  doc.font('Helvetica').fontSize(9).fillColor('#666666');
  writeText(doc, 'Document version 1.0 - June 2026', { align: 'center' });
  writeText(doc, 'Draft for trademark counsel - not legal advice', { align: 'center' });
  doc.moveDown(1);
  subheading(doc, 'How to use this PDF');
  bullets(doc, [
    'Copy TEAS single-paragraph blocks from Sections 3 and 4 into goods/services fields',
    'Search (Ctrl+F): Class 9, Class 42, CMMS, AI, white-label, specimen, MOOREVIEW',
    'Bullet lists summarize each section; semicolon paragraphs are filing-ready text',
  ], { size: 9 });
  doc.addPage();
  resetX(doc);

  heading1(doc, 'TEAS Field Quick Reference');
  labeledBullets(doc, TEAS_FIELDS);
  doc.moveDown(0.2);

  heading1(doc, '1. Mark Description & Specimens');
  subheading(doc, 'Platform scope');
  bullets(doc, MARK_DESC);
  subheading(doc, 'Mark appears on');
  bullets(doc, MARK_SPECIMENS);

  heading1(doc, '2. Product & Services Overview');
  sectionBullets(doc, PRODUCT_OVERVIEW);

  doc.addPage();
  resetX(doc);
  heading1(doc, '3. CLASS 9 - Goods (Copy for TEAS)');
  subheading(doc, 'Scope');
  bullets(doc, [
    'International Class 9',
    'Downloadable software',
    'Pre-loaded hardware',
    'Badged custom and white-label equipment',
  ], { size: 9 });
  teasBlock(doc, '3A. Broad - Downloadable Software', CLASS9_IDS.broad);
  maybePageBreak(doc, 140);
  teasBlock(doc, '3B. Hardware, Pre-Loaded & White-Label Goods', CLASS9_IDS.hardware);
  maybePageBreak(doc, 120);
  teasBlock(doc, '3C. Narrow Core (minimal filing set)', CLASS9_IDS.narrow);

  doc.addPage();
  resetX(doc);
  heading1(doc, '4. CLASS 42 - Services (Copy for TEAS)');
  subheading(doc, 'Scope');
  bullets(doc, [
    'International Class 42',
    'SaaS and PaaS platform services',
    'AI analytics and CMMS services',
    'White-label platform and custom integration services',
  ], { size: 9 });
  teasBlock(doc, '4A. Broad - SaaS / Platform', CLASS42_IDS.broad);
  maybePageBreak(doc, 120);
  teasBlock(doc, '4B. AI & Analytics Services', CLASS42_IDS.ai);
  maybePageBreak(doc, 90);
  teasBlock(doc, '4C. CMMS Services', CLASS42_IDS.cmms);
  maybePageBreak(doc, 110);
  teasBlock(doc, '4D. White-Label, OEM & Custom System Services', CLASS42_IDS.whitelabel);
  maybePageBreak(doc, 90);
  teasBlock(doc, '4E. Narrow Core (combined)', CLASS42_IDS.narrow);

  doc.addPage();
  resetX(doc);
  heading1(doc, '5. Attorney Cover-Sheet Summary');
  bullets(doc, ATTORNEY_BULLETS);

  heading1(doc, '6. Class 9 + 42 Coordination');
  labeledBullets(doc, COORDINATION);

  heading1(doc, '7. Specimen & First-Use Checklist');
  labeledBullets(doc, SPECIMENS);

  heading1(doc, '8. Optional Related Classes');
  labeledBullets(doc, RELATED_CLASSES);

  doc.moveDown(0.4);
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#666666');
  writeText(doc, 'Prepared from MooreVIEW product documentation (MVP Suite, Cloud Studio, CMMS Integration v1, PdM/edge AI, appliance templates). Verify all statements against current use in commerce before filing. Not legal advice.');
}

function main() {
  ensureDir(OUT_DIR);
  const doc = createDoc();
  const stream = fs.createWriteStream(OUT_FILE);
  doc.pipe(stream);
  buildPdf(doc);
  addFooter(doc);
  doc.end();
  stream.on('finish', () => {
    const stat = fs.statSync(OUT_FILE);
    console.log(`Wrote ${OUT_FILE} (${Math.round(stat.size / 1024)} KB)`);
  });
}

main();
