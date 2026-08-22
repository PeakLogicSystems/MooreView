'use strict';

/**
 * Build APG True Echo device review PDF for engineering sign-off.
 * Usage: node scripts/build-apg-true-echo-review-pdf.js
 */

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { mdToPdfLaunchOptions } = require('./pdf-chrome');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'devices');
const SOURCE_MD = path.join(DOCS, 'APG-True-Echo-Device-Review.md');
const OUT_PDF = path.join(DOCS, 'MooreVIEW-APG-True-Echo-Device-Review.pdf');
const PUBLIC_DIR = path.join(ROOT, 'public', 'docs');
const PUBLIC_PDF = path.join(PUBLIC_DIR, 'MooreVIEW-APG-True-Echo-Device-Review.pdf');
const CSS_PATH = path.join(__dirname, 'opta-features-pdf.css');

async function main() {
  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Missing source: ${SOURCE_MD}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  let markdown = fs.readFileSync(SOURCE_MD, 'utf8');
  markdown = markdown.replace(/\*\*Generated:\*\* _\(build date\)_/, `**Generated:** ${generated}`);

  const cover = `<div class="title-page">

# MooreVIEW

## APG True Echo Radar — Device Review

**Modbus RTU level transmitter integration**  
**Template:** \`apg_true_echo_rtu\`  
**Document generated:** ${generated}

Integrator review — register map, appliance tags, Opta bring-up

</div>

<div class="page-break"></div>

`;

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const pdf = await mdToPdf(
    { content: cover + markdown },
    {
      dest: OUT_PDF,
      css,
      pdf_options: {
        format: 'Letter',
        margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
        printBackground: true,
      },
      launch_options: mdToPdfLaunchOptions(),
    },
  );

  if (!pdf || !pdf.filename) {
    throw new Error('md-to-pdf did not produce a file');
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(OUT_PDF, PUBLIC_PDF);

  const stat = fs.statSync(OUT_PDF);
  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Copied ${PUBLIC_PDF}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
