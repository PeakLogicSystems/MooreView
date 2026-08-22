'use strict';

const {
  resolveNextcenturyPropertyIds,
  isPlaceholderNcPropertyIds,
  propertyIdListsEqual,
} = require('./nextcenturyPropertyIds');
const {
  isEzMeterFacility,
  syncEzMeterSemanticTags,
  mergedEzMeterSemanticMap,
  pqThresholds,
} = require('../facilities/ezmeterPq');

/** Main pool vs shared-plumbing bodies with independent circulation targets. */
const WATER_BODY_KINDS = {
  POOL: 'pool',
  SPA: 'spa',
  WATER_FEATURE: 'water_feature',
};

const DEFAULT_POOLS = [
  {
    id: 'therapy',
    tagPrefix: 'POOL',
    name: 'Therapy Pool',
    sanitizer: 'orp',
    waterType: 'fresh',
    filterPumpCount: 1,
    bodyKind: WATER_BODY_KINDS.POOL,
    sharedWaterWith: '',
    circulationHoursPerDay: 7,
  },
];

/** Site-wide pool bodies (residential, commercial, assisted living, etc.). */
const MAX_POOLS = 4;
/** Filter pumps per body of water — each has its own weekly schedule on the HMI schedule screen. */
const MAX_FILTER_PUMPS = 2;
const MAX_SITE_FILTER_PUMPS = MAX_POOLS * MAX_FILTER_PUMPS;
const DEFAULT_CIRCULATION_HOURS = 7;
const MIN_CIRCULATION_HOURS = 0.25;
const MAX_CIRCULATION_HOURS = 24;

const DEFAULT_CIRCULATION_BY_KIND = {
  [WATER_BODY_KINDS.POOL]: 7,
  [WATER_BODY_KINDS.SPA]: 0.5,
  [WATER_BODY_KINDS.WATER_FEATURE]: 1,
};

function poolTagPrefix(pool) {
  const raw = String(pool?.tagPrefix || pool?.id || 'POOL').trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9_]/g, '');
  return cleaned || 'POOL';
}

function normalizeSanitizer(raw) {
  return String(raw || '').toLowerCase() === 'cl2' ? 'cl2' : 'orp';
}

function normalizeWaterType(raw) {
  return String(raw || '').toLowerCase() === 'salt' ? 'salt' : 'fresh';
}

function normalizeFilterPumpCount(raw, fallback = 1) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_FILTER_PUMPS, Math.max(1, Math.trunc(n)));
}

function normalizeCirculationHours(raw, fallback = DEFAULT_CIRCULATION_HOURS) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  const clamped = Math.min(MAX_CIRCULATION_HOURS, Math.max(MIN_CIRCULATION_HOURS, n));
  return Math.round(clamped * 4) / 4;
}

function normalizeSharedWaterWith(raw, poolId, peerIds = []) {
  const id = String(raw || '').trim();
  if (!id || id === poolId) return '';
  return peerIds.includes(id) ? id : '';
}

function normalizeBodyKind(raw, sharedWaterWith = '') {
  const kind = String(raw || '').trim().toLowerCase();
  if (kind === WATER_BODY_KINDS.SPA || kind === WATER_BODY_KINDS.WATER_FEATURE) return kind;
  if (kind === WATER_BODY_KINDS.POOL) return WATER_BODY_KINDS.POOL;
  if (sharedWaterWith) return WATER_BODY_KINDS.SPA;
  return WATER_BODY_KINDS.POOL;
}

function mainPoolPeerIds(pools, excludeIndex) {
  return pools
    .filter((p, i) => i !== excludeIndex && p.bodyKind === WATER_BODY_KINDS.POOL)
    .map((p) => p.id);
}

