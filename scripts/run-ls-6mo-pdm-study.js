#!/usr/bin/env node
'use strict';

/**
 * 6-month duplex lift station PdM study — SCADA-only vs edge AI.
 *
 * Usage:
 *   node scripts/run-ls-6mo-pdm-study.js
 *   node scripts/run-ls-6mo-pdm-study.js --days 180
 *
 * Requires MongoDB (mongoLogger.uri in data/settings.json).
 * Outputs: data/sim-studies/ls-6mo-<timestamp>/
 */

const { runLiftStation6MonthStudy } = require('../src/pdm/liftStationStudy');
const { initMongoServicesFromSettings } = require('../src/logger/mongoServicesInit');

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days' && argv[i + 1]) {
      opts.days = Number(argv[++i]);
    } else if (argv[i] === '--out' && argv[i + 1]) {
      opts.outputDir = argv[++i];
    }
  }
  return opts;
}

async function main() {
  const ml = await initMongoServicesFromSettings();
  if (!ml?.uri) {
    throw new Error('MongoDB not configured — set mongoLogger.uri in data/settings.json');
  }
  return runLiftStation6MonthStudy(parseArgs(process.argv.slice(2)));
}

main()
  .then((result) => {
    console.log(JSON.stringify({
      ok: true,
      outputDir: result.outputDir,
      totalWorkOrders: result.allWorkOrders?.length ?? 0,
      scenarios: (result.results || []).map((r) => ({
        id: r.scenario,
        workOrders: r.counts.proactiveWorkOrders,
        edge: r.counts.edgeInferences,
      })),
    }, null, 2));
  })
  .catch((e) => {
    console.error('[ls-study] FAILED:', e.message || e);
    process.exit(1);
  });
