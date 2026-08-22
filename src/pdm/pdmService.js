'use strict';

const persistence = require('../persistence');
const mongoTagLogger = require('../logger/mongoTagLogger');
const { alignPdmFeatures, resolveTagIdsForAsset } = require('./featureAlign');
const { featuresToChartHistory, estimateRulFromFeatures, defaultPdmChartPens } = require('./rulEstimate');
const { buildFailureForecast } = require('./failureForecast');
const { generateMotorStartSimDocs } = require('./motorStartSim');
const { generateMotorAssetSimDocs } = require('./motorAssetSim');
const {
  normalizePdmSettings,
  listPdmAssets,
  getAssetContext,
} = require('../settings/pdmSettings');
const {
  normalizeAssetContext,
  defaultScadaTags,
  buildRuntimeContext,
  clampDays,
} = require('./motorAssetSetup');
const { maybeCreatePdmFailureWorkOrder } = require('../cmms/pdmCmmsBridge');

const DAY_MS = 24 * 60 * 60 * 1000;

function readSettings() {
  return persistence.readJson('settings.json', {});
}

function writeSettings(next) {
  persistence.writeJson('settings.json', next);
}

async function buildFeaturesForAsset(assetId, opts = {}) {
  const settings = opts.settings || readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const tagIds = resolveTagIdsForAsset(assetId, { tagIds: opts.tagIds, assetTags: pdm.assetTags });
  const toMs = Number(opts.toMs) || Date.now();
  const fromMs = Number(opts.fromMs) || (toMs - 7 * DAY_MS);
  const assetContext = getAssetContext(pdm, assetId);
  const [penDocs, edgeDocs] = await Promise.all([
    mongoTagLogger.queryPenDocs({ from: fromMs, to: toMs, tagIds }),
    mongoTagLogger.queryEdgeDocs({ from: fromMs, to: toMs, assetId }),
  ]);
  const aligned = alignPdmFeatures({
    fromMs,
    toMs,
    assetId,
    windowMin: pdm.windowMin,
    penDocs,
    edgeDocs,
    assetContext: assetContext ? buildRuntimeContext(assetContext, toMs) : null,
  });
  const stored = await mongoTagLogger.storePdmFeatures({
    assetId,
    features: aligned.features,
    collection: pdm.featuresCollection,
    fromMs,
    toMs,
  });
  return { ...aligned, stored, tagIds };
}

async function buildAllFeatures(opts = {}) {
  const settings = opts.settings || readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const assets = listPdmAssets(pdm);
  const results = [];
  for (const assetId of assets) {
    results.push(await buildFeaturesForAsset(assetId, { ...opts, settings }));
  }
  return { ok: true, assets: results, count: results.length };
}

async function loadPdmView(assetId, opts = {}) {
  const settings = opts.settings || readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const toMs = Number(opts.toMs) || Date.now();
  const fromMs = Number(opts.fromMs) || (toMs - DAY_MS);
  const tagIds = resolveTagIdsForAsset(assetId, { assetTags: pdm.assetTags });
  let features = await mongoTagLogger.loadPdmFeatures({
    assetId,
    from: fromMs,
    to: toMs,
    collection: pdm.featuresCollection,
  });
  if (!features.length) {
    const built = await buildFeaturesForAsset(assetId, { fromMs, toMs, settings });
    features = built.features;
  }
  const history = featuresToChartHistory(features);
  const rul = estimateRulFromFeatures(features, { failureThreshold: pdm.failureThreshold });
  const assetContext = getAssetContext(pdm, assetId);
  const runAmpsTag = tagIds.find((t) => /^AI\d+$/i.test(t))
    || tagIds.find((t) => /(_RAW|_AMPS|CURRENT)/i.test(t));
  const pumpIdx = assetContext?.pumpIndex || assetContext?.unitIndex || 1;
  const motorStartTagId = tagIds.find((t) => new RegExp(`^MOTOR${pumpIdx}_START_MS$`, 'i').test(t))
    || `MOTOR${pumpIdx}_START_MS`;
  const forecast = buildFailureForecast({
    features,
    assetId,
    failureThreshold: pdm.failureThreshold,
    now: toMs,
    forecastMethods: pdm.forecastMethods,
    runAmpsTagId: runAmpsTag,
    motorStartTagId,
  });
  let proactive = null;
  if (opts.runProactive !== false) {
    const wo = maybeCreatePdmFailureWorkOrder(assetId, {
      forecast,
      rul,
      assetContext,
    });
    proactive = { workOrder: wo, created: !!wo };
  }
  return {
    ok: true,
    assetId,
    tagIds,
    assetContext,
    fromMs,
    toMs,
    features,
    history,
    pens: defaultPdmChartPens(history),
    rul,
    forecast,
    proactive,
    meta: {
      windowCount: features.length,
      tagIds,
      source: 'pdm',
    },
  };
}

