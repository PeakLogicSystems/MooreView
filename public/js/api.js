'use strict';

const API = (() => {
  const base = String(window.MOOREVIEW_API_BASE || '').trim().replace(/\/$/, '');
  return base || '/api';
})();

const PLATFORM_API = (() => {
  const base = String(window.MOOREVIEW_PLATFORM_API || '').trim().replace(/\/$/, '');
  return base || '/api';
})();

async function request(method, path, body, apiBase = API) {
  const url = path.startsWith('http') ? path : `${apiBase}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const target = apiBase.startsWith('http') ? apiBase : `${location.origin}${apiBase}`;
    const hint = e.message === 'Failed to fetch'
      ? `Cannot reach the MooreVIEW server at ${target}. Start MVP Suite with npm start (default http://127.0.0.1:3090/).`
      : e.message;
    throw new Error(hint);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error
      || (Array.isArray(data.errors) && data.errors.length ? data.errors.join('; ') : null)
      || res.statusText;
    const err = new Error(msg);
    if (data.errors) err.errors = data.errors;
    if (data.unknownTags) err.unknownTags = data.unknownTags;
    if (data.tagIds) err.tagIds = data.tagIds;
    if (data.activeProgram) err.activeProgram = data.activeProgram;
    throw err;
  }
  return data;
}

async function platformRequest(method, path, body) {
  return request(method, path, body, PLATFORM_API);
}

