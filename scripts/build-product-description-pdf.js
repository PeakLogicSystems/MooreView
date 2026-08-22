'use strict';

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
const DOC_SLUG = 'MooreVIEW-Product-Description';
const DEFAULT_SOURCE = path.join(DOCS, `${DOC_SLUG}.md`);
const DEFAULT_OUT = path.join(DOCS, `${DOC_SLUG}.pdf`);
const CSS_PATH = path.join(__dirname, 'product-description-pdf.css');

async function buildProductDescriptionPdf(options = {}) {
  const sourceMd = options.source || DEFAULT_SOURCE;
  const outPdf = options.out || DEFAULT_OUT;
  const archive = options.archive !== false;

  if (!fs.existsSync(sourceMd)) {
    throw new Error(`Missing source: ${sourceMd}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  let bodyRaw = fs.readFileSync(sourceMd, 'utf8');
  bodyRaw = bodyRaw.replace(
    /Run `npm run build:product-description-pdf` for build date/,
    generated
  );

  const version =
    options.version || parseVersionFromMarkdown(bodyRaw) || '1.2';

  const body = stripLeadingTitleBlock(bodyRaw);
  const purpleStandardMatch = body.match(/## Part of The Purple Standard[\s\S]*?(?=\n---\n\n## At a glance)/);
  const atGlanceMatch = body.match(/## At a glance[\s\S]*?(?=\n---\n\n## )/);
  const purpleStandard = purpleStandardMatch
    ? purpleStandardMatch[0].replace(/^## Part of The Purple Standard\n\n/, '')
    : '';
  const atGlance = atGlanceMatch ? atGlanceMatch[0].replace(/^## At a glance\n\n/, '') : '';
  const executiveSummary = [purpleStandard, atGlance].filter(Boolean).join('\n\n---\n\n');
  const remainder = body
    .replace(/## Part of The Purple Standard[\s\S]*?(?=\n---\n\n## At a glance)/, '')
    .replace(/## At a glance[\s\S]*?(?=\n---\n\n)/, '')
    .replace(/^---\n\n/, '');
  const toc = buildToc(remainder);

  const markdown = `<div class="title-page">

<div class="brand">moore<span>VIEW</span></div>

# Product Description

<div class="tagline">Proactive operations. Portable everywhere.</div>

<p class="parent-byline">A company powered by <strong>The Purple Standard</strong><br>purple-standard.com</p>

**Marketing collateral · Version ${version}**

**Document generated:** ${generated}

Integrated automation, condition monitoring, and maintenance — fix before breakdown, deploy on any site

</div>

<div class="page-break"></div>

<div class="summary-page">

# Executive Summary

${executiveSummary}

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
  console.log(`Version: ${version}`);

  if (archive) {
    const versionDir = archiveMarketingVersion({
      docSlug: DOC_SLUG,
      version,
      mdPath: sourceMd,
      pdfPath: outPdf,
      generated,
    });
    console.log(`Archived: ${versionDir}`);
  }

  return { outPdf, version, generated };
}

async function main() {
  const cli = parseCliArgs(process.argv);
  await buildProductDescriptionPdf(cli);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildProductDescriptionPdf, DOC_SLUG };
