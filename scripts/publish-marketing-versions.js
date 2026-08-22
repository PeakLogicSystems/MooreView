'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { archiveMarketingVersion, parseVersionFromMarkdown, VERSIONS_ROOT } = require('./marketing-pdf-common');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'marketing');

const MARKETING_DOCS = [
  {
    slug: 'MooreVIEW-Product-Description',
    md: path.join(DOCS, 'MooreVIEW-Product-Description.md'),
    pdf: path.join(DOCS, 'MooreVIEW-Product-Description.pdf'),
  },
  {
    slug: 'MooreVIEW-Pricing-Guide',
    md: path.join(DOCS, 'MooreVIEW-Pricing-Guide.md'),
    pdf: path.join(DOCS, 'MooreVIEW-Pricing-Guide.pdf'),
  },
  {
    slug: 'MooreVIEW-Product-Market-Entry',
    md: path.join(DOCS, 'MooreVIEW-Product-Market-Entry.md'),
    pdf: path.join(DOCS, 'MooreVIEW-Product-Market-Entry.pdf'),
  },
  {
    slug: 'MooreVIEW-SCADA-Competitive-Comparison',
    md: path.join(DOCS, 'MooreVIEW-SCADA-Competitive-Comparison.md'),
    pdf: path.join(DOCS, 'MooreVIEW-SCADA-Competitive-Comparison.pdf'),
  },
  {
    slug: 'MooreVIEW-Subscription-Sell-Sheet',
    md: path.join(DOCS, 'MooreVIEW-Subscription-Sell-Sheet.md'),
    pdf: path.join(DOCS, 'MooreVIEW-Subscription-Sell-Sheet.pdf'),
  },
  {
    slug: 'MooreVIEW-Infrastructure-Projections',
    md: path.join(DOCS, 'MooreVIEW-Infrastructure-Projections.md'),
    pdf: path.join(DOCS, 'MooreVIEW-Infrastructure-Projections.pdf'),
  },
];

function archiveCurrentOnly() {
  const generated = new Date().toISOString().slice(0, 10);
  for (const doc of MARKETING_DOCS) {
    if (!fs.existsSync(doc.md)) {
      console.warn(`Skip (no source): ${doc.slug}`);
      continue;
    }
    const version = parseVersionFromMarkdown(fs.readFileSync(doc.md, 'utf8')) || 'current';
    const dir = archiveMarketingVersion({
      docSlug: doc.slug,
      version,
      mdPath: doc.md,
      pdfPath: doc.pdf,
      generated,
    });
    console.log(`Archived ${doc.slug} v${version} → ${dir}`);
  }
}

function buildAllPdfs() {
  const scripts = [
    'build-product-description-pdf.js',
    'build-pricing-guide-pdf.js',
    'build-market-entry-pdf.js',
    'build-scada-comparison-pdf.js',
    'build-subscription-sell-sheet-pdf.js',
    'build-infrastructure-projections-pdf.js',
  ];
  for (const script of scripts) {
    const scriptPath = path.join(__dirname, script);
    console.log(`\n--- ${script} ---`);
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      throw new Error(`${script} failed with exit ${result.status}`);
    }
  }
}

function buildProductDescriptionV11() {
  const source = path.join(
    VERSIONS_ROOT,
    'MooreVIEW-Product-Description',
    'v1.1',
    'MooreVIEW-Product-Description.md'
  );
  const out = path.join(
    VERSIONS_ROOT,
    'MooreVIEW-Product-Description',
    'v1.1',
    'MooreVIEW-Product-Description.pdf'
  );
  const { buildProductDescriptionPdf } = require('./build-product-description-pdf');
  return buildProductDescriptionPdf({
    source,
    out,
    version: '1.1',
    archive: true,
  });
}

async function main() {
  const mode = process.argv[2] || 'all';

  if (mode === 'archive-only') {
    archiveCurrentOnly();
    return;
  }

  if (mode === 'v1.1-product-description') {
    await buildProductDescriptionV11();
    return;
  }

  if (mode === 'all') {
    buildAllPdfs();
    console.log('\n--- Product Description v1.1 (archived source) ---');
    await buildProductDescriptionV11();
    return;
  }

  console.error(`Unknown mode: ${mode}`);
  console.error('Usage: node scripts/publish-marketing-versions.js [all|archive-only|v1.1-product-description]');
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
