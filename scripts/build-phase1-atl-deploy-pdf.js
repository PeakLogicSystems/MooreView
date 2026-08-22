'use strict';

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { findChromeExecutable } = require('./marketing-pdf-common');

const ROOT = path.join(__dirname, '..');
const SOURCE_MD = path.join(ROOT, 'docs', 'CLOUD_PHASE1_ATL_DEPLOY.md');
const OUT_PDF = path.join(ROOT, 'docs', 'MooreVIEW-Cloud-Phase1-ATL-Deploy.pdf');
const CSS_PATH = path.join(__dirname, 'system-test-pdf.css');

async function main() {
  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Missing source: ${SOURCE_MD}`);
  }

  let markdown = fs.readFileSync(SOURCE_MD, 'utf8');
  const generated = new Date().toISOString().slice(0, 10);
  markdown = markdown.replace(
    /Run `npm run build:phase1-atl-deploy-pdf` for build date/,
    generated
  );

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const chromePath = findChromeExecutable();
  const launchOptions = { args: ['no-sandbox', '--disable-gpu'] };
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
