'use strict';

const persistence = require('../persistence');
const { normalizeCloudRemote } = require('../settings/cloudRemoteSettings');

function cloudRemoteFromSettings() {
  const settings = persistence.readJson('settings.json', {});
  return normalizeCloudRemote(settings.cloudRemote, settings.cloudRemote);
}

function cloudApiBase(cfg) {
  const url = String(cfg?.cloudApiUrl || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  return url;
}

function applianceHeaders(cfg) {
  const headers = { Accept: 'application/json' };
  if (cfg?.tenantId) headers['X-Mooreview-Tenant-Id'] = String(cfg.tenantId);
  if (cfg?.applianceId) headers['X-Mooreview-Appliance-Id'] = String(cfg.applianceId);
  return headers;
}

async function cloudFetch(path, opts = {}) {
  const cfg = opts.cloudRemote || cloudRemoteFromSettings();
  const base = cloudApiBase(cfg);
  if (!base) {
    throw Object.assign(new Error('Cloud API URL not configured (pair appliance or set cloudRemote.cloudApiUrl)'), { status: 400 });
  }
  if (!cfg.tenantId || !cfg.applianceId) {
    throw Object.assign(new Error('Appliance not paired to a cloud tenant'), { status: 400 });
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...applianceHeaders(cfg),
      ...(opts.headers || {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || res.statusText };
  }
  if (!res.ok) {
    throw Object.assign(new Error(data?.error || `Cloud request failed (${res.status})`), { status: res.status });
  }
  return data;
}

async function cloudFetchBinary(path, opts = {}) {
  const cfg = opts.cloudRemote || cloudRemoteFromSettings();
  const base = cloudApiBase(cfg);
  if (!base) {
    throw Object.assign(new Error('Cloud API URL not configured (pair appliance or set cloudRemote.cloudApiUrl)'), { status: 400 });
  }
  if (!cfg.tenantId || !cfg.applianceId) {
    throw Object.assign(new Error('Appliance not paired to a cloud tenant'), { status: 400 });
  }
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      Accept: 'application/zip, application/octet-stream',
      ...applianceHeaders(cfg),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(text || `Cloud request failed (${res.status})`), { status: res.status });
  }
  return Buffer.from(await res.arrayBuffer());
}

async function listCloudCatalog(cloudRemote) {
  const data = await cloudFetch('/api/project-hub/catalog', { cloudRemote });
  return Array.isArray(data.projects) ? data.projects : [];
}

async function fetchCloudArchive(id, cloudRemote) {
  return cloudFetchBinary(`/api/project-hub/catalog/${encodeURIComponent(id)}/file`, { cloudRemote });
}

async function publishToCloud(archiveBuffer, meta = {}, cloudRemote) {
  const buf = Buffer.isBuffer(archiveBuffer) ? archiveBuffer : Buffer.from(archiveBuffer);
  return cloudFetch('/api/project-hub/publish', {
    method: 'POST',
    cloudRemote,
    body: {
      name: meta.name,
      description: meta.description || '',
      archiveBase64: buf.toString('base64'),
    },
    headers: cloudRemote?.pairingKey ? { 'X-Mooreview-Pairing-Key': String(cloudRemote.pairingKey) } : {},
  });
}

module.exports = {
  cloudRemoteFromSettings,
  listCloudCatalog,
  fetchCloudArchive,
  publishToCloud,
};
