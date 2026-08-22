'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { mdToPdf } = require('md-to-pdf');
const { STUDY_SCENARIOS } = require('../src/pdm/liftStationStudy');

const ROOT = path.join(__dirname, '..');
const DOCS = path.join(ROOT, 'docs', 'testing');
const STUDIES_DIR = path.join(ROOT, 'data', 'sim-studies');
const SOURCE_MD = path.join(DOCS, 'LIFT-STATION-6MO-PDM-STUDY-TEST.md');
const OUT_PDF = path.join(DOCS, 'MooreVIEW-Lift-Station-6Mo-PdM-Study-Test.pdf');
const CSS_PATH = path.join(__dirname, 'system-test-pdf.css');

function findChromeExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
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

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--study-dir' && argv[i + 1]) opts.studyDir = path.resolve(argv[++i]);
  }
  return opts;
}

function findLatestStudyDir() {
  if (!fs.existsSync(STUDIES_DIR)) return null;
  const dirs = fs.readdirSync(STUDIES_DIR)
    .filter((n) => n.startsWith('ls-6mo-4way-'))
    .map((n) => path.join(STUDIES_DIR, n))
    .filter((p) => fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'comparison.json')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return dirs[0] || null;
}

function runAutomatedTests() {
  const r = spawnSync(
    process.execPath,
    ['--test', 'test/liftStationStudy.test.js', 'test/hostInference.test.js'],
    { cwd: ROOT, encoding: 'utf8', shell: false },
  );
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const pass = (out.match(/\n✔ /g) || []).length + (out.match(/\n  ✔ /g) || []).length;
  const fail = (out.match(/\n✖ /g) || []).length + (out.match(/\n  ✖ /g) || []).length;
  const suitesPass = /ℹ pass (\d+)/.exec(out)?.[1] || String(pass);
  const suitesFail = /ℹ fail (\d+)/.exec(out)?.[1] || String(fail);
  return {
    ok: r.status === 0,
    exitCode: r.status,
    pass: Number(suitesPass),
    fail: Number(suitesFail),
    output: out.trim(),
  };
}

function passCell(ok) {
  return ok ? '**PASS**' : '**FAIL**';
}

function scenarioCriteria(scenario) {
  const { id, hostInference, mcsaMode } = scenario;
  const rows = [];
  if (hostInference === false) {
    rows.push({ id: `${id}-no-inference`, text: 'No host inference docs written (regression-only path)', check: (c) => c.edgeInferences === 0 });
  } else {
    rows.push({ id: `${id}-inference`, text: `Host inference runs on every motor start (${hostInference})`, check: (c) => c.edgeInferences > 0 && c.edgeInferences === c.mcsaUplinkReports });
  }
  rows.push({ id: `${id}-mcsa-uplink`, text: `MCSA uplink reports generated (${mcsaMode} mode)`, check: (c) => c.mcsaUplinkReports >= 7000 });
  rows.push({ id: `${id}-wo-count`, text: 'Exactly 2 proactive CMMS work orders (lead + lag pump)', check: (c) => c.proactiveWorkOrders === 2 });
  if (hostInference === false) {
    rows.push({ id: `${id}-late-wo`, text: 'First proactive WO issued in month 6 or later (SCADA/regression lag)', check: (_c, wos) => wos.every((w) => (w.firstAlertMonth || 0) >= 6) });
  } else {
    rows.push({ id: `${id}-early-wo`, text: 'First proactive WO issued by month 1 (inference early warning)', check: (_c, wos) => wos.every((w) => (w.firstAlertMonth || 99) <= 1) });
  }
  return rows;
}

