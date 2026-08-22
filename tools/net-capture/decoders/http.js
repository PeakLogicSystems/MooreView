'use strict';

function decodeHttp(buf) {
  if (!buf || buf.length < 8) return null;
  const text = buf.toString('latin1');
  if (!/^((GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) |HTTP\/)/.test(text)) return null;

  const headerEnd = text.indexOf('\r\n\r\n');
  const head = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const bodyRaw = headerEnd >= 0 ? buf.subarray(headerEnd + 4) : Buffer.alloc(0);
  const lines = head.split('\r\n');
  const first = lines[0] || '';

  const req = first.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) (\S+) HTTP\/(\d\.\d)$/);
  if (req) {
    const headers = parseHeaders(lines.slice(1));
    return {
      protocol: 'http',
      role: 'request',
      method: req[1],
      path: req[2],
      httpVersion: req[3],
      headers,
      bodyPreview: previewBody(bodyRaw, headers['content-type']),
    };
  }

  const res = first.match(/^HTTP\/(\d\.\d) (\d{3})(?: (.+))?$/);
  if (res) {
    const headers = parseHeaders(lines.slice(1));
    return {
      protocol: 'http',
      role: 'response',
      httpVersion: res[1],
      status: Number(res[2]),
      statusText: res[3] || '',
      headers,
      bodyPreview: previewBody(bodyRaw, headers['content-type']),
    };
  }

  return null;
}

function parseHeaders(lines) {
  const h = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    h[key] = h[key] ? `${h[key]}; ${val}` : val;
  }
  return h;
}

function previewBody(buf, contentType) {
  if (!buf.length) return null;
  const ct = String(contentType || '').toLowerCase();
  if (ct.includes('json') || looksLikeJson(buf)) {
    const text = buf.toString('utf8');
    try {
      const j = JSON.parse(text);
      return { type: 'json', value: j, rawLen: buf.length };
    } catch {
      return { type: 'text', text: text.slice(0, 400), rawLen: buf.length };
    }
  }
  if (ct.includes('text') || isMostlyText(buf)) {
    return { type: 'text', text: buf.toString('utf8').slice(0, 400), rawLen: buf.length };
  }
  return {
    type: 'binary',
    hex: buf.subarray(0, 48).toString('hex'),
    rawLen: buf.length,
  };
}

function looksLikeJson(buf) {
  const c = buf[0];
  return c === 0x7b || c === 0x5b;
}

function isMostlyText(buf) {
  let printable = 0;
  const n = Math.min(buf.length, 200);
  for (let i = 0; i < n; i += 1) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) printable += 1;
  }
  return printable / n > 0.85;
}

module.exports = { decodeHttp };
