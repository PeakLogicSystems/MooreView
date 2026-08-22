'use strict';

const { normalizeSiteKey, siteKeyToAddrKey } = require('./globalAddressKey');

const DEVICE_ID_RE = /^[a-zA-Z0-9._-]{1,64}$/;
const GLOBAL_TOPIC_RE = /^g\/([0-9a-f]{4})\/(.+)$/i;

function normalizeDeviceId(id) {
  const s = String(id || '').trim();
  if (!s || !DEVICE_ID_RE.test(s)) {
    throw new Error('deviceId must be 1-64 chars: letters, digits, . _ -');
  }
  return s;
}

function topicPrefix(cfg) {
  const p = (cfg?.topicPrefix || 'mooreview/v1').replace(/\/+$/, '');
  return p;
}

function topics(cfg, deviceId) {
  const id = normalizeDeviceId(deviceId);
  const base = `${topicPrefix(cfg)}/${id}`;
  return {
    telemetry: `${base}/telemetry`,
    online: `${base}/online`,
    config: `${base}/config`,
    cmd: `${base}/cmd`,
    cmdResponse: `${base}/cmd/response`,
    wildcardTelemetry: `${topicPrefix(cfg)}/+/telemetry`,
    wildcardCmdResponse: `${topicPrefix(cfg)}/+/cmd/response`,
    wildcardOnline: `${topicPrefix(cfg)}/+/online`,
    deviceId: id,
  };
}

function deviceIdFromTopic(topic, cfg) {
  const prefix = topicPrefix(cfg) + '/';
  if (!topic.startsWith(prefix)) return null;
  const rest = topic.slice(prefix.length);
  if (rest.startsWith('g/')) return null;
  const slash = rest.indexOf('/');
  if (slash <= 0) return null;
  const id = rest.slice(0, slash);
  return DEVICE_ID_RE.test(id) ? id : null;
}

/** Subscribe pattern for global P2P tags at a site key. */
function globalWildcardTopic(cfg, siteKey) {
  return `${topicPrefix(cfg)}/g/${siteKeyToAddrKey(siteKey)}/+`;
}

/** Parse mooreview/v1/g/{siteKey4}/{tagName} → { addrKey, tagName, siteKey } or null. */
function parseGlobalTopic(topic, cfg) {
  const prefix = `${topicPrefix(cfg)}/`;
  if (!topic.startsWith(prefix)) return null;
  const rest = topic.slice(prefix.length);
  const m = GLOBAL_TOPIC_RE.exec(rest);
  if (!m) return null;
  const tagName = m[2];
  if (!tagName || tagName.includes('/')) return null;
  const addrKey = m[1].toLowerCase();
  let siteKey;
  try {
    siteKey = normalizeSiteKey(parseInt(addrKey, 16));
  } catch {
    return null;
  }
  return { addrKey, tagName, siteKey };
}

/** Tenant-scoped telemetry: mooreview/v1/{tenant}/{device}/telemetry or mooreview/v1/{device}/telemetry */
function telemetryTopicInfo(topic, cfg) {
  const prefix = `${topicPrefix(cfg)}/`;
  if (!topic.startsWith(prefix) || !topic.endsWith('/telemetry')) return null;
  const rest = topic.slice(prefix.length, -('/telemetry'.length));
  const parts = rest.split('/').filter(Boolean);
  if (parts.length === 1) {
    return { tenantId: null, deviceId: DEVICE_ID_RE.test(parts[0]) ? parts[0] : null };
  }
  if (parts.length === 2 && DEVICE_ID_RE.test(parts[1])) {
    return { tenantId: parts[0], deviceId: parts[1] };
  }
  return null;
}

/** Wildcard for tenant-scoped uplink: mooreview/v1/{tenantId}/{deviceId}/telemetry */
function wildcardTenantTelemetry(cfg) {
  return `${topicPrefix(cfg)}/+/+/telemetry`;
}

/** Resolve device + optional tenant from any Parc telemetry topic. */
function resolveTelemetryRoute(topic, cfg) {
  const info = telemetryTopicInfo(topic, cfg);
  if (!info?.deviceId) return null;
  return info;
}

module.exports = {
  normalizeDeviceId,
  topicPrefix,
  topics,
  deviceIdFromTopic,
  globalWildcardTopic,
  parseGlobalTopic,
  telemetryTopicInfo,
  wildcardTenantTelemetry,
  resolveTelemetryRoute,
};
