'use strict';

const fs = require('fs');
const path = require('path');

const VERSIONS_ROOT = path.join(__dirname, '..', 'docs', 'marketing', 'versions');

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

function stripLeadingTitleBlock(markdown) {
  return markdown.replace(/^# [^\n]+\n(?:\n|\*\*[^\n]*\*\*\s*\n)*---\n\n/s, '');
}

function findChromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const exe of candidates) {
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function parseVersionFromMarkdown(markdown) {
  const m = markdown.match(/\*\*Document version:\*\*\s*([\d.]+)/);
  return m ? m[1] : null;
}

function parseCliArgs(argv) {
  const args = { archive: true };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--no-archive') args.archive = false;
    else if (arg === '--source' && argv[i + 1]) args.source = argv[++i];
    else if (arg === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (arg === '--version' && argv[i + 1]) args.version = argv[++i];
    else if (arg === '--doc' && argv[i + 1]) args.doc = argv[++i];
  }
  return args;
}

function archiveMarketingVersion({ docSlug, version, mdPath, pdfPath, generated }) {
  const versionDir = path.join(VERSIONS_ROOT, docSlug, `v${version}`);
  fs.mkdirSync(versionDir, { recursive: true });

  const mdName = `${docSlug}.md`;
  const pdfName = `${docSlug}.pdf`;
  const mdDest = path.join(versionDir, mdName);
  const pdfDest = path.join(versionDir, pdfName);

  fs.copyFileSync(mdPath, mdDest);
  if (fs.existsSync(pdfPath)) {
    fs.copyFileSync(pdfPath, pdfDest);
  }

  const pdfStat = fs.existsSync(pdfPath) ? fs.statSync(pdfPath) : null;
  const manifest = {
    doc: docSlug,
    version,
    generated: generated || new Date().toISOString().slice(0, 10),
    archivedAt: new Date().toISOString(),
    files: {
      markdown: mdName,
      pdf: pdfStat ? pdfName : null,
    },
    pdfSizeKb: pdfStat ? Number((pdfStat.size / 1024).toFixed(1)) : null,
  };
  fs.writeFileSync(path.join(versionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return versionDir;
}

function listArchivedVersions(docSlug) {
  const docDir = path.join(VERSIONS_ROOT, docSlug);
  if (!fs.existsSync(docDir)) return [];
  return fs
    .readdirSync(docDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^v[\d.]+$/.test(e.name))
    .map((e) => e.name.slice(1))
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff) return diff;
      }
      return 0;
    });
}

module.exports = {
  VERSIONS_ROOT,
  slugify,
  buildToc,
  stripLeadingTitleBlock,
  findChromeExecutable,
  parseVersionFromMarkdown,
  parseCliArgs,
  archiveMarketingVersion,
  listArchivedVersions,
};
