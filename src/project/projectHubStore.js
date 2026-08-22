'use strict';

const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../config');
const { archiveFilename } = require('./projectArchive');

const HUB_DIR = path.join(DATA_DIR, 'project-hub');
const ZIP_EXT = '.est.zip';

function ensureHubDir() {
  if (!fs.existsSync(HUB_DIR)) fs.mkdirSync(HUB_DIR, { recursive: true });
  return HUB_DIR;
}

function catalogPath() {
  return path.join(ensureHubDir(), 'catalog.json');
}

function readCatalog() {
  ensureHubDir();
  try {
    const raw = fs.readFileSync(catalogPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCatalog(entries) {
  ensureHubDir();
  fs.writeFileSync(catalogPath(), JSON.stringify(entries, null, 2));
}

function safeSlug(name) {
  const base = String(name || 'project').trim().replace(/[^\w.-]+/g, '_').replace(/^\.+/, '') || 'project';
  return base.toLowerCase();
}

function archivePathForSlug(slug) {
  return path.join(ensureHubDir(), `${slug}${ZIP_EXT}`);
}

function listEntries() {
  const catalog = readCatalog();
  return catalog
    .filter((e) => e && e.id && e.slug)
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name || e.slug,
      description: e.description || '',
      updatedAt: e.updatedAt || null,
      source: 'local',
    }))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

function loadArchiveBuffer(idOrSlug) {
  const key = String(idOrSlug || '').trim();
  if (!key) throw Object.assign(new Error('Missing project id'), { status: 400 });
  const catalog = readCatalog();
  const entry = catalog.find((e) => e.id === key || e.slug === key);
  if (!entry) throw Object.assign(new Error(`Project not in repository: ${key}`), { status: 404 });
  const filePath = archivePathForSlug(entry.slug);
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error(`Repository file missing for ${entry.name}`), { status: 404 });
  }
  return { entry, buffer: fs.readFileSync(filePath) };
}

function publishArchive(name, archiveBuffer, meta = {}) {
  const projectName = String(name || 'project').trim() || 'project';
  const slug = safeSlug(meta.slug || projectName);
  const catalog = readCatalog();
  const now = new Date().toISOString();
  let entry = catalog.find((e) => e.slug === slug);
  if (!entry) {
    entry = {
      id: slug,
      slug,
      name: projectName,
      description: String(meta.description || '').trim(),
      createdAt: now,
      updatedAt: now,
    };
    catalog.push(entry);
  } else {
    entry.name = projectName;
    entry.description = String(meta.description || entry.description || '').trim();
    entry.updatedAt = now;
  }
  const buf = Buffer.isBuffer(archiveBuffer) ? archiveBuffer : Buffer.from(archiveBuffer);
  const fp = archivePathForSlug(slug);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, fp);
  writeCatalog(catalog);
  return {
    ...entry,
    filename: archiveFilename(projectName),
    source: 'local',
  };
}

function removeEntry(idOrSlug) {
  const key = String(idOrSlug || '').trim();
  const catalog = readCatalog();
  const idx = catalog.findIndex((e) => e.id === key || e.slug === key);
  if (idx < 0) throw Object.assign(new Error(`Project not in repository: ${key}`), { status: 404 });
  const [entry] = catalog.splice(idx, 1);
  const filePath = archivePathForSlug(entry.slug);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeCatalog(catalog);
  return { ok: true };
}

module.exports = {
  HUB_DIR,
  ZIP_EXT,
  listEntries,
  loadArchiveBuffer,
  publishArchive,
  removeEntry,
  safeSlug,
};
