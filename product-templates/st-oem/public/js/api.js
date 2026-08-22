'use strict';

const API = '/api';

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const hint = e.message === 'Failed to fetch'
      ? 'Cannot reach the MV-ST-OEM server. Run npm start on the host.'
      : e.message;
    throw new Error(hint);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    if (data.errors) err.errors = data.errors;
    if (data.unknownTags) err.unknownTags = data.unknownTags;
    throw err;
  }
  return data;
}

window.api = {
  getDashboard: () => request('GET', '/dashboard'),
  getTags: () => request('GET', '/tags'),
  putTags: (tags) => request('PUT', '/tags', { tags }),
  getDrivers: () => request('GET', '/drivers'),
  putDrivers: (drivers) => request('PUT', '/drivers', { drivers }),
  listDevicePresets: () => request('GET', '/devices/presets'),
  applyDevicePreset: (body) => request('POST', '/devices/apply', body),
  listPrograms: () => request('GET', '/programs'),
  loadProgram: (path, opts = {}) => request('POST', '/programs/load', {
    path,
    loadFixtures: opts.loadFixtures === true,
  }),
  saveProgram: (path, source) => request('POST', '/programs/save', { path, source }),
  putProgram: (source) => request('PUT', '/program', { source }),
  validateProgram: (source) => request('POST', '/program/validate', { source }),
  runtimeStart: () => request('POST', '/runtime/start'),
  runtimeStop: () => request('POST', '/runtime/stop'),
  putSettings: (s) => request('PUT', '/settings', s),
  getIoMap: () => request('GET', '/io-map'),
  patchIoMapTag: (tagId, body) => request('PATCH', `/io-map/tags/${encodeURIComponent(tagId)}`, body),
  connectDriver: (driverId) => request('POST', '/drivers/connect', { driverId }),
  disconnectDriver: (driverId) => request('POST', '/drivers/disconnect', { driverId }),
  testDriver: (cfg) => request('POST', '/drivers/test', cfg),
};
