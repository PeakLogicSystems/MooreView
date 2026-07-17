'use strict';

const { numericTagValue } = require('../tags/graphableTags');

const { defaultColor } = require('../graph/graphPens');
const { DEFAULT_MONGO_LOGGER } = require('../settings/mongoLoggerSettings');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORIAN_MIN_CHUNK_MS = HOUR_MS;
const HISTORIAN_MAX_CHUNK_MS = 30 * DAY_MS;
const DEFAULT_LIMIT_PER_TAG = 5000;
const SEED_BATCH_SIZE = 2000;
const SEED_DEFAULT_DAYS = 90;
const SEED_DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

const SEED_DIGITAL_IDS = ['SEED_DI1', 'SEED_DI2', 'SEED_DI3', 'SEED_DI4'];
const SEED_ANALOG_IDS = ['SEED_AI1', 'SEED_AI2', 'SEED_AI3', 'SEED_AI4', 'SEED_AI5', 'SEED_AI6'];
const SEED_ALL_TAG_IDS = [...SEED_DIGITAL_IDS, ...SEED_ANALOG_IDS];

let client = null;
let collection = null;
let samplesCollection = null;
let edgeCollection = null;
let featuresCollectionHandle = null;
let connecting = null;
let lastSampleLog = 0;

let override = null;

function sampleIntervalMs() {
  return Number(override?.sampleIntervalMs)
    || Number(process.env.MONGODB_SAMPLE_MS)
    || DEFAULT_MONGO_LOGGER.sampleIntervalMs;
}

function uri() {
  return override?.uri || process.env.MONGODB_URI || process.env.MONGO_URL || '';
}

function dbName() {
  return override?.db || process.env.MONGODB_DB || DEFAULT_MONGO_LOGGER.db;
}

function collectionName() {
  return override?.collection || process.env.MONGODB_COLLECTION || DEFAULT_MONGO_LOGGER.collection;
}

function samplesCollectionName() {
  return override?.samplesCollection
    || process.env.MONGODB_SAMPLES_COLLECTION
    || DEFAULT_MONGO_LOGGER.samplesCollection;
}

function edgeCollectionName() {
  return override?.edgeCollection || process.env.MONGODB_EDGE_COLLECTION || DEFAULT_MONGO_LOGGER.edgeCollection;
}

function tagSnapshot(tag) {
  if (!tag) return null;
  return {
    id: tag.id,
    type: tag.type,
    role: tag.role,
    driverId: tag.driverId ?? null,
    driverAddress: tag.driverAddress ?? null,
    value: tag.value,
    quality: tag.quality,
    wordWidth: tag.wordWidth,
    scale: tag.scale,
    offset: tag.offset,
  };
}

function roundSampleValue(value, tagType) {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  if (tagType === 'BOOL') return n ? 1 : 0;
  return Math.round(n * 100) / 100;
}

function penSampleToTsDoc({
  at,
  projectName,
  tagId,
  tagType,
  running,
  sampleValue,
  scaledValue,
  source,
}) {
  const timestamp = at instanceof Date ? at : new Date(at);
  const roundedValue = roundSampleValue(sampleValue, tagType);
  const roundedScaled = scaledValue != null ? roundSampleValue(scaledValue, tagType) : null;
  const metadata = {
    projectName: projectName || 'untitled',
    tagId,
  };
  if (tagType) metadata.tagType = tagType;
  if (source) metadata.source = source;
  const doc = {
    timestamp,
    metadata,
    value: roundedValue,
    running: !!running,
  };
  if (roundedScaled != null) doc.scaledValue = roundedScaled;
  return doc;
}

