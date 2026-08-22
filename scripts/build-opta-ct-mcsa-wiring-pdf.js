'use strict';

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');
const { findChromeExecutable } = require('./marketing-pdf-common');

const ROOT = path.join(__dirname, '..');
const SOURCE_MD = path.join(ROOT, 'docs', 'projects', 'OPTA-CT-AC-MCSA-WIRING.md');
const OUT_PDF = path.join(ROOT, 'docs', 'projects', 'OPTA-CT-AC-MCSA-WIRING.pdf');
const FW_PDF = path.join(ROOT, 'firmware', 'arduino-opta-mqtt-st', 'OPTA-CT-AC-MCSA-WIRING.pdf');
const CSS_PATH = path.join(__dirname, 'opta-features-pdf.css');

function mermaidBlocksToDivs(html) {
  return html.replace(
    /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
    (_match, code) => {
      const body = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
      return `<pre class="mermaid">${body}</pre>`;
    }
  );
}

function buildHtml(markdown, css, generated) {
  const bodyHtml = mermaidBlocksToDivs(marked.parse(markdown));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Opta CT AC MCSA Wiring</title>
  <style>${css}
.mermaid { text-align: center; margin: 1.2em 0; page-break-inside: avoid; }
.mermaid svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>
<div class="title-page">
  <h1>Opta — 50 mA CT AC MCSA Wiring</h1>
  <p><strong>MooreVIEW integrator reference</strong></p>
  <p>Document generated: ${generated}</p>
  <p>True line MCSA — burden shunt + mid-rail bias — <code>MV_CT_WAVEFORM=1</code></p>
</div>
<div class="page-break"></div>
${bodyHtml}
</body>
</html>`;
}

async function main() {
  if (!fs.existsSync(SOURCE_MD)) {
    throw new Error(`Missing source: ${SOURCE_MD}`);
  }

  const generated = new Date().toISOString().slice(0, 10);
  let markdown = fs.readFileSync(SOURCE_MD, 'utf8');
  markdown = markdown.replace(/^# Opta — 50 mA CT AC MCSA Wiring\n\n[\s\S]*?---\n\n/, '');

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const html = buildHtml(markdown, css, generated);
  const htmlPath = path.join(ROOT, 'docs', 'projects', '.opta-ct-mcsa-wiring.html');
  fs.writeFileSync(htmlPath, html, 'utf8');

  const executablePath = findChromeExecutable();
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (executablePath) launchOptions.executablePath = executablePath;

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
    await page.addScriptTag({
      url: 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js',
    });
    await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
      const nodes = document.querySelectorAll('pre.mermaid');
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        const graph = el.textContent;
        const id = `mermaid-${i}`;
        // eslint-disable-next-line no-undef
        const { svg } = await mermaid.render(id, graph);
        el.outerHTML = `<div class="mermaid">${svg}</div>`;
      }
    });
    await page.waitForSelector('.mermaid svg', { timeout: 60000 });

    fs.mkdirSync(path.dirname(OUT_PDF), { recursive: true });
    await page.pdf({
      path: OUT_PDF,
      format: 'Letter',
      margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
      printBackground: true,
    });
  } finally {
    await browser.close();
    try {
      fs.unlinkSync(htmlPath);
    } catch {
      /* ignore */
    }
  }

  fs.mkdirSync(path.dirname(FW_PDF), { recursive: true });
  fs.copyFileSync(OUT_PDF, FW_PDF);

  const stat = fs.statSync(OUT_PDF);
  console.log(`Wrote ${OUT_PDF}`);
  console.log(`Copied to ${FW_PDF}`);
  console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
