'use strict';

const { QUALITY } = require('../tags/constants');
const { mergeNextcenturyTagsIntoStore } = require('./nextcenturyTagSync');

const AUTH_URL = 'https://api.nextcenturymeters.com/login';
const BASE_API_URL = 'https://api.nextcenturymeters.com/api';
const DEFAULT_POLL_MS = 15 * 60 * 1000;
const DEFAULT_REPORT_ID = 'rt_4510';
const PROPERTY_DELAY_MS = 600;
const TOKEN_TTL_MS = 55 * 60 * 1000;

const NUMERIC_FIELDS = new Set([
  'temperature',
  'currentReading',
  'previousReading',
  'totalUsage',
  'propertyId',
]);

function reportDateStr(d = new Date()) {
  return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRt4510Row(row, propertyId) {
  return {
    propertyId,
    installationType: row[0] || null,
    leakStatus: row[1] || null,
    unknown1: row[2] || null,
    area: row[3] || null,
    unknown2: row[4] || null,
    deviceType: row[5] || null,
    temperature: row[6] != null && row[6] !== '' ? Number(row[6]) : null,
    deviceId: row[7] || null,
    meterModel: row[8] || null,
    currentReading: row[9] != null && row[9] !== '' ? Number(row[9]) : null,
    previousReading: row[10] != null && row[10] !== '' ? Number(row[10]) : null,
    totalUsage: row[11] != null && row[11] !== '' ? Number(row[11]) : null,
    unitNumber: row[12] || null,
    description: row[13] || null,
  };
}

function leakIsActive(leakStatus) {
  const s = String(leakStatus || '').trim().toLowerCase();
  if (!s) return false;
  if (s.includes('no leak') || s === 'dry' || s === 'ok') return false;
  return s.includes('leak') || s.includes('wet');
}

function fieldValue(doc, field) {
  if (!doc || !field) return null;
  if (field === 'leakActive') return leakIsActive(doc.leakStatus);
  if (field === '_deviceCount') return doc._deviceCount ?? null;
  if (field === '_lastCollectEpoch') return doc._lastCollectEpoch ?? null;
  if (NUMERIC_FIELDS.has(field)) {
    const v = doc[field];
    return v == null || Number.isNaN(Number(v)) ? null : Number(v);
  }
  const text = doc[field];
  if (text == null) return null;
  return String(text);
}

function coerceForTag(tag, raw) {
  if (raw == null) return tag.type === 'BOOL' ? false : 0;
  if (tag.type === 'BOOL') return !!raw;
  if (tag.type === 'INT') {
    if (typeof raw === 'number') return Math.trunc(raw);
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function tagAddress(tag) {
  const a = tag.driverAddress;
  if (!a || typeof a !== 'object') return null;
  const deviceId = String(a.deviceId || '').trim();
  const field = String(a.field || 'totalUsage').trim();
  if (!deviceId) return null;
  return { deviceId, field };
}

class NextcenturyDriver {
  constructor(cfg) {
    this.cfg = cfg || {};
    this.connected = false;
    this._lastError = '';
    this._jwtToken = '';
    this._tokenExpiry = 0;
    this._deviceCache = new Map();
    this._lastPollAt = 0;
    this._lastCollectEpoch = 0;
    this._propertyIds = [];
  }

  health() {
    if (!this.connected) return this._lastError || 'disconnected';
    const age = this._lastPollAt ? Math.round((Date.now() - this._lastPollAt) / 1000) : null;
    return age != null ? `OK · last poll ${age}s ago` : 'OK';
  }

  _pollIntervalMs() {
    const n = Number(this.cfg.pollIntervalMs);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_POLL_MS;
  }

  _credentials() {
    const email = String(this.cfg.email || process.env.NEXTCENTURY_EMAIL || '').trim();
    const password = String(this.cfg.password || process.env.NEXTCENTURY_PASSWORD || '');
    if (!email || !password) {
      throw new Error('NextCentury email and password required (driver config or NEXTCENTURY_* env)');
    }
    return { email, password };
  }

  async _login() {
    if (this._jwtToken && Date.now() < this._tokenExpiry - 60_000) return;
    const { email, password } = this._credentials();
    const res = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs || 15000),
    });
    if (!res.ok) throw new Error(`NextCentury login HTTP ${res.status}`);
    const data = await res.json();
    const token = data.token || data.access_token;
    if (!token) throw new Error('NextCentury login: no token');
    this._jwtToken = token;
    this._tokenExpiry = Date.now() + TOKEN_TTL_MS;
  }

  async _apiGet(path) {
    await this._login();
    const res = await fetch(`${BASE_API_URL}${path}`, {
      headers: { Authorization: this._jwtToken },
      signal: AbortSignal.timeout(this.cfg.timeoutMs || 20000),
    });
    if (!res.ok) {
      const gatewayHint = res.status === 502 || res.status === 503 || res.status === 504
        ? ' — NextCentury API gateway error; retry later or set propertyIds to limit poll scope'
        : '';
      throw new Error(`NextCentury HTTP ${res.status} ${path}${gatewayHint}`);
    }
    return res.json();
  }

  async _loadPropertyIds() {
    const configured = Array.isArray(this.cfg.propertyIds)
      ? this.cfg.propertyIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [];
    if (configured.length) {
      this._propertyIds = configured;
      return;
    }
    const properties = await this._apiGet('/Properties');
    if (!Array.isArray(properties)) throw new Error('NextCentury: expected property array');
    this._propertyIds = properties
      .map((p) => (p._id?.startsWith('p_') ? parseInt(p._id.slice(2), 10) : null))
      .filter((id) => id != null && !Number.isNaN(id));
  }

  async _pollReports() {
    const reportId = String(this.cfg.reportId || DEFAULT_REPORT_ID).trim();
    const dateStr = reportDateStr();
    const delayMs = Number(this.cfg.propertyDelayMs) || PROPERTY_DELAY_MS;
    const nextCache = new Map();
    const collectedAt = Date.now();

    await this._loadPropertyIds();
    for (const propertyId of this._propertyIds) {
      const path = `/Properties/${propertyId}/RunReport/${reportId}?start=${dateStr}&end=${dateStr}`;
      try {
        const data = await this._apiGet(path);
        for (const row of data?.rows || []) {
          const doc = parseRt4510Row(row, propertyId);
          if (!doc.deviceId) continue;
          nextCache.set(doc.deviceId, {
            ...doc,
            _lastCollectEpoch: Math.floor(collectedAt / 1000),
          });
        }
      } catch (e) {
        this._lastError = `Property ${propertyId}: ${e.message}`;
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    this._deviceCache = nextCache;
    this._lastPollAt = collectedAt;
    this._lastCollectEpoch = Math.floor(collectedAt / 1000);
    this.connected = true;
    this._lastError = '';
  }

  async connect(cfg) {
    this.cfg = cfg || this.cfg;
    try {
      await this._login();
      await this._loadPropertyIds();
      this.connected = true;
      this._lastError = '';
      return true;
    } catch (e) {
      this.connected = false;
      this._lastError = e.message || String(e);
      return false;
    }
  }

  async disconnect() {
    this.connected = false;
    this._jwtToken = '';
    this._tokenExpiry = 0;
    this._deviceCache.clear();
    this._lastPollAt = 0;
  }

  _applyCacheToTags(tags, store) {
    const meta = {
      _deviceCount: this._deviceCache.size,
      _lastCollectEpoch: this._lastCollectEpoch,
    };
    for (const tag of tags) {
      const addr = tagAddress(tag);
      if (!addr) {
        store.setValue(tag.id, store.get(tag.id)?.value ?? tag.default, QUALITY.STALE);
        continue;
      }
      let doc = null;
      if (addr.field === '_deviceCount' || addr.field === '_lastCollectEpoch') {
        doc = meta;
      } else {
        doc = this._deviceCache.get(addr.deviceId);
      }
      if (!doc) {
        store.setValue(tag.id, store.get(tag.id)?.value ?? tag.default, QUALITY.STALE);
        continue;
      }
      const raw = fieldValue(doc, addr.field);
      store.setValue(tag.id, coerceForTag(tag, raw), QUALITY.GOOD);
    }
  }

  async readBatch(tags, store) {
    const pollMs = this._pollIntervalMs();
    const due = !this._lastPollAt || Date.now() - this._lastPollAt >= pollMs;
    let polled = false;
    if (due) {
      try {
        await this._pollReports();
        polled = true;
      } catch (e) {
        this._lastError = e.message || String(e);
        this.connected = false;
      }
    }
    if (
      polled
      && this.cfg.autoSyncTags !== false
      && store
      && typeof store.list === 'function'
      && typeof store.replaceAll === 'function'
      && this.cfg.id
    ) {
      const merged = mergeNextcenturyTagsIntoStore(
        store.list(),
        this._deviceCache,
        this.cfg.id,
        {
          _deviceCount: this._deviceCache.size,
          _lastCollectEpoch: this._lastCollectEpoch,
        },
      );
      if (merged.ok) {
        store.replaceAll(merged.tags, { keepForces: true });
        tags = store.list().filter(
          (t) => t.driverId === this.cfg.id && t.driverAddress,
        );
      } else if (merged.error && !this._lastError) {
        this._lastError = merged.error;
      }
    }
    this._applyCacheToTags(tags, store);
  }

  async writeBatch() {
    /* read-only API */
  }
}

module.exports = {
  NextcenturyDriver,
  parseRt4510Row,
  leakIsActive,
  fieldValue,
  reportDateStr,
};