function legacyPenDocToTs(doc) {
  if (doc?.metadata?.tagId && doc.timestamp) return doc;
  const tagId = doc.pen?.tagId || doc.tag?.id;
  if (!tagId) return null;
  return penSampleToTsDoc({
    at: doc.at || doc.timestamp,
    projectName: doc.projectName || doc.metadata?.projectName,
    tagId,
    tagType: doc.tag?.type || doc.metadata?.tagType,
    running: doc.running,
    sampleValue: doc.sampleValue ?? doc.value,
    scaledValue: doc.scaledValue,
    source: doc.source || doc.metadata?.source,
  });
}

function edgeInferenceToTsDoc(doc) {
  if (doc?.metadata && doc.timestamp) return doc;
  const inference = doc.inference || {};
  return {
    timestamp: doc.at instanceof Date ? doc.at : new Date(doc.at || Date.now()),
    metadata: {
      assetId: doc.assetId || doc.cameraId || null,
      deviceId: doc.deviceId || doc.cameraId || null,
      modelId: doc.modelId || 'unknown',
      cameraId: doc.cameraId || null,
      snapshotId: doc.snapshotId || null,
      source: doc.source || null,
    },
    score: inference.score != null ? Number(inference.score) : null,
    label: inference.label || null,
    confidence: inference.confidence != null ? Number(inference.confidence) : null,
    type: inference.type || 'anomaly',
    features: doc.features && typeof doc.features === 'object' ? doc.features : {},
  };
}

function edgeDocForRead(doc) {
  if (doc.inference) return doc;
  return {
    at: doc.timestamp,
    assetId: doc.metadata?.assetId,
    deviceId: doc.metadata?.deviceId,
    modelId: doc.metadata?.modelId,
    inference: {
      type: doc.type,
      score: doc.score,
      label: doc.label,
      confidence: doc.confidence,
    },
    features: doc.features || {},
  };
}

function tagIdFromSampleDoc(doc) {
  return doc.metadata?.tagId || doc.pen?.tagId || doc.tag?.id;
}

function timestampFromSampleDoc(doc) {
  const at = doc.timestamp ?? doc.at;
  if (at instanceof Date) return at.getTime();
  const ts = Date.parse(at);
  return Number.isFinite(ts) ? ts : NaN;
}

function validateTimeRange(fromMs, toMs) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    return { ok: false, error: 'Invalid from/to timestamps' };
  }
  if (toMs <= fromMs) {
    return { ok: false, error: 'End time must be after start time' };
  }
  const spanMs = toMs - fromMs;
  if (spanMs < HISTORIAN_MIN_CHUNK_MS) {
    return { ok: false, error: 'Time range must be at least 1 hour' };
  }
  if (spanMs > HISTORIAN_MAX_CHUNK_MS) {
    return { ok: false, error: 'Time range cannot exceed 30 days' };
  }
  return { ok: true, spanMs };
}

function downsample(points, maxPoints) {
  if (points.length <= maxPoints) return { points, downsampled: false };
  const step = Math.ceil(points.length / maxPoints);
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return { points: out, downsampled: true };
}