function finalizePoolRelationships(pools) {
  return pools.map((pool, index) => {
    const bodyKind = normalizeBodyKind(pool.bodyKind, pool.sharedWaterWith);
    const circDefault = DEFAULT_CIRCULATION_BY_KIND[bodyKind] ?? DEFAULT_CIRCULATION_HOURS;
    if (bodyKind === WATER_BODY_KINDS.POOL) {
      return {
        ...pool,
        bodyKind,
        sharedWaterWith: '',
        circulationHoursPerDay: normalizeCirculationHours(pool.circulationHoursPerDay, circDefault),
      };
    }
    const mainIds = mainPoolPeerIds(pools, index);
    let sharedWaterWith = normalizeSharedWaterWith(pool.sharedWaterWith, pool.id, mainIds);
    if (!sharedWaterWith && mainIds.length) sharedWaterWith = mainIds[0];
    return {
      ...pool,
      bodyKind,
      sharedWaterWith,
      circulationHoursPerDay: normalizeCirculationHours(pool.circulationHoursPerDay, circDefault),
    };
  });
}

function normalizePoolEntry(raw, index = 0, peerIds = []) {
  const fallback = DEFAULT_POOLS[Math.min(index, DEFAULT_POOLS.length - 1)] || DEFAULT_POOLS[0];
  const src = raw && typeof raw === 'object' ? raw : {};
  const id = String(src.id || fallback.id || `pool${index + 1}`).trim() || `pool${index + 1}`;
  const name = String(src.name || fallback.name || `Pool ${index + 1}`).trim() || `Pool ${index + 1}`;
  const tagPrefix = poolTagPrefix({ tagPrefix: src.tagPrefix || src.tagIdPrefix || fallback.tagPrefix || id });
  const bodyKind = normalizeBodyKind(
    src.bodyKind,
    src.sharedWaterWith ?? fallback.sharedWaterWith,
  );
  const circDefault = DEFAULT_CIRCULATION_BY_KIND[bodyKind] ?? DEFAULT_CIRCULATION_HOURS;
  return {
    id,
    tagPrefix,
    name,
    sanitizer: normalizeSanitizer(src.sanitizer ?? fallback.sanitizer),
    waterType: normalizeWaterType(src.waterType ?? fallback.waterType),
    filterPumpCount: normalizeFilterPumpCount(src.filterPumpCount ?? fallback.filterPumpCount, 1),
    bodyKind,
    sharedWaterWith: bodyKind === WATER_BODY_KINDS.POOL
      ? ''
      : normalizeSharedWaterWith(src.sharedWaterWith ?? fallback.sharedWaterWith, id, peerIds),
    circulationHoursPerDay: normalizeCirculationHours(
      src.circulationHoursPerDay ?? fallback.circulationHoursPerDay,
      circDefault,
    ),
  };
}

function normalizePools(raw, prev) {
  const base = Array.isArray(prev) && prev.length ? prev : DEFAULT_POOLS;
  if (!Array.isArray(raw)) {
    const draft = base.map((p, i) => normalizePoolEntry(p, i));
    const ids = draft.map((p) => p.id);
    const merged = draft.map((p, i) => normalizePoolEntry(
      {
        ...base[i],
        ...p,
        bodyKind: base[i]?.bodyKind ?? p.bodyKind,
        sharedWaterWith: base[i]?.sharedWaterWith ?? p.sharedWaterWith,
      },
      i,
      ids.filter((id) => id !== p.id),
    ));
    return finalizePoolRelationships(merged);
  }
  const slice = raw.slice(0, MAX_POOLS);
  const draft = slice.map((p, i) => normalizePoolEntry(p, i));
  const ids = draft.map((p) => p.id);
  const merged = draft.map((p, i) => normalizePoolEntry(
    {
      ...slice[i],
      ...p,
      bodyKind: slice[i]?.bodyKind ?? p.bodyKind,
      sharedWaterWith: slice[i]?.sharedWaterWith ?? p.sharedWaterWith,
    },
    i,
    ids.filter((id) => id !== p.id),
  ));
  const normalized = merged.length ? merged : DEFAULT_POOLS.map((p, i) => normalizePoolEntry(p, i));
  return finalizePoolRelationships(normalized);
}

