#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pickBackend } = require('../lib/capture-backend');
const { detectInterfaceForHost, listInterfaces, findTshark } = require('../lib/lan-interface');
const { FlowRegistry } = require('../lib/flow-registry');
const { proposeDecodingScheme } = require('../lib/scheme-proposer');
const { loadPlugins } = require('../decoders');

const DEFAULT_HOST = '192.168.1.241';

function parseArgs(argv) {
  const opts = {
    targetHost: DEFAULT_HOST,
    iface: 'auto',
    bpf: null,
    durationSec: 0,
    output: null,
    schemeOnly: false,
    listIfaces: false,
    forceTshark: false,
    verbose: false,
    plugins: [],
    proposalFile: null,
    promiscuous: true,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--host' || a === '-H') opts.targetHost = argv[++i];
    else if (a === '--iface' || a === '-i') opts.iface = argv[++i];
    else if (a === '--bpf' || a === '-f') opts.bpf = argv[++i];
    else if (a === '--no-promisc') opts.promiscuous = false;
    else if (a === '--duration' || a === '-d') opts.durationSec = Number(argv[++i]) || 0;
    else if (a === '--output' || a === '-o') opts.output = argv[++i];
    else if (a === '--proposal') opts.proposalFile = argv[++i] || 'proposal.json';
    else if (a === '--scheme') opts.schemeOnly = true;
    else if (a === '--list-ifaces') opts.listIfaces = true;
    else if (a === '--tshark') opts.forceTshark = true;
    else if (a === '--verbose' || a === '-v') opts.verbose = true;
    else if (a === '--plugin') opts.plugins.push(argv[++i]);
    else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return opts;
}

function printHelp() {
  console.log(`proto-sniff — standalone LAN capture & unknown protocol decoder

Captures traffic for a target host, runs heuristics on opaque payloads,
and proposes a decoding scheme (framing, field layout, pseudocode).

Usage:
  node bin/capture.js [options]

Options:
  --host, -H <ip>       Target IP (default ${DEFAULT_HOST})
  --bpf, -f <filter>    Custom BPF filter (default: host <ip>)
  --iface, -i <name>    Interface name or index (default auto)
  --duration, -d <sec>  Stop after N seconds
  --output, -o <file>   JSONL packet log
  --proposal <file>     Write decoding proposal JSON at end (default: proposal.json)
  --scheme              Print methodology template and exit
  --plugin <name>       Load decoders/plugins/<name>.js (repeatable)
  --list-ifaces         List interfaces
  --tshark              Force tshark backend
  --verbose, -v         Print every decoded packet
  --help, -h

Setup (Windows):
  • Npcap https://npcap.com/ (WinPcap-compatible mode)
  • npm install
  • Run as Administrator

Examples:
  node bin/capture.js --host 192.168.1.241 -d 60 -o capture.jsonl -v
  node bin/analyze.js capture.jsonl --proposal scheme.json
`);
}

function printScheme(host) {
  const { proposeDecodingScheme } = require('../lib/scheme-proposer');
  console.log(JSON.stringify(proposeDecodingScheme({ packetCount: 0, unknownCount: 0, flows: [] }, host), null, 2));
}

function printInterfaces(host) {
  console.log('IPv4 interfaces:');
  for (const row of listInterfaces()) {
    console.log(`  ${row.name.padEnd(24)} ${row.address}${row.internal ? ' (internal)' : ''}`);
  }
  const tshark = findTshark();
  if (tshark) {
    const { tsharkListInterfaces } = require('../lib/lan-interface');
    console.log('\ntshark -D:');
    for (const i of tsharkListInterfaces(tshark)) {
      console.log(`  ${i.index}. ${i.name} ${i.detail}`);
    }
  }
  const lan = detectInterfaceForHost(host);
  if (lan) console.log(`\nSuggested for ${host}: ${lan.name} (${lan.address})`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    printHelp();
    return;
  }
  if (opts.listIfaces) {
    printInterfaces(opts.targetHost);
    return;
  }
  if (opts.schemeOnly) {
    printScheme(opts.targetHost);
    return;
  }

  if (opts.plugins.length) loadPlugins(opts.plugins);

  const outStream = opts.output
    ? fs.createWriteStream(path.resolve(opts.output), { flags: 'a' })
    : null;
  const registry = new FlowRegistry();
  const bpf = opts.bpf || `host ${opts.targetHost}`;

  const backend = pickBackend(opts);
  console.log(`[proto-sniff] backend=${backend.name} bpf="${bpf}"`);
  console.log('[proto-sniff] unknown payloads → entropy, prefixes, length-fields, framing proposal');
  console.log('[proto-sniff] capturing… Ctrl+C to stop\n');

  const onRecord = (record) => {
    registry.ingest(record);

    if (opts.verbose) printRecord(record);
    else if (registry.packetCount % 25 === 0) {
      process.stdout.write(`\r[proto-sniff] ${registry.packetCount} packets…`);
    }

    if (outStream) outStream.write(`${JSON.stringify(record)}\n`);
  };

  const runPromise = backend.start(onRecord);
  let timer = null;
  if (opts.durationSec > 0) {
    timer = setTimeout(() => {
      console.log(`\n[proto-sniff] duration ${opts.durationSec}s elapsed`);
      backend.stop();
    }, opts.durationSec * 1000);
  }

  const shutdown = () => {
    console.log('\n[proto-sniff] stopping…');
    backend.stop();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await runPromise;
  } finally {
    if (timer) clearTimeout(timer);
    outStream?.end();
    const snapshot = registry.snapshot();
    const proposal = proposeDecodingScheme(snapshot, opts.targetHost);
    const proposalPath = path.resolve(opts.proposalFile || 'proposal.json');
    fs.writeFileSync(proposalPath, `${JSON.stringify(proposal, null, 2)}\n`);
    printSummary(snapshot, proposal, opts, proposalPath);
  }
}

function printRecord(record) {
  const ip = record.ip;
  const app = record.stream?.application || record.application;
  const line = [
    record.ts,
    ip ? `${ip.srcIp}:${ip.srcPort || '-'} → ${ip.dstIp}:${ip.dstPort || '-'}` : 'ARP',
    app?.scheme || '',
    app?.unknown?.contentClass || '',
  ].join(' | ');
  console.log(line);
  if (app?.unknown) {
    console.log('   unknown:', JSON.stringify({
      entropy: app.unknown.entropy,
      prefix: app.unknown.prefixHex4,
      hints: app.unknown.hints,
      lengthFields: app.unknown.lengthFields,
    }));
  }
  if (app?.decoded) {
    console.log('   known:', JSON.stringify(app.decoded, null, 2).split('\n').join('\n   '));
  }
}

function printSummary(snapshot, proposal, opts, proposalPath) {
  console.log('\n--- capture summary ---');
  console.log(`target:    ${opts.targetHost}`);
  console.log(`packets:   ${snapshot.packetCount}`);
  console.log(`flows:     ${snapshot.flowCount}`);
  console.log(`unknown:   ${snapshot.unknownCount} payloads without known decoder`);
  if (opts.output) console.log(`log:       ${path.resolve(opts.output)}`);
  console.log(`proposal:  ${proposalPath}`);

  const unknownFlows = proposal.flowProposals.filter((p) => p.confidence !== 'high' || p.proposedFraming?.includes('unknown'));
  if (unknownFlows.length) {
    console.log('\n--- proposed decoding (unknown flows) ---');
    for (const p of unknownFlows.slice(0, 8)) {
      console.log(`\n${p.flow}  port=${p.port || '?'}  framing=${p.proposedFraming}  (${p.confidence})`);
      if (p.evidence?.length) console.log(`  evidence: ${p.evidence.join('; ')}`);
      if (p.decodePseudocode) console.log(`  ${p.decodePseudocode.split('\n').join('\n  ')}`);
    }
  }
}

main().catch((err) => {
  console.error('[proto-sniff] ERROR:', err.message || err);
  process.exit(1);
});
