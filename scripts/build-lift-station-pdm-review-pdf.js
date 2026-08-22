'use strict';

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'pdm');
const SOURCE_MD = path.join(DOCS, 'LIFT-STATION-PDM-TRAINING-REVIEW.md');
const OUT_PDF = path.join(DOCS, 'MooreVIEW-Lift-Station-PdM-Training-Review.pdf');
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
    /Run `npm run build:lift-station-pdm-review-pdf` for build date/,
    generated
  );

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const chromePath = findChromeExecutable();
  const launchOptions = { args: ['--no-sandbox'] };
  if (chromePath) {
    launchOptions.executablePath = chromePath;
  }

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
      launch_options: launchOptions,
    }
  );

  if (!pdf || !pdf.filename) {
    throw new Error('md-to-pdf did not produce a file');
  }

  const stat = fs.statSync(OUT_PDF);
  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
