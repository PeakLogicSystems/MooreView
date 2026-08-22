#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const zlib = require('zlib');
const crypto = require('crypto');
const path = require('path');

const TSHARK = 'C:\\Program Files\\Wireshark\\tshark.exe';
const CAP_DIR = path.join(__dirname, '..');

const FRAMES = [
  { file: 'capture-241-1hr-2.pcapng', n: 68, label: 'bulk-540-wet-sync' },
  { file: 'capture-241-1hr-2.pcapng', n: 70, label: 'bulk-78-followup' },
  { file: 'capture-241-1hr-2.pcapng', n: 65, label: 'handshake-26' },
  { file: 'capture-241-1hr.pcapng', n: 19, label: 'bulk-216' },
  { file: 'capture-241-1hr.pcapng', n: 22, label: 'bulk-78' },
  { file: 'capture-241-1hr.pcapng', n: 15, label: 'handshake-26-b' },
  { file: 'capture-241-1hr.pcapng', n: 9, label: 'session-79' },
  { file: 'capture-241-1hr.pcapng', n: 17, label: 'server-ack-21' },
];

function tsharkHex(file, frameNum) {
  const p = path.join(CAP_DIR, file);
  const out = execSync(
    `"${TSHARK}" -r "${p}" -Y "frame.number==${frameNum}" -T fields -e data.data`,
    { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 },
  ).trim();
  return Buffer.from(out, 'hex');
}

function parseFrame(buf) {
  const magic = buf.slice(0, 8);
  const body = buf.slice(8);
  const len = body.readUInt16LE(0);
  const type = body.readUInt16LE(2);
  const word3 = body.readUInt16LE(4);
  const payload = body.slice(6);
  return {
    magic: magic.toString('hex'),
    len,
    type: `0x${type.toString(16).padStart(4, '0')}`,
    word3: `0x${word3.toString(16).padStart(4, '0')}`,
    payload,
    header: body.slice(0, 6),
  };
}

function entropy(buf) {
  const freq = new Array(256).fill(0);
  for (const b of buf) freq[b]++;
  let e = 0;
  for (const c of freq) {
    if (!c) continue;
    const p = c / buf.length;
    e -= p * Math.log2(p);
  }
  return e;
}

function printableRatio(buf) {
  let n = 0;
  for (const b of buf) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) n++;
  }
  return n / buf.length;
}

function scorePrintable(buf) {
  return printableRatio(buf);
}

function xorBuf(a, b) {
  const n = Math.min(a.length, b.length);
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) out[i] = a[i] ^ b[i];
  return out;
}

function xorRepeating(buf, key) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] ^ key[i % key.length];
  return out;
}

function tryZlib(buf) {
  for (const fn of [
    (b) => zlib.inflateSync(b),
    (b) => zlib.inflateRawSync(b),
    (b) => zlib.unzipSync(b),
    (b) => zlib.brotliDecompressSync(b),
  ]) {
    try {
      const out = fn(buf);
      return { ok: true, len: out.length, preview: out.slice(0, 120).toString('utf8') };
    } catch (_) {}
  }
  return { ok: false };
}

