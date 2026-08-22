'use strict';

/**
 * Build Wastewater Business Plan PDF.
 *
 *   node scripts/build-wastewater-business-plan-pdf.js
 *   npm run build:wastewater-business-plan-pdf
 */

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const {
  buildToc,
  stripLeadingTitleBlock,
  findChromeExecutable,
  parseVersionFromMarkdown,
  parseCliArgs,
  archiveMarketingVersion,
} = require('./marketing-pdf-common');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'marketing');
const DOC_SLUG = 'MooreVIEW-Wastewater-Business-Plan';
const SOURCE_MD = path.join(DOCS, `${DOC_SLUG}.md`);
const OUT_PDF = path.join(DOCS, `${DOC_SLUG}.pdf`);
const CSS_PATH = path.join(__dirname, 'product-description-pdf.css');

async function main() {
  const cli = parseCliArgs(process.argv);

  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Missing source: ${SOURCE_MD}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  let bodyRaw = fs.readFileSync(SOURCE_MD, 'utf8');
  bodyRaw = bodyRaw.replace(
    /Run `npm run build:wastewater-business-plan-pdf` for build date/,
    generated
  );

  const version = parseVersionFromMarkdown(bodyRaw) || '1.0';
  const body = stripLeadingTitleBlock(bodyRaw);
  const summaryMatch = body.match(/## Executive summary[\s\S]*?(?=\n---\n\n## Part 1)/);
  const summary = summaryMatch
    ? summaryMatch[0].replace(/^## Executive summary\n\n/, '')
    : '';
  const remainder = body
    .replace(/## Executive summary[\s\S]*?(?=\n---\n\n## Part 1)/, '')
    .replace(/^---\n\n/, '');
  const toc = buildToc(remainder);

  const markdown = `<div class="title-page">

<div class="brand">moore<span>VIEW</span></div>

# Wastewater Business Plan

<div class="tagline">Lift · ATU · WWTP · Phase 1 Cloud · 2026</div>

<p class="parent-byline">A company powered by <strong>The Purple Standard</strong><br>purple-standard.com</p>

**Vertical business plan · Version ${version}**

**Document generated:** ${generated}

Phase 1 SaaS · 500-device fleet · cellular cost model

</div>

<div class="page-break"></div>

<div class="summary-page">

# Executive Summary

${summary}

</div>

<div class="page-break"></div>

## Contents

${toc}

<div class="page-break"></div>

${remainder}
`;

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const chromePath = findChromeExecutable();
  const launchOptions = { args: ['--no-sandbox'] };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

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
      launch_options: launchOptions,
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

  const stat = fs.statSync(OUT_PDF);
  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`Version: ${version}`);

  if (cli.archive !== false) {
    const versionDir = archiveMarketingVersion({
      docSlug: DOC_SLUG,
      version,
      mdPath: SOURCE_MD,
      pdfPath: OUT_PDF,
      generated,
    });
    console.log(`Archived: ${versionDir}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
