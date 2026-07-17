'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('./loadEnv');

loadEnv();

/** Trim env secrets; strip CRLF (WinSCP), BOM, and one layer of quotes. */
function readEnvSecret(name, fallback = '') {
  let value = String(process.env[name] || fallback)
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

/** True when saas.env still has install-template placeholders. */
function isEnvPlaceholder(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^(REPLACE_WITH_|CHANGE_ME|YOUR_|XXXXX)/i.test(v)) return true;
  if (/replace_with_openssl_rand/i.test(v)) return true;
  return false;
}

function resolvePlatformAdminKey() {
  const raw = readEnvSecret('PLATFORM_ADMIN_KEY');
  return isEnvPlaceholder(raw) ? '' : raw;
}

function isPlatformAdminConfigured() {
  return Boolean(resolvePlatformAdminKey());
}

function platformAdminKeyMatches(input) {
  const expected = resolvePlatformAdminKey();
  if (!expected) return false;
  const provided = String(input || '').trim();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.MOOREVIEW_DATA || path.join(ROOT, 'data');

function resolveStDir() {
  const raw = process.env.MOOREVIEW_ST || path.join(ROOT, 'st');
  let dir = path.resolve(raw);
  try {
    if (fs.existsSync(dir)) {
      dir = fs.realpathSync.native(dir);
    }
  } catch {
    /* keep resolved path */
  }
  return dir;
}

const ST_DIR = resolveStDir();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_PROGRAM = 'program.st';

/** Cloud API listen port (npm start → src/server.js). */
const PORT = Number(process.env.PORT) || 3100;
const MONGODB_URI = process.env.MONGODB_URI
  || process.env.MONGO_URL
  || process.env.DOCUMENTDB_URI
  || '';
const MONGODB_DB = process.env.MONGODB_DB || process.env.DOCUMENTDB_DB || 'mooreview_cloud';
const JWT_SECRET = readEnvSecret('JWT_SECRET', 'dev-only-change-in-production');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PLATFORM_ADMIN_KEY = resolvePlatformAdminKey();
const PUBLIC_API_URL = process.env.PUBLIC_API_URL || '';
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || '';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || PUBLIC_APP_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const LIMITS = {
  locationsPerTenant: Number(process.env.MAX_LOCATIONS_PER_TENANT) || 5000,
  systemsPerLocation: Number(process.env.MAX_SYSTEMS_PER_LOCATION) || 1000,
  devicesPerSystem: Number(process.env.MAX_DEVICES_PER_SYSTEM) || 1000,
};

const { getEdition } = require('./product/edition');
const EDITION = getEdition();

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017';
const CONFIG_URI = String(
  process.env.MOOREVIEW_CONFIG_URI
  || process.env.MONGODB_URI
  || process.env.MONGO_URL
  || process.env.DOCUMENTDB_URI
  || DEFAULT_MONGO_URI,
).trim();
const CONFIG_DB = String(process.env.MOOREVIEW_CONFIG_DB || 'mooreview_config').trim() || 'mooreview_config';
const CONFIG_COLLECTION = String(process.env.MOOREVIEW_CONFIG_COLLECTION || 'config_documents').trim() || 'config_documents';
const CONFIG_PROJECTS_COLLECTION = String(
  process.env.MOOREVIEW_CONFIG_PROJECTS_COLLECTION || 'project_snapshots',
).trim() || 'project_snapshots';
const REQUEST_JSON_LIMIT = String(process.env.MOOREVIEW_JSON_LIMIT || '32mb').trim() || '32mb';

module.exports = {
  ROOT,
  DATA_DIR,
  ST_DIR,
  PUBLIC_DIR,
  DEFAULT_PROGRAM,
  MAX_TAGS: Math.max(64, Number(process.env.MOOREVIEW_MAX_TAGS) || 4096),
  DEFAULT_PORT: Number(process.env.MOOREVIEW_RUNTIME_PORT) || Number(process.env.PORT) || 3090,
  DEFAULT_SCAN_MS: 100,
  DEFAULT_MQTT_PARC_BROKER: process.env.MOOREVIEW_MQTT_BROKER || 'mqtt://127.0.0.1:1883',
  DASHBOARD_POLL_MS: 800,
  LIVE_WS_INTERVAL_MS: Number(process.env.LIVE_WS_INTERVAL_MS) || 250,
  AUTH_TOKEN: process.env.MOOREVIEW_TOKEN || '',
  DEPLOYMENT_MODE: process.env.MOOREVIEW_DEPLOYMENT === 'cloud' ? 'cloud' : 'appliance',
  TENANT_ID: process.env.MOOREVIEW_TENANT_ID || 'local',
  CONFIG_URI,
  CONFIG_DB,
  CONFIG_COLLECTION,
  CONFIG_PROJECTS_COLLECTION,
  REQUEST_JSON_LIMIT,
  PORT,
  MONGODB_URI,
  MONGODB_DB,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  PLATFORM_ADMIN_KEY,
  isPlatformAdminConfigured,
  platformAdminKeyMatches,
  PUBLIC_API_URL,
  PUBLIC_APP_URL,
  CORS_ORIGINS,
  LIMITS,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SERVICE_BUS_CONNECTION_STRING: process.env.SERVICE_BUS_CONNECTION_STRING || '',
  SERVICE_BUS_NAMESPACE: process.env.SERVICE_BUS_NAMESPACE || '',
  EVENT_HUB_CONNECTION_STRING: process.env.EVENT_HUB_CONNECTION_STRING || '',
  EVENT_HUB_NAME: process.env.EVENT_HUB_NAME || 'telemetry',
  /** eventhub | servicebus | direct — eventhub is most efficient at scale */
  TELEMETRY_INGEST_MODE: process.env.TELEMETRY_INGEST_MODE || (
    process.env.EVENT_HUB_CONNECTION_STRING ? 'eventhub' : 'servicebus'
  ),
  TELEMETRY_TTL_DAYS: Number(process.env.TELEMETRY_TTL_DAYS) || 7,
  DOCUMENTDB_ENABLED: process.env.DOCUMENTDB_ENABLED === 'true'
    || (process.env.MONGODB_URI || process.env.DOCUMENTDB_URI || '').includes('.mongocluster.cosmos.azure.com'),
  MOOREVIEW_PRODUCT: EDITION.product,
  MOOREVIEW_PLATFORM: process.env.MOOREVIEW_PLATFORM || EDITION.platform,
  EDITION,
};
