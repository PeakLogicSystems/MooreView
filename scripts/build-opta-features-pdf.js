'use strict';

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');

const ROOT = path.join(__dirname, '..');
const FW_DIR = path.join(ROOT, 'firmware', 'arduino-opta-mqtt-st');
const MD_PATH = path.join(FW_DIR, 'OPTa_FEATURES.md');
const VERSION_H = path.join(FW_DIR, 'MooreviewOptaMqttSt', 'mv_version.h');
const OUT_PDF = path.join(FW_DIR, 'OPTa_FEATURES.pdf');
const PUBLIC_DIR = path.join(ROOT, 'public', 'docs');
const PUBLIC_PDF = path.join(PUBLIC_DIR, 'OPTa_FEATURES.pdf');
const CSS_PATH = path.join(__dirname, 'opta-features-pdf.css');

function readFirmwareVersion() {
  const text = fs.readFileSync(VERSION_H, 'utf8');
  const match = text.match(/#define\s+MV_FIRMWARE_VERSION\s+"([^"]+)"/);
  return match ? match[1] : 'unknown';
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function buildToc(markdown) {
  const items = [];
  for (const line of markdown.split(/\r?\n/)) {
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h2) items.push(`- [${h2[1]}](#${slugify(h2[1])})`);
    if (h3) items.push(`  - [${h3[1]}](#${slugify(h3[1])})`);
  }
  return items.join('\n');
}

/** Drop duplicate top-level title block; cover page carries the product title. */
function stripLeadingTitleBlock(markdown) {
  return markdown.replace(
    /^# MooreVIEW Opta[^\n]*\n(?:\n|\*\*[^\n]*\*\*\s*\n)*---\n\n/s,
    ''
  );
}

async function main() {
  const version = readFirmwareVersion();
  const generated = new Date().toISOString().slice(0, 10);
  const body = fs.readFileSync(MD_PATH, 'utf8');
  const toc = buildToc(body);
  const mainContent = stripLeadingTitleBlock(body);

  const markdown = `<div class="title-page">

# MooreVIEW Opta Firmware & Operation

**Firmware version:** ${version}  
**Document generated:** ${generated}

Operator and integrator reference — MQTT Parc ST runtime on Arduino Opta

</div>

<div class="page-break"></div>

## Contents

${toc}

<div class="page-break"></div>

${mainContent}
`;

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const pdf = await mdToPdf(
    { content: markdown },
    {
      dest: OUT_PDF,
      css,
      pdf_options: {
        format: 'Letter',
        margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
        printBackground: true,
      },
      launch_options: { args: ['--no-sandbox'] },
    }
  );

  if (!pdf || !pdf.filename) {
    throw new Error('md-to-pdf did not produce a file');
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(OUT_PDF, PUBLIC_PDF);

  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Copied to ${PUBLIC_PDF}`);
  console.log(`Firmware version: ${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
