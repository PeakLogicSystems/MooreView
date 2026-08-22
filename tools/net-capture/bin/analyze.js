#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { FlowRegistry } = require('../lib/flow-registry');
const { proposeDecodingScheme } = require('../lib/scheme-proposer');
const { analyzeUnknown } = require('../lib/unknown-analyzer');
const { loadPlugins } = require('../decoders');

function parseArgs(argv) {
  const opts = {
    input: null,
    proposal: 'proposal.json',
    target: null,
    verbose: false,
    plugins: [],
  };
  const rest = [];
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--proposal' || a === '-p') opts.proposal = argv[++i];
    else if (a === '--target' || a === '-H') opts.target = argv[++i];
    else if (a === '--verbose' || a === '-v') opts.verbose = true;
    else if (a === '--plugin') opts.plugins.push(argv[++i]);
    else if (a === '--help' || a === '-h') { opts.help = true; break; }
    else if (!a.startsWith('-')) rest.push(a);
    else throw new Error(`Unknown argument: ${a}`);
  }
  opts.input = rest[0];
  return opts;
}

function printHelp() {
  console.log(`proto-sniff analyze — offline JSONL analysis

Usage:
  node bin/analyze.js <capture.jsonl> [options]

Options:
  --proposal, -p <file>   Write decoding proposal JSON
  --target, -H <ip>       Target host label in proposal
  --plugin <name>         Load optional vendor plugin
  --verbose, -v           Print per-flow unknown analysis
`);
}

async function analyzeFile(filePath, opts) {
  if (opts.plugins.length) loadPlugins(opts.plugins);

  const registry = new FlowRegistry();
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let target = opts.target;
  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    if (!target && record.target) target = record.target;
    registry.ingest(record);
  }

  const snapshot = registry.snapshot();
  const proposal = proposeDecodingScheme(snapshot, target);
  fs.writeFileSync(path.resolve(opts.proposal), `${JSON.stringify(proposal, null, 2)}\n`);

  console.log(`Analyzed ${snapshot.packetCount} packets, ${snapshot.flowCount} flows`);
  console.log(`Unknown payloads: ${snapshot.unknownCount}`);
  console.log(`Proposal written: ${path.resolve(opts.proposal)}`);

  if (opts.verbose) {
    for (const flow of proposal.flowProposals) {
      console.log('\n---', flow.flow, '---');
      console.log(JSON.stringify(flow, null, 2));
    }
  } else {
    for (const flow of proposal.flowProposals.filter((f) => f.proposedFraming && f.confidence !== 'high').slice(0, 10)) {
      console.log(`\n${flow.flow}: ${flow.proposedFraming} [${flow.confidence}]`);
      if (flow.sampleAnalysis?.hints?.length) {
        console.log(`  hints: ${flow.sampleAnalysis.hints.join('; ')}`);
      }
    }
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help || !opts.input) {
    printHelp();
    process.exit(opts.input ? 0 : 1);
  }
  await analyzeFile(path.resolve(opts.input), opts);
}

main().catch((err) => {
  console.error('[analyze] ERROR:', err.message || err);
  process.exit(1);
});

module.exports = { analyzeUnknown };