function listAssetSetup(settings = readSettings()) {
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const assets = Object.keys(pdm.assetContext || {}).sort();
  const sites = new Map();
  for (const assetId of assets) {
    const ctx = pdm.assetContext[assetId];
    if (ctx?.siteId) {
      if (!sites.has(ctx.siteId)) {
        sites.set(ctx.siteId, {
          siteId: ctx.siteId,
          siteName: ctx.siteName || ctx.siteId,
          configuration: ctx.configuration,
          locationClass: ctx.locationClass,
          assets: [],
        });
      }
      sites.get(ctx.siteId).assets.push(assetId);
    }
  }
  return {
    ok: true,
    assets: pdm.assetContext,
    assetIds: assets,
    sites: [...sites.values()],
    pdm,
  };
}

function saveAssetSetup(assetId, rawContext, settings = readSettings(), opts = {}) {
  const id = String(assetId || '').trim();
  if (!id) return { ok: false, error: 'assetId required' };
  const prev = readSettings();
  const pdm = normalizePdmSettings(settings?.pdm ?? prev.pdm, prev);
  const ctx = normalizeAssetContext(rawContext, id);
  const nextContext = { ...(pdm.assetContext || {}), [id]: ctx };
  const hasExplicitTagIds = Array.isArray(opts.tagIds);
  const resolvedTags = hasExplicitTagIds
    ? opts.tagIds.map(String).filter(Boolean)
    : (pdm.assetTags?.[id]?.length ? pdm.assetTags[id] : defaultScadaTags(ctx));
  const nextTags = {
    ...(pdm.assetTags || {}),
    [id]: resolvedTags,
  };
  const next = {
    ...prev,
    pdm: { ...pdm, assetContext: nextContext, assetTags: nextTags },
  };
  writeSettings(next);
  return { ok: true, assetId: id, context: ctx, assetTags: nextTags, pdm: next.pdm, settings: next };
}

function deleteAssetSetup(assetId, settings = readSettings()) {
  const id = String(assetId || '').trim();
  if (!id) return { ok: false, error: 'assetId required' };
  const prev = readSettings();
  const pdm = normalizePdmSettings(settings?.pdm ?? prev.pdm, prev);
  const nextContext = { ...(pdm.assetContext || {}) };
  const nextTags = { ...(pdm.assetTags || {}) };
  delete nextContext[id];
  delete nextTags[id];
  const next = { ...prev, pdm: { ...pdm, assetContext: nextContext, assetTags: nextTags } };
  writeSettings(next);
  return { ok: true, assetId: id, pdm: next.pdm, settings: next };
}

function getAssetContextView(assetId) {
  const settings = readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const ctx = getAssetContext(pdm, assetId);
  if (!ctx) return { ok: false, error: 'Asset not found' };
  return { ok: true, assetId, context: ctx, runtime: buildRuntimeContext(ctx) };
}

async function simulateMotorStart(opts = {}) {
  const sim = generateMotorStartSimDocs(opts);
  const edgeOk = await mongoTagLogger.logEdgeInferences(sim.edgeDocs);
  const scadaOk = await mongoTagLogger.insertPenDocs(sim.scadaDocs);
  const settings = readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const tagIds = (sim.tags || []).map((t) => t.id).filter(Boolean);
  const nextTags = {
    ...(pdm.assetTags || {}),
    [sim.assetId]: tagIds,
  };
  const next = {
    ...settings,
    pdm: { ...pdm, assetTags: nextTags },
  };
  writeSettings(next);
  return {
    ok: true,
    ...sim,
    edgeLogged: edgeOk,
    scadaLogged: scadaOk,
    assetTags: nextTags,
  };
}

