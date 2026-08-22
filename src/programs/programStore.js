'use strict';

const fs = require('fs');
const path = require('path');
const { ST_DIR, DEFAULT_PROGRAM } = require('../config');
const persistence = require('../persistence');

function ensureStDir() {
  if (!fs.existsSync(ST_DIR)) fs.mkdirSync(ST_DIR, { recursive: true });
}

function sanitizeRel(rel) {
  const norm = path.normalize(rel || '').replace(/^(\.\.(\/|\\|$))+/, '');
  return norm.replace(/\\/g, '/');
}

function resolvePath(rel) {
  ensureStDir();
  return path.join(ST_DIR, sanitizeRel(rel));
}

function activeRel() {
  const s = persistence.readJson('settings.json', {});
  if (s.activeProgram === null || s.activeProgram === '') return '';
  if (s.activeProgram) return sanitizeRel(s.activeProgram);
  return sanitizeRel(DEFAULT_PROGRAM);
}

function setActive(rel) {
  const s = persistence.readJson('settings.json', {});
  s.activeProgram = sanitizeRel(rel);
  persistence.writeJson('settings.json', s);
  return s.activeProgram;
}

function clearActive() {
  const s = persistence.readJson('settings.json', {});
  s.activeProgram = null;
  persistence.writeJson('settings.json', s);
  return '';
}

function readActive() {
  const rel = activeRel();
  if (!rel) return '';
  return readProgram(rel);
}

function writeActive(source) {
  writeProgram(activeRel(), source);
}

function programExists(rel) {
  return fs.existsSync(resolvePath(rel));
}

function readProgram(rel) {
  const fp = resolvePath(rel);
  if (!fs.existsSync(fp)) return '';
  return fs.readFileSync(fp, 'utf8');
}

/** Coerce API/import input to ST source text — rejects deploy AST objects with a clear error. */
function normalizeProgramSource(source) {
  if (source == null) return '';
  if (typeof source === 'string') return source;
  if (Buffer.isBuffer(source)) return source.toString('utf8');
  if (typeof source === 'object') {
    const nested = source.source ?? source.text ?? source.content ?? source.program;
    if (typeof nested === 'string') return nested;
  }
  throw Object.assign(
    new Error('Program source must be ST text (string), not a JSON object'),
    { status: 400 },
  );
}

function writeProgram(rel, source) {
  const text = normalizeProgramSource(source);
  const fp = resolvePath(rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, text, 'utf8');
}

/** Map a picked filename to a path under st/ (e.g. logic/my_prog.st). */
function suggestRelFromFilename(filename) {
  const raw = String(filename || 'program.st').replace(/\\/g, '/');
  const base = path.basename(raw);
  const stem = base.replace(/\.st$/i, '') || 'program';
  const name = base.toLowerCase().endsWith('.st') ? base : `${stem}.st`;
  if (raw.includes('/')) {
    const dir = path.dirname(raw).replace(/\\/g, '/');
    return sanitizeRel(`${dir}/${name}`);
  }
  return sanitizeRel(`logic/${name}`);
}

function saveToPath(rel, source, makeActive = true) {
  const safe = sanitizeRel(rel);
  if (!/\.st$/i.test(safe)) {
    throw new Error('Program path must end with .st');
  }
  writeProgram(safe, source);
  if (makeActive) setActive(safe);
  return safe;
}

function listProgramsInRoot(rootDir) {
  const out = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full, rel);
      else if (name.endsWith('.st')) {
        const parts = rel.split('/');
        out.push({
          path: rel.replace(/\\/g, '/'),
          name: name.replace(/\.st$/, ''),
          category: parts.length > 1 ? parts[0] : 'root',
        });
      }
    }
  }
  walk(rootDir, '');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function listPrograms() {
  ensureStDir();
  return listProgramsInRoot(ST_DIR);
}

/** Shipped sample paths under st/ — kept when pruning user programs on new project. */
function isShippedSamplePath(rel) {
  const p = sanitizeRel(rel);
  if (/^(logic|modbus|mqtt|opta)\/\d{2}_/i.test(p)) return true;
  if (/^opta-mqtt\//i.test(p)) return true;
  if (p === 'program.st') return true;
  return false;
}

function removeEmptyDirs(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  for (const name of fs.readdirSync(rootDir)) {
    const full = path.join(rootDir, name);
    if (!fs.statSync(full).isDirectory()) continue;
    removeEmptyDirs(full);
    try {
      if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Delete .st files except the active path (and shipped samples by default).
 * @param {string} keepRel relative path under st/
 * @param {{ protectShipped?: boolean, stRoot?: string }} [opts]
 */
function pruneProgramsExcept(keepRel, opts = {}) {
  const keep = sanitizeRel(keepRel);
  const protectShipped = opts.protectShipped !== false;
  const root = path.resolve(opts.stRoot || ST_DIR);
  for (const { path: rel } of listProgramsInRoot(root)) {
    if (rel === keep) continue;
    if (protectShipped && isShippedSamplePath(rel)) continue;
    const fp = path.join(root, ...rel.split('/'));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  removeEmptyDirs(root);
}

function warnLegacyDataSt() {
  const legacy = path.join(require('../config').DATA_DIR, 'st');
  if (path.resolve(legacy) === path.resolve(ST_DIR)) return;
  try {
    if (fs.existsSync(legacy) && fs.readdirSync(legacy).some((n) => n.endsWith('.st'))) {
      console.warn(
        `[programs] Legacy ${legacy} is ignored. Use ${ST_DIR} (set MOOREVIEW_ST to override).`
      );
    }
  } catch {
    /* ignore */
  }
}

function migrateLegacyProgram() {
  warnLegacyDataSt();
  ensureStDir();
  const stMain = resolvePath(DEFAULT_PROGRAM);
  if (fs.existsSync(stMain)) return;
  const legacyFp = persistence.filePath('program.st');
  if (fs.existsSync(legacyFp)) {
    fs.copyFileSync(legacyFp, stMain);
  } else {
    fs.writeFileSync(stMain, '// Select a program from st/logic, st/mqtt, or st/modbus\n', 'utf8');
  }
}

module.exports = {
  ST_DIR,
  DEFAULT_PROGRAM,
  ensureStDir,
  sanitizeRel,
  resolvePath,
  activeRel,
  setActive,
  clearActive,
  readActive,
  writeActive,
  programExists,
  suggestRelFromFilename,
  saveToPath,
  readProgram,
  normalizeProgramSource,
  writeProgram,
  listPrograms,
  listProgramsInRoot,
  isShippedSamplePath,
  pruneProgramsExcept,
  migrateLegacyProgram,
};
