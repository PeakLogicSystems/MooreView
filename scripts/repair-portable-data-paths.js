#!/usr/bin/env node
'use strict';

/** Rewrite dev-machine absolute paths in data/*.json for portable PC installs. */
const fs = require('fs');
const path = require('path');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'data'));
const WIN_ABS = /^[A-Za-z]:[\\/]/;

function repairValue(key, value) {
  if (typeof value !== 'string') return value;
  if (!WIN_ABS.test(value)) return value;

  const norm = value.replace(/\\/g, '/').toLowerCase();
  if (key === 'modelsDir' || norm.includes('/data/models')) {
    return './models';
  }
  if (norm.endsWith('/data') || norm.includes('/est-pc/data')) {
    return './data';
  }
  return value;
}

function walk(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(walk);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') out[k] = repairValue(k, v);
    else out[k] = walk(v);
  }
  return out;
}

function shouldSkip(rel) {
  const norm = rel.replace(/\\/g, '/');
  const base = path.basename(rel);
  if (base === 'sys_log.json') return true;
  if (norm.includes('/sim-studies/')) return true;
  if (norm.includes('/.cache/')) return true;
  return false;
}

let changed = 0;
function processFile(fp) {
  const rel = path.relative(dataDir, fp);
  if (shouldSkip(rel)) return;
  let raw;
  try {
    raw = fs.readFileSync(fp, 'utf8');
    const doc = JSON.parse(raw);
    const next = walk(doc);
    const out = `${JSON.stringify(next, null, 2)}\n`;
    if (out !== raw && out !== raw.replace(/\r\n/g, '\n')) {
      fs.writeFileSync(fp, out, 'utf8');
      changed += 1;
      console.log(`[repair] ${rel}`);
    }
  } catch (err) {
    console.warn(`[repair] skip ${rel}: ${err.message}`);
  }
}

function visit(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Data dir not found: ${dir}`);
    process.exit(1);
  }
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    const st = fs.statSync(fp);
    if (st.isDirectory()) visit(fp);
    else if (name.endsWith('.json')) processFile(fp);
  }
}

visit(dataDir);
console.log(`[repair] done — updated ${changed} file(s) under ${dataDir}`);
