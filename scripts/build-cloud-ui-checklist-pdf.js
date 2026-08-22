'use strict';

/**
 * Build mooreVIEW Cloud functional UI checklist PDF.
 *
 *   node scripts/build-cloud-ui-checklist-pdf.js
 *   npm run build:cloud-ui-checklist
 */

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { mdToPdfLaunchOptions } = require('./pdf-chrome');

const ROOT = path.join(__dirname, '..');
const MD_PATH = path.join(ROOT, 'docs', 'MOOREVIEW_CLOUD_UI_CHECKLIST.md');
const CSS_PATH = path.join(__dirname, 'cloud-ui-checklist-pdf.css');
const OUT_PDF = path.join(ROOT, 'docs', 'MOOREVIEW_CLOUD_UI_CHECKLIST.pdf');
const PUBLIC_DIR = path.join(ROOT, 'public', 'docs');
const PUBLIC_PDF = path.join(PUBLIC_DIR, 'MOOREVIEW_CLOUD_UI_CHECKLIST.pdf');

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.version || 'unknown';
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
    if (h2 && !h2[1].startsWith('Contents')) {
      items.push(`- [${h2[1]}](#${slugify(h2[1])})`);
    }
    if (h3) items.push(`  - [${h3[1]}](#${slugify(h3[1])})`);
  }
  return items.join('\n');
}

/** Drop duplicate top-level title; cover page carries product title. */
function stripLeadingTitleBlock(markdown) {
  return markdown.replace(/^# mooreVIEW Cloud[^\n]*\n\n/m, '');
}

async function main() {
  const version = readPackageVersion();
  const generated = new Date().toISOString().slice(0, 10);
  const body = fs.readFileSync(MD_PATH, 'utf8');
  const toc = buildToc(body);
  const mainContent = stripLeadingTitleBlock(body);

  const markdown = `<div class="title-page">

# mooreVIEW Cloud

<div class="subtitle">Functional UI Validation Checklist</div>

**Suite version:** ${version}  
**Document generated:** ${generated}  
**Deployment mode:** Cloud SaaS (\`MOOREVIEW_DEPLOYMENT=cloud\`, port 3100)

Complete end-to-end UI test plan for authentication, Studio, fleet management, CMMS, and standalone tools.

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
        landscape: true,
        margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
        printBackground: true,
      },
      launch_options: mdToPdfLaunchOptions(),
    }
  );

  if (!pdf || !pdf.filename) {
    throw new Error('md-to-pdf did not produce a file');
  }

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(OUT_PDF, PUBLIC_PDF);

  const stats = fs.statSync(OUT_PDF);
  console.log(`Wrote ${OUT_PDF} (${stats.size} bytes)`);
  console.log(`Copied to ${PUBLIC_PDF}`);
  console.log(`Suite version: ${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
