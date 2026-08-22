'use strict';

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { buildToc, stripLeadingTitleBlock, findChromeExecutable } = require('./marketing-pdf-common');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'nexcomm');
const DOC_SLUG = 'MooreVIEW-Nexcomm-Partnership-Discussion-MOU';
const SOURCE_MD = path.join(DOCS, `${DOC_SLUG}.md`);
const OUT_PDF = path.join(DOCS, `${DOC_SLUG}.pdf`);
const CSS_PATH = path.join(__dirname, 'nexcomm-story-pdf.css');

function extractExecutiveSummary(body) {
  const m = body.match(/## 1\. Executive summary\n\n([\s\S]*?)(?=\n---\n\n## 2\.)/);
  return m ? m[1].trim() : '';
}

async function buildPartnershipMouPdf(options = {}) {
  const sourceMd = options.source || SOURCE_MD;
  const outPdf = options.out || OUT_PDF;

  if (!fs.existsSync(sourceMd)) {
    throw new Error(`Missing source: ${sourceMd}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  let bodyRaw = fs.readFileSync(sourceMd, 'utf8');
  bodyRaw = bodyRaw.replace(
    /\*\*Status:\*\* Discussion draft · July 2026/,
    `**Status:** Discussion draft · **Generated:** ${generated}`
  );

  const body = stripLeadingTitleBlock(bodyRaw);
  const summary = extractExecutiveSummary(body);
  const remainder = body.replace(/## 1\. Executive summary\n\n[\s\S]*?(?=\n---\n\n## 2\.)/, '');
  const toc = buildToc(remainder);

  const markdown = `<div class="title-page">

<div class="brand">moore<span>VIEW</span></div>

<div class="partner">Nexcomm Systems · Partnership Discussion</div>

# MooreVIEW × Nexcomm

<div class="subtitle">Field-to-data integration · Financial model · MOU term sheet</div>

<div class="subtitle">End state: Memorandum of Understanding</div>

<p class="parent-byline">A company powered by <strong>The Purple Standard</strong><br>Reference operator: ACE Septic &amp; Waste</p>

<div class="meta">Discussion draft · Generated ${generated}</div>

<div class="meta">Confidential — for executive alignment only</div>

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

  fs.mkdirSync(path.dirname(outPdf), { recursive: true });

  const pdf = await mdToPdf(
    { content: markdown },
    {
      dest: outPdf,
      css,
      pdf_options: {
        format: 'Letter',
        margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
        printBackground: true,
      },
      launch_options: launchOptions,
    }
  );

  if (!pdf || !pdf.filename) {
    throw new Error('md-to-pdf did not produce a file');
  }

  const stat = fs.statSync(outPdf);
  console.log(`Wrote ${outPdf}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
  return { outPdf, generated };
}

async function main() {
  await buildPartnershipMouPdf();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildPartnershipMouPdf, SOURCE_MD, OUT_PDF };
