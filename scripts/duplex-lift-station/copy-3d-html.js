'use strict';

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../../../est-pc/public/samples/duplex-lift-station-ortho-3d.html');
const dst = path.join(__dirname, '../../public/samples/duplex-lift-station-ortho-3d.html');

let s = fs.readFileSync(src, 'utf8');
if (!s.includes('mvApiRoot')) {
  s = s.replace(
    '    const tagValues = new Map();',
    `    const tagValues = new Map();
    let mvApiRoot = String(window.MV_API_BASE || '').trim();
    if (!mvApiRoot) {
      try {
        if (window.parent !== window && window.parent.MOOREVIEW_API_BASE) {
          mvApiRoot = String(window.parent.MOOREVIEW_API_BASE).trim();
        }
      } catch { /* cross-origin */ }
    }
    if (!mvApiRoot) mvApiRoot = '/api';`,
  );
  s = s.replace(
    "fetch('/api/dashboard', { credentials: 'same-origin' })",
    "fetch(`${mvApiRoot}/dashboard`, { credentials: 'same-origin' })",
  );
  s = s.replace(
    "if (data.type === 'mv-hmi-poll-config' && Number.isFinite(Number(data.pollMs))) {",
    `if (data.type === 'mv-hmi-poll-config') {
        if (typeof data.apiBase === 'string' && data.apiBase.trim()) {
          mvApiRoot = data.apiBase.trim();
        }
        if (Number.isFinite(Number(data.pollMs))) {`,
  );
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, s);
console.log('wrote', dst, fs.statSync(dst).size);
