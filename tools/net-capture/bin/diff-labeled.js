#!/usr/bin/env node
'use strict';

/**
 * Diff labeled GW4 cloud bursts (port 44444) to find bytes that change between
 * dry / wet / dry2 captures sharing the same 8-byte session prefix.
 *
 * Usage:
 *   node bin/diff-labeled.js
 *   node bin/diff-labeled.js data/paired/manifest.json
 *   node bin/diff-labeled.js --dry data/paired/dry-*.pcapng --wet data/paired/wet-*.pcapng
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULT_MANIFEST = path.join(ROOT, 'data', 'paired', 'manifest.json');
const TSHARK = process.env.TSHARK || 'C:\\Program Files\\Wireshark\\tshark.exe';
const GW4_HOST = process.env.GW4_HOST || '192.168.1.241';

function usage() {
  console.log(`Usage:
  node bin/diff-labeled.js [manifest.json]
  node bin/diff-labeled.js --dry <pcap> --wet <pcap> [--dry2 <pcap>]

Workflow:
  .\\bin\\capture-labeled.ps1 -Label dry
  (wet sensor FA003A90)
  .\\bin\\capture-labeled.ps1 -Label wet
  (dry sensor)
  .\\bin\\capture-labeled.ps1 -Label dry2
  node bin/diff-labeled.js`);
}

function tshark(args) {
  return execSync(`"${TSHARK}" ${args}`, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
}

function parseFrame(buf) {
  const body = buf.slice(8);
  const len = body.readUInt16LE(0);
  const type = body.readUInt16LE(2);
  const word3 = body.readUInt16LE(4);
  const payload = body.slice(6);
  return {
    len,
    type,
    typeHex: `0x${type.toString(16).padStart(4, '0')}`,
    word3,
    word3Hex: `0x${word3.toString(16).padStart(4, '0')}`,
    payload,
  };
}

function extractBursts(pcapPath) {
  const abs = path.isAbsolute(pcapPath) ? pcapPath : path.join(ROOT, pcapPath);
  if (!fs.existsSync(abs)) throw new Error(`Missing pcap: ${abs}`);

  const filter = `tcp.port==44444 && tcp.len>0 && ip.src==${GW4_HOST}`;
  const tsv = tshark(
    `-r "${abs}" -Y "${filter}" -T fields -e frame.number -e frame.time_relative -e tcp.len -e data.data`,
  );
  if (!tsv) return [];

  return tsv
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [frameNum, timeRel, tcpLen, hex] = line.split('\t');
      const raw = Buffer.from(hex, 'hex');
      const parsed = parseFrame(raw);
      return {
        file: path.basename(abs),
        frameNum: Number(frameNum),
        timeRel: Number(timeRel),
        tcpLen: Number(tcpLen),
        nonce8: parsed.payload.slice(0, 8).toString('hex'),
        challenge13: parsed.payload.slice(0, 13).toString('hex'),
        ...parsed,
      };
    });
}

function xorBuffers(a, b) {
  const n = Math.min(a.length, b.length);
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = a[i] ^ b[i];
  return out;
}

function diffOffsets(xor) {
  const offsets = [];
  for (let i = 0; i < xor.length; i++) {
    if (xor[i] !== 0) offsets.push(i);
  }
  return offsets;
}

function summarizeOffsets(offsets, maxShow = 24) {
  if (!offsets.length) return 'none';
  const head = offsets.slice(0, maxShow).join(', ');
  return offsets.length > maxShow ? `${head}, ... (+${offsets.length - maxShow} more)` : head;
}

function groupByNonce(bursts) {
  const map = new Map();
  for (const b of bursts) {
    const key = `${b.typeHex}:${b.nonce8}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return map;
}

function pickLargestPayload(bursts) {
  return bursts.reduce((best, b) => (b.payload.length > best.payload.length ? b : best), bursts[0]);
}

function parseArgs(argv) {
  const out = { manifest: null, dry: null, wet: null, dry2: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') return { help: true };
    if (a === '--dry') out.dry = argv[++i];
    else if (a === '--wet') out.wet = argv[++i];
    else if (a === '--dry2') out.dry2 = argv[++i];
    else if (!a.startsWith('-')) out.manifest = a;
  }
  return out;
}

function loadFromManifest(manifestPath) {
  const abs = path.isAbsolute(manifestPath) ? manifestPath : path.join(ROOT, manifestPath);
  let text = fs.readFileSync(abs, 'utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.captures || [];
  const byLabel = {};
  for (const row of list) {
    const pcap = path.join(path.dirname(abs), row.file);
    byLabel[row.label] = { pcap, meta: row };
  }
  return byLabel;
}

function analyzePair(labelA, burstA, labelB, burstB) {
  const xor = xorBuffers(burstA.payload, burstB.payload);
  const offsets = diffOffsets(xor);
  const skipNonce = diffOffsets(xor.slice(8));
  return {
    labelA,
    labelB,
    fileA: burstA.file,
    frameA: burstA.frameNum,
    fileB: burstB.file,
    frameB: burstB.frameNum,
    type: burstA.typeHex,
    nonce8: burstA.nonce8,
    lenA: burstA.payload.length,
    lenB: burstB.payload.length,
    diffBytes: offsets.length,
    diffOffsets: offsets,
    diffAfterNonce8: skipNonce.length,
    xorHead: xor.slice(0, 32).toString('hex'),
    xorNonce8: xor.slice(0, 8).toString('hex'),
  };
}

function printBurstTable(label, bursts) {
  console.log(`\n--- ${label} (${bursts.length} outbound cloud payload(s)) ---`);
  if (!bursts.length) {
    console.log('  (none — extend capture or wait for GW4 bulk upload)');
    return;
  }
  for (const b of bursts) {
    console.log(
      `  #${b.frameNum} @${b.timeRel.toFixed(1)}s type=${b.typeHex} seq=${b.word3Hex} len=${b.payload.length} nonce8=${b.nonce8}`,
    );
  }
}

function main() {
  if (!fs.existsSync(TSHARK)) {
    console.error(`tshark not found: ${TSHARK}`);
    process.exit(1);
  }

  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  let dryPath;
  let wetPath;
  let dry2Path;
  let meta = {};

  if (args.dry || args.wet) {
    dryPath = args.dry;
    wetPath = args.wet;
    dry2Path = args.dry2;
  } else {
    const manifest = args.manifest || DEFAULT_MANIFEST;
    if (!fs.existsSync(manifest)) {
      console.error(`No manifest at ${manifest}`);
      console.error('Run labeled captures first: .\\bin\\capture-labeled.ps1 -Label dry');
      usage();
      process.exit(1);
    }
    const byLabel = loadFromManifest(manifest);
    meta = byLabel;
    dryPath = byLabel.dry?.pcap;
    wetPath = byLabel.wet?.pcap;
    dry2Path = byLabel.dry2?.pcap;
  }

  console.log('=== Paired capture diff (GW4 port 44444) ===\n');

  const sets = [];
  if (dryPath) sets.push({ label: 'dry', bursts: extractBursts(dryPath) });
  if (wetPath) sets.push({ label: 'wet', bursts: extractBursts(wetPath) });
  if (dry2Path) sets.push({ label: 'dry2', bursts: extractBursts(dry2Path) });

  for (const s of sets) printBurstTable(s.label, s.bursts);

  const allBursts = sets.flatMap((s) => s.bursts.map((b) => ({ ...b, stateLabel: s.label })));
  const byNonce = groupByNonce(allBursts);

  console.log('\n=== Session groups (type + nonce8) ===');
  for (const [key, bursts] of byNonce.entries()) {
    const labels = [...new Set(bursts.map((b) => b.stateLabel))].join(', ');
    console.log(`  ${key}  [${labels}]  ${bursts.length} frame(s)`);
  }

  console.log('\n=== XOR pairs (same type + nonce8, largest payload each label) ===');
  const pairs = [];
  for (const [key, bursts] of byNonce.entries()) {
    const byState = new Map();
    for (const b of bursts) {
      if (!byState.has(b.stateLabel)) byState.set(b.stateLabel, []);
      byState.get(b.stateLabel).push(b);
    }
    const states = [...byState.keys()];
    if (states.length < 2) continue;

    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        const a = pickLargestPayload(byState.get(states[i]));
        const b = pickLargestPayload(byState.get(states[j]));
        if (a.nonce8 !== b.nonce8 || a.typeHex !== b.typeHex) continue;
        pairs.push(analyzePair(states[i], a, states[j], b));
      }
    }
  }

  if (!pairs.length) {
    console.log('  No pairs with matching nonce8 across labels.');
    console.log('  Tips:');
    console.log('  - Capture soon after a GW4 bulk upload (watch for tcp.len > 50 on port 44444)');
    console.log('  - Keep captures short (5 min) so session nonce may persist across dry/wet/dry2');
    console.log('  - Trigger wet during the WET capture window only');
    return;
  }

  for (const p of pairs) {
    console.log(`\n  ${p.labelA} vs ${p.labelB}  type=${p.type}  nonce8=${p.nonce8}`);
    console.log(`    ${p.fileA}#${p.frameA} (${p.lenA}B)  vs  ${p.fileB}#${p.frameB} (${p.lenB}B)`);
    console.log(`    differing bytes: ${p.diffBytes} / ${Math.min(p.lenA, p.lenB)}`);
    console.log(`    differing after byte 8 (past nonce): ${p.diffAfterNonce8}`);
    console.log(`    xor nonce8: ${p.xorNonce8} ${p.xorNonce8 === '0000000000000000' ? '(identical prefix)' : '(prefix differs — different sessions)'}`);
    console.log(`    xor head (32B): ${p.xorHead}`);
    console.log(`    diff offsets: ${summarizeOffsets(p.diffOffsets)}`);

    if (p.diffAfterNonce8 > 0 && p.diffAfterNonce8 < 40) {
      console.log('    ** candidate leak-state region (few byte changes after nonce) **');
    }
  }

  const dryWet = pairs.find((p) => p.labelA === 'dry' && p.labelB === 'wet');
  const wetDry2 = pairs.find((p) => p.labelA === 'wet' && p.labelB === 'dry2');
  if (dryWet && wetDry2) {
    const a = xorBuffers(
      Buffer.from(dryWet.xorHead, 'hex'),
      Buffer.from(wetDry2.xorHead, 'hex'),
    );
    const stable = diffOffsets(a).length === 0;
    console.log(`\n=== Consistency check (dry⊕wet vs wet⊕dry2 head) ===`);
    console.log(stable ? '  Head XOR pattern differs (expected if state toggled)' : '  Compare full offsets in report above');
  }

  console.log('\nDone. If diff offsets cluster after byte 13, leak flag may live in encrypted region.');
  console.log('Re-run after three fresh labeled captures in one session.');
}

main();
