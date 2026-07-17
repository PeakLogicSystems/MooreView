'use strict';

/**
 * Build a printable PDF from MooreVIEW markdown docs + in-app help.
 * Usage: node scripts/generate-docs-pdf.js [--out path/to/file.pdf]
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const CLOUD_ROOT = path.resolve(__dirname, '..');
const EST_PC_ROOT = path.resolve(CLOUD_ROOT, '..', 'est-pc');

const DEFAULT_OUT = path.join(CLOUD_ROOT, 'docs', 'MooreVIEW-Documentation.pdf');

const QUICK_START_PATH = path.join(CLOUD_ROOT, 'docs', 'QUICK_START.md');
const DEFAULT_COMPACT_OUT = path.join(CLOUD_ROOT, 'docs', 'MooreVIEW-Quick-Start.pdf');

const COMPACT_DOC_SECTIONS = [
  {
    part: 'Quick Start',
    files: [
      { path: QUICK_START_PATH, title: 'Quick Start' },
    ],
  },
  {
    part: 'Essential reference',
    files: [
      { path: path.join(CLOUD_ROOT, 'docs', 'SEED.md'), title: 'Database Seed' },
      { path: path.join(EST_PC_ROOT, 'docs', 'MQTT_PARC.md'), title: 'MQTT Parc Hub & Opta' },
      { path: path.join(EST_PC_ROOT, 'docs', 'BASELINE_TEST.md'), title: 'Baseline Test' },
      { path: path.join(CLOUD_ROOT, 'docs', 'EST_PC_PARITY.md'), title: 'Cloud vs Appliance' },
    ],
  },
];

const DOC_SECTIONS = [
  {
    part: 'Quick Start',
    files: [
      { path: QUICK_START_PATH, title: 'Quick Start' },
    ],
  },
  {
    part: 'MooreVIEW Cloud',
    files: [
      { path: path.join(CLOUD_ROOT, 'docs', 'USER_GUIDE.md'), title: 'User Guide' },
      { path: path.join(CLOUD_ROOT, 'docs', 'SEED.md'), title: 'Database Seed' },
      { path: path.join(CLOUD_ROOT, 'docs', 'PLATFORM_ADMIN.md'), title: 'Platform Admin' },
      { path: path.join(CLOUD_ROOT, 'docs', 'CMMS_ENTITLEMENT.md'), title: 'CMMS Entitlement' },
      { path: path.join(CLOUD_ROOT, 'DEPLOY.md'), title: 'Production Deploy' },
      { path: path.join(CLOUD_ROOT, 'docs', 'APPLIANCE_CLOUD_REMOTE.md'), title: 'Appliance Cloud Remote' },
      { path: path.join(CLOUD_ROOT, 'docs', 'IOT_MQTT_BRIDGES.md'), title: 'IoT MQTT Bridges' },
      { path: path.join(CLOUD_ROOT, 'docs', 'EST_PC_PARITY.md'), title: 'est-pc Runtime Parity' },
    ],
  },
  {
    part: 'MooreVIEW Appliance (est-pc)',
    files: [
      { path: path.join(EST_PC_ROOT, 'docs', 'ARCHITECTURE.md'), title: 'Architecture' },
      { path: path.join(EST_PC_ROOT, 'docs', 'MQTT_PARC.md'), title: 'MQTT Parc Hub & Opta' },
      { path: path.join(EST_PC_ROOT, 'docs', 'BASELINE_TEST.md'), title: 'Baseline Test' },
      { path: path.join(EST_PC_ROOT, 'docs', 'CMMS_INTEGRATION.md'), title: 'CMMS Integration' },
      { path: path.join(EST_PC_ROOT, 'docs', 'INTEGRATED_PACKAGE.md'), title: 'Integrated Package' },
      { path: path.join(EST_PC_ROOT, 'docs', 'PURPLE_STANDARD.md'), title: 'Purple Standard' },
      { path: path.join(EST_PC_ROOT, 'docs', 'HAL.md'), title: 'Hardware Abstraction' },
    ],
  },
];

const MARGIN = 54;
const BODY_SIZE = 10;
const CODE_SIZE = 8;
const LINE_GAP = 2;
const TABLE_SIZE = 8.5;

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function leftX(doc) {
  return doc.page.margins.left;
}

/** Reset cursor to left margin after table/cell draws that move doc.x. */
function resetCursor(doc) {
  doc.x = leftX(doc);
}

function breakLongTokens(line, maxLen = 76) {
  if (line.length <= maxLen) return line;
  const out = [];
  let rest = line;
  while (rest.length > maxLen) {
    let cut = maxLen;
    const slice = rest.slice(0, maxLen);
    const br = Math.max(slice.lastIndexOf('/'), slice.lastIndexOf(' '), slice.lastIndexOf('_'));
    if (br > maxLen * 0.35) cut = br + 1;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest) out.push(rest);
  return out.join('\n');
}

