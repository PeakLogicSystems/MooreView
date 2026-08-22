'use strict';

const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');
const { buildToc, stripLeadingTitleBlock, findChromeExecutable } = require('./marketing-pdf-common');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'nexcomm');
const CSS_PATH = path.join(__dirname, 'nexcomm-story-pdf.css');

const STORIES = {
  alf: {
    slug: 'alf-halow-story',
    title: 'ALF Living Campus',
    subtitle: 'Nexcomm HaLow + mooreVIEW — institutional / assisted living',
    tagline: 'Survey-ready campus ops before families complain or survey week arrives',
    source: path.join(DOCS, 'alf-halow-story.md'),
    out: path.join(DOCS, 'MooreVIEW-Nexcomm-ALF-HaLow-Story.pdf'),
  },
  cstore: {
    slug: 'cstore-halow-story',
    title: 'Convenience Store / Gas Station',
    subtitle: 'Nexcomm HaLow + mooreVIEW — cold chain, RTU, lift, leaks',
    tagline: 'One HaLow AP covers the shop and forecourt — planned WOs before spoilage or overflow',
    source: path.join(DOCS, 'cstore-halow-story.md'),
    out: path.join(DOCS, 'MooreVIEW-Nexcomm-CStore-HaLow-Story.pdf'),
  },
};

function extractOneLinePitch(body) {
  const m = body.match(/^## One-line pitch\n\n([\s\S]*?)(?=\n---\n)/m);
  return m ? m[1].trim() : '';
}

function extractMetaLines(body) {
  const lines = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('**')) break;
    lines.push(line.replace(/\*\*/g, ''));
  }
  return lines.join(' · ');
}

async function buildStoryPdf(storyKey, options = {}) {
  const story = STORIES[storyKey];
  if (!story) {
    throw new Error(`Unknown story: ${storyKey}. Use: ${Object.keys(STORIES).join(', ')}`);
  }

  const sourceMd = options.source || story.source;
  const outPdf = options.out || story.out;

  if (!fs.existsSync(sourceMd)) {
    throw new Error(`Missing source: ${sourceMd}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  const bodyRaw = fs.readFileSync(sourceMd, 'utf8');
  const body = stripLeadingTitleBlock(bodyRaw);
  const oneLine = extractOneLinePitch(body);
  const meta = extractMetaLines(bodyRaw);
  const remainder = body.replace(/^## One-line pitch\n\n[\s\S]*?\n---\n\n/m, '');
  const toc = buildToc(remainder);

  const markdown = `<div class="title-page">

<div class="brand">moore<span>VIEW</span></div>

<div class="partner">Nexcomm Systems · Wi-Fi HaLow</div>

# ${story.title}

<div class="subtitle">${story.subtitle}</div>

<div class="subtitle">${story.tagline}</div>

<div class="meta">${meta}</div>

<div class="meta">Document generated: ${generated}</div>

</div>

<div class="page-break"></div>

<div class="summary-page">

# At a Glance

${oneLine}

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

async function buildAll() {
  const results = [];
  for (const key of Object.keys(STORIES)) {
    results.push(await buildStoryPdf(key));
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const docIdx = args.indexOf('--doc');
  if (docIdx >= 0 && args[docIdx + 1]) {
    await buildStoryPdf(args[docIdx + 1]);
    return;
  }
  await buildAll();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildStoryPdf, buildAll, STORIES };
