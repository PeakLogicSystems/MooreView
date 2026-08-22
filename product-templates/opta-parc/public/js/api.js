'use strict';

const API = (() => {
  const base = (window.MOOREVIEW_API_BASE || 'https://mooreview.io/api').replace(/\/$/, '');
  return base ? `${base}` : '/api';
})();

async function request(method, path, body) {
  const url = path.startsWith('http') ? path : `${API}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const target = API.startsWith('http') ? API : `${location.origin}${API}`;
    const hint = e.message === 'Failed to fetch'
      ? `Cannot reach MooreVIEW API at ${target}. Set MOOREVIEW_API_BASE or start the cloud server.`
      : e.message;
    throw new Error(hint);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    if (data.errors) err.errors = data.errors;
    if (data.unknownTags) err.unknownTags = data.unknownTags;
    if (data.tagIds) err.tagIds = data.tagIds;
    if (data.activeProgram) err.activeProgram = data.activeProgram;
    throw err;
  }
  return data;
}

window.api = {
  getDashboard: (graphTags) => {
    let q = '/dashboard';
    if (graphTags?.length) q += `?graphTags=${graphTags.join(',')}`;
    return request('GET', q);
  },
  openEst: (doc) => request('POST', '/project/est', doc),
  saveEstBlob: async (name) => {
    const url = `${API}/project/est?name=${encodeURIComponent(name || 'project')}`;
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(e.message === 'Failed to fetch' ? `Cannot reach API at ${API}` : e.message);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || 'Save project failed');
    }
    return res.blob();
  },
  saveWorkspace: (project) => request('POST', '/workspace/save', { project }),
  listProjects: () => request('GET', '/projects'),
  saveProject: (name) => request('POST', '/projects/save', { name }),
  newProject: (name) => request('POST', '/projects/new', { name }),
  openProject: (id) => request('POST', '/projects/open', { id }),
  deleteProject: (id) => request('DELETE', `/projects?id=${encodeURIComponent(id)}`),
  putTags: (tags) => request('PUT', '/tags', { tags }),
  putDrivers: (drivers) => request('PUT', '/drivers', { drivers }),
  connectDriver: (driverId) => request('POST', '/drivers/connect', { driverId }),
  disconnectDriver: (driverId) => request('POST', '/drivers/disconnect', { driverId }),
  testDriver: (cfg) => request('POST', '/drivers/test', cfg),
  listDevicePresets: () => request('GET', '/devices/presets'),
  applyDevicePreset: (body) => request('POST', '/devices/apply', body),
  listPrograms: () => request('GET', '/programs'),
  openProgramFolder: () => request('POST', '/programs/open-folder', {}),
  loadProgram: (path, opts = {}) => request('POST', '/programs/load', {
    path,
    loadFixtures: opts.loadFixtures === true,
  }),
  loadProgramFixtures: (path) => request('POST', '/programs/load-fixtures', { path }),
  saveProgram: (path, source) => request('POST', '/programs/save', { path, source }),
  importProgram: (path, source) => request('POST', '/programs/import', { path, source }),
  getProgramFile: (path) => request('GET', `/program/file?path=${encodeURIComponent(path)}`),
  putProgram: (source) => request('PUT', '/program', { source }),
  validateProgram: (source) => request('POST', '/program/validate', { source }),
  ackAlarm: (tagId) => request('POST', '/alarms/ack', { tagId }),
  ackAllAlarms: () => request('POST', '/alarms/ack', { all: true }),
  runtimeStart: () => request('POST', '/runtime/start'),
  runtimePause: () => request('POST', '/runtime/pause'),
  runtimeResume: () => request('POST', '/runtime/resume'),
  runtimeStop: () => request('POST', '/runtime/stop'),
  putSettings: (s) => request('PUT', '/settings', s),
  setForce: (body) => request('POST', '/debug/force', body),
  clearForce: (tagId) => request('DELETE', `/debug/force?tagId=${encodeURIComponent(tagId)}`),
  clearGraph: () => request('POST', '/graph/clear', {}),
  modbusMove: (body) => request('POST', '/modbus/move', body),
  getSerialPorts: () => request('GET', '/system/serial-ports'),
  getTags: () => request('GET', '/tags'),
  mongoLoggerStatus: () => request('GET', '/logger/mongo/status'),
  getMongoHistory: ({ from, to, tags, project, limit }) => {
    const q = new URLSearchParams({ from, to });
    if (tags?.length) q.set('tags', tags.join(','));
    if (project) q.set('project', project);
    if (limit != null) q.set('limit', String(limit));
    return request('GET', `/logger/mongo/history?${q}`);
  },
  purgeMongoHistory: (body) => request('POST', '/logger/mongo/purge', body),
  seedMongoHistory: (body) => request('POST', '/logger/mongo/seed', body),
  listHmiAssets: async () => {
    const data = await request('GET', '/hmi/assets');
    if (Array.isArray(data?.assets)) return data.assets;
    if (Array.isArray(data)) return data;
    return [];
  },
  parcDevices: () => request('GET', '/parc/devices'),
  parcDevice: (id) => request('GET', `/parc/devices/${encodeURIComponent(id)}`),
  parcReport: (body) => request('POST', '/parc/report', body),
  parcAttach: (id, body) => request('POST', `/parc/devices/${encodeURIComponent(id)}/attach`, body || {}),
  parcDetach: (id) => request('POST', `/parc/devices/${encodeURIComponent(id)}/detach`, {}),
  parcCmd: (id, op, body) => request('POST', `/parc/devices/${encodeURIComponent(id)}/cmd`, { op, body }),
  parcDeployProgram: (id, body) => request('POST', `/parc/devices/${encodeURIComponent(id)}/program`, body || {}),
  parcSettings: () => request('GET', '/parc/settings'),
  putParcSettings: (settings) => request('PUT', '/parc/settings', settings),
};