function normalizeAssistedLiving(raw, prev = {}) {
  const base = prev && typeof prev === 'object' ? { ...prev } : {};
  if (!raw || typeof raw !== 'object') return base;
  const next = { ...base, ...raw };
  if (Object.prototype.hasOwnProperty.call(raw, 'mechWhGas')) {
    next.mechWhGas = raw.mechWhGas === true;
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'pools')) {
    next.pools = normalizePools(raw.pools, base.pools);
  } else if (!Array.isArray(next.pools) || !next.pools.length) {
    next.pools = normalizePools(undefined, base.pools);
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'halow') && raw.halow && typeof raw.halow === 'object') {
    next.halow = { ...(base.halow || {}), ...raw.halow };
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'poolSubsystem') && raw.poolSubsystem) {
    next.poolSubsystem = { ...(base.poolSubsystem || {}), ...raw.poolSubsystem };
  }
  if (raw.nextCentury && typeof raw.nextCentury === 'object') {
    next.nextCentury = { ...(base.nextCentury || {}), ...raw.nextCentury };
    const resolved = resolveNextcenturyPropertyIds(next.nextCentury.propertyIds);
    if (resolved.length) next.nextCentury.propertyIds = resolved;
  } else if (next.nextCentury?.propertyIds) {
    const resolved = resolveNextcenturyPropertyIds(next.nextCentury.propertyIds);
    if (resolved.length) next.nextCentury.propertyIds = resolved;
  }
  return next;
}

function setTagBool(tagStore, tagId, value) {
  if (tagStore.get(tagId)) tagStore.setValue(tagId, !!value);
}

function setTagReal(tagStore, tagId, value) {
  if (tagStore.get(tagId)) tagStore.setValue(tagId, Number(value));
}

function defaultNextcenturySemanticMap() {
  try {
    return require('../../scripts/assisted-living/nextcentury-map').SEMANTIC_MAP;
  } catch {
    return [];
  }
}

function defaultNextcenturyDriverId(assistedLiving) {
  return String(assistedLiving?.nextCentury?.driverId || 'nextcentury1').trim() || 'nextcentury1';
}

function facilityDriverMode(assistedLiving) {
  return String(assistedLiving?.facility?.driver || '').trim().toLowerCase();
}

/** True when the project is on NextCentury (not T-HaLow phase-1 defaults). */
function isNextcenturyFacility(assistedLiving) {
  const mode = facilityDriverMode(assistedLiving);
  if (mode === 'nextcentury' || mode === 'nc') return true;
  const pids = assistedLiving?.nextCentury?.propertyIds;
  return Array.isArray(pids) && pids.length > 0;
}

/** HaLow semantic wiring applies only when the project is explicitly on T-HaLow. */
function halowSemanticMappingEnabled(assistedLiving) {
  const halow = assistedLiving?.halow;
  if (halow?.enabled === false) return false;
  const mode = facilityDriverMode(assistedLiving);
  if (mode === 'halow' || mode === 't-halow' || mode === 'thalow') return true;
  if (!halow || typeof halow !== 'object') return false;
  if (Array.isArray(halow.semanticMap) && halow.semanticMap.length) return true;
  if (halow.phase) return true;
  return false;
}

function mergedHalowSemanticMap(assistedLiving) {
  if (!halowSemanticMappingEnabled(assistedLiving)) return [];
  const stored = assistedLiving?.halow?.semanticMap;
  if (Array.isArray(stored) && stored.length) return stored;
  try {
    return require('../../scripts/assisted-living-halow/halow-semantic-map').SEMANTIC_MAP;
  } catch {
    return [];
  }
}

