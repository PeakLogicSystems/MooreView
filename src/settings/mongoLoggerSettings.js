'use strict';

const DEFAULT_MONGO_LOGGER = {
  uri: 'mongodb://127.0.0.1:27017',
  db: 'mooreview',
  collection: 'tag_logs',
  samplesCollection: 'tag_samples_ts',
  edgeCollection: 'edge_inference_ts',
  sampleIntervalMs: 5000,
};

function defaultMongoLogger() {
  return { ...DEFAULT_MONGO_LOGGER };
}

/** Stored config merged with defaults (for UI display and new projects). */
function effectiveMongoLogger(stored) {
  const ml = stored && typeof stored === 'object' ? stored : {};
  if (ml.uri) {
    return normalizeMongoLogger(ml, {});
  }
  return defaultMongoLogger();
}

function normalizeMongoLogger(incoming, prev = {}) {
  const prevMl = prev?.mongoLogger && typeof prev.mongoLogger === 'object'
    ? prev.mongoLogger
    : {};
  if (incoming === null) return {};
  if (incoming === undefined) return { ...prevMl };
  if (typeof incoming !== 'object') return { ...prevMl };

  const hasUriKey = Object.prototype.hasOwnProperty.call(incoming, 'uri');
  const uri = hasUriKey
    ? String(incoming.uri || '').trim()
    : String(prevMl.uri || '').trim();

  if (!uri) {
    if (hasUriKey) return {};
    return { ...prevMl };
  }

  const db = String(incoming.db ?? prevMl.db ?? DEFAULT_MONGO_LOGGER.db).trim()
    || DEFAULT_MONGO_LOGGER.db;
  const collection = String(incoming.collection ?? prevMl.collection ?? DEFAULT_MONGO_LOGGER.collection).trim()
    || DEFAULT_MONGO_LOGGER.collection;
  const samplesCollection = String(
    incoming.samplesCollection ?? prevMl.samplesCollection ?? DEFAULT_MONGO_LOGGER.samplesCollection
  ).trim() || DEFAULT_MONGO_LOGGER.samplesCollection;
  const edgeCollection = String(incoming.edgeCollection ?? prevMl.edgeCollection ?? DEFAULT_MONGO_LOGGER.edgeCollection).trim()
    || DEFAULT_MONGO_LOGGER.edgeCollection;
  const sampleIntervalMs = Math.max(
    Number(incoming.sampleIntervalMs ?? prevMl.sampleIntervalMs ?? DEFAULT_MONGO_LOGGER.sampleIntervalMs)
      || DEFAULT_MONGO_LOGGER.sampleIntervalMs,
    1000
  );

  return {
    uri,
    db,
    collection,
    samplesCollection,
    edgeCollection,
    sampleIntervalMs,
  };
}

module.exports = {
  DEFAULT_MONGO_LOGGER,
  defaultMongoLogger,
  effectiveMongoLogger,
  normalizeMongoLogger,
};
