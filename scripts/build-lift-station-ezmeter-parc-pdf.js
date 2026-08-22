'use strict';

/**
 * Build Lift Station + EZ Meter Parc & Cloud commissioning PDF.
 * Usage: node scripts/build-lift-station-ezmeter-parc-pdf.js [outputPath]
 */

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');

const ROOT = path.join(__dirname, '..');
const SOURCE_MD = path.join(ROOT, 'docs', 'projects', 'LIFT-STATION-EZMETER-PARC-CLOUD.md');
const OUT_PDF = path.join(ROOT, 'docs', 'projects', 'MooreVIEW-Lift-Station-EZMeter-Parc-Cloud.pdf');
const PUBLIC_PDF = path.join(ROOT, 'public', 'docs', 'MooreVIEW-Lift-Station-EZMeter-Parc-Cloud.pdf');
const CSS_PATH = path.join(__dirname, 'system-test-pdf.css');

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

async function main() {
  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Missing source: ${SOURCE_MD}`);
  }

  let markdown = fs.readFileSync(SOURCE_MD, 'utf8');
  const generated = new Date().toISOString().slice(0, 10);
  markdown = markdown.replace(
    /Run `npm run build:lift-station-ezmeter-parc-pdf` for build date/,
    generated,
  );

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const chromePath = findChromeExecutable();
  const launchOptions = { args: ['--no-sandbox'] };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

  const outPath = path.resolve(process.argv[2] || OUT_PDF);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const pdf = await mdToPdf(
    { content: markdown },
    {
      dest: outPath,
      css,
      pdf_options: {
        format: 'Letter',
        margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
        printBackground: true,
      },
      launch_options: launchOptions,
    },
  );

  if (!pdf || !pdf.filename) {
    throw new Error('md-to-pdf did not produce a file');
  }

  fs.mkdirSync(path.dirname(PUBLIC_PDF), { recursive: true });
  fs.copyFileSync(outPath, PUBLIC_PDF);

  const stat = fs.statSync(outPath);
  console.log(`Wrote ${outPath}`);
  console.log(`Copied to ${PUBLIC_PDF}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