async function simulateMotorAsset(opts = {}) {
  const settings = readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const assetId = String(opts.assetId || '').trim();
  if (!assetId) return { ok: false, error: 'assetId required' };

  const days = clampDays(opts.days ?? pdm.simSeedDays ?? 180);
  const ctx = normalizeAssetContext(
    opts.context || pdm.assetContext?.[assetId] || { motorType: 'pump' },
    assetId,
  );

  const sim = generateMotorAssetSimDocs({
    assetId,
    context: ctx,
    days,
    now: opts.now ? Number(opts.now) : Date.now(),
    projectName: opts.projectName || 'motor_asset_sim',
  });

  const edgeOk = await mongoTagLogger.logEdgeInferences(sim.edgeDocs);
  const scadaOk = await mongoTagLogger.insertPenDocs(sim.scadaDocs);

  const tagIds = (sim.tags || []).map((t) => (typeof t === 'string' ? t : t.id)).filter(Boolean)
    .length ? (sim.tags || []).map((t) => (typeof t === 'string' ? t : t.id)).filter(Boolean)
    : defaultScadaTags(ctx);

  const nextContext = { ...(pdm.assetContext || {}), [assetId]: ctx };
  const nextTags = { ...(pdm.assetTags || {}), [assetId]: tagIds };
  const nextPdm = {
    ...pdm,
    assetContext: nextContext,
    assetTags: nextTags,
    simSeedDays: days,
  };
  const next = { ...settings, pdm: nextPdm };
  writeSettings(next);

  const fromMs = Date.parse(sim.from);
  const toMs = Date.parse(sim.to);
  let featuresBuilt = null;
  if (opts.buildFeatures !== false) {
    featuresBuilt = await buildFeaturesForAsset(assetId, {
      fromMs,
      toMs,
      settings: next,
      tagIds,
    });
  }

  let proactive = null;
  if (opts.runProactive !== false && featuresBuilt) {
    proactive = await evaluateProactiveForAsset(assetId, { settings: next, fromMs, toMs });
  }

  return {
    ok: true,
    ...sim,
    days,
    edgeLogged: edgeOk,
    scadaLogged: scadaOk,
    assetTags: nextTags,
    assetContext: ctx,
    featuresBuilt,
    proactive,
    penSampleCount: sim.scadaDocs?.length ?? 0,
    edgeInferenceCount: sim.edgeDocs?.length ?? 0,
    pdm: nextPdm,
    settings: next,
  };
}

function batchStatus(settings = readSettings()) {
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const cmms = require('../settings/cmmsSettings').readCmmsSettings(settings);
  return {
    enabled: !!pdm.buildEnabled,
    intervalHours: pdm.buildIntervalHours,
    assets: listPdmAssets(pdm),
    assetContextCount: Object.keys(pdm.assetContext || {}).length,
    featuresCollection: pdm.featuresCollection,
    windowMin: pdm.windowMin,
    failureThreshold: pdm.failureThreshold,
    simSeedDays: pdm.simSeedDays,
    reportEnabled: !!pdm.reportEnabled,
    reportIntervalHours: pdm.reportIntervalHours,
    autoWorkOrdersFromPdm: !!cmms.autoWorkOrdersFromPdm,
  };
}

async function evaluateProactiveForAsset(assetId, opts = {}) {
  const settings = opts.settings || readSettings();
  const toMs = Number(opts.toMs) || Date.now();
  const fromMs = Number(opts.fromMs) || (toMs - 7 * DAY_MS);
  const view = await loadPdmView(assetId, { fromMs, toMs, settings });
  const wo = maybeCreatePdmFailureWorkOrder(assetId, {
    forecast: view.forecast,
    rul: view.rul,
    assetContext: view.assetContext,
  });
  return {
    ok: true,
    assetId,
    forecast: view.forecast,
    workOrder: wo,
    created: !!wo,
  };
}

async function evaluateProactiveCmms(opts = {}) {
  const settings = opts.settings || readSettings();
  const pdm = normalizePdmSettings(settings.pdm, settings);
  const assets = listPdmAssets(pdm);
  const toMs = Date.now();
  const fromMs = toMs - 7 * DAY_MS;
  const results = [];
  for (const assetId of assets) {
    results.push(await evaluateProactiveForAsset(assetId, { settings, fromMs, toMs }));
  }
  const created = results.filter((r) => r.created).map((r) => r.workOrder);
  return { ok: true, count: created.length, workOrders: created, assets: results };
}

async function runScheduledPdmReports(opts = {}) {
  return require('./pdmReportService').runScheduledPdmReports(opts);
}

async function buildAssetReportPdf(assetId, opts = {}) {
  return require('./pdmReportService').buildAssetReportPdf(assetId, opts);
}

module.exports = {
  buildFeaturesForAsset,
  buildAllFeatures,
  loadPdmView,
  simulateMotorStart,
  simulateMotorAsset,
  listAssetSetup,
  saveAssetSetup,
  deleteAssetSetup,
  getAssetContextView,
  batchStatus,
  listPdmAssets,
  evaluateProactiveForAsset,
  evaluateProactiveCmms,
  runScheduledPdmReports,
  buildAssetReportPdf,
};
