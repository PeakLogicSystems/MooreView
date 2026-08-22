'use strict';

/**
 * Rebuild all help & training artifacts:
 *   - docs/training/reference/ (offline pack)
 *   - Help/training PDFs (Opta, full-system test, lift-station PdM, cloud UI checklist)
 *   - Putnam RUN↔amps training report (when artifacts exist)
 *
 *   npm run rebuild:help-training
 *   node scripts/rebuild-help-training.js
 *   node scripts/rebuild-help-training.js --skip-putnam
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findChromeExecutable } = require('./pdf-chrome');

const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  return {
    skipPutnam: argv.includes('--skip-putnam'),
    skipSync: argv.includes('--skip-sync'),
  };
}

function runStep(label, fn) {
  console.log(`\n=== ${label} ===`);
  const code = fn();
  if (code !== 0) {
    console.error(`FAILED: ${label} (exit ${code})`);
    process.exit(code);
  }
  console.log(`OK: ${label}`);
}

function runNodeScript(scriptName) {
  const scriptPath = path.join(__dirname, scriptName);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  return result.status ?? 1;
}

function runSyncTrainingReference() {
  if (process.platform === 'win32') {
    const ps1 = path.join(__dirname, 'sync-training-reference.ps1');
    const result = spawnSync(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', ps1],
      { cwd: ROOT, stdio: 'inherit', env: process.env }
    );
    return result.status ?? 1;
  }

  console.warn('sync-training-reference.ps1 requires Windows PowerShell — skipped on this platform.');
  console.warn('Copy docs/training/reference/ from a Windows build or run the PowerShell script manually.');
  return 0;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const chrome = findChromeExecutable();
  if (chrome && !process.env.PUPPETEER_EXECUTABLE_PATH) {
    process.env.PUPPETEER_EXECUTABLE_PATH = chrome;
    console.log(`Using browser: ${chrome}`);
  } else if (!chrome) {
    console.warn('No system Chrome/Edge found — md-to-pdf will use bundled Puppeteer Chrome if installed.');
  }

  if (!args.skipSync) {
    runStep('Training reference pack (initial sync)', runSyncTrainingReference);
  }

  runStep('OPTa features PDF', () => runNodeScript('build-opta-features-pdf.js'));
  runStep('Full system test PDF', () => runNodeScript('build-full-system-test-pdf.js'));
  runStep('Lift-station PdM training review PDF', () => runNodeScript('build-lift-station-pdm-review-pdf.js'));
  runStep('Cloud UI checklist PDF', () => runNodeScript('build-cloud-ui-checklist-pdf.js'));

  const putnamTrain = path.join(ROOT, 'data', 'training', 'putnam-county', 'training.json');
  if (!args.skipPutnam && fs.existsSync(putnamTrain)) {
    runStep('Putnam RUN↔amps training report PDF', () => runNodeScript('report-putnam-training-pdf.js'));
  } else if (!args.skipPutnam) {
    console.log('\n=== Putnam RUN↔amps training report PDF ===');
    console.log(`Skip — no artifacts at ${putnamTrain}`);
  }

  if (!args.skipSync) {
    runStep('Training reference pack (final sync)', runSyncTrainingReference);
  }

  console.log('\nHelp & training rebuild complete.');
  console.log('In-app F1/F2 content: public/js/help.js, training.js (edit source directly).');
}

main();
