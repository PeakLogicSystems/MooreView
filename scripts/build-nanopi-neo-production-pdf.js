'use strict';

/**
 * Build NanoPi NEO CAT1 production deployment runbook PDF.
 *
 *   node scripts/build-nanopi-neo-production-pdf.js
 *   npm run build:nanopi-neo-production-pdf
 */

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { mdToPdfLaunchOptions } = require('./pdf-chrome');

const ROOT = path.join(__dirname, '..');
const PHASE1 = path.join(ROOT, 'deploy', 'cloud', 'phase1');
const SOURCE_MD = path.join(PHASE1, 'NANOPI-NEO-PRODUCTION.md');
const OUT_PDF = path.join(PHASE1, 'NANOPI-NEO-PRODUCTION.pdf');
const CSS_PATH = path.join(__dirname, 'product-description-pdf.css');
const PUBLIC_DIR = path.join(ROOT, 'public', 'docs');
const PUBLIC_PDF = path.join(PUBLIC_DIR, 'NANOPI-NEO-PRODUCTION.pdf');

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
  return markdown.replace(/^# NanoPi NEO CAT1[^\n]*\n\n/m, '');
}

async function main() {
  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Missing source: ${SOURCE_MD}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  let body = fs.readFileSync(SOURCE_MD, 'utf8');
  body = body.replace(
    /Run `npm run build:nanopi-neo-production-pdf` for build date/,
    generated
  );
  body = body.replace(
    /\*Revision: 2026-08-11[^\n]*\*/,
    `*Revision: ${generated} — field stack NanoPi NEO + NEO CAT1 + FriendlyWrt + Mosquitto bridge.*`
  );

  const toc = buildToc(body);
  const mainContent = stripLeadingTitleBlock(body);

  const markdown = `<div class="title-page">

<div class="brand">moore<span>VIEW</span></div>

# NanoPi NEO CAT1

<div class="tagline">Opta Parc Gateway · Production Deployment</div>

<p class="parent-byline">A company powered by <strong>The Purple Standard</strong><br>purple-standard.com</p>

**Field runbook · Bench → install → sign-off**

**Document generated:** ${generated}

FriendlyWrt · Mosquitto bridge · LTE RNDIS · Opta \`192.168.1.1:1883\`

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
      dest: `${OUT_PDF}.tmp`,
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

  try {
    fs.rmSync(OUT_PDF, { force: true });
  } catch (_) {
    /* ignore */
  }
  fs.renameSync(`${OUT_PDF}.tmp`, OUT_PDF);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(OUT_PDF, PUBLIC_PDF);

  const stat = fs.statSync(OUT_PDF);
  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Copied to ${PUBLIC_PDF}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