function buildMarkdown({ studyDir, comparison, autoTests }) {
  const generated = new Date().toISOString();
  const studyName = path.basename(studyDir);
  const lines = [];

  lines.push('<div class="title-page">', '');
  lines.push('<div class="brand">Moore<span>VIEW</span></div>', '');
  lines.push('# Lift Station 6-Month PdM Study', '');
  lines.push('**Test plan · acceptance criteria · results**', '');
  lines.push('', '| | |');
  lines.push('|---|---|');
  lines.push('| **Document ID** | MV-LS6MO-PDM-1.0 |');
  lines.push('| **Product** | MooreVIEW MVP Suite (est-pc) |');
  lines.push('| **Study run** | `' + studyName + '` |');
  lines.push('| **Generated** | ' + generated + ' |');
  lines.push('', '</div>', '');
  lines.push('<div class="page-break"></div>', '');

  lines.push('## 1. Purpose', '');
  lines.push('This document validates the **duplex lift station 6-month predictive maintenance (PdM) study** across four MCSA / inference scenarios. It records **test criteria**, **automated checks**, and **observed results** from the simulated restaurant duplex lift station (180 days, 8 PdM assets, CMMS auto work orders).', '');
  lines.push('');

  lines.push('## 2. Scenario matrix (acceptance design)', '');
  lines.push('');
  lines.push('| ID | Title | MCSA source | Host path | Expected early warning |');
  lines.push('|----|-------|-------------|-----------|------------------------|');
  for (const sc of STUDY_SCENARIOS) {
    const host = sc.hostInference === false ? 'None (PdM regression only)' : `Host ${sc.hostInference}`;
    const early = sc.hostInference === false ? 'Late (month 6+)' : 'Early (month 1)';
    lines.push(`| \`${sc.id}\` | ${sc.title} | ${sc.mcsaMode === 'lite' ? 'Opta pseudo MCSA' : 'True FFT MCSA (sim)'} | ${host} | ${early} |`);
  }
  lines.push('');

  lines.push('## 3. Automated unit tests', '');
  lines.push('');
  lines.push('Run before or after the study:', '');
  lines.push('');
  lines.push('```text');
  lines.push('cd est-pc');
  lines.push('node --test test/liftStationStudy.test.js test/hostInference.test.js');
  lines.push('```');
  lines.push('');
  lines.push('| Suite | Criterion | Result |');
  lines.push('|-------|-----------|--------|');
  lines.push(`| \`liftStationStudy.test.js\` | Four scenario IDs match design matrix | ${passCell(autoTests.ok)} |`);
  lines.push(`| \`liftStationStudy.test.js\` | Regression scenario produces zero edge docs in sim | ${passCell(autoTests.ok)} |`);
  lines.push(`| \`liftStationStudy.test.js\` | Production early-warning profile (host supplement + CMMS) | ${passCell(autoTests.ok)} |`);
  lines.push(`| \`hostInference.test.js\` | MCSA feature vector, registry, host orchestration | ${passCell(autoTests.ok)} |`);
  lines.push(`| **Summary** | ${autoTests.pass} passed · ${autoTests.fail} failed (exit ${autoTests.exitCode}) | ${passCell(autoTests.ok)} |`);
  lines.push('');

  lines.push('### 3.1 Unit test definitions', '');
  lines.push('');
  lines.push('| Test | Pass criterion |');
  lines.push('|------|----------------|');
  lines.push('| Scenario matrix | `STUDY_SCENARIOS` = opta-mcsa-regression, opta-mcsa-onnx, true-mcsa-regression, true-mcsa-onnx with hostInference false / onnx / rule / onnx |');
  lines.push('| Asset registration | 8 study assets + live `pump-1` / `pump-2`; all three PdM forecast methods enabled |');
  lines.push('| Production profile | `inference.hostEnabled`, `mode: host-supplement`, `cmms.autoWorkOrdersFromPdm` |');
  lines.push('| True MCSA sim | FFT channels include bearing and eccentricity metadata |');
  lines.push('| Regression sim | `edgeDocs.length === 0` with >50 start events over 90-day sample |');
  lines.push('| MCSA features | 64-dim vector from Opta lite telemetry fixture |');
  lines.push('| Host inference | Supplement skips when device `edgeAi` present; runs for HVAC without edge |');
  lines.push('');

  lines.push('## 4. Integration study criteria', '');
  lines.push('');
  lines.push('| # | Criterion | Target |');
  lines.push('|---|-----------|--------|');
  lines.push(`| I1 | Simulated duration | ${comparison.days} days |`);
  lines.push('| I2 | Registered PdM assets | 8 (`pump-{1,2}-{scenario}`) |');
  lines.push('| I3 | MCSA uplink reports per scenario | ~7,400 (all motor starts) |');
  lines.push('| I4 | Pen historian samples per scenario | ~45,120 |');
  lines.push('| I5 | Total proactive CMMS work orders | 8 (2 per scenario) |');
  lines.push('| I6 | WO source | `pdm` with urgent priority |');
  lines.push('| I7 | Regression-only path | Latest WO month (≥6) vs inference paths (≤1) |');
  lines.push('| I8 | PdM failure threshold | 0.35 health index |');
  lines.push('| I9 | Forecast methods stacked | health_index, run_amps_creep, start_time_ms (shortest RUL wins) |');
  lines.push('| I10 | ONNX model | `data/models/lift-submersible-v3.onnx` |');
  lines.push('');

  lines.push('## 5. Study results by scenario', '');
  const allCriteria = [];
  let allPass = autoTests.ok;

  for (const sc of comparison.scenarios) {
    lines.push('');
    lines.push(`### ${sc.title} (\`${sc.id}\`)`, '');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| MCSA uplink reports | ${sc.counts.mcsaUplinkReports} |`);
    lines.push(`| Host / edge inferences | ${sc.counts.edgeInferences} |`);
    lines.push(`| Pen samples | ${sc.counts.penSamples} |`);
    lines.push(`| Proactive work orders | ${sc.counts.proactiveWorkOrders} |`);
    const month = sc.workOrders.map((w) => w.firstAlertMonth).sort((a, b) => a - b)[0];
    lines.push(`| First alert month | ${month ?? '—'} |`);
    lines.push('');

    lines.push('| WO | Asset | Priority | First alert month |');
    lines.push('|----|-------|----------|-------------------|');
    for (const wo of sc.workOrders) {
      lines.push(`| ${wo.number} | ${wo.assetId} | ${wo.priority} | ${wo.firstAlertMonth} |`);
    }
    lines.push('');

    lines.push('| Acceptance check | Result |');
    lines.push('|------------------|--------|');
    const criteria = scenarioCriteria(STUDY_SCENARIOS.find((s) => s.id === sc.id));
    for (const cr of criteria) {
      const ok = cr.check(sc.counts, sc.workOrders);
      if (!ok) allPass = false;
      allCriteria.push({ scenario: sc.id, ...cr, ok });
      lines.push(`| ${cr.text} | ${passCell(ok)} |`);
    }

    lines.push('');
    lines.push('**Final forecasts (end of study):**', '');
    lines.push('');
    lines.push('| Asset | Severity | Health | Headline |');
    lines.push('|-------|----------|--------|----------|');
    for (const f of sc.finalForecasts) {
      const health = f.currentHealth == null ? '—' : f.currentHealth.toFixed(2);
      lines.push(`| ${f.assetId} | ${f.severity} | ${health} | ${f.headline.replace(/\|/g, '/')} |`);
    }
  }

  lines.push('');
  lines.push('<div class="page-break"></div>', '');
  lines.push('## 6. Cross-scenario comparison', '');
  lines.push('');
  lines.push('| Scenario | First WO month | Edge inferences | Forecast driver (regression path) |');
  lines.push('|----------|----------------|-----------------|-----------------------------------|');
  for (const sc of comparison.scenarios) {
    const month = sc.workOrders.map((w) => w.firstAlertMonth).sort((a, b) => a - b)[0];
    const driver = sc.id.includes('regression') && !sc.id.includes('onnx') && sc.id === 'opta-mcsa-regression'
      ? 'run_amps_creep (no health index from inference)'
      : 'health_index (inference-fed)';
    lines.push(`| ${sc.id} | ${month} | ${sc.counts.edgeInferences} | ${driver} |`);
  }
  lines.push('');
  const regression = comparison.scenarios.find((s) => s.id === 'opta-mcsa-regression');
  const onnx = comparison.scenarios.find((s) => s.id === 'opta-mcsa-onnx');
  const regMonth = regression?.workOrders.map((w) => w.firstAlertMonth).sort((a, b) => a - b)[0] || 0;
  const onnxMonth = onnx?.workOrders.map((w) => w.firstAlertMonth).sort((a, b) => a - b)[0] || 0;
  const delta = regMonth - onnxMonth;
  lines.push(`**Early-warning delta (Opta pseudo MCSA):** regression-only detected failure **${delta} simulated month(s)** later than host ONNX (${regMonth} vs ${onnxMonth}).`, '');
  lines.push('');

  lines.push('## 7. Overall verdict', '');
  lines.push('');
  const i5ok = comparison.totalProactiveWorkOrders === 8;
  if (!i5ok) allPass = false;
  lines.push('| Gate | Result |');
  lines.push('|------|--------|');
  lines.push(`| Automated unit tests | ${passCell(autoTests.ok)} |`);
  lines.push(`| All scenario acceptance checks (${allCriteria.length}) | ${passCell(allCriteria.every((c) => c.ok))} |`);
  lines.push(`| Total proactive WOs = 8 | ${passCell(i5ok)} (${comparison.totalProactiveWorkOrders}) |`);
  lines.push(`| **Release recommendation** | ${passCell(allPass && i5ok)} |`);
  lines.push('');

  lines.push('## 8. Manual verification in MooreVIEW UI', '');
  lines.push('');
  lines.push('After loading study settings:', '');
  lines.push('');
  lines.push('1. **Historian → Logger config → PdM** — confirm 8 assets (`pump-1-*` / `pump-2-*`).');
  lines.push('2. **CMMS** (`/cmms`) — filter **source: pdm** — verify WO-0018 through WO-0025 (or current run).');
  lines.push('3. **Per-scenario PDFs** — open `PdM_{scenario}_pump-*.pdf` under each scenario folder in the study output directory.');
  lines.push('4. **Production profile** — review `data/pdm-production-early-warning.json`; apply with `npm run pdm:production-profile`.');
  lines.push('');

  lines.push('## 9. Reproduce', '');
  lines.push('');
  lines.push('```text');
  lines.push('cd est-pc');
  lines.push('py -3 scripts/gen-lift-study-onnx.py          # if model missing');
  lines.push('npm run study:ls-6mo                          # ~30 min, requires MongoDB');
  lines.push('npm run build:ls-6mo-study-test-pdf           # this document');
  lines.push('```');
  lines.push('');
  lines.push('Study artifacts: `' + studyDir.replace(/\\/g, '/') + '`', '');
  lines.push('');

  lines.push('## 10. Sign-off', '');
  lines.push('');
  lines.push('| Role | Name | Date | Signature |');
  lines.push('|------|------|------|-----------|');
  lines.push('| Test engineer | | | |');
  lines.push('| PdM / reliability | | | |');
  lines.push('| Product owner | | | |');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const studyDir = opts.studyDir || findLatestStudyDir();
  if (!studyDir) {
    throw new Error('No ls-6mo-4way study found under data/sim-studies/ — run npm run study:ls-6mo first');
  }
  const comparisonPath = path.join(studyDir, 'comparison.json');
  if (!fs.existsSync(comparisonPath)) {
    throw new Error(`Missing comparison.json in ${studyDir}`);
  }
  const comparison = JSON.parse(fs.readFileSync(comparisonPath, 'utf8'));

  console.log('[pdf] Running automated tests…');
  const autoTests = runAutomatedTests();
  console.log(`[pdf] Tests: ${autoTests.pass} pass, ${autoTests.fail} fail`);

  const markdown = buildMarkdown({ studyDir, comparison, autoTests });
  fs.mkdirSync(DOCS, { recursive: true });
  fs.writeFileSync(SOURCE_MD, markdown, 'utf8');
  console.log(`[pdf] Wrote ${SOURCE_MD}`);

  const css = fs.readFileSync(CSS_PATH, 'utf8');
  const chromePath = findChromeExecutable();
  const launchOptions = { args: ['--no-sandbox'] };
  if (chromePath) launchOptions.executablePath = chromePath;

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
    },
  );

  if (!pdf || !pdf.filename) throw new Error('md-to-pdf did not produce a file');

  const studyPdf = path.join(studyDir, 'MooreVIEW-Lift-Station-6Mo-PdM-Study-Test.pdf');
  fs.copyFileSync(OUT_PDF, studyPdf);

  const stat = fs.statSync(OUT_PDF);
  console.log(`[pdf] Wrote ${OUT_PDF}`);
  console.log(`[pdf] Copied to ${studyPdf}`);
  console.log(`[pdf] Size: ${(stat.size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
