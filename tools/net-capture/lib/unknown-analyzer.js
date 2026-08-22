'use strict';

/** Shannon entropy in bits per byte (0–8). High ≈ encrypted/compressed. */
function entropy(buf) {
  if (!buf?.length) return 0;
  const freq = new Array(256).fill(0);
  for (let i = 0; i < buf.length; i += 1) freq[buf[i]] += 1;
  let h = 0;
  for (let i = 0; i < 256; i += 1) {
    if (!freq[i]) continue;
    const p = freq[i] / buf.length;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 1000) / 1000;
}

function printableRatio(buf) {
  if (!buf?.length) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) n += 1;
  }
  return Math.round((n / buf.length) * 1000) / 1000;
}

function asciiPreview(buf, max = 64) {
  let s = '';
  const n = Math.min(buf.length, max);
  for (let i = 0; i < n; i += 1) {
    const b = buf[i];
    s += b >= 32 && b < 127 ? String.fromCharCode(b) : '.';
  }
  return s;
}

const MAGIC = [
  { hex: '47455420', label: 'HTTP GET' },
  { hex: '48545450', label: 'HTTP response' },
  { hex: '504f5354', label: 'HTTP POST' },
  { hex: '7b', label: 'JSON object' },
  { hex: '5b', label: 'JSON array' },
  { hex: '89504e47', label: 'PNG' },
  { hex: 'ffd8ff', label: 'JPEG' },
  { hex: '000001ba', label: 'MPEG-PS' },
];

function detectMagic(buf) {
  if (!buf?.length) return [];
  const hex = buf.toString('hex');
  return MAGIC.filter((m) => hex.startsWith(m.hex)).map((m) => m.label);
}

function detectDelimiters(buf) {
  const found = [];
  const sample = buf.subarray(0, Math.min(buf.length, 512)).toString('latin1');
  if (sample.includes('\r\n')) found.push('CRLF');
  if (sample.includes('\n') && !found.includes('CRLF')) found.push('LF');
  if (buf.includes(0)) found.push('NUL');
  if (sample.includes('\x1e')) found.push('RS (0x1e)');
  return found;
}

/**
 * Guess length-prefixed framing: does uint16/uint32 at offset match rest of buffer?
 */
function lengthFieldHypotheses(buf) {
  if (!buf || buf.length < 4) return [];
  const hypotheses = [];
  const total = buf.length;
  const tries = [
    { off: 0, len: 2, be: true, name: 'uint16-be@0' },
    { off: 0, len: 2, be: false, name: 'uint16-le@0' },
    { off: 0, len: 4, be: true, name: 'uint32-be@0' },
    { off: 0, len: 4, be: false, name: 'uint32-le@0' },
    { off: 2, len: 2, be: true, name: 'uint16-be@2' },
    { off: 2, len: 2, be: false, name: 'uint16-le@2' },
  ];
  for (const t of tries) {
    if (t.off + t.len >= total) continue;
    let declared;
    if (t.len === 2) {
      declared = t.be ? buf.readUInt16BE(t.off) : buf.readUInt16LE(t.off);
    } else {
      declared = t.be ? buf.readUInt32BE(t.off) : buf.readUInt32LE(t.off);
    }
    const bodyLen = total - t.off - t.len;
    const matchExact = declared === bodyLen;
    const matchTotal = declared === total;
    const matchPayload = declared === total - t.off;
    if (matchExact || matchTotal || matchPayload) {
      hypotheses.push({
        format: t.name,
        declaredLength: declared,
        actualLength: total,
        bodyAfterHeader: bodyLen,
        match: matchExact ? 'body' : matchTotal ? 'frame' : 'remainder',
      });
    }
  }
  return hypotheses;
}

function fixedHeaderPrefix(buf, prefixLen = 4) {
  if (!buf || buf.length < prefixLen) return null;
  return buf.subarray(0, prefixLen).toString('hex');
}

function looksLikeTls(buf) {
  return buf?.length >= 3 && buf[0] === 0x16 && buf[1] === 0x03;
}

function looksLikeMqtt(buf) {
  if (!buf || buf.length < 2) return false;
  const type = (buf[0] >> 4) & 0x0f;
  return type >= 1 && type <= 14;
}

/**
 * Deep analysis of an unknown or partially-known payload.
 */
function analyzeUnknown(buf, ctx = {}) {
  if (!buf?.length) return { empty: true };

  const analysis = {
    length: buf.length,
    entropy: entropy(buf),
    printableRatio: printableRatio(buf),
    magic: detectMagic(buf),
    delimiters: detectDelimiters(buf),
    prefixHex4: fixedHeaderPrefix(buf, 4),
    prefixHex8: fixedHeaderPrefix(buf, 8),
    ascii: asciiPreview(buf),
    hexPreview: buf.subarray(0, 32).toString('hex'),
    lengthFields: lengthFieldHypotheses(buf),
    hints: [],
  };

  if (analysis.entropy > 7.5) analysis.hints.push('high-entropy: likely encrypted, compressed, or random');
  else if (analysis.entropy < 4.5 && analysis.printableRatio > 0.7) {
    analysis.hints.push('low-entropy text: try line-based or JSON/XML grammar');
  }

  if (looksLikeTls(buf)) analysis.hints.push('TLS record detected — need session keys to decode application data');
  if (looksLikeMqtt(buf) && !ctx.knownMqtt) analysis.hints.push('possible MQTT wire format (type nibble 1–14)');
  if (analysis.lengthFields.length) {
    analysis.hints.push(`length-prefixed framing candidate: ${analysis.lengthFields[0].format}`);
  }
  if (analysis.delimiters.includes('CRLF') && analysis.printableRatio > 0.5) {
    analysis.hints.push('text protocol with CRLF line endings');
  }
  if (analysis.magic.length) {
    analysis.hints.push(`known signature: ${analysis.magic.join(', ')}`);
  }

  analysis.contentClass = classifyContent(analysis);
  return analysis;
}

function classifyContent(a) {
  if (a.magic.some((m) => m.startsWith('HTTP'))) return 'text-http-like';
  if (a.magic.includes('JSON object') || a.magic.includes('JSON array')) return 'text-json';
  if (looksLikeTls(Buffer.from(a.hexPreview, 'hex'))) return 'binary-tls';
  if (a.entropy > 7.5) return 'binary-opaque';
  if (a.printableRatio > 0.85) return 'text-ascii';
  if (a.lengthFields.length) return 'binary-length-prefixed';
  return 'binary-unknown';
}

module.exports = {
  entropy,
  printableRatio,
  asciiPreview,
  analyzeUnknown,
  detectMagic,
  lengthFieldHypotheses,
  classifyContent,
};
