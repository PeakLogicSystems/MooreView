'use strict';

const MIN_WINDOW_MS = 60 * 1000;
const MAX_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

function normalizeWindowMs(windowMin) {
  const ms = Math.max(Number(windowMin) || DEFAULT_WINDOW_MS / 60000, 1) * 60 * 1000;
  return Math.min(Math.max(ms, MIN_WINDOW_MS), MAX_WINDOW_MS);
}

function docTimestampMs(doc) {
  const at = doc.timestamp ?? doc.at;
  if (at instanceof Date) return at.getTime();
  const ts = Date.parse(at);
  return Number.isFinite(ts) ? ts : NaN;
}

function numericStats(values) {
  if (!values.length) return { count: 0, avg: null, min: null, max: null };
  let min = values[0];
  let max = values[0];
  let sum = 0;
  for (const v of values) {
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    count: values.length,
    avg: Math.round((sum / values.length) * 10000) / 10000,
    min,
    max,
  };
}

function buildWindows(fromMs, toMs, windowMs) {
  const windows = [];
  for (let start = fromMs; start < toMs; start += windowMs) {
    windows.push({ start, end: Math.min(start + windowMs, toMs) });
  }
  return windows;
}

function scadaStatsForWindow(penDocs, windowStart, windowEnd) {
  const buckets = new Map();
  let sampleCount = 0;
  for (const doc of penDocs) {
    const ts = docTimestampMs(doc);
    if (!Number.isFinite(ts) || ts < windowStart || ts >= windowEnd) continue;
    const tagId = doc.metadata?.tagId || doc.pen?.tagId || doc.tag?.id;
    if (!tagId) continue;
    const value = doc.value != null
      ? Number(doc.value)
      : (doc.sampleValue != null ? Number(doc.sampleValue) : Number(doc.scaledValue));
    if (!Number.isFinite(value)) continue;
    if (!buckets.has(tagId)) buckets.set(tagId, []);
    buckets.get(tagId).push(value);
    sampleCount++;
  }
  const tagStats = {};
  for (const [tagId, values] of buckets) {
    tagStats[tagId] = numericStats(values);
  }
  return { tagStats, sampleCount };
}

function edgeStatsForWindow(edgeDocs, windowStart, windowEnd) {
  const scores = [];
  const startMsValues = [];
  const labels = new Set();
  const models = new Set();
  let inferenceCount = 0;
  for (const doc of edgeDocs) {
    const ts = docTimestampMs(doc);
    if (!Number.isFinite(ts) || ts < windowStart || ts >= windowEnd) continue;
    inferenceCount++;
    const score = doc.inference?.score ?? doc.score;
    if (Number.isFinite(score)) scores.push(score);
    const label = doc.inference?.label ?? doc.label;
    if (label) labels.add(label);
    const modelId = doc.modelId ?? doc.metadata?.modelId;
    if (modelId) models.add(modelId);
    const startMs = doc.features?.startMs;
    if (Number.isFinite(startMs)) startMsValues.push(Number(startMs));
  }
  const scoreStats = numericStats(scores);
  const startMsStats = numericStats(startMsValues);
  return {
    inferenceCount,
    maxScore: scoreStats.max,
    avgScore: scoreStats.avg,
    startMsStats,
    labels: [...labels],
    models: [...models],
  };
}

function healthIndexFromEdge(edge) {
  if (edge.maxScore == null || !Number.isFinite(edge.maxScore)) return null;
  return Math.round((1 - Math.min(Math.max(edge.maxScore, 0), 1)) * 1000) / 1000;
}