function sampleValueFromDoc(doc) {
  if (doc.value != null && Number.isFinite(Number(doc.value))) {
    return Number(doc.value);
  }
  if (doc.sampleValue != null && Number.isFinite(Number(doc.sampleValue))) {
    return Number(doc.sampleValue);
  }
  const raw = doc.tag?.value;
  if (typeof raw === 'boolean') return raw ? 1 : 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function docsToHistory(docs, tagIds, limitPerTag = DEFAULT_LIMIT_PER_TAG) {
  const idSet = tagIds?.length ? new Set(tagIds) : null;
  const buckets = new Map();
  for (const doc of docs) {
    const tagId = tagIdFromSampleDoc(doc);
    if (!tagId) continue;
    if (idSet && !idSet.has(tagId)) continue;
    const ts = timestampFromSampleDoc(doc);
    if (!Number.isFinite(ts)) continue;
    if (!buckets.has(tagId)) buckets.set(tagId, []);
    buckets.get(tagId).push({
      ts,
      value: sampleValueFromDoc(doc),
      wordWidth: doc.tag?.wordWidth || 16,
    });
  }
  const history = {};
  const counts = {};
  let downsampled = false;
  for (const [tagId, points] of buckets) {
    points.sort((a, b) => a.ts - b.ts);
    const { points: trimmed, downsampled: ds } = downsample(points, limitPerTag);
    if (ds) downsampled = true;
    history[tagId] = trimmed;
    counts[tagId] = trimmed.length;
  }
  if (tagIds?.length) {
    for (const id of tagIds) {
      if (!history[id]) history[id] = [];
      if (counts[id] == null) counts[id] = 0;
    }
  }
  return { history, counts, downsampled };
}

async function ensureTimeSeriesCollection(db, name, { timeField, metaField, granularity }) {
  try {
    await db.createCollection(name, {
      timeseries: { timeField, metaField, granularity },
    });
  } catch (err) {
    if (err.codeName !== 'NamespaceExists' && !String(err.message).includes('already exists')) {
      throw err;
    }
  }
  return db.collection(name);
}

async function connect() {
  if (collection && samplesCollection && edgeCollection) return true;
  const u = uri();
  if (!u) return false;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const { MongoClient } = require('mongodb');
      client = new MongoClient(u);
      await client.connect();
      const db = client.db(dbName());
      collection = db.collection(collectionName());
      samplesCollection = await ensureTimeSeriesCollection(db, samplesCollectionName(), {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'seconds',
      });
      edgeCollection = await ensureTimeSeriesCollection(db, edgeCollectionName(), {
        timeField: 'timestamp',
        metaField: 'metadata',
        granularity: 'seconds',
      });
      await collection.createIndex({ at: -1 });
      await collection.createIndex({ event: 1, 'tag.id': 1 });
      await collection.createIndex({ event: 1, at: -1, 'pen.tagId': 1 });
      try {
        await samplesCollection.createIndex({ 'metadata.tagId': 1, timestamp: -1 });
        await samplesCollection.createIndex({ 'metadata.projectName': 1, timestamp: -1 });
      } catch {
        // Time series collections auto-index time + meta; extra indexes may already exist.
      }
      try {
        await edgeCollection.createIndex({ 'metadata.assetId': 1, timestamp: -1 });
        await edgeCollection.createIndex({ 'metadata.deviceId': 1, timestamp: -1 });
      } catch {
        // Non-fatal if index already exists.
      }
      console.log(
        `[MooreVIEW] MongoDB logger connected: ${dbName()}.${collectionName()}`
        + ` + ${samplesCollectionName()} (time series)`
        + ` + ${edgeCollectionName()} (time series)`
      );
      return true;
    } catch (e) {
      console.warn('[MooreVIEW] MongoDB logger:', e.message);
      client = null;
      collection = null;
      samplesCollection = null;
      edgeCollection = null;
      featuresCollectionHandle = null;
      return false;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

async function featuresCollection(name) {
  if (!(await connect())) return null;
  const colName = String(name || 'pdm_features').trim() || 'pdm_features';
  if (!featuresCollectionHandle || featuresCollectionHandle.collectionName !== colName) {
    featuresCollectionHandle = client.db(dbName()).collection(colName);
    await featuresCollectionHandle.createIndex({ assetId: 1, windowStartMs: -1 });
  }
  return featuresCollectionHandle;
}

function enabled() {
  return !!uri();
}

function status() {
  return {
    enabled: enabled(),
    connected: !!collection,
    db: dbName(),
    collection: collectionName(),
    samplesCollection: samplesCollectionName(),
    edgeCollection: edgeCollectionName(),
    timeSeries: true,
    sampleIntervalMs: sampleIntervalMs(),
    minChunkMs: HISTORIAN_MIN_CHUNK_MS,
    maxChunkMs: HISTORIAN_MAX_CHUNK_MS,
  };
}

async function insertOne(doc) {
  if (!(await connect())) return false;
  try {
    await collection.insertOne({ ...doc, at: doc.at || new Date() });
    return true;
  } catch (e) {
    console.warn('[MooreVIEW] MongoDB insert:', e.message);
    return false;
  }
}

async function insertMany(docs) {
  if (!docs.length) return false;
  if (!(await connect())) return false;
  try {
    await collection.insertMany(
      docs.map((d) => ({ ...d, at: d.at || new Date() })),
      { ordered: false }
    );
    return true;
  } catch (e) {
    console.warn('[MooreVIEW] MongoDB insertMany:', e.message);
    return false;
  }
}

async function insertManySamples(docs) {
  if (!docs.length) return false;
  if (!(await connect())) return false;
  try {
    await samplesCollection.insertMany(docs, { ordered: false });
    return true;
  } catch (e) {
    console.warn('[MooreVIEW] MongoDB sample insert:', e.message);
    return false;
  }
}

/**
 * Log graph pen selection with full tag database rows.
 */
async function logPenSelection({ pens, tags, projectName, source }) {
  if (!enabled() || !pens?.length) return { ok: false, skipped: true };
  const tagMap = new Map((tags || []).map((t) => [t.id, t]));
  const docs = pens.map((pen) => ({
    event: 'pen_selection',
    source: source || 'graph_setup',
    projectName: projectName || 'untitled',
    pen,
    tag: tagSnapshot(tagMap.get(pen.tagId)),
  }));
  const ok = await insertMany(docs);
  return { ok, count: docs.length };
}

/**
 * Periodic sample of configured pen tags while runtime runs.
 */
async function logPenSamples({ pens, tags, runtime }) {
  if (!enabled() || !pens?.length) return { ok: false, skipped: true };
  const now = Date.now();
  if (now - lastSampleLog < sampleIntervalMs()) return { ok: false, skipped: true };
  lastSampleLog = now;

  const tagMap = new Map((tags || []).map((t) => [t.id, t]));
  const at = new Date(now);
  const docs = pens.map((pen) => {
    const tag = tagMap.get(pen.tagId);
    const sampleValue = tag ? numericTagValue(tag) : null;
    return penSampleToTsDoc({
      at,
      projectName: runtime?.projectName,
      tagId: pen.tagId,
      tagType: tag?.type,
      running: !!runtime?.running,
      sampleValue,
      scaledValue: sampleValue != null
        ? (sampleValue * (pen.scale || 1) + (pen.offset || 0))
        : null,
    });
  });
  const ok = await insertManySamples(docs);
  return { ok, count: docs.length };
}

function buildSampleTsFilter({ fromMs, toMs, tagIds, projectName }) {
  const filter = {
    timestamp: { $gte: new Date(fromMs), $lte: new Date(toMs) },
  };
  if (tagIds?.length) filter['metadata.tagId'] = { $in: tagIds };
  if (projectName) filter['metadata.projectName'] = projectName;
  return filter;
}

function buildLegacySampleFilter({ fromMs, toMs, tagIds, projectName }) {
  const filter = {
    event: 'pen_sample',
    at: { $gte: new Date(fromMs), $lte: new Date(toMs) },
  };
  if (tagIds?.length) filter['pen.tagId'] = { $in: tagIds };
  if (projectName) filter.projectName = projectName;
  return filter;
}

/**
 * Retrieve pen_sample documents for historian graph/report (1 hour – 30 day window).
 */
async function queryPenHistory({ from, to, tagIds, projectName, limitPerTag }) {
  if (!enabled()) return { ok: false, error: 'MongoDB logger not configured' };
  const fromMs = typeof from === 'number' ? from : Date.parse(from);
  const toMs = typeof to === 'number' ? to : Date.parse(to);
  const vr = validateTimeRange(fromMs, toMs);
  if (!vr.ok) return { ok: false, error: vr.error };
  if (!(await connect())) return { ok: false, error: 'MongoDB not connected' };

  const lim = Math.min(Math.max(Number(limitPerTag) || DEFAULT_LIMIT_PER_TAG, 100), 20000);
  const tsFilter = buildSampleTsFilter({ fromMs, toMs, tagIds, projectName });
  const legacyFilter = buildLegacySampleFilter({ fromMs, toMs, tagIds, projectName });

  try {
    const [tsDocs, legacyDocs] = await Promise.all([
      samplesCollection.find(tsFilter).sort({ timestamp: 1 }).toArray(),
      collection.find(legacyFilter).sort({ at: 1 }).toArray(),
    ]);
    const docs = [...legacyDocs, ...tsDocs];
    const { history, counts, downsampled } = docsToHistory(docs, tagIds, lim);
    return {
      ok: true,
      history,
      meta: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        spanMs: vr.spanMs,
        tagIds: tagIds?.length ? tagIds : Object.keys(history),
        counts,
        totalDocs: docs.length,
        downsampled,
        source: 'mongo',
        samplesCollection: samplesCollectionName(),
      },
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

function seededRandom(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483646 || 1;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

function buildSeedTagDefinitions() {
  const digital = SEED_DIGITAL_IDS.map((id) => ({
    id,
    type: 'BOOL',
    role: 'input',
    value: false,
    graphEnabled: true,
    quality: 'good',
  }));
  const analog = SEED_ANALOG_IDS.map((id) => ({
    id,
    type: 'REAL',
    role: 'input',
    value: 0,
    graphEnabled: true,
    wordWidth: 16,
    quality: 'good',
  }));
  return [...digital, ...analog];
}

function buildSeedPens() {
  return SEED_ALL_TAG_IDS.map((tagId, i) => ({
    tagId,
    color: defaultColor(i),
    scale: 1,
    offset: 0,
    ymin: tagId.startsWith('SEED_DI') ? 0 : 0,
    ymax: tagId.startsWith('SEED_DI') ? 1 : 100,
    autoScale: true,
  }));
}

/**
 * Build pen_sample time-series documents for demo historian data (pure, for tests and seeding).
 */
function generateSeedSampleDocs({
  days = SEED_DEFAULT_DAYS,
  intervalMs = SEED_DEFAULT_INTERVAL_MS,
  projectName = 'seed_demo',
  now = Date.now(),
}) {
  const dayCount = Math.min(Math.max(Number(days) || SEED_DEFAULT_DAYS, 1), 90);
  const stepMs = Math.max(Number(intervalMs) || SEED_DEFAULT_INTERVAL_MS, 60 * 1000);
  const endMs = now;
  const startMs = endMs - dayCount * DAY_MS;
  const pens = buildSeedPens();
  const penByTag = new Map(pens.map((p) => [p.tagId, p]));
  const docs = [];
  let tick = 0;
  for (let t = startMs; t <= endMs; t += stepMs) {
    const at = new Date(t);
    for (let tagIdx = 0; tagIdx < SEED_ALL_TAG_IDS.length; tagIdx++) {
      const tagId = SEED_ALL_TAG_IDS[tagIdx];
      const pen = penByTag.get(tagId);
      const isDigital = tagId.startsWith('SEED_DI');
      const rnd = seededRandom(tagIdx * 9973 + tick);
      let sampleValue;
      if (isDigital) {
        sampleValue = rnd() > 0.52 ? 1 : 0;
      } else {
        const hours = (t - startMs) / HOUR_MS;
        const analogIdx = tagIdx - SEED_DIGITAL_IDS.length;
        const base = 40 + analogIdx * 8
          + 25 * Math.sin((hours / 24) * Math.PI * 2 + analogIdx * 0.7);
        sampleValue = Math.round((base + (rnd() - 0.5) * 6) * 100) / 100;
      }
      docs.push(penSampleToTsDoc({
        at,
        projectName,
        tagId,
        tagType: isDigital ? 'BOOL' : 'REAL',
        running: false,
        sampleValue,
        scaledValue: sampleValue * (pen.scale || 1) + (pen.offset || 0),
        source: 'seed',
      }));
    }
    tick++;
  }
  return {
    docs,
    startMs,
    endMs,
    dayCount,
    intervalMs: stepMs,
    tags: SEED_ALL_TAG_IDS,
    pens,
    sampleCount: docs.length,
  };
}

async function purgeHistory({ from, to, tagIds, projectName, events, all }) {
  if (!enabled()) return { ok: false, error: 'MongoDB logger not configured' };
  if (!(await connect())) return { ok: false, error: 'MongoDB not connected' };

  const evts = events?.length ? events : ['pen_sample', 'pen_selection'];
  let deletedCount = 0;

  try {
    if (evts.includes('pen_sample')) {
      const sampleFilter = {};
      if (!all) {
        const fromMs = typeof from === 'number' ? from : Date.parse(from);
        const toMs = typeof to === 'number' ? to : Date.parse(to);
        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
          return { ok: false, error: 'Invalid from/to timestamps' };
        }
        if (toMs <= fromMs) return { ok: false, error: 'End time must be after start time' };
        sampleFilter.timestamp = { $gte: new Date(fromMs), $lte: new Date(toMs) };
      }
      if (tagIds?.length) sampleFilter['metadata.tagId'] = { $in: tagIds };
      if (projectName) sampleFilter['metadata.projectName'] = projectName;
      const sampleResult = await samplesCollection.deleteMany(sampleFilter);
      deletedCount += sampleResult.deletedCount;

      const legacyFilter = { event: 'pen_sample' };
      if (!all) {
        const fromMs = typeof from === 'number' ? from : Date.parse(from);
        const toMs = typeof to === 'number' ? to : Date.parse(to);
        legacyFilter.at = { $gte: new Date(fromMs), $lte: new Date(toMs) };
      }
      if (tagIds?.length) legacyFilter['pen.tagId'] = { $in: tagIds };
      if (projectName) legacyFilter.projectName = projectName;
      const legacyResult = await collection.deleteMany(legacyFilter);
      deletedCount += legacyResult.deletedCount;
    }

    if (evts.includes('pen_selection')) {
      const selectionFilter = { event: 'pen_selection' };
      if (!all) {
        const fromMs = typeof from === 'number' ? from : Date.parse(from);
        const toMs = typeof to === 'number' ? to : Date.parse(to);
        if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
          return { ok: false, error: 'Invalid from/to timestamps' };
        }
        if (toMs <= fromMs) return { ok: false, error: 'End time must be after start time' };
        selectionFilter.at = { $gte: new Date(fromMs), $lte: new Date(toMs) };
      }
      if (tagIds?.length) selectionFilter['pen.tagId'] = { $in: tagIds };
      if (projectName) selectionFilter.projectName = projectName;
      const selectionResult = await collection.deleteMany(selectionFilter);
      deletedCount += selectionResult.deletedCount;
    }

    return { ok: true, deletedCount };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function seedDemoHistory({
  days = SEED_DEFAULT_DAYS,
  intervalMs = SEED_DEFAULT_INTERVAL_MS,
  projectName = 'seed_demo',
}) {
  if (!enabled()) return { ok: false, error: 'MongoDB logger not configured' };
  if (!(await connect())) return { ok: false, error: 'MongoDB not connected' };

  const generated = generateSeedSampleDocs({ days, intervalMs, projectName });
  let inserted = 0;
  try {
    for (let i = 0; i < generated.docs.length; i += SEED_BATCH_SIZE) {
      const batch = generated.docs.slice(i, i + SEED_BATCH_SIZE);
      await samplesCollection.insertMany(batch, { ordered: false });
      inserted += batch.length;
    }
    return {
      ok: true,
      inserted,
      projectName,
      tags: generated.tags,
      pens: generated.pens,
      tagDefinitions: buildSeedTagDefinitions(),
      from: new Date(generated.startMs).toISOString(),
      to: new Date(generated.endMs).toISOString(),
      days: generated.dayCount,
      intervalMs: generated.intervalMs,
      digitalCount: SEED_DIGITAL_IDS.length,
      analogCount: SEED_ANALOG_IDS.length,
      samplesCollection: samplesCollectionName(),
    };
  } catch (e) {
    return { ok: false, error: e.message || String(e), inserted };
  }
}

async function close() {
  if (client) {
    try { await client.close(); } catch { /* ignore */ }
  }
  client = null;
  collection = null;
  samplesCollection = null;
  edgeCollection = null;
  featuresCollectionHandle = null;
}

function normalizeEdgeInference(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const score = raw.score ?? raw.inference?.score;
  const label = raw.label ?? raw.inference?.label;
  const modelId = raw.modelId ?? raw.model;
  const assetId = raw.assetId;
  if (score == null && !label && !modelId) return null;
  return {
    modelId: modelId || 'unknown',
    assetId: assetId || null,
    inference: {
      type: raw.type || raw.inference?.type || 'anomaly',
      score: score != null ? Number(score) : null,
      label: label || null,
      confidence: raw.confidence ?? raw.inference?.confidence ?? null,
    },
    features: raw.features && typeof raw.features === 'object' ? raw.features : {},
  };
}

function extractEdgePayloads(body) {
  if (!body || typeof body !== 'object') return [];
  const deviceId = body.deviceId || body.device || body.id || null;
  const edgeAi = body.edgeAi ?? body.edge_ai ?? body.inference;
  if (!edgeAi) {
    if (Array.isArray(body.tags) && !body.tags.length) return [];
    return [];
  }
  const list = Array.isArray(edgeAi) ? edgeAi : [edgeAi];
  const docs = [];
  for (const item of list) {
    const norm = normalizeEdgeInference(item);
    if (!norm) continue;
    docs.push({
      event: 'edge_inference',
      deviceId,
      assetId: norm.assetId || item.assetId || body.assetId || deviceId,
      modelId: norm.modelId,
      inference: norm.inference,
      features: norm.features,
    });
  }
  return docs;
}

async function logEdgeInferences(docs) {
  if (!enabled() || !docs?.length) return { ok: false, skipped: true };
  if (!(await connect())) return { ok: false, error: 'MongoDB not connected' };
  try {
    const tsDocs = docs.map((d) => edgeInferenceToTsDoc(d));
    await edgeCollection.insertMany(tsDocs, { ordered: false });
    return { ok: true, count: tsDocs.length };
  } catch (e) {
    console.warn('[MooreVIEW] MongoDB edge insert:', e.message);
    return { ok: false, error: e.message || String(e) };
  }
}

async function logEdgeFromReport(body) {
  const docs = extractEdgePayloads(body);
  if (!docs.length) return { ok: false, skipped: true, count: 0 };
  return logEdgeInferences(docs);
}

async function insertPenDocs(docs) {
  if (!enabled() || !docs?.length) return false;
  const tsDocs = docs.map((d) => legacyPenDocToTs(d)).filter(Boolean);
  return insertManySamples(tsDocs);
}

async function queryPenDocs({ from, to, tagIds, projectName }) {
  if (!enabled()) return [];
  const fromMs = typeof from === 'number' ? from : Date.parse(from);
  const toMs = typeof to === 'number' ? to : Date.parse(to);
  if (!(await connect())) return [];
  const tsFilter = buildSampleTsFilter({ fromMs, toMs, tagIds, projectName });
  const legacyFilter = buildLegacySampleFilter({ fromMs, toMs, tagIds, projectName });
  try {
    const [tsDocs, legacyDocs] = await Promise.all([
      samplesCollection.find(tsFilter).sort({ timestamp: 1 }).toArray(),
      collection.find(legacyFilter).sort({ at: 1 }).toArray(),
    ]);
    return [...legacyDocs, ...tsDocs];
  } catch {
    return [];
  }
}

async function queryEdgeDocs({ from, to, assetId, deviceId, cameraId }) {
  if (!enabled()) return [];
  const fromMs = typeof from === 'number' ? from : Date.parse(from);
  const toMs = typeof to === 'number' ? to : Date.parse(to);
  if (!(await connect())) return [];
  const tsFilter = {
    timestamp: { $gte: new Date(fromMs), $lte: new Date(toMs) },
  };
  if (assetId) tsFilter['metadata.assetId'] = assetId;
  if (deviceId) tsFilter['metadata.deviceId'] = deviceId;
  if (cameraId) tsFilter['metadata.cameraId'] = cameraId;
  const legacyFilter = {
    at: { $gte: new Date(fromMs), $lte: new Date(toMs) },
  };
  if (assetId) legacyFilter.assetId = assetId;
  if (deviceId) legacyFilter.deviceId = deviceId;
  if (cameraId) legacyFilter.cameraId = cameraId;
  try {
    const [tsDocs, legacyDocs] = await Promise.all([
      edgeCollection.find(tsFilter).sort({ timestamp: 1 }).toArray(),
      edgeCollection.find(legacyFilter).sort({ at: 1 }).toArray(),
    ]);
    return [...legacyDocs.map(edgeDocForRead), ...tsDocs.map(edgeDocForRead)];
  } catch {
    return [];
  }
}

async function storePdmFeatures({ assetId, features, collection: colName, fromMs, toMs }) {
  const col = await featuresCollection(colName);
  if (!col) return { ok: false, error: 'MongoDB not connected' };
  try {
    await col.deleteMany({
      assetId,
      windowStartMs: { $gte: fromMs, $lte: toMs },
    });
    if (features?.length) {
      await col.insertMany(features.map((f) => ({
        ...f,
        assetId,
        event: 'pdm_feature',
        builtAt: new Date(),
      })), { ordered: false });
    }
    return { ok: true, count: features?.length || 0 };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

async function loadPdmFeatures({ assetId, from, to, collection: colName }) {
  const col = await featuresCollection(colName);
  if (!col) return [];
  const fromMs = typeof from === 'number' ? from : Date.parse(from);
  const toMs = typeof to === 'number' ? to : Date.parse(to);
  try {
    const docs = await col.find({
      assetId,
      windowStartMs: { $gte: fromMs, $lte: toMs },
    }).sort({ windowStartMs: 1 }).toArray();
    return docs;
  } catch {
    return [];
  }
}

async function getDb() {
  if (!(await connect())) return null;
  return client.db(dbName());
}

async function getClient() {
  if (!(await connect())) return null;
  return client;
}

module.exports = {
  HISTORIAN_MIN_CHUNK_MS,
  HISTORIAN_MAX_CHUNK_MS,
  SEED_DIGITAL_IDS,
  SEED_ANALOG_IDS,
  SEED_ALL_TAG_IDS,
  validateTimeRange,
  docsToHistory,
  penSampleToTsDoc,
  legacyPenDocToTs,
  edgeInferenceToTsDoc,
  tagIdFromSampleDoc,
  timestampFromSampleDoc,
  buildSeedTagDefinitions,
  buildSeedPens,
  generateSeedSampleDocs,
  setConfig: async (cfg) => {
    override = cfg && typeof cfg === 'object' ? { ...cfg } : null;
    await close();
  },
  clearConfig: async () => {
    override = null;
    await close();
  },
  enabled,
  status,
  connect,
  getDb,
  getClient,
  logPenSelection,
  logPenSamples,
  queryPenHistory,
  purgeHistory,
  seedDemoHistory,
  normalizeEdgeInference,
  extractEdgePayloads,
  logEdgeInferences,
  logEdgeFromReport,
  insertPenDocs,
  queryPenDocs,
  queryEdgeDocs,
  storePdmFeatures,
  loadPdmFeatures,
  close,
};