/** Wire ALF tags to T-HaLow mqtt_parc drivers via on-device Parc tag ids. */
function syncHalowSemanticTags(tagStore, assistedLiving) {
  if (!tagStore || typeof tagStore.list !== 'function') return;
  const map = mergedHalowSemanticMap(assistedLiving);
  const poolMap = Array.isArray(assistedLiving?.halow?.poolRollupMap)
    ? assistedLiving.halow.poolRollupMap
    : [];
  const hvacMap = Array.isArray(assistedLiving?.halow?.hvacCondMap)
    ? assistedLiving.halow.hvacCondMap
    : [];
  let defaultHvac = [];
  if (!hvacMap.length) {
    try {
      defaultHvac = require('../../scripts/assisted-living-halow/hvac-halow-bindings').HVAC_COND_BINDINGS;
    } catch { /* optional */ }
  }
  const all = [...map, ...poolMap, ...hvacMap, ...defaultHvac];
  if (!all.length) return;

  const ncTagIds = isNextcenturyFacility(assistedLiving)
    ? new Set(mergedSemanticMap(assistedLiving).map((m) => m.tagId))
    : new Set();

  const tags = tagStore.list();
  let changed = false;
  const wired = tags.map((t) => {
    const m = all.find((row) => row.tagId === t.id);
    if (!m?.deviceId || !m?.parcTagId) return t;
    if (ncTagIds.has(t.id)) return t;
    changed = true;
    const next = {
      ...t,
      driverId: m.driverId || m.deviceId,
      driverAddress: { channel: m.parcTagId },
    };
    if (m.scale != null) next.scale = m.scale;
    if (m.offset != null) next.offset = m.offset;
    return next;
  });
  if (changed) tagStore.replaceAll(wired, { keepForces: true });
}

/** Stored project map overrides defaults; defaults fill gaps (e.g. RM101 on property 40074). */
function mergedSemanticMap(assistedLiving) {
  const defaults = defaultNextcenturySemanticMap();
  const stored = assistedLiving?.nextCentury?.semanticMap;
  if (!Array.isArray(stored) || !stored.length) return defaults;
  const byTag = new Map(defaults.map((m) => [m.tagId, m]));
  for (const m of stored) {
    if (m?.tagId) byTag.set(m.tagId, m);
  }
  return [...byTag.values()];
}

/** Ensure mechanical NC meter tags exist and wire semantic tags to the NextCentury driver. */
function syncNextcenturySemanticTags(tagStore, assistedLiving) {
  if (!tagStore || typeof tagStore.list !== 'function') return;

  const tags = tagStore.list();
  const byId = new Map(tags.map((t) => [t.id, t]));
  let next = tags;

  if (byId.has('MECH_METER_KWH') && !byId.has('MECH_METER_INTERVAL_KWH')) {
    const base = byId.get('MECH_METER_KWH');
    next = [
      ...next,
      {
        ...base,
        id: 'MECH_METER_INTERVAL_KWH',
        label: 'Site electric meter interval kWh (NC)',
        value: 0,
        graphEnabled: base.graphEnabled !== false,
        driverId: undefined,
        driverAddress: undefined,
      },
    ];
  }

  const driverId = defaultNextcenturyDriverId(assistedLiving);
  const map = mergedSemanticMap(assistedLiving);

  if (!map.length) {
    if (next !== tags) tagStore.replaceAll(next, { keepForces: true });
    return;
  }

  const mapByTagId = new Map(map.map((m) => [m.tagId, m]));
  let changed = next !== tags;
  const wired = next.map((t) => {
    const m = mapByTagId.get(t.id);
    if (!m?.deviceId || !m?.field) return t;
    changed = true;
    return {
      ...t,
      driverId,
      driverAddress: { deviceId: m.deviceId, field: m.field },
    };
  });

  if (changed) tagStore.replaceAll(wired, { keepForces: true });
}

