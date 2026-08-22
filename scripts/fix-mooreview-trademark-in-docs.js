'use strict';

const fs = require('fs');
const path = require('path');

const ROOTS = [
  path.join(__dirname, '..'),
  path.join(__dirname, '..', '..', 'est'),
];

/** Filename slugs stay capital-M on disk; restore after prose fix. */
const FILENAME_SLUGS = [
  'MooreVIEW-Pricing-Guide',
  'MooreVIEW-Product-Description',
  'MooreVIEW-Product-Market-Entry',
  'MooreVIEW-SCADA-Competitive-Comparison',
  'MooreVIEW-Infrastructure-Projections',
  'MooreVIEW-Subscription-Sell-Sheet',
  'MooreVIEW-marketplace-business-plan',
  'MooreVIEW-Wastewater-Lift-ATU-WWTP-Business-Plan',
  'MooreVIEW-Full-System-Test',
  'MooreVIEW-Lift-Station-6Mo-PdM-Study-Test',
  'MooreVIEW-Lift-Station-PdM-Training-Review',
  'MooreVIEW-Pricing-Guide',
];

function collectMarkdownFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === '.git') continue;
      collectMarkdownFiles(full, out);
    } else if (name.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function restoreFilenameSlugs(text) {
  let out = text;
  for (const slug of FILENAME_SLUGS) {
    const broken = slug.replace(/^MooreVIEW/, 'mooreVIEW');
    out = out.split(broken).join(slug);
  }
  return out;
}

function fixTrademark(text, filePath) {
  let out = text;
  out = out.replace(/Mooreview/g, 'mooreVIEW');
  out = out.replace(/MooreVIEW/g, 'mooreVIEW');
  out = restoreFilenameSlugs(out);

  // Legal mark field in USPTO doc — keep all-caps MOOREVIEW for filing references
  if (filePath.replace(/\\/g, '/').includes('trademark/MOOREVIEW-USPTO')) {
    out = out.replace(/\*\*Mark:\*\* mooreVIEW/g, '**Mark:** MOOREVIEW');
    out = out.replace(/Search for: Class 9, Class 42, CMMS, AI, white-label, specimen, mooreVIEW\./g,
      'Search for: Class 9, Class 42, CMMS, AI, white-label, specimen, MOOREVIEW.');
  }

  return out;
}

function main() {
  let changed = 0;
  const files = [];
  for (const root of ROOTS) {
    collectMarkdownFiles(path.join(root, 'docs'), files);
    const readme = path.join(root, 'README.md');
    if (fs.existsSync(readme)) files.push(readme);
    for (const sub of ['deploy', 'product-templates', 'sdk', 'st', 'firmware', 'mv-draw', 'hal', 'halow-xiao-sta', 'cellular-opta-gateway', 'cellular-parc-st', 'tools', 'public/hmi', 'data']) {
      collectMarkdownFiles(path.join(root, sub), files);
    }
  }

  const unique = [...new Set(files)];
  for (const file of unique) {
    const before = fs.readFileSync(file, 'utf8');
    const after = fixTrademark(before, file);
    if (after !== before) {
      fs.writeFileSync(file, after, 'utf8');
      changed += 1;
      console.log(path.relative(process.cwd(), file));
    }
  }
  console.log(`\nUpdated ${changed} file(s).`);
}

main();
