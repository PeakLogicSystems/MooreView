'use strict';

/**
 * Build RUN↔amps training data from Putnam County lift-station CSVs.
 *
 * Usage:
 *   node scripts/build-putnam-training.js
 *   node scripts/build-putnam-training.js --dir "E:/putnam-county- DNL"
 *   node scripts/build-putnam-training.js --no-mongo path1.csv path2.csv
 */

const path = require('path');
const fs = require('fs');
const pdmService = require('../src/pdm/pdmService');

const DEFAULT_DIR = 'E:/putnam-county- DNL';

function parseArgs(argv) {
  const args = { paths: [], seedMongo: true, dir: null, ampThreshold: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-mongo') args.seedMongo = false;
    else if (a === '--dir') args.dir = argv[++i];
    else if (a === '--amp-threshold') args.ampThreshold = Number(argv[++i]) || 2;
    else if (a === '--out') args.outDir = argv[++i];
    else if (!a.startsWith('-')) args.paths.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let paths = args.paths;
  if (!paths.length) {
    const dir = args.dir || DEFAULT_DIR;
    if (!fs.existsSync(dir)) {
      console.error(`Directory not found: ${dir}`);
      process.exit(1);
    }
    paths = fs.readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith('.csv'))
      .map((f) => path.join(dir, f));
  }
  if (!paths.length) {
    console.error('No CSV files found');
    process.exit(1);
  }

  console.log(`Analyzing ${paths.length} CSV(s)…`);
  const result = await pdmService.importRunAmpsCsv({
    paths,
    seedMongo: args.seedMongo,
    ampThreshold: args.ampThreshold,
    outDir: args.outDir,
  });
  if (!result.ok) {
    console.error(result.error || result);
    process.exit(1);
  }

  console.log(`\nModel: ${result.modelId}`);
  console.log(`Sites: ${result.siteCount}  Runs: ${result.runCount}`);
  for (const s of result.sites) {
    const c = s.correlation || {};
    console.log(
      `  ${s.siteId.padEnd(28)} runs=${String(s.runCount).padStart(4)}  `
      + `corr=${c.digital || 'n/a'}${c.inverted ? ' (inv)' : ''} → ${c.ct || 'n/a'}  Δ=${c.delta ?? 'n/a'}  `
      + `labels=${JSON.stringify(s.summary?.labels || {})}`,
    );
  }
  console.log('\nArtifacts:');
  for (const [k, v] of Object.entries(result.artifacts || {})) {
    if (k !== 'outDir') console.log(`  ${k}: ${v}`);
  }
  if (result.edgeLogged) console.log('Mongo edge:', result.edgeLogged);
  if (result.scadaLogged != null) console.log('Mongo scada seeded:', !!result.scadaLogged);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