function stripInline(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function pageBottom(doc) {
  return doc.page.height - doc.page.margins.bottom - 28;
}

function pageTop(doc) {
  return doc.page.margins.top;
}

function pageHasContent(doc) {
  return doc.y > pageTop(doc) + 16;
}

function newPage(doc) {
  doc.addPage({ size: 'LETTER', margin: MARGIN });
}

function installPageHooks(doc) {
  const origAddPage = doc.addPage.bind(doc);
  doc.addPage = function patchedAddPage(...args) {
    if (!doc._footerPass && pageHasContent(doc)) drawFooter(doc);
    const ret = origAddPage(...args);
    doc.x = leftX(doc);
    doc.y = pageTop(doc);
    return ret;
  };
}

function ensureSpace(doc, height) {
  if (doc.y + height <= pageBottom(doc)) return;
  newPage(doc);
}

function drawFooter(doc) {
  if (!pageHasContent(doc) || doc._footerPass) return;
  doc._footerPass = true;
  try {
    doc._pageNum = (doc._pageNum || 0) + 1;
    const y = doc.page.height - 32;
    const w = contentWidth(doc);
    const savedY = doc.y;
    doc.fontSize(8).fillColor('#64748b').font('Helvetica');
    doc.text(
      `MooreVIEW Documentation · Page ${doc._pageNum}`,
      leftX(doc),
      y,
      { width: w, align: 'center', lineBreak: false },
    );
    doc.fillColor('#111827');
    doc.fontSize(BODY_SIZE);
    doc.y = savedY;
    resetCursor(doc);
  } finally {
    doc._footerPass = false;
  }
}

function flowingText(doc, text, opts = {}) {
  const width = opts.width || contentWidth(doc);
  doc.x = leftX(doc);
  doc.text(text, {
    width,
    lineGap: opts.lineGap == null ? LINE_GAP : opts.lineGap,
    align: opts.align || 'left',
  });
  resetCursor(doc);
}

function writeParagraph(doc, text, opts = {}) {
  const t = stripInline(text);
  if (!t) return;
  const width = contentWidth(doc);
  const size = opts.size || BODY_SIZE;
  const font = opts.bold ? 'Helvetica-Bold' : opts.font || 'Helvetica';
  doc.font(font).fontSize(size);
  ensureSpace(doc, 14);
  flowingText(doc, t, { width, lineGap: LINE_GAP });
  if (opts.afterGap !== false) doc.moveDown(opts.gap == null ? 0.25 : opts.gap);
}

function startChapter(doc, title, subtitle, opts = {}) {
  const minBlock = 56;
  if (pageHasContent(doc)) {
    if (doc.y + minBlock > pageBottom(doc)) {
      newPage(doc);
    } else {
      doc.moveDown(0.6);
    }
  }
  writeParagraph(doc, title, { size: opts.size || 15, bold: true, gap: 0.15 });
  if (subtitle) writeParagraph(doc, subtitle, { size: 8, gap: 0.2 });
  else doc.moveDown(0.15);
}

function writeCodeBlock(doc, lines) {
  const text = lines.map((line) => breakLongTokens(line)).join('\n');
  if (!text.trim()) return;
  const width = contentWidth(doc) - 16;
  doc.font('Courier').fontSize(CODE_SIZE).fillColor('#1e293b');
  doc.x = leftX(doc) + 8;
  ensureSpace(doc, 14);
  flowingText(doc, text, { width, lineGap: 1 });
  doc.font('Helvetica').fontSize(BODY_SIZE).fillColor('#111827');
  resetCursor(doc);
  doc.moveDown(0.2);
}

function parseTableRow(line) {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));
}

function isTableSep(line) {
  return /^\|?[\s:-]+\|/.test(line) && /-/.test(line);
}

function tableColumnWidths(doc, cols, rows) {
  const total = contentWidth(doc);
  if (cols <= 1) return [total];
  const weights = Array.from({ length: cols }, (_, ci) => {
    let max = 8;
    for (const row of rows) {
      const cell = stripInline(row[ci] || '');
      max = Math.max(max, Math.min(cell.length, 48));
    }
    return max;
  });
  const sum = weights.reduce((a, b) => a + b, 0) || cols;
  return weights.map((w) => (w / sum) * total);
}

