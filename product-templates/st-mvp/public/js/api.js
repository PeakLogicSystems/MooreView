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
      ? 'Cannot reach the ST MVP server. Run npm start on the Linux host.'
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
  getProgramFile: (path) => request('GET', `/program/file?path=${encodeURIComponent(path)}`),
  putProgram: (source) => request('PUT', '/program', { source }),
  validateProgram: (source) => request('POST', '/program/validate', { source }),
  openEst: (doc) => request('POST', '/project/est', doc),
  saveEstBlob: async (name) => {
    const res = await fetch(`${API}/project/est?name=${encodeURIComponent(name || 'project')}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    return res.blob();
  },
  saveWorkspace: (project) => request('POST', '/workspace/save', { project }),
  listProjects: () => request('GET', '/projects'),
  saveProject: (name) => request('POST', '/projects/save', { name }),
  newProject: (name) => request('POST', '/projects/new', { name }),
  openProject: (id) => request('POST', '/projects/open', { id }),
  deleteProject: (id) => request('DELETE', `/projects?id=${encodeURIComponent(id)}`),
  runtimeStart: () => request('POST', '/runtime/start'),
  runtimePause: () => request('POST', '/runtime/pause'),
  runtimeResume: () => request('POST', '/runtime/resume'),
  runtimeStop: () => request('POST', '/runtime/stop'),
  putSettings: (s) => request('PUT', '/settings', s),
  setForce: (body) => request('POST', '/debug/force', body),
  clearForce: (tagId) => request('DELETE', `/debug/force?tagId=${encodeURIComponent(tagId)}`),
  getSerialPorts: () => request('GET', '/system/serial-ports'),
  connectDriver: (driverId) => request('POST', '/drivers/connect', { driverId }),
  disconnectDriver: (driverId) => request('POST', '/drivers/disconnect', { driverId }),
  testDriver: (cfg) => request('POST', '/drivers/test', cfg),
};
