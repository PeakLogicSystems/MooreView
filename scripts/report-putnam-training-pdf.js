'use strict';

/**
 * Generate PDF report from Putnam RUN↔amps training artifacts.
 *
 *   node scripts/report-putnam-training-pdf.js
 *   node scripts/report-putnam-training-pdf.js --dir data/training/putnam-county
 */

const path = require('path');
const { writeRunAmpsPdfReport } = require('../src/pdm/runAmpsPdfReport');

async function main() {
  const args = process.argv.slice(2);
  let dir = path.join(process.cwd(), 'data', 'training', 'putnam-county');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dir') dir = args[++i];
  }
  const result = await writeRunAmpsPdfReport({ trainingDir: dir });
  console.log(`PDF written (${result.bytes} bytes)`);
  console.log(`  ${result.outPath}`);
  console.log(`  ${result.latestPath}`);
  console.log(`Sites: ${result.siteCount}  Runs: ${result.runCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
