'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { CONFIG_JSON_FILES } = require('./keys');
function readFileJson(name, fallback, dataDir = DATA_DIR) {
  const fp = path.join(dataDir, name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return fallback;
  }
}

function listFileProjects(dataDir = DATA_DIR) {
  const dir = path.join(dataDir, 'projects');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /\.est\.json$/i.test(f));
}

/**
 * Import JSON config files from data/ into mongo cache (and optionally persist).
 * @param {{ writeDocument: Function, writeProjectSnapshot: Function, safeId: Function }} backend
 * @param {{ seedProjects?: boolean }} opts
 */
async function migrateConfigFilesToMongo(backend, opts = {}) {
  const imported = [];
  for (const key of CONFIG_JSON_FILES) {
    const data = readFileJson(key, null);
    if (data == null) continue;
    await backend.writeDocument(key, data);
    imported.push(key);
  }
  if (opts.seedProjects !== false) {
    const synced = await syncBundledProjectsFromDisk(backend);
    imported.push(...synced.map((id) => `projects/${id}`));
  }
  return imported;
}

const BUNDLED_FORCE_REFRESH_IDS = new Set(['assisted-living', 'assisted-living-halow', 'assisted-living-pool-iot-link', 'mle-wastewater', 'duplex-lift-station', 'putnam-county-cloud', 'putnam-mle-plant', 'atu-cloud-residential', 'atu-cloud-commercial']);

function bundledProjectRel(projectId) {
  return path.join('projects', `${projectId}.est.json`);
}

/** True when data/projects/<id>.est.json mtime is newer than the Mongo snapshot savedAt. */
function isBundledDiskNewerThanMongo(projectId, row, dataDir = DATA_DIR) {
  if (!row?.data) return true;
  try {
    const fp = path.join(dataDir, bundledProjectRel(projectId));
    const st = fs.statSync(fp);
    const mongoTs = row.savedAt ? Date.parse(row.savedAt) : 0;
    return Number.isFinite(mongoTs) ? st.mtimeMs > mongoTs + 500 : true;
  } catch {
    return false;
  }
}

/**
 * Reload a bundled project snapshot from data/projects/<id>.est.json (always for force-refresh ids).
 * @returns {Promise<object|null>} project document or null when not bundled / missing on disk
 */
async function refreshBundledProjectFromDisk(projectId, backend, opts = {}) {
  const { safeId, writeProjectSnapshot, readProjectSnapshot } = backend;
  const id = typeof safeId === 'function' ? safeId(projectId) : String(projectId || '').trim();
  if (!id || !BUNDLED_FORCE_REFRESH_IDS.has(id)) return null;
  const doc = readFileJson(bundledProjectRel(id), null);
  if (!doc) return null;
  if (opts.force !== true && typeof readProjectSnapshot === 'function') {
    const row = await readProjectSnapshot(id);
    if (row?.data && !isBundledDiskNewerThanMongo(id, row)) return row.data;
  }
  await writeProjectSnapshot(id, doc, { name: doc?.project?.name || id });
  return doc;
}

/**
 * Import data/projects/*.est.json snapshots that are not yet in Mongo.
 * Safe to run on every startup — skips projects already in the library.
 * @param {{ writeProjectSnapshot: Function, safeId: Function, existingIds?: Set<string> }} backend
 */
async function syncBundledProjectsFromDisk(backend, opts = {}) {
  const imported = [];
  const existing = opts.existingIds || new Set();
  const dataDir = opts.dataDir || DATA_DIR;
  const { safeId, readProjectSnapshot } = backend;
  const FORCE_REFRESH_IDS = BUNDLED_FORCE_REFRESH_IDS;

  for (const fname of listFileProjects(dataDir)) {
    const id = fname.replace(/\.est\.json$/i, '');
    const projectId = typeof safeId === 'function' ? safeId(id) : id;
    const forceRefresh = FORCE_REFRESH_IDS.has(projectId);
    if (existing.has(projectId) && !forceRefresh && !opts.forceAll) continue;
    const doc = readFileJson(path.join('projects', fname), null, dataDir);
    if (!doc) continue;
    if (
      !opts.forceAll
      && existing.has(projectId)
      && forceRefresh
      && typeof readProjectSnapshot === 'function'
    ) {
      const row = await readProjectSnapshot(projectId);
      if (row?.data && !isBundledDiskNewerThanMongo(projectId, row, dataDir)) continue;
    }
    await backend.writeProjectSnapshot(projectId, doc, { name: doc?.project?.name || id });
    imported.push(projectId);
  }
  return imported;
}

module.exports = {
  migrateConfigFilesToMongo,
  syncBundledProjectsFromDisk,
  refreshBundledProjectFromDisk,
  BUNDLED_FORCE_REFRESH_IDS,
  isBundledDiskNewerThanMongo,
  readFileJson,
  listFileProjects,
};
