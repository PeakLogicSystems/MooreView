'use strict';

const fs = require('fs');
const path = require('path');
const persistence = require('../persistence');
const { packArchive, unpackArchive, ZIP_EXT } = require('./projectArchive');
const { EST_FORMAT } = require('./estFile');

/** @type {Map<string, { mtimeMs: number, size: number, meta: object }>} */
const fileMetaCache = new Map();

function projectsDir() {
  const dir = persistence.filePath('projects');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function safeId(name) {
  const s = String(name || '').trim().toLowerCase();
  const id = s
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
  return id || 'project';
}

function projectPath(id) {
  return path.join(projectsDir(), `${safeId(id)}${ZIP_EXT}`);
}

function invalidateProjectListCache(filePath) {
  if (filePath) fileMetaCache.delete(filePath);
  else fileMetaCache.clear();
}

function readProjectMeta(fp, id) {
  let st;
  try {
    st = fs.statSync(fp);
  } catch {
    return { name: id, savedAt: null, tagCount: null, driverCount: null };
  }
  const cached = fileMetaCache.get(fp);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.meta;
  }
  let meta;
  try {
    const unpacked = unpackArchive(fs.readFileSync(fp));
    const raw = unpacked.project;
    meta = {
      name: raw?.project?.name || unpacked.manifest?.projectName || id,
      savedAt: raw?.savedAt || unpacked.manifest?.exportedAt || null,
      tagCount: Array.isArray(raw?.tags) ? raw.tags.length : null,
      driverCount: Array.isArray(raw?.drivers) ? raw.drivers.length : null,
    };
  } catch {
    meta = { name: id, savedAt: null, tagCount: null, driverCount: null };
  }
  fileMetaCache.set(fp, { mtimeMs: st.mtimeMs, size: st.size, meta });
  return meta;
}

function readJsonProjectMeta(fp, label) {
  let st;
  try {
    st = fs.statSync(fp);
  } catch {
    return { name: label, savedAt: null, tagCount: null, driverCount: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return {
      name: raw?.project?.name || label.replace(/\.(est\.json|mvbundle|json)$/i, ''),
      savedAt: raw?.savedAt || st.mtime.toISOString(),
      tagCount: Array.isArray(raw?.tags) ? raw.tags.length : null,
      driverCount: Array.isArray(raw?.drivers) ? raw.drivers.length : null,
    };
  } catch {
    return { name: label, savedAt: st.mtime.toISOString(), tagCount: null, driverCount: null };
  }
}

function isImportableProjectFilename(name) {
  const lower = String(name || '').toLowerCase();
  return lower.endsWith('.est.zip')
    || lower.endsWith('.est.json')
    || lower.endsWith('.mvbundle');
}

function resolveImportableProjectPath(filename) {
  const base = path.basename(String(filename || '').trim());
  if (!base || base !== filename) {
    throw Object.assign(new Error('Invalid project filename'), { status: 400 });
  }
  if (!isImportableProjectFilename(base)) {
    throw Object.assign(new Error('Expected .est.zip, .est.json, or .mvbundle'), { status: 400 });
  }
  const fp = path.join(projectsDir(), base);
  if (!fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
    throw Object.assign(new Error(`Project file not found: ${base}`), { status: 404 });
  }
  const resolved = fs.realpathSync.native(fp);
  const root = fs.realpathSync.native(projectsDir());
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw Object.assign(new Error('Invalid project path'), { status: 400 });
  }
  return resolved;
}

function listImportableProjects() {
  const dir = projectsDir();
  const files = fs.readdirSync(dir).filter((f) => isImportableProjectFilename(f));
  return files.map((f) => {
    const fp = path.join(dir, f);
    const lower = f.toLowerCase();
    const meta = lower.endsWith('.est.zip')
      ? readProjectMeta(fp, f.slice(0, -ZIP_EXT.length))
      : readJsonProjectMeta(fp, f);
    return {
      file: f,
      format: lower.endsWith('.est.zip') ? 'zip' : 'json',
      ...meta,
    };
  }).sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

function readImportableProjectBuffer(filename) {
  const fp = resolveImportableProjectPath(filename);
  return { buffer: fs.readFileSync(fp), filename: path.basename(fp) };
}

function listProjects() {
  const dir = projectsDir();
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(ZIP_EXT));
  const livePaths = new Set(files.map((f) => path.join(dir, f)));
  for (const fp of fileMetaCache.keys()) {
    if (!livePaths.has(fp)) fileMetaCache.delete(fp);
  }
  return files.map((f) => {
    const fp = path.join(dir, f);
    const id = f.slice(0, -ZIP_EXT.length);
    return { id, ...readProjectMeta(fp, id) };
  }).sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

function saveProjectArchive(nameOrId, archiveBuffer) {
  const id = safeId(nameOrId);
  const fp = projectPath(id);
  const buf = Buffer.isBuffer(archiveBuffer) ? archiveBuffer : Buffer.from(archiveBuffer);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, fp);
  invalidateProjectListCache(fp);
  return { id, path: fp };
}

function saveProjectDoc(nameOrId, doc, deps) {
  if (!deps) {
    throw Object.assign(new Error('saveProjectDoc requires runtime deps to pack archive'), { status: 500 });
  }
  const name = doc?.project?.name || nameOrId || 'project';
  const archiveBuffer = packArchive(deps, { name, exportedBy: require('../../package.json').version });
  return saveProjectArchive(nameOrId || name, archiveBuffer);
}

function loadProjectArchive(id) {
  const fp = projectPath(id);
  if (!fs.existsSync(fp)) {
    throw Object.assign(new Error(`Project not found: ${safeId(id)}`), { status: 404 });
  }
  return unpackArchive(fs.readFileSync(fp));
}

/** @deprecated use loadProjectArchive */
function loadProjectDoc(id) {
  const unpacked = loadProjectArchive(id);
  if (!unpacked.project || unpacked.project.format !== EST_FORMAT) {
    throw Object.assign(new Error('Invalid project archive'), { status: 400 });
  }
  return unpacked.project;
}

function deleteProjectDoc(id) {
  const fp = projectPath(id);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  invalidateProjectListCache(fp);
  return true;
}

function readProjectArchiveBuffer(id) {
  const fp = projectPath(id);
  if (!fs.existsSync(fp)) {
    throw Object.assign(new Error(`Project not found: ${safeId(id)}`), { status: 404 });
  }
  return fs.readFileSync(fp);
}

module.exports = {
  ZIP_EXT,
  projectsDir,
  safeId,
  listProjects,
  listImportableProjects,
  readImportableProjectBuffer,
  resolveImportableProjectPath,
  isImportableProjectFilename,
  saveProjectArchive,
  saveProjectDoc,
  loadProjectArchive,
  loadProjectDoc,
  deleteProjectDoc,
  readProjectArchiveBuffer,
  invalidateProjectListCache,
};