function writeTable(doc, rows) {
  if (!rows.length) return;
  const cols = Math.max(...rows.map((r) => r.length));
  const colWidths = tableColumnWidths(doc, cols, rows);
  const pad = 4;
  const fontSize = TABLE_SIZE;
  const usable = pageBottom(doc) - pageTop(doc);

  doc.fontSize(fontSize);
  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    let maxH = 14;
    const cells = row.map((cell, ci) => {
      const t = stripInline(cell);
      const cellW = Math.max(12, colWidths[ci] - pad * 2);
      const h = doc.heightOfString(t || ' ', { width: cellW, lineGap: 1 });
      maxH = Math.max(maxH, h + pad * 2);
      return t;
    });
    maxH = Math.min(maxH, usable);
    ensureSpace(doc, maxH + 2);
    const x0 = leftX(doc);
    const y0 = doc.y;
    let x = x0;
    for (let ci = 0; ci < cols; ci++) {
      const colW = colWidths[ci];
      const fill = ri === 0 ? '#e2e8f0' : '#ffffff';
      doc.rect(x, y0, colW, maxH).fillAndStroke(fill, '#cbd5e1');
      doc.fillColor('#111827').font(ri === 0 ? 'Helvetica-Bold' : 'Helvetica');
      doc.text(cells[ci] || '', x + pad, y0 + pad, {
        width: Math.max(12, colW - pad * 2),
        lineGap: 1,
      });
      x += colW;
    }
    doc.x = x0;
    doc.y = y0 + maxH;
  }
  doc.font('Helvetica').fontSize(BODY_SIZE);
  resetCursor(doc);
  doc.moveDown(0.35);
}

function renderMarkdown(doc, markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let inCode = false;
  let codeLines = [];
  let tableRows = [];
  let paraBuf = [];

  const flushPara = () => {
    if (!paraBuf.length) return;
    writeParagraph(doc, paraBuf.join(' '));
    paraBuf = [];
  };

  const flushTable = () => {
    if (tableRows.length) {
      writeTable(doc, tableRows);
      tableRows = [];
    }
  };

  for (const raw of lines) {
    const line = raw;

    if (line.startsWith('```')) {
      flushPara();
      flushTable();
      if (inCode) {
        writeCodeBlock(doc, codeLines);
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^\|.+\|/.test(line)) {
      flushPara();
      if (isTableSep(line)) continue;
      tableRows.push(parseTableRow(line));
      continue;
    }

    flushTable();

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      flushPara();
      const level = h[1].length;
      const sizes = { 1: 18, 2: 14, 3: 12, 4: 11 };
      writeParagraph(doc, h[2], { size: sizes[level] || BODY_SIZE, bold: true });
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flushPara();
      doc.moveDown(0.25);
      ensureSpace(doc, 8);
      const x = doc.page.margins.left;
      doc.moveTo(x, doc.y).lineTo(x + contentWidth(doc), doc.y).stroke('#cbd5e1');
      doc.moveDown(0.5);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      flushPara();
      writeParagraph(doc, `• ${line.replace(/^[-*]\s+/, '')}`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      flushPara();
      writeParagraph(doc, line);
      continue;
    }

    if (!line.trim()) {
      flushPara();
      continue;
    }

    paraBuf.push(line.trim());
  }

  flushPara();
  flushTable();
  if (inCode && codeLines.length) writeCodeBlock(doc, codeLines);
}

function extractHelpSections(helpPath) {
  if (!fs.existsSync(helpPath)) return [];
  const src = fs.readFileSync(helpPath, 'utf8');
  const sections = [];
  const re = /\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)',\s*html:\s*`([\s\S]*?)`\s*,?\s*\}/g;
  let m;
  while ((m = re.exec(src))) {
    sections.push({ id: m[1], title: m[2], html: m[3] });
  }
  return sections;
}

