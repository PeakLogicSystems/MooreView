'use strict';

const { applyDefaultLabel } = require('../tags/tagLabels');
const { inferTagType, inferTagRole } = require('./optaTagMeta');

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

module.exports = { parcRowToStoreTag, mergeParcTagsIntoStore };