/** Apply resolved NC property IDs to the nextcentury driver config (project open / settings sync). */
function syncNextcenturyDriverPropertyIds(driverManager, assistedLiving) {
  if (!driverManager || typeof driverManager.list !== 'function') return false;
  if (!isNextcenturyFacility(assistedLiving)) return false;

  const driverId = defaultNextcenturyDriverId(assistedLiving);
  const fromSettings = assistedLiving?.nextCentury?.propertyIds;
  const resolved = resolveNextcenturyPropertyIds(fromSettings);
  if (!resolved.length) return false;

  const list = driverManager.list();
  const idx = list.findIndex((d) => d.id === driverId && d.type === 'nextcentury');
  if (idx < 0) return false;

  const cur = list[idx];
  if (propertyIdListsEqual(cur.propertyIds, resolved)) return false;

  const drivers = list.map((d, i) => (i === idx ? { ...d, propertyIds: resolved } : d));
  driverManager.save(drivers);
  return true;
}

function patchNextcenturyDriverPropertyIds(drivers, assistedLiving) {
  if (!Array.isArray(drivers)) return drivers;
  const fromSettings = assistedLiving?.nextCentury?.propertyIds;
  const fallback = resolveNextcenturyPropertyIds(fromSettings);
  return drivers.map((d) => {
    if (d.type !== 'nextcentury') return d;
    const resolved = resolveNextcenturyPropertyIds(d.propertyIds);
    const nextIds = resolved.length ? resolved : fallback;
    if (!nextIds.length || propertyIdListsEqual(d.propertyIds, nextIds)) return d;
    return { ...d, propertyIds: nextIds };
  });
}

const MECH_METER_INTERVAL_BINDING = {
  screenId: 'screen_6',
  elementId: 't1_1_z0__val_meter_interval',
  tagId: 'MECH_METER_INTERVAL_KWH',
  property: 'text',
  format: 'fixed1',
};

/** Add mechanical-room interval meter binding when the screen exists but binding is missing. */
function patchAssistedLivingHmi(hmi) {
  if (!hmi || typeof hmi !== 'object') return hmi;
  const bindings = Array.isArray(hmi.bindings) ? [...hmi.bindings] : [];
  const hasMechanical = (hmi.screens || []).some((s) => s.id === 'screen_6');
  if (!hasMechanical) return hmi;
  if (bindings.some((b) => b.tagId === 'MECH_METER_INTERVAL_KWH')) return hmi;
  return { ...hmi, bindings: [...bindings, { ...MECH_METER_INTERVAL_BINDING }] };
}

