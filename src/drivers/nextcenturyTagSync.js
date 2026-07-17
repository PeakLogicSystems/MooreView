'use strict';

const { applyDefaultLabel } = require('../tags/tagLabels');

function sanitizeDeviceId(deviceId) {
  return String(deviceId || '').replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
}

function tagIdFor(deviceId, suffix) {
  return `NC_${sanitizeDeviceId(deviceId)}_${suffix}`;
}

function isAutoNextcenturyTag(tag) {
  if (!tag || tag.ncAuto === true) return true;
  const id = String(tag.id || '');
  if (id === 'NC_STATUS_DEVICES' || id === 'NC_STATUS_LAST_COLLECT') return true;
  return /^NC_[A-Z0-9]+_(USAGE|TEMP|LEAK)$/.test(id);
}

function isLeakStyleDevice(doc) {
  const dt = String(doc.deviceType || '').toLowerCase();
  if (dt.includes('leak') || dt.includes('light')) return true;
  const ls = String(doc.leakStatus || '').trim().toLowerCase();
  return ls && !ls.includes('no leak') && ls !== 'dry' && ls !== 'ok';
}

function fieldsForDevice(doc) {
  const fields = [{ field: 'totalUsage', suffix: 'USAGE', type: 'REAL' }];
  const leakStyle = isLeakStyleDevice(doc);
  if (!leakStyle || doc.temperature != null) {
    fields.push({ field: 'temperature', suffix: 'TEMP', type: 'REAL' });
  }
  if (leakStyle) {
    fields.push({ field: 'leakActive', suffix: 'LEAK', type: 'BOOL' });
  }
  return fields;
}

function defaultLabel(doc, suffix) {
  const loc = String(doc.description || doc.area || doc.unitNumber || doc.deviceId || '').trim();
  const names = { USAGE: 'usage', TEMP: 'temp', LEAK: 'leak' };
  const tail = names[suffix] || suffix.toLowerCase();
  return loc ? `${loc} ${tail}` : `${doc.deviceId} ${tail}`;
}

function makeStatusTags(driverId, meta) {
  const rows = [
    {
      id: 'NC_STATUS_DEVICES',
      label: 'NC device count',
      type: 'INT',
      field: '_deviceCount',
    },
    {
      id: 'NC_STATUS_LAST_COLLECT',
      label: 'NC last collect epoch',
      type: 'INT',
      field: '_lastCollectEpoch',
    },
  ];
  return rows.map((row) => applyDefaultLabel({
    id: row.id,
    label: row.label,
    type: row.type,
    role: 'input',
    value: meta[row.field] ?? (row.type === 'BOOL' ? false : 0),
    driverId,
    driverAddress: { deviceId: '_meta', field: row.field },
    ncAuto: true,
    readonly: true,
    graphEnabled: false,
    alarmsEnabled: false,
  }));
}

function deviceDocToTags(doc, driverId) {
  if (!doc?.deviceId) return [];
  return fieldsForDevice(doc).map((def) => applyDefaultLabel({
    id: tagIdFor(doc.deviceId, def.suffix),
    label: defaultLabel(doc, def.suffix),
    type: def.type,
    role: 'input',
    value: def.type === 'BOOL' ? false : 0,
    driverId,
    driverAddress: { deviceId: doc.deviceId, field: def.field },
    ncAuto: true,
    readonly: true,
    graphEnabled: def.type === 'REAL',
    alarmsEnabled: def.field === 'leakActive',
  }));
}

/**
 * Build MooreVIEW tag rows from a NextCentury device cache (Map or iterable entries).
 */
function buildNextcenturyTags(deviceCache, driverId, meta = {}) {
  const incoming = [...makeStatusTags(driverId, meta)];
  for (const doc of deviceCache.values()) {
    incoming.push(...deviceDocToTags(doc, driverId));
  }
  return incoming;
}

/**
 * Merge auto-generated NC tags into the full tag store list.
 * Preserves labels/graph settings on matching ids; keeps manual tags on the same driver.
 */
function mergeNextcenturyTagsIntoStore(existingTags, deviceCache, driverId, meta = {}) {
  if (!driverId) return { ok: false, error: 'driverId required' };
  const incoming = buildNextcenturyTags(deviceCache, driverId, meta);
  if (!incoming.length) {
    return { ok: false, error: 'No devices in NextCentury report — check property IDs and credentials' };
  }
  const byId = new Map((existingTags || []).map((t) => [t.id, t]));
  for (const tag of incoming) {
    const prev = byId.get(tag.id);
    if (!prev) continue;
    if (prev.label) tag.label = prev.label;
    if (prev.graphEnabled != null) tag.graphEnabled = prev.graphEnabled;
    if (prev.alarmsEnabled != null) tag.alarmsEnabled = prev.alarmsEnabled;
  }
  const stripped = (existingTags || []).filter(
    (t) => t.driverId !== driverId || !isAutoNextcenturyTag(t),
  );
  const conflictIds = incoming.filter((t) => stripped.some((x) => x.id === t.id));
  if (conflictIds.length) {
    return {
      ok: false,
      error: `Tag id conflict (not on this driver): ${conflictIds.map((t) => t.id).join(', ')}`,
    };
  }
  return {
    ok: true,
    tags: [...stripped, ...incoming],
    count: incoming.length,
    deviceCount: deviceCache.size,
  };
}

module.exports = {
  buildNextcenturyTags,
  mergeNextcenturyTagsIntoStore,
  isAutoNextcenturyTag,
  tagIdFor,
  fieldsForDevice,
};