window.api = {
  getDashboard: (graphTags, opts = {}) => {
    const q = new URLSearchParams();
    if (graphTags?.length) q.set('graphTags', graphTags.join(','));
    if (opts.lite) q.set('lite', '1');
    const qs = q.toString();
    return request('GET', `/dashboard${qs ? `?${qs}` : ''}`);
  },
  getLive: (graphTags) => {
    let q = '/live';
    if (graphTags?.length) q += `?graphTags=${graphTags.join(',')}`;
    return request('GET', q);
  },
  openEst: (doc) => request('POST', '/project/est', doc),
  saveEstBlob: async (name) => {
    let res;
    try {
      res = await fetch(`${API}/project/est?name=${encodeURIComponent(name || 'project')}`);
    } catch (e) {
      const hint = e.message === 'Failed to fetch'
        ? `Cannot reach the MooreVIEW server at ${location.origin}. Start MVP Suite with npm start.`
        : e.message;
      throw new Error(hint);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || 'Save project failed');
    }
    return res.blob();
  },
  saveWorkspace: (project) => request('POST', '/workspace/save', { project }),
  listProjects: () => request('GET', '/projects'),
  openProjectsFolder: () => request('POST', '/projects/open-folder', {}),
  saveProject: (name) => request('POST', '/projects/save', { name }),
  newProject: (name) => request('POST', '/projects/new', { name }),
  openProject: (id) => request('POST', '/projects/open', { id }),
  deleteProject: (id) => request('DELETE', `/projects?id=${encodeURIComponent(id)}`),
  exportEstDoc: async (name) => {
    let res;
    try {
      res = await fetch(`${API}/project/est?name=${encodeURIComponent(name || 'project')}`);
    } catch (e) {
      const target = API.startsWith('http') ? API : `${location.origin}${API}`;
      throw new Error(e.message === 'Failed to fetch'
        ? `Cannot reach the MooreVIEW server at ${target}.`
        : e.message);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || 'Export project failed');
    }
    return res.json();
  },
  downloadProjectBundle: async (name) => {
    let res;
    try {
      res = await fetch(`${API}/project/bundle?name=${encodeURIComponent(name || 'project')}`);
    } catch (e) {
      const hint = e.message === 'Failed to fetch'
        ? `Cannot reach the MooreVIEW server at ${location.origin}. Start MVP Suite with npm start.`
        : e.message;
      throw new Error(hint);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || 'Export project failed');
    }
    return res.blob();
  },
  listProjectHubCatalog: (locationId) => {
    const q = locationId ? `?locationId=${encodeURIComponent(locationId)}` : '';
    return platformRequest('GET', `/project-hub/catalog${q}`);
  },
  fetchProjectHubEst: (id) => platformRequest('GET', `/project-hub/catalog/${encodeURIComponent(id)}/est`),
  publishProjectHub: (body) => platformRequest('POST', '/project-hub/publish', body),
  listLocations: () => platformRequest('GET', '/locations'),
  putTags: (tags) => request('PUT', '/tags', { tags }),
  putDrivers: (drivers) => request('PUT', '/drivers', { drivers }),
  connectDriver: (driverId) => request('POST', '/drivers/connect', { driverId }),
  disconnectDriver: (driverId) => request('POST', '/drivers/disconnect', { driverId }),
  testDriver: (cfg) => request('POST', '/drivers/test', cfg),
  getNextcenturyExample: () => request('GET', '/drivers/nextcentury/example'),
  loadNextcenturyExampleTags: (body) => request('POST', '/drivers/nextcentury/load-example-tags', body),
  listDevicePresets: () => request('GET', '/devices/presets'),
  applyDevicePreset: (body) => request('POST', '/devices/apply', body),
  listPrograms: () => request('GET', '/programs'),
  openProgramFolder: () => request('POST', '/programs/open-folder', {}),
  loadProgram: (path, opts = {}) => request('POST', '/programs/load', {
    path,
    loadFixtures: opts.loadFixtures === true,
  }),
  reloadProgram: (path) => request('POST', '/programs/reload', path ? { path } : {}),
  clearActiveProgram: () => request('POST', '/programs/clear', {}),
  loadProgramFixtures: (path) => request('POST', '/programs/load-fixtures', { path }),
  saveProgram: (path, source) => request('POST', '/programs/save', { path, source }),
  importProgram: (path, source) => request('POST', '/programs/import', { path, source }),
  getProgramFile: (path) => request('GET', `/program/file?path=${encodeURIComponent(path)}`),
  putProgram: (source) => request('PUT', '/program', { source }),
  validateProgram: (source) => request('POST', '/program/validate', { source }),
  deployEstimate: (source, driverId) => request('POST', '/program/deploy-estimate', {
    source,
    ...(driverId ? { driverId } : {}),
  }),
  ackAlarm: (tagId) => request('POST', '/alarms/ack', { tagId }),
  ackAllAlarms: () => request('POST', '/alarms/ack', { all: true }),
  runtimeStart: () => request('POST', '/runtime/start'),
  runtimePause: () => request('POST', '/runtime/pause'),
  runtimeResume: () => request('POST', '/runtime/resume'),
  runtimeStop: () => request('POST', '/runtime/stop'),
  putSettings: (s) => request('PUT', '/settings', s),
  setForce: (body) => request('POST', '/debug/force', body),
  setTagValue: (body) => request('POST', '/tags/write', body),
  clearForce: (tagId) => request('DELETE', `/debug/force?tagId=${encodeURIComponent(tagId)}`),
  clearGraph: () => request('POST', '/graph/clear', {}),
  modbusMove: (body) => request('POST', '/modbus/move', body),
  getSerialPorts: () => request('GET', '/system/serial-ports'),
  getTags: () => request('GET', '/tags'),
  getIoMap: () => request('GET', '/io-map'),
  patchIoMapTag: (tagId, body) => request('PATCH', `/io-map/tags/${encodeURIComponent(tagId)}`, body),
  bindIoMapRoomTemplate: (body) => request('POST', '/io-map/bindings/room-template', body),
  putIoMapBindings: (bindings) => request('PUT', '/io-map/bindings', { bindings }),
  ensureMotorTags: () => request('POST', '/tags/ensure-motor', {}),
  ensureTpoTags: () => request('POST', '/tags/ensure-tpo', {}),
  ensureProgramTags: (source) => request('POST', '/tags/ensure-program', source != null ? { source } : {}),
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
  pdmStatus: () => request('GET', '/pdm/status'),
  pdmAssets: () => request('GET', '/pdm/assets'),
  getPdmView: ({ asset, from, to }) => {
    const q = new URLSearchParams({ asset });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return request('GET', `/pdm/view?${q}`);
  },
  putPdmSettings: (pdm) => request('PUT', '/pdm/settings', { pdm }),
  buildPdmFeatures: () => request('POST', '/pdm/build', {}),
  simulateMotorPdm: (body) => request('POST', '/pdm/sim/motor', body || {}),
  listHmiAssets: async () => {
    const data = await request('GET', '/hmi/assets');
    if (Array.isArray(data?.assets)) return data.assets;
    if (Array.isArray(data)) return data;
    return [];
  },
  importHmiGraphic: (filename, contentBase64) => request('POST', '/hmi/assets/import', { filename, contentBase64 }),
  parcDevices: () => request('GET', '/parc/devices'),
  parcDevice: (id) => request('GET', `/parc/devices/${encodeURIComponent(id)}`),
  parcReport: (body) => request('POST', '/parc/report', body),
  parcAttach: (id, body) => request('POST', `/parc/devices/${encodeURIComponent(id)}/attach`, body || {}),
  parcDetach: (id) => request('POST', `/parc/devices/${encodeURIComponent(id)}/detach`, {}),
  parcCmd: (id, op, body) => request('POST', `/parc/devices/${encodeURIComponent(id)}/cmd`, { op, body }),
  parcScanExpansions: (deviceId) => request('POST', `/parc/devices/${encodeURIComponent(deviceId)}/scan-expansions`, {}),
  parcSyncTags: (deviceId, driverId) => request('POST', `/parc/devices/${encodeURIComponent(deviceId)}/sync-tags`, { driverId }),
  syncParcTags: (driverId) => request('POST', '/drivers/sync-parc-tags', { driverId }),
  parcDeployProgram: (id, body) => request('POST', `/parc/devices/${encodeURIComponent(id)}/program`, body || {}),
  parcSettings: () => request('GET', '/parc/settings'),
  putParcSettings: (settings) => request('PUT', '/parc/settings', settings),
  cameras: () => request('GET', '/cameras'),
  camera: (id) => request('GET', `/cameras/${encodeURIComponent(id)}`),
  createCamera: (body) => request('POST', '/cameras', body),
  updateCamera: (id, body) => request('PUT', `/cameras/${encodeURIComponent(id)}`, body),
  deleteCamera: (id) => request('DELETE', `/cameras/${encodeURIComponent(id)}`),
  discoverCameras: (body) => request('POST', '/cameras/discover', body || {}),
  addCameraByIp: (body) => request('POST', '/cameras/add-by-ip', body || {}),
  probeCamera: (id, body) => request('POST', `/cameras/${encodeURIComponent(id)}/probe`, body || {}),
  probeAllCameras: (body) => request('POST', '/cameras/probe-all', body || {}),
  cameraViewer: (id) => request('GET', `/cameras/${encodeURIComponent(id)}/viewer`),
  cloudStatus: () => platformRequest('GET', '/cloud/status'),
  cloudAgent: () => platformRequest('GET', '/cloud/agent'),
  putCloudAgent: (body) => platformRequest('PUT', '/cloud/agent', body || {}),
  startCloudAgent: () => platformRequest('POST', '/cloud/agent/start'),
  stopCloudAgent: () => platformRequest('POST', '/cloud/agent/stop'),
  syncCloudAgent: () => platformRequest('POST', '/cloud/agent/sync'),
  listSites: () => platformRequest('GET', '/sites'),
  createSite: (body) => platformRequest('POST', '/sites', body || {}),
  deleteSite: (id) => platformRequest('DELETE', `/sites/${encodeURIComponent(id)}`),
  siteCameras: (siteId) => platformRequest('GET', `/sites/${encodeURIComponent(siteId)}/cameras`),
  siteCameraViewer: (siteId, cameraId) => platformRequest(
    'GET',
    `/sites/${encodeURIComponent(siteId)}/cameras/${encodeURIComponent(cameraId)}/viewer`,
  ),
  login: (body) => platformRequest('POST', '/auth/login', body || {}),
  logout: () => platformRequest('POST', '/auth/logout'),
  authMe: () => platformRequest('GET', '/auth/me'),
  getTenant: () => platformRequest('GET', '/tenant'),
  listAdminTenants: () => platformRequest('GET', '/admin/tenants'),
  createAdminTenant: (body) => platformRequest('POST', '/admin/tenants', body || {}),
  patchTenantCmms: (id, body) => platformRequest('PATCH', `/admin/tenants/${encodeURIComponent(id)}/cmms`, body || {}),
  listTenantUsers: () => platformRequest('GET', '/tenant/users'),
  createTenantUser: (body) => platformRequest('POST', '/tenant/users', body || {}),
  listSiteDevices: () => platformRequest('GET', '/sites/devices'),
  createSiteDevice: (body) => platformRequest('POST', '/sites/devices', body || {}),
  listFleetAssets: () => platformRequest('GET', '/fleet'),
  createFleetAsset: (body) => platformRequest('POST', '/fleet', body || {}),
  deleteFleetAsset: (id) => platformRequest('DELETE', `/fleet/${encodeURIComponent(id)}`),
  tenantCmms: () => platformRequest('GET', '/tenant/cmms'),
  captureCameraSnapshot: (id, body) => request('POST', `/cameras/${encodeURIComponent(id)}/snapshot`, body || {}),
  cameraSnapshots: (id, limit) => request('GET', `/cameras/${encodeURIComponent(id)}/snapshots?limit=${limit || 50}`),
  cameraEvents: (id, limit, type) => {
    const q = new URLSearchParams();
    if (limit) q.set('limit', String(limit));
    if (type) q.set('type', type);
    const qs = q.toString();
    return request('GET', `/cameras/${encodeURIComponent(id)}/events${qs ? `?${qs}` : ''}`);
  },
  inferCamera: (id, body) => request('POST', `/cameras/${encodeURIComponent(id)}/infer`, body || {}),
  cameraInferences: (id, hours) => request('GET', `/cameras/${encodeURIComponent(id)}/inferences?hours=${hours || 24}`),
  cameraOverlays: (id) => request('GET', `/cameras/${encodeURIComponent(id)}/overlays`),
  putCameraOverlays: (id, overlays) => request('PUT', `/cameras/${encodeURIComponent(id)}/overlays`, { overlays }),
  cameraAiStatus: () => request('GET', '/cameras/ai/status'),
  refreshCameraAi: () => request('POST', '/cameras/ai/refresh'),
  cameraOverview: () => request('GET', '/cameras/overview'),
  allCameraEvents: (limit, type) => {
    const q = new URLSearchParams();
    if (limit) q.set('limit', String(limit));
    if (type) q.set('type', type);
    const qs = q.toString();
    return request('GET', `/cameras/events${qs ? `?${qs}` : ''}`);
  },
  allCameraInferences: (hours) => request('GET', `/cameras/inferences?hours=${hours || 24}`),
  cameraSettings: () => request('GET', '/cameras/settings'),
  putCameraSettings: (settings) => request('PUT', '/cameras/settings', settings),
  go2rtcStatus: () => request('GET', '/cameras/go2rtc/status'),
  syncGo2rtc: () => request('POST', '/cameras/go2rtc/sync'),
  gridfsStatus: () => request('GET', '/storage/gridfs/status'),
  gridfsList: (bucket, cameraId, limit) => {
    const q = new URLSearchParams();
    if (cameraId) q.set('cameraId', cameraId);
    if (limit) q.set('limit', String(limit));
    const qs = q.toString();
    return request('GET', `/storage/gridfs/${encodeURIComponent(bucket)}${qs ? `?${qs}` : ''}`);
  },
  listReportPdfs: (limit) => request('GET', `/reports/pdfs?limit=${limit || 50}`),
  getReportConfig: () => request('GET', '/reports/config'),
  putReportConfig: (reportConfig) => request('PUT', '/reports/config', { reportConfig }),
  downloadReportPdf: async (body) => {
    let res;
    try {
      res = await fetch(`${API}/reports/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(e.message === 'Failed to fetch'
        ? `Cannot reach the MooreVIEW server at ${location.origin}.`
        : e.message);
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText || 'PDF export failed');
    }
    return res.blob();
  },
};