/** Sync assisted-living config tags after settings or project load. */
function syncAssistedLivingTags(tagStore, assistedLiving) {
  if (!tagStore) return;

  if (assistedLiving && typeof assistedLiving === 'object') {
    if (Object.prototype.hasOwnProperty.call(assistedLiving, 'mechWhGas')) {
      const gas = assistedLiving.mechWhGas === true;
      setTagBool(tagStore, 'MECH_CFG_GAS_WH', gas);
      setTagBool(tagStore, 'MECH_CFG_ELEC_WH', !gas);
    }

    const pools = normalizePools(assistedLiving.pools, assistedLiving.pools);
    for (const pool of pools) {
    const p = poolTagPrefix(pool);
    const useOrp = pool.sanitizer !== 'cl2';
    const isSalt = pool.waterType === 'salt';
    setTagBool(tagStore, `${p}_CFG_USE_ORP`, useOrp);
    setTagBool(tagStore, `${p}_CFG_USE_CL2`, !useOrp);
    setTagBool(tagStore, `${p}_CFG_SALT`, isSalt);
    setTagBool(tagStore, `${p}_CFG_FRESH`, !isSalt);
    const fpCount = normalizeFilterPumpCount(pool.filterPumpCount, 1);
    if (tagStore.get(`${p}_CFG_FP_CNT`)) tagStore.setValue(`${p}_CFG_FP_CNT`, fpCount);
    for (let n = 2; n <= MAX_FILTER_PUMPS; n++) {
      setTagBool(tagStore, `${p}_CFG_FP${n}`, fpCount >= n);
    }
    if (tagStore.get(`${p}_CFG_FP2`) && fpCount < 2) {
      tagStore.setValue(`${p}_CFG_FP2`, false);
    }
    for (let n = 1; n <= MAX_FILTER_PUMPS; n++) {
      const seq = tagStore.get(`${p}_FP${n}_MODE`);
      const modeSeq = seq ? Number(seq.value) !== 0 : true;
      setTagBool(tagStore, `${p}_FP${n}_CFG_SEQ`, modeSeq);
      setTagBool(tagStore, `${p}_FP${n}_CFG_SS`, !modeSeq);
    }
    }
  }

  const ncMap = mergedSemanticMap(assistedLiving);
  const tagIds = new Set(tagStore.list().map((t) => t.id));
  if (ncMap.some((m) => tagIds.has(m.tagId)) && isNextcenturyFacility(assistedLiving)) {
    syncNextcenturySemanticTags(tagStore, assistedLiving);
  }
  const ezMap = mergedEzMeterSemanticMap(assistedLiving);
  if (isEzMeterFacility(assistedLiving) && ezMap.some((m) => tagIds.has(m.tagId))) {
    syncEzMeterSemanticTags(tagStore, assistedLiving);
    const th = pqThresholds(assistedLiving);
    setTagReal(tagStore, 'MECH_PQ_CFG_NOM_V', th.nominalV);
    setTagReal(tagStore, 'MECH_PQ_CFG_UV_V', th.undervoltV);
    setTagReal(tagStore, 'MECH_PQ_CFG_OV_V', th.overvoltV);
    setTagReal(tagStore, 'MECH_PQ_CFG_LOW_PF', th.lowPf);
    setTagReal(tagStore, 'MECH_PQ_CFG_FREQ_MIN', th.freqMinHz);
    setTagReal(tagStore, 'MECH_PQ_CFG_FREQ_MAX', th.freqMaxHz);
    setTagReal(tagStore, 'MECH_PQ_CFG_IMBAL_PCT', th.vImbalPct);
    setTagReal(tagStore, 'MECH_PQ_CFG_LOAD_I', th.loadedIA);
  }
  const halowMap = mergedHalowSemanticMap(assistedLiving);
  const poolRollup = Array.isArray(assistedLiving?.halow?.poolRollupMap)
    ? assistedLiving.halow.poolRollupMap
    : [];
  if ([...halowMap, ...poolRollup].some((m) => tagIds.has(m.tagId))) {
    syncHalowSemanticTags(tagStore, assistedLiving);
  }
}

module.exports = {
  DEFAULT_POOLS,
  MAX_POOLS,
  MAX_FILTER_PUMPS,
  MAX_SITE_FILTER_PUMPS,
  WATER_BODY_KINDS,
  DEFAULT_CIRCULATION_BY_KIND,
  DEFAULT_CIRCULATION_HOURS,
  MIN_CIRCULATION_HOURS,
  MAX_CIRCULATION_HOURS,
  poolTagPrefix,
  normalizeFilterPumpCount,
  normalizeCirculationHours,
  normalizeBodyKind,
  normalizeSharedWaterWith,
  normalizeSanitizer,
  normalizeWaterType,
  normalizePoolEntry,
  normalizePools,
  normalizeAssistedLiving,
  syncAssistedLivingTags,
  syncNextcenturySemanticTags,
  syncHalowSemanticTags,
  mergedHalowSemanticMap,
  mergedSemanticMap,
  halowSemanticMappingEnabled,
  isNextcenturyFacility,
  patchAssistedLivingHmi,
  syncNextcenturyDriverPropertyIds,
  patchNextcenturyDriverPropertyIds,
  isPlaceholderNcPropertyIds,
  isEzMeterFacility,
  syncEzMeterSemanticTags,
  mergedEzMeterSemanticMap,
};
