'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');

const RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOENT', 'EXDEV']);
const fileWriteLocks = new Map();

function sleepSync(ms) {
  if (ms <= 0) return;
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) { /* spin */ }
}

function uniqueTempPath(fp) {
  return `${fp}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
}

function withFileWriteLock(name, fn) {
  while (fileWriteLocks.get(name)) sleepSync(5);
  fileWriteLocks.set(name, true);
  try {
    return fn();
  } finally {
    fileWriteLocks.delete(name);
  }
}

function renameWithRetry(src, dest, maxAttempts = 25) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      fs.renameSync(src, dest);
      return;
    } catch (err) {
      lastErr = err;
      if (!RENAME_RETRY_CODES.has(err.code)) throw err;
      if (attempt === maxAttempts - 1) break;
      sleepSync(20 * (attempt + 1));
    }
  }
  // Windows: target may stay locked (AV, indexer, editor) — copy over then remove temp.
  try {
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
    return;
  } catch (copyErr) {
    try { fs.unlinkSync(src); } catch { /* ignore */ }
    throw lastErr || copyErr;
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name, fallback) {
  ensureDataDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(name, data) {
  return withFileWriteLock(name, () => {
    ensureDataDir();
    const fp = filePath(name);
    const tmp = uniqueTempPath(fp);
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    try {
      renameWithRetry(tmp, fp);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw err;
    }
  });
}

function readText(name, fallback = '') {
  ensureDataDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return fallback;
  return fs.readFileSync(fp, 'utf8');
}

function writeText(name, text) {
  ensureDataDir();
  fs.writeFileSync(filePath(name), text, 'utf8');
}

/** Flush batched config writes (mongo configStore) or no-op for file backend. */
async function flushConfig() {
  try {
    const configStore = require('./configStore');
    if (configStore.status?.().ready) {
      await configStore.flushPending();
    }
  } catch {
    /* File-backed persistence: writeJson is already durable on disk. */
  }
}

function writeBinary(name, buffer) {
  return withFileWriteLock(name, () => {
    ensureDataDir();
    const fp = filePath(name);
    const tmp = uniqueTempPath(fp);
    const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
    fs.writeFileSync(tmp, buf);
    try {
      renameWithRetry(tmp, fp);
    } catch (err) {
      try { fs.unlinkSync(tmp); } catch { /* ignore */ }
      throw err;
    }
  });
}

function readBinary(name) {
  ensureDataDir();
  const fp = filePath(name);
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp);
}

module.exports = {
  ensureDataDir,
  readJson,
  writeJson,
  readText,
  writeText,
  readBinary,
  writeBinary,
  filePath,
  flushConfig,
};