function htmlToPlain(html) {
  return html
    .replace(/<h4[^>]*>/gi, '\n\n')
    .replace(/<\/h4>/gi, '\n')
    .replace(/<h3[^>]*>/gi, '\n\n')
    .replace(/<\/h3>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderHelpSection(doc, section) {
  writeParagraph(doc, section.title, { size: 13, bold: true, gap: 0.2 });
  const plain = htmlToPlain(section.html);
  for (const block of plain.split(/\n\n+/)) {
    const t = block.trim();
    if (!t) continue;
    if (/^\|?.+\|/.test(t) && t.includes('|')) {
      const tableRows = t.split('\n').filter((line) => /^\|?.+\|/.test(line) && !isTableSep(line))
        .map(parseTableRow);
      if (tableRows.length) {
        writeTable(doc, tableRows);
        continue;
      }
    }
    if (t.startsWith('•')) {
      for (const line of t.split('\n')) {
        if (line.trim()) writeParagraph(doc, line.trim(), { gap: 0.12 });
      }
    } else {
      writeParagraph(doc, t, { gap: 0.2 });
    }
  }
  doc.moveDown(0.35);
}

function buildTocEntries(sections, { includeHelp = true } = {}) {
  const entries = [];
  for (const group of sections) {
    entries.push({ level: 0, title: group.part });
    for (const f of group.files) entries.push({ level: 1, title: f.title });
  }
  if (includeHelp) entries.push({ level: 0, title: 'In-app Help (est-pc)' });
  return entries;
}

async function generatePdf(outPath, opts = {}) {
  const compact = Boolean(opts.compact);
  const sections = compact ? COMPACT_DOC_SECTIONS : DOC_SECTIONS;
  const includeHelp = !compact && opts.includeHelp !== false;
  const coverSubtitle = compact ? 'Quick Start & Reference' : 'Documentation';

  const missing = [];
  for (const group of sections) {
    for (const f of group.files) {
      if (!fs.existsSync(f.path)) missing.push(f.path);
    }
  }
  if (missing.length) {
    console.warn('[docs-pdf] Missing files (skipped):');
    for (const p of missing) console.warn('  ', p);
  }

  const helpPath = fs.existsSync(path.join(EST_PC_ROOT, 'public', 'js', 'help.js'))
    ? path.join(EST_PC_ROOT, 'public', 'js', 'help.js')
    : path.join(CLOUD_ROOT, 'public', 'js', 'help.js');
  const helpSections = includeHelp ? extractHelpSections(helpPath) : [];

  await new Promise((resolve, reject) => {
    const outDir = path.dirname(outPath);
    fs.mkdirSync(outDir, { recursive: true });
    const stream = fs.createWriteStream(outPath);
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN, autoFirstPage: true });
    doc.pipe(stream);
    installPageHooks(doc);

    doc._pageNum = 0;
    const coverW = contentWidth(doc);
    const coverX = leftX(doc);
    let coverY = doc.y;
    doc.font('Helvetica-Bold').fontSize(22).fillColor('#4c1d95');
    doc.text('MooreVIEW', coverX, coverY, { width: coverW, align: 'center' });
    coverY = doc.y + 8;
    doc.fontSize(16).fillColor('#111827').text(coverSubtitle, coverX, coverY, { width: coverW, align: 'center' });
    coverY = doc.y + 14;
    doc.font('Helvetica').fontSize(11).fillColor('#475569');
    doc.text(`Generated ${new Date().toLocaleString()}`, coverX, coverY, { width: coverW, align: 'center' });
    coverY = doc.y + 4;
    doc.text('Purple Standard · mooreVIEW product suite', coverX, coverY, { width: coverW, align: 'center' });
    doc.y = doc.y + 20;
    resetCursor(doc);

    doc.fontSize(12).fillColor('#111827').font('Helvetica-Bold');
    doc.text('Contents', leftX(doc), doc.y, { width: coverW });
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(10);
    for (const entry of buildTocEntries(sections, { includeHelp })) {
      ensureSpace(doc, 14);
      const indent = entry.level === 0 ? '' : '    ';
      const style = entry.level === 0 ? 'Helvetica-Bold' : 'Helvetica';
      doc.font(style).fontSize(10);
      flowingText(doc, `${indent}${entry.title}`, { lineGap: 0.5 });
    }

    newPage(doc);

    for (const group of sections) {
      const soloQuickStart = group.files.length === 1 && group.files[0].path === QUICK_START_PATH;
      if (!soloQuickStart) startChapter(doc, group.part, null, { size: 16 });
      for (const file of group.files) {
        if (!fs.existsSync(file.path)) continue;
        if (file.path !== QUICK_START_PATH) {
          startChapter(
            doc,
            file.title,
            path.relative(CLOUD_ROOT, file.path).replace(/\\/g, '/'),
          );
        }
        renderMarkdown(doc, fs.readFileSync(file.path, 'utf8'));
      }
    }

    if (helpSections.length) {
      startChapter(doc, 'In-app Help (est-pc)', 'Reference content from the F1 help panel in the MooreVIEW appliance UI.');
      for (const section of helpSections) {
        renderHelpSection(doc, section);
      }
    }

    drawFooter(doc);
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  const stat = fs.statSync(outPath);
  return { outPath, bytes: stat.size, helpSections: helpSections.length, compact };
}

function parseArgs() {
  const args = process.argv.slice(2);
  let out = null;
  let compact = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--compact') compact = true;
    else if (args[i] === '--out' && args[i + 1]) out = path.resolve(args[++i]);
  }
  if (!out) {
    out = compact ? DEFAULT_COMPACT_OUT : DEFAULT_OUT;
  }
  return { out, compact };
}

if (require.main === module) {
  const { out, compact } = parseArgs();
  generatePdf(out, { compact })
    .then(({ outPath, bytes, helpSections, compact: isCompact }) => {
      const kb = (bytes / 1024).toFixed(1);
      const mode = isCompact ? 'compact' : 'full';
      console.log(`[docs-pdf] Wrote ${outPath} (${kb} KB, ${mode}${helpSections ? `, ${helpSections} help sections` : ''})`);
    })
    .catch((err) => {
      console.error('[docs-pdf] Failed:', err.message);
      process.exit(1);
    });
}

module.exports = { generatePdf };
