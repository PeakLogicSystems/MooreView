'use strict';

const { normalizeAssetContext } = require('../pdm/motorAssetSetup');

const DEFAULT_PDM = {
  assetTags: {},
  assetContext: {},
  windowMin: 5,
  featuresCollection: 'pdm_features',
  failureThreshold: 0.3,
  buildEnabled: false,
  buildIntervalHours: 24,
  simSeedDays: 180,
  liftModelId: 'lift-submersible-v2',
  forecastMethods: ['health_index', 'run_amps_creep', 'start_time_ms'],
  reportEnabled: false,
  reportIntervalHours: 168,
  reportTitle: 'PdM Report',
  reportCompany: '',
  lastReportAt: {},
};

function defaultPdmSettings() {
  return { ...DEFAULT_PDM, assetTags: {}, assetContext: {} };
}

function normalizeAssetContextMap(raw, prev = {}) {
  if (raw == null) return { ...(prev || {}) };
  if (typeof raw !== 'object') return { ...(prev || {}) };
  const out = {};
  for (const [assetId, ctx] of Object.entries(raw)) {
    if (!assetId || typeof ctx !== 'object') continue;
    out[assetId] = normalizeAssetContext(ctx, assetId);
  }
  return out;
}

function normalizeForecastMethods(raw, fallback = DEFAULT_PDM.forecastMethods) {
  const allowed = new Set(['health_index', 'run_amps_creep', 'start_time_ms', 'starts_analytics']);
  const src = Array.isArray(raw) ? raw : fallback;
  const out = src.map((m) => String(m)).filter((m) => allowed.has(m));
  return out.length ? out : [...DEFAULT_PDM.forecastMethods];
}

function normalizePdmSettings(incoming, prev = {}) {
  const prevPdm = prev?.pdm && typeof prev.pdm === 'object' ? prev.pdm : {};
  if (incoming === null) return {};
  if (incoming === undefined) return { ...prevPdm };
  if (typeof incoming !== 'object') return { ...prevPdm };

  const assetTags = incoming.assetTags != null ? incoming.assetTags : prevPdm.assetTags;
  let parsedTags = {};
  if (typeof assetTags === 'string') {
    try { parsedTags = JSON.parse(assetTags); } catch { parsedTags = prevPdm.assetTags || {}; }
  } else if (assetTags && typeof assetTags === 'object') {
    parsedTags = assetTags;
  }

  const assetContext = incoming.assetContext != null
    ? incoming.assetContext
    : prevPdm.assetContext;

  return {
    assetTags: parsedTags,
    assetContext: normalizeAssetContextMap(assetContext, prevPdm.assetContext),
    windowMin: Math.max(1, Math.min(60, Number(incoming.windowMin ?? prevPdm.windowMin ?? DEFAULT_PDM.windowMin) || DEFAULT_PDM.windowMin)),
    featuresCollection: String(incoming.featuresCollection ?? prevPdm.featuresCollection ?? DEFAULT_PDM.featuresCollection).trim() || DEFAULT_PDM.featuresCollection,
    failureThreshold: Math.max(0.05, Math.min(0.95, Number(incoming.failureThreshold ?? prevPdm.failureThreshold ?? DEFAULT_PDM.failureThreshold) || DEFAULT_PDM.failureThreshold)),
    buildEnabled: incoming.buildEnabled != null ? !!incoming.buildEnabled : !!prevPdm.buildEnabled,
    buildIntervalHours: Math.max(1, Math.min(168, Number(incoming.buildIntervalHours ?? prevPdm.buildIntervalHours ?? DEFAULT_PDM.buildIntervalHours) || DEFAULT_PDM.buildIntervalHours)),
    simSeedDays: Math.max(30, Math.min(360, Number(incoming.simSeedDays ?? prevPdm.simSeedDays ?? DEFAULT_PDM.simSeedDays) || DEFAULT_PDM.simSeedDays)),
    liftModelId: String(incoming.liftModelId ?? prevPdm.liftModelId ?? DEFAULT_PDM.liftModelId).trim() || DEFAULT_PDM.liftModelId,
    forecastMethods: normalizeForecastMethods(incoming.forecastMethods, prevPdm.forecastMethods),
    reportEnabled: incoming.reportEnabled != null ? !!incoming.reportEnabled : !!prevPdm.reportEnabled,
    reportIntervalHours: Math.max(1, Math.min(720, Number(incoming.reportIntervalHours ?? prevPdm.reportIntervalHours ?? DEFAULT_PDM.reportIntervalHours) || DEFAULT_PDM.reportIntervalHours)),
    reportTitle: String(incoming.reportTitle ?? prevPdm.reportTitle ?? DEFAULT_PDM.reportTitle).trim() || DEFAULT_PDM.reportTitle,
    reportCompany: String(incoming.reportCompany ?? prevPdm.reportCompany ?? '').trim(),
    lastReportAt: incoming.lastReportAt != null && typeof incoming.lastReportAt === 'object'
      ? { ...(prevPdm.lastReportAt || {}), ...incoming.lastReportAt }
      : { ...(prevPdm.lastReportAt || {}) },
  };
}

function listPdmAssets(pdm) {
  const tagMap = pdm?.assetTags && typeof pdm.assetTags === 'object' ? pdm.assetTags : {};
  const ctxMap = pdm?.assetContext && typeof pdm.assetContext === 'object' ? pdm.assetContext : {};
  return [...new Set([...Object.keys(tagMap), ...Object.keys(ctxMap)])].sort((a, b) => a.localeCompare(b));
}

function getAssetContext(pdm, assetId) {
  const ctx = pdm?.assetContext?.[assetId];
  return ctx ? normalizeAssetContext(ctx, assetId) : null;
}

module.exports = {
  DEFAULT_PDM,
  defaultPdmSettings,
  normalizePdmSettings,
  normalizeAssetContextMap,
  listPdmAssets,
  getAssetContext,
};