function tryAes(buf, key, iv) {
  const results = [];
  for (const mode of ['aes-128-ecb', 'aes-192-ecb', 'aes-256-ecb']) {
    try {
      const d = crypto.createDecipheriv(mode, key.slice(0, mode.includes('256') ? 32 : mode.includes('192') ? 24 : 16), null);
      d.setAutoPadding(false);
      const out = Buffer.concat([d.update(buf), d.final()]);
      results.push({ mode, score: scorePrintable(out), preview: out.slice(0, 80).toString('hex') });
    } catch (_) {}
  }
  if (iv) {
    for (const mode of ['aes-128-cbc', 'aes-256-cbc']) {
      try {
        const d = crypto.createDecipheriv(mode, key.slice(0, mode.includes('256') ? 32 : 16), iv.slice(0, 16));
        d.setAutoPadding(false);
        const out = Buffer.concat([d.update(buf), d.final()]);
        results.push({ mode, score: scorePrintable(out), preview: out.slice(0, 80).toString('hex') });
      } catch (_) {}
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

function singleByteXorScan(buf) {
  let best = { key: 0, score: 0, preview: '' };
  for (let k = 0; k < 256; k++) {
    const out = xorRepeating(buf, Buffer.from([k]));
    const s = scorePrintable(out);
    if (s > best.score) {
      best = { key: k, score: s, preview: out.slice(0, 80).toString('utf8').replace(/[^\x20-\x7e]/g, '.') };
    }
  }
  return best;
}

function nibbleSwap(buf) {
  const out = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) {
    out[i] = ((buf[i] & 0x0f) << 4) | ((buf[i] & 0xf0) >> 4);
  }
  return out;
}

function findRepeatingBlocks(buf, blockSize = 16) {
  const seen = new Map();
  let repeats = 0;
  for (let i = 0; i + blockSize <= buf.length; i += blockSize) {
    const k = buf.slice(i, i + blockSize).toString('hex');
    seen.set(k, (seen.get(k) || 0) + 1);
    if (seen.get(k) === 2) repeats++;
  }
  return repeats;
}

function deviceIdCandidates() {
  const id = 'FA003A90';
  return [
    Buffer.from(id, 'ascii'),
    Buffer.from(id, 'hex'),
    Buffer.alloc(4).writeUInt32BE(0xfa003a90) && Buffer.from([0xfa, 0x00, 0x3a, 0x90]),
    Buffer.from([0x90, 0x3a, 0x00, 0xfa]),
  ];
}

function main() {
  const packets = FRAMES.map((f) => {
    const raw = tsharkHex(f.file, f.n);
    const parsed = parseFrame(raw);
    return { ...f, raw, ...parsed };
  });

  console.log('=== PARSED FRAMES ===');
  for (const p of packets) {
    console.log(
      `${p.label}: total=${p.raw.length} type=${p.type} w3=${p.word3} payload=${p.payload.length}B entropy=${entropy(p.payload).toFixed(2)}`,
    );
  }

  const bulk540 = packets.find((p) => p.label === 'bulk-540-wet-sync');
  const bulk216 = packets.find((p) => p.label === 'bulk-216');
  const hsA = packets.find((p) => p.label === 'handshake-26');
  const hsB = packets.find((p) => p.label === 'handshake-26-b');
  const srvAck = packets.find((p) => p.label === 'server-ack-21');
  const session79 = packets.find((p) => p.label === 'session-79');

  console.log('\n=== PAYLOAD PREFIX (first 32 B) ===');
  for (const p of packets.filter((x) => x.payload.length >= 13)) {
    console.log(`${p.label}: ${p.payload.slice(0, 32).toString('hex')}`);
  }

  console.log('\n=== 1. COMPRESSION (zlib/gzip/raw) ===');
  for (const p of [bulk540, bulk216, bulk540.payload.slice(13)]) {
    const label = typeof p === 'object' && p.label ? p.label : 'bulk540-skip13';
    const buf = Buffer.isBuffer(p) ? p : p.payload;
    const r = tryZlib(buf);
    console.log(`${label}: ${r.ok ? `OK len=${r.len} "${r.preview.slice(0, 60)}"` : 'failed'}`);
  }

  console.log('\n=== 2. SINGLE-BYTE XOR (best printable score) ===');
  for (const p of [bulk540, bulk216, hsA]) {
    const b = singleByteXorScan(p.payload);
    console.log(`${p.label}: key=0x${b.key.toString(16)} score=${b.score.toFixed(2)} preview="${b.preview}"`);
  }

  console.log('\n=== 3. REPEATING-KEY XOR (handshake / server nonce) ===');
  const keys = [
    { name: 'hs-challenge', key: hsA.payload },
    { name: 'hs-challenge-b', key: hsB.payload },
    { name: 'srv-ack-payload', key: srvAck.payload },
    { name: 'session79', key: session79.payload },
    { name: 'hs+ack', key: Buffer.concat([hsA.payload, srvAck.payload]) },
    { name: 'magic', key: Buffer.from('fefefefefefefefe', 'hex') },
  ];
  for (const { name, key } of keys) {
    const out = xorRepeating(bulk540.payload, key);
    const s = scorePrintable(out);
    console.log(
      `${name}: printable=${s.toFixed(2)} preview="${out.slice(0, 64).toString('utf8').replace(/[^\x20-\x7e]/g, '.')}"`,
    );
    if (out.includes('FA003A90') || out.includes('Leak') || out.includes('GW4')) {
      console.log('  *** ASCII HIT ***', out.toString('utf8'));
    }
  }

  console.log('\n=== 4. XOR two ciphertexts (216 vs 540 bulk) ===');
  const x = xorBuf(bulk216.payload, bulk540.payload);
  console.log(`xor entropy=${entropy(x).toFixed(2)} printable=${scorePrintable(x).toFixed(2)}`);
  console.log(`xor first64=${x.slice(0, 64).toString('hex')}`);
  const x2 = xorBuf(bulk216.payload, bulk540.payload.slice(0, bulk216.payload.length));
  console.log(`aligned xor printable=${scorePrintable(x2).toFixed(2)} preview="${x2.slice(0, 48).toString('utf8').replace(/[^\x20-\x7e]/g, '.')}"`);

  console.log('\n=== 5. AES-ECB/CBC with handshake-derived keys ===');
  const keyCandidates = [
  Buffer.from('041b2621ee43830f03380b46', 'hex'),
    hsA.payload,
    srvAck.payload,
    crypto.createHash('md5').update(hsA.payload).digest(),
    crypto.createHash('sha256').update(hsA.payload).digest(),
  ];
  for (const key of keyCandidates) {
    const iv = bulk540.payload.slice(0, 16);
    const body = bulk540.payload.slice(16);
    const res = tryAes(body, key, iv);
    if (res.length) {
      console.log(`key=${key.slice(0, 8).toString('hex')}... best=${res[0].mode} score=${res[0].score.toFixed(2)}`);
    }
  }

  console.log('\n=== 6. NIBBLE SWAP / BIT ROT ===');
  const nib = nibbleSwap(bulk540.payload);
  console.log(`nibble swap printable=${scorePrintable(nib).toFixed(2)} zlib=${tryZlib(nib).ok}`);

  console.log('\n=== 7. ECB BLOCK REPEAT (16-byte) ===');
  for (const p of [bulk540, bulk216]) {
    console.log(`${p.label}: repeated-16b-blocks=${findRepeatingBlocks(p.payload, 16)}`);
  }

  console.log('\n=== 8. DEVICE ID XOR SCAN ===');
  for (const key of deviceIdCandidates()) {
    const out = xorRepeating(bulk540.payload, key);
    const idx = out.indexOf('FA003A90');
    console.log(`key=${key.toString('hex')}: printable=${scorePrintable(out).toFixed(2)} FA003A90@${idx}`);
  }

  console.log('\n=== 9. STRUCTURED TLV SCAN (tag 0x8774 from prior note) ===');
  const p = bulk540.payload;
  for (let i = 0; i < p.length - 4; i++) {
    if (p[i] === 0x20 && p[i + 1] === 0x87 && p[i + 2] === 0x74) {
      const len = p.readUInt16LE(i + 3) || p[i + 3];
      console.log(`possible TLV @${i} len byte=${p[i + 3]} next=${p.slice(i, i + 12).toString('hex')}`);
    }
  }

  console.log('\n=== 10. JSON / KEYWORD SLIDING WINDOW ===');
  const needles = ['FA003A90', 'Leak', 'Wet', 'Dry', 'GW4', 'DA211240', '{"', 'leak'];
  for (const needle of needles) {
    for (const { name, key } of keys) {
      const out = xorRepeating(bulk540.payload, key);
      if (out.toString('latin1').includes(needle)) console.log(`HIT "${needle}" with xor key ${name}`);
    }
  }

  // Compare handshake payloads - same challenge?
  console.log('\n=== HANDSHAKE STABILITY ===');
  console.log(`hsA=${hsA.payload.toString('hex')}`);
  console.log(`hsB=${hsB.payload.toString('hex')}`);
  console.log(`identical=${hsA.payload.equals(hsB.payload)}`);
  console.log(`bulk540 starts with hs prefix=${bulk540.payload.slice(0, 13).equals(hsB.payload)}`);
  console.log(`bulk540 prefix13=${bulk540.payload.slice(0, 13).toString('hex')}`);
  console.log(`hsB=${hsB.payload.toString('hex')}`);

  const f78a = packets.find((p) => p.label === 'bulk-78-followup');
  const f78b = packets.find((p) => p.label === 'bulk-78');
  console.log('\n=== 11. 64B FOLLOWUP COMPARE (same type 0x1123) ===');
  console.log(`f78a=${f78a.payload.toString('hex')}`);
  console.log(`f78b=${f78b.payload.toString('hex')}`);
  const x78 = xorBuf(f78a.payload, f78b.payload);
  console.log(`xor printable=${scorePrintable(x78).toFixed(2)} entropy=${entropy(x78).toFixed(2)}`);
  console.log(`shared4=${f78a.payload.slice(0, 4).equals(f78b.payload.slice(0, 4))} a=${f78a.payload.slice(0, 8).toString('hex')} b=${f78b.payload.slice(0, 8).toString('hex')}`);

  console.log('\n=== 12. BULK540 AFTER 13B CHALLENGE PREFIX ===');
  const hsChallenge = hsB.payload; // 041b2621ee43830f03380b46
  const body540 = bulk540.payload.slice(13);
  console.log(`body len=${body540.length} entropy=${entropy(body540).toFixed(2)}`);
  console.log(`xor-with-bulk216 printable=${scorePrintable(xorBuf(body540, bulk216.payload)).toFixed(2)}`);

  function rc4(key, data) {
    const S = new Array(256);
    for (let i = 0; i < 256; i++) S[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + S[i] + key[i % key.length]) % 256;
      [S[i], S[j]] = [S[j], S[i]];
    }
    let i = 0;
    j = 0;
    const o = Buffer.alloc(data.length);
    for (let k = 0; k < data.length; k++) {
      i = (i + 1) % 256;
      j = (j + S[i]) % 256;
      [S[i], S[j]] = [S[j], S[i]];
      o[k] = data[k] ^ S[(S[i] + S[j]) % 256];
    }
    return o;
  }

  console.log('\n=== 13. RC4 WITH HANDSHAKE KEYS ===');
  for (const [name, key] of [
    ['hs-challenge', hsChallenge],
    ['srv-ack', srvAck.payload],
    ['f78-prefix', f78a.payload.slice(0, 8)],
    ['session79', session79.payload.slice(0, 16)],
  ]) {
    const out = rc4(key, body540);
    console.log(`${name}: printable=${scorePrintable(out).toFixed(2)} head=${out.slice(0, 32).toString('hex')}`);
  }

  console.log('\n=== 14. AES-CTR / ChaCha20-LIKE ===');
  for (const [name, key] of [
    ['hs-pad16', Buffer.concat([hsChallenge, Buffer.alloc(3)])],
    ['md5-hs', crypto.createHash('md5').update(hsChallenge).digest()],
    ['sha256-hs', crypto.createHash('sha256').update(hsChallenge).digest().slice(0, 16)],
  ]) {
    try {
      const iv = Buffer.alloc(16, 0);
      const d = crypto.createDecipheriv('aes-128-ctr', key.slice(0, 16), iv);
      const out = Buffer.concat([d.update(body540.slice(0, 128)), d.final()]);
      console.log(`${name}: printable=${scorePrintable(out).toFixed(2)} head=${out.slice(0, 32).toString('hex')}`);
    } catch (e) {
      console.log(`${name}: err ${e.message}`);
    }
  }

  console.log('\n=== 15. SUBTRACT MOD 256 (delta encoding) ===');
  const deltas = [];
  for (let i = 1; i < Math.min(body540.length, 64); i++) {
    deltas.push((body540[i] - body540[i - 1] + 256) % 256);
  }
  const deltaBuf = Buffer.from(deltas);
  console.log(`delta printable=${scorePrintable(deltaBuf).toFixed(2)} head=${deltaBuf.slice(0, 24).toString('hex')}`);

  console.log('\n=== 16. BASE64 / ASCII85 CHECK ===');
  const b64chars = /^[A-Za-z0-9+/=]+$/;
  console.log(`bulk540 payload looks b64=${b64chars.test(body540.toString('latin1'))}`);
}

main();
