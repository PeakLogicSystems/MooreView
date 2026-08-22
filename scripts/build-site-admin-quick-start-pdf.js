'use strict';

/**
 * Build mooreVIEW Site Admin, Login & Quick Start PDF.
 *
 *   node scripts/build-site-admin-quick-start-pdf.js
 *   npm run build:site-admin-quick-start-pdf
 */

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { mdToPdfLaunchOptions } = require('./pdf-chrome');

const ROOT = path.join(__dirname, '..');
const MD_PATH = path.join(ROOT, 'docs', 'MOOREVIEW-SITE-ADMIN-LOGIN-QUICK-START.md');
const CSS_PATH = path.join(__dirname, 'cloud-ui-checklist-pdf.css');
const OUT_PDF = path.join(ROOT, 'docs', 'MOOREVIEW-SITE-ADMIN-LOGIN-QUICK-START.pdf');
const PUBLIC_DIR = path.join(ROOT, 'public', 'docs');
const PUBLIC_PDF = path.join(PUBLIC_DIR, 'MOOREVIEW-SITE-ADMIN-LOGIN-QUICK-START.pdf');

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

function stripLeadingTitleBlock(markdown) {
  return markdown.replace(/^# mooreVIEW[^\n]*\n\n/m, '');
}

async function main() {
  const version = readPackageVersion();
  const generated = new Date().toISOString().slice(0, 10);

  if (!fs.existsSync(MD_PATH)) {
    throw new Error(`Missing source: ${MD_PATH}`);
  }

  const body = fs.readFileSync(MD_PATH, 'utf8');
  const toc = buildToc(body);
  const mainContent = stripLeadingTitleBlock(body);

  const markdown = `<div class="title-page">

<div class="brand">moore<span>VIEW</span></div>

# Site Admin, Login & Quick Start

<div class="subtitle">Edge appliance · Cloud SaaS · Site pairing · User administration</div>

<p class="parent-byline">A company powered by <strong>The Purple Standard</strong><br>purple-standard.com</p>

**Suite version:** ${version}  
**Document generated:** ${generated}

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
        margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
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
  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Copied to ${PUBLIC_PDF}`);
  console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`Suite version: ${version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