function deriveWindowMetrics(scada, tagStats) {
  const derived = {};
  const hrsKeys = Object.keys(tagStats).filter((k) => /_HRS$/i.test(k));
  const startKeys = Object.keys(tagStats).filter((k) => /_STARTS$/i.test(k));
  const ampKeys = Object.keys(tagStats).filter((k) => /(_RAW|_AMPS|CURRENT)/i.test(k));

  if (hrsKeys.length >= 2) {
    const vals = hrsKeys.map((k) => tagStats[k].avg).filter((v) => v != null);
    if (vals.length >= 2) derived.deltaRunHours = Math.round((Math.max(...vals) - Math.min(...vals)) * 1000) / 1000;
  } else if (hrsKeys.length === 1 && tagStats[hrsKeys[0]].max != null && tagStats[hrsKeys[0]].min != null) {
    derived.deltaRunHours = Math.round((tagStats[hrsKeys[0]].max - tagStats[hrsKeys[0]].min) * 1000) / 1000;
  }

  if (startKeys.length) {
    const maxStarts = Math.max(...startKeys.map((k) => tagStats[k].max ?? tagStats[k].avg ?? 0));
    const minStarts = Math.min(...startKeys.map((k) => tagStats[k].min ?? tagStats[k].avg ?? 0));
    derived.startsInWindow = Math.max(0, Math.round(maxStarts - minStarts));
  }

  if (derived.deltaRunHours != null && derived.startsInWindow > 0) {
    derived.runtimePerStartMin = Math.round((derived.deltaRunHours * 60 / derived.startsInWindow) * 100) / 100;
  }

  if (ampKeys.length) {
    const avgs = ampKeys.map((k) => tagStats[k].avg).filter((v) => Number.isFinite(v));
    if (avgs.length) {
      derived.avgRunAmps = Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100;
      derived.maxRunAmps = Math.round(Math.max(...ampKeys.map((k) => tagStats[k].max ?? 0)) * 100) / 100;
    }
  }

  derived.sampleCount = scada?.sampleCount ?? 0;
  derived.dutyCycle = derived.sampleCount > 0 && derived.deltaRunHours != null
    ? Math.min(1, Math.round((derived.deltaRunHours / (scada.windowMinHours || 1)) * 1000) / 1000)
    : null;

  return derived;
}

/**
 * Align SCADA pen_sample docs and edge_inference docs into time windows per asset.
 */
function alignPdmFeatures({
  fromMs,
  toMs,
  assetId,
  windowMin,
  penDocs = [],
  edgeDocs = [],
  assetContext = null,
}) {
  const winMs = normalizeWindowMs(windowMin);
  const windows = buildWindows(fromMs, toMs, winMs);
  const features = windows.map(({ start, end }) => {
    const scada = scadaStatsForWindow(penDocs, start, end);
    scada.windowMinHours = winMs / 3600000;
    const edge = edgeStatsForWindow(edgeDocs, start, end);
    const derived = deriveWindowMetrics(scada, scada.tagStats || {});
    const pumpIdx = assetContext?.pumpIndex || assetContext?.unitIndex;
    if (pumpIdx && edge.startMsStats?.avg != null) {
      scada.tagStats[`MOTOR${pumpIdx}_START_MS`] = edge.startMsStats;
    }
    const contextFromEdge = edgeDocs.find((d) => {
      const ts = docTimestampMs(d);
      return Number.isFinite(ts) && ts >= start && ts < end && d.context;
    })?.context;
    return {
      at: new Date(start).toISOString(),
      windowStartMs: start,
      windowEndMs: end,
      windowMin: winMs / 60000,
      assetId,
      scada,
      edge,
      derived,
      context: assetContext || contextFromEdge || null,
      healthIndex: healthIndexFromEdge(edge),
    };
  });
  return {
    features,
    meta: {
      assetId,
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      windowMin: winMs / 60000,
      windowCount: features.length,
      scadaDocs: penDocs.length,
      edgeDocs: edgeDocs.length,
    },
  };
}

function resolveTagIdsForAsset(assetId, { tagIds, assetTags } = {}) {
  if (tagIds?.length) return tagIds;
  const map = assetTags && typeof assetTags === 'object' ? assetTags : {};
  const mapped = map[assetId];
  return Array.isArray(mapped) ? mapped.map(String) : [];
}

module.exports = {
  MIN_WINDOW_MS,
  MAX_WINDOW_MS,
  DEFAULT_WINDOW_MS,
  normalizeWindowMs,
  alignPdmFeatures,
  resolveTagIdsForAsset,
  deriveWindowMetrics,
  scadaStatsForWindow,
  edgeStatsForWindow,
  healthIndexFromEdge,
};
