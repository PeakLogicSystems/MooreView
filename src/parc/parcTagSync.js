'use strict';

const { applyDefaultLabel } = require('../tags/tagLabels');
const { rawToEngineering } = require('../tags/tagAnalog');
const { inferTagType, inferTagRole } = require('./optaTagMeta');

function normalizeParcRole(row) {
  let role = row?.role || inferTagRole(row?.id, row?.type);
  if (role === 'in') role = 'input';
  if (role === 'out') role = 'output';
  if (role === 'mem') role = 'memory';
  return role;
}

const PARC_ROLE_RANK = { input: 0, output: 1, memory: 2, fb: 3 };

/** Collapse duplicate tag ids — prefer hardware input/output rows over memory copies. */
function dedupeParcTags(tags) {
  const byId = new Map();
  for (const row of tags || []) {
    const id = String(row?.id || '').trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, row);
      continue;
    }
    const rankNew = PARC_ROLE_RANK[normalizeParcRole(row)] ?? 9;
    const rankOld = PARC_ROLE_RANK[normalizeParcRole(existing)] ?? 9;
    if (rankNew < rankOld) byId.set(id, row);
  }
  return [...byId.values()];
}

/** id → row map for Parc telemetry sync (hardware inputs win over memory duplicates). */
function buildParcTagSnap(tags) {
  return new Map(dedupeParcTags(tags).map((row) => [row.id, row]));
}

function isParcHardwareIoRow(row) {
  const id = String(row?.id || '').trim();
  if (!id) return false;
  const role = normalizeParcRole(row);
  return role === 'input' || role === 'output';
}

/** Map Parc telemetry tag row → MooreVIEW tag store row. */
function parcRowToStoreTag(row, driverId) {
  const id = String(row?.id || '').trim();
  if (!id) return null;
  const type = String(row.type || inferTagType(id)).toUpperCase();
  let role = row.role || inferTagRole(id, type);
  if (role === 'in') role = 'input';
  if (role === 'out') role = 'output';
  if (role === 'mem') role = 'memory';
  let value = row.value;
  if (value === undefined || value === null) {
    value = type === 'BOOL' ? false : 0;
  } else if (type === 'BOOL') {
    value = !!value;
  } else if (type === 'INT') {
    value = Math.trunc(Number(value) || 0);
  } else if (type === 'REAL' || type === 'PID' || type === 'AVG') {
    value = Number(value) || 0;
  }
  const tag = applyDefaultLabel({
    id,
    type,
    role,
    value,
    driverId,
    driverAddress: { channel: id },
    quality: row.quality || 'GOOD',
    alarmsEnabled: false,
    readonly: role === 'input',
    graphEnabled: type === 'INT' || type === 'REAL',
  });
  if (type === 'PID' && tag.preset == null) {
    tag.preset = 512;
    tag.mode = 'PI';
    tag.kp = 0.5;
    tag.ki = 0.1;
    tag.kd = 0;
    tag.outMin = 0;
    tag.outMax = 1023;
  }
  if (type === 'AVG' && tag.preset == null) {
    tag.preset = 8;
    tag.mode = 'MOV';
  }
  if (type === 'TIMER' && tag.preset == null) {
    tag.preset = 1000;
    tag.mode = 'TON';
  }
  if (type === 'COUNTER' && tag.preset == null) {
    tag.preset = 10;
    tag.mode = 'CTU';
  }
  return tag;
}

/**
 * Replace all tags on driverId with rows from Parc device telemetry.
 * @param {object[]} existingTags full tag store list
 * @param {object[]} parcTags tags[] from registry device report
 * @param {string} driverId
 */
function mergeParcTagsIntoStore(existingTags, parcTags, driverId) {
  const incoming = (parcTags || [])
    .map((row) => parcRowToStoreTag(row, driverId))
    .filter(Boolean);
  if (!incoming.length) {
    return { ok: false, error: 'Device has no tags in last Parc report — scan expansions on Opta /setup first' };
  }
  const stripped = (existingTags || []).filter((t) => t.driverId !== driverId);
  const ids = new Set(stripped.map((t) => t.id));
  const conflicts = incoming.filter((t) => ids.has(t.id));
  if (conflicts.length) {
    return {
      ok: false,
      error: `Tag id conflict (not on this driver): ${conflicts.map((t) => t.id).join(', ')}`,
    };
  }
  return { ok: true, tags: [...stripped, ...incoming], count: incoming.length };
}

/** Add missing physical input/output tags from Parc telemetry (analog RAW, Xn_AI*, etc.). */
function ensureParcHardwareTags(store, parcTags, opts = {}) {
  const driverId = opts.driverId ?? null;
  let added = 0;
  for (const row of parcTags || []) {
    if (!isParcHardwareIoRow(row)) continue;
    if (store.get(row.id)) continue;
    const tag = parcRowToStoreTag(row, driverId);
    if (!tag) continue;
    store.upsert({ ...tag, driverId: tag.driverId ?? driverId ?? null });
    added += 1;
  }
  return added;
}

/** Apply latest Parc hardware I/O values into an existing tag store row. */
function applyParcHardwareTelemetry(store, parcTags, opts = {}) {
  const quality = opts.stale ? 'STALE' : 'GOOD';
  let n = 0;
  for (const row of parcTags || []) {
    if (!isParcHardwareIoRow(row)) continue;
    const t = store.get(row.id);
    if (!t) continue;
    if (store.isDriverReadSkipped?.(t)) continue;
    let val = row.value;
    if (t.type === 'BOOL') val = !!val;
    else if (t.type === 'INT') {
      val = Math.trunc(rawToEngineering(Math.trunc(Number(val) || 0), t));
    } else if (t.type === 'REAL' || t.type === 'PID' || t.type === 'AVG') {
      val = rawToEngineering(Number(val) || 0, t);
    }
    if (typeof store.applyParcTelemetry === 'function') {
      store.applyParcTelemetry(t.id, {
        value: val,
        quality,
        forceInput: row.forceInput,
        forceOutput: row.forceOutput,
        forceValue: row.forceValue,
        logicValue: row.logicValue,
        type: t.type,
      });
    } else {
      store.setValue(t.id, val, quality);
    }
    n += 1;
  }
  return n;
}

module.exports = {
  parcRowToStoreTag,
  mergeParcTagsIntoStore,
  isParcHardwareIoRow,
  ensureParcHardwareTags,
  applyParcHardwareTelemetry,
  dedupeParcTags,
  buildParcTagSnap,
};
