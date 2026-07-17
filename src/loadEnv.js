'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/** mooreview-cloud package root (parent of src/). */
const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.example');
const SAAS_ENV_PATH = process.env.MOOREVIEW_SAAS_ENV || '/etc/mooreview/saas.env';

/** Local dev only — seed writes these when .env keys are missing (never overwrites existing). */
const DEV_ENV_DEFAULTS = {
  MONGODB_URI: 'mongodb://localhost:27017',
  PLATFORM_ADMIN_KEY: 'mooreview-platform-dev',
  JWT_SECRET: 'mooreview-jwt-dev-local-only',
};

const JWT_PLACEHOLDER = 'change-me-in-production-use-long-random-string';

/**
 * Load .env from the package root (not process.cwd()).
 * Safe to call more than once; later calls do not override existing env vars unless override=true.
 * @param {{ override?: boolean }} [opts]
 * @returns {{ projectRoot: string, envPath: string, envExists: boolean, loaded: boolean, error?: Error }}
 */
function loadEnv(opts = {}) {
  const envExists = fs.existsSync(ENV_PATH);
  const result = dotenv.config({ path: ENV_PATH, override: Boolean(opts.override) });
  // Production SaaS: canonical secrets live in /etc/mooreview/saas.env (not repo-root saas.env).
  // Re-parse with override so edits + LF normalization win over stale systemd/CRLF values.
  if (fs.existsSync(SAAS_ENV_PATH)) {
    dotenv.config({ path: SAAS_ENV_PATH, override: true });
  }
  return {
    projectRoot: PROJECT_ROOT,
    envPath: ENV_PATH,
    saasEnvPath: SAAS_ENV_PATH,
    envExists,
    loaded: !result.error,
    error: result.error || undefined,
  };
}

/**
 * Read KEY=value from .env file (ignores process.env).
 * @param {string} key
 * @returns {string|null} null if key absent from file
 */
function readEnvFileValue(key) {
  if (!fs.existsSync(ENV_PATH)) return null;
  const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`);
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = line.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function isEnvValueMissing(key, fileValue) {
  if (fileValue === null) return true;
  if (fileValue === '') return true;
  if (key === 'JWT_SECRET' && fileValue === JWT_PLACEHOLDER) return true;
  return false;
}

/**
 * Ensure dev defaults exist in .env for local seed/demo. Never overwrites non-empty values.
 * Creates .env from .env.example when missing.
 * @returns {{ written: string[], envPath: string }}
 */
function ensureDevEnvDefaults() {
  const written = [];
  if (!fs.existsSync(ENV_PATH)) {
    if (fs.existsSync(ENV_EXAMPLE_PATH)) {
      fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
      written.push('(created .env from .env.example)');
    } else {
      fs.writeFileSync(ENV_PATH, `PORT=3100\nMONGODB_URI=mongodb://localhost:27017\nMONGODB_DB=mooreview_cloud\n`, 'utf8');
      written.push('(created minimal .env)');
    }
  }

  let lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  let dirty = false;

  const fileValueFromLines = (key) => {
    const re = new RegExp(`^\\s*${key}\\s*=\\s*(.*)$`);
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    return null;
  };

  for (const [key, defaultValue] of Object.entries(DEV_ENV_DEFAULTS)) {
    const fileValue = fileValueFromLines(key);
    if (!isEnvValueMissing(key, fileValue)) continue;

    const re = new RegExp(`^(\\s*${key}\\s*=\\s*).*$`);
    const idx = lines.findIndex((line) => re.test(line));
    if (idx >= 0) {
      lines[idx] = `${key}=${defaultValue}`;
    } else {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      lines.push(`# Local dev only — change before production`);
      lines.push(`${key}=${defaultValue}`);
    }
    written.push(`${key}=${defaultValue}`);
    dirty = true;
  }

  if (dirty) {
    fs.writeFileSync(ENV_PATH, lines.join('\n').replace(/\n?$/, '\n'), 'utf8');
  }

  return { written, envPath: ENV_PATH };
}

module.exports = {
  loadEnv,
  ensureDevEnvDefaults,
  PROJECT_ROOT,
  ENV_PATH,
  DEV_ENV_DEFAULTS,
};
