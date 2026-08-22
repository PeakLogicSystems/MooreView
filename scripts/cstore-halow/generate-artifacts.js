#!/usr/bin/env node
'use strict';

/**
 * Write c-store HaLow fixture artifacts (manifest + CSV).
 * Usage: node scripts/cstore-halow/generate-artifacts.js
 */

const fs = require('fs');
const path = require('path');
const { manifest, halowNodeCsvLines } = require('./cstore-halow-data');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_MANIFEST = path.join(ROOT, 'st', 'fixtures', 'cstore_halow.json');
const OUT_CSV = path.join(ROOT, 'st', 'fixtures', 'cstore_halow_nodes.csv');

fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
fs.writeFileSync(OUT_MANIFEST, `${JSON.stringify(manifest(), null, 2)}\n`);
fs.writeFileSync(OUT_CSV, `${halowNodeCsvLines().join('\n')}\n`);

console.log('Wrote', path.relative(ROOT, OUT_MANIFEST));
console.log('Wrote', path.relative(ROOT, OUT_CSV));
