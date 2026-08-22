'use strict';

const programStore = require('../programs/programStore');
const persistence = require('../persistence');
const { DEFAULT_SCAN_MS, MAX_TAGS, DEFAULT_MQTT_PARC_BROKER } = require('../config');
const { defaultBlankHmi } = require('../hmi/hmiConfig');
const { defaultMongoLogger, effectiveMongoLogger } = require('../settings/mongoLoggerSettings');
const { DEFAULT_CLOUD_REMOTE } = require('../settings/cloudRemoteSettings');
const { stripLegacyProjectHwDefaults } = require('../settings/portableSettings');
const { registry: cameraRegistry } = require('../cameras/cameraRegistry');

const EST_FORMAT = 'mooreview-est';
const EST_VERSION = 1;
const ARCHIVE_FORMAT = 'mooreview-est-archive';
const ARCHIVE_VERSION = 1;

const BLANK_PROGRAM = '(* New MooreVIEW project — load an ST program or write logic here *)\n';

function mapLegacyRole(tag) {
  if (tag.role) return tag.role;
  const d = String(tag.direction || '').toLowerCase();
  if (d === 'input' || d === 'in') return 'input';
  if (d === 'output' || d === 'out') return 'output';
  if (d === 'memory' || d === 'mem') return 'memory';
  if (d === 'fb') return 'fb';
  return null;
}

function normalizeTagImport(tag) {
  const role = mapLegacyRole(tag) || 'memory';
  let type = String(tag.type || 'BOOL');
  if (/^bool$/i.test(type)) type = 'BOOL';
  else if (/^int$/i.test(type)) type = 'INT';
  else if (/^real$/i.test(type) || /^float$/i.test(type)) type = 'REAL';
  else type = type.toUpperCase();
  return { ...tag, type, role };
}

function coerceImportDoc(raw) {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error('Invalid project document'), { status: 400 });
  }
  if (raw.format !== EST_FORMAT) {
    throw Object.assign(new Error(`Expected format "${EST_FORMAT}"`), { status: 400 });
  }
  if (raw.version !== EST_VERSION) {
    throw Object.assign(new Error(`Unsupported project version ${raw.version}`), { status: 400 });
  }
  return {
    ...raw,
    tags: Array.isArray(raw.tags) ? raw.tags.map(normalizeTagImport) : [],
    drivers: Array.isArray(raw.drivers) ? raw.drivers : null,
    activeProgram: raw.activeProgram ?? null,
    settings: raw.settings ?? null,
    cameras: raw.cameras && typeof raw.cameras === 'object' ? raw.cameras : null,
    mvDraw: raw.mvDraw ?? null,
  };
}

function mergePortableSettings(incoming) {
  const stored = incoming && typeof incoming === 'object' ? incoming : {};
  const defaults = {
    scanMs: DEFAULT_SCAN_MS,
    graphMaxPoints: 600,
    graphPens: [],
    hmi: defaultBlankHmi(),
    mongoLogger: effectiveMongoLogger({}),
    remoteExecution: false,
    mqttParc: {
      enabled: true,
      brokerUrl: DEFAULT_MQTT_PARC_BROKER,
      topicPrefix: 'mooreview/v1',
    },
    cloudRemote: { ...DEFAULT_CLOUD_REMOTE },
  };
  return stripLegacyProjectHwDefaults({
    ...defaults,
    ...stored,
    hmi: stored.hmi && typeof stored.hmi === 'object' ? stored.hmi : defaults.hmi,
    mongoLogger: effectiveMongoLogger(stored.mongoLogger),
    mqttParc: { ...defaults.mqttParc, ...(stored.mqttParc || {}) },
    cloudRemote: { ...DEFAULT_CLOUD_REMOTE, ...(stored.cloudRemote || {}) },
  });
}

function packProjectDoc(deps, meta = {}) {
  const { tagStore, driverManager } = deps;
  const settings = stripLegacyProjectHwDefaults(persistence.readJson('settings.json', {}));
  return {
    format: EST_FORMAT,
    version: EST_VERSION,
    savedAt: new Date().toISOString(),
    project: { name: meta.name || settings.project?.name || 'untitled', ...meta },
    tags: tagStore.list(),
    drivers: driverManager.list(),
    activeProgram: programStore.activeRel() || null,
    settings,
    cameras: cameraRegistry.exportForProject(),
  };
}

/** @deprecated use packProjectDoc — kept for internal callers during transition */
function pack(deps, meta = {}) {
  return packProjectDoc(deps, meta);
}

function blankProjectDoc(name) {
  const projectName = String(name || 'untitled').trim() || 'untitled';
  const activeProgram = programStore.suggestRelFromFilename(`${projectName}.st`);
  return {
    format: EST_FORMAT,
    version: EST_VERSION,
    project: { name: projectName },
    tags: [],
    drivers: [],
    activeProgram,
    settings: mergePortableSettings({
      project: { name: projectName },
      activeProgram,
    }),
  };
}

function isProjectSnapshot(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  return d.format === EST_FORMAT
    && Array.isArray(d.tags)
    && Array.isArray(d.drivers)
    && d.settings != null && typeof d.settings === 'object';
}

function validateImport(doc) {
  if (!Array.isArray(doc.tags)) return 'Missing tags array';
  if (doc.tags.length > MAX_TAGS) return `Tag limit ${MAX_TAGS} exceeded`;
  if (doc.drivers != null && !Array.isArray(doc.drivers)) return 'Invalid drivers array';
  return null;
}

async function applyProjectDoc(doc, deps, opts = {}) {
  const normalized = coerceImportDoc(doc);
  const err = validateImport(normalized);
  if (err) throw Object.assign(new Error(err), { status: 400 });

  const { tagStore, driverManager, scanEngine, graphHistory } = deps;
  const snapshot = isProjectSnapshot(normalized);
  const importWarnings = [];

  if (snapshot && scanEngine.running) await scanEngine.stop();

  if (normalized.tags != null) {
    tagStore.replaceAll(normalized.tags, {
      keepForces: !snapshot,
      clearAlarms: snapshot,
    });
  }
  if (normalized.drivers != null) {
    driverManager.save(normalized.drivers);
    await driverManager.rebuild();
  }

  const programs = opts.programs && typeof opts.programs === 'object' ? opts.programs : null;
  let activeRel = programStore.activeRel();

  if (programs && Object.keys(programs).length) {
    const manifestActive = programStore.sanitizeRel(
      opts.programsManifest?.active || normalized.activeProgram || '',
    );
    for (const [relPath, source] of Object.entries(programs)) {
      programStore.writeProgram(relPath, source);
    }
    if (manifestActive && programs[manifestActive] != null) {
      activeRel = programStore.setActive(manifestActive);
    } else if (normalized.activeProgram) {
      activeRel = programStore.setActive(normalized.activeProgram);
    } else {
      const first = Object.keys(programs).sort()[0];
      activeRel = first ? programStore.setActive(first) : programStore.clearActive();
    }
  } else if (normalized.activeProgram === null || normalized.activeProgram === '') {
    programStore.clearActive();
    activeRel = '';
  } else if (normalized.activeProgram) {
    activeRel = programStore.setActive(normalized.activeProgram);
  }

  if (opts.prunePrograms) {
    programStore.pruneProgramsExcept(activeRel);
  }

  if (normalized.settings) {
    persistence.writeJson('settings.json', mergePortableSettings(normalized.settings));
    const cfg = persistence.readJson('settings.json', {}).mongoLogger;
    const { applyMongoLoggerConfig } = require('../logger/mongoServicesInit');
    if (cfg?.uri) await applyMongoLoggerConfig(cfg);
    else await applyMongoLoggerConfig(null);
  }

  if (normalized.cameras) {
    cameraRegistry.importFromProject(normalized.cameras);
  }

  if (snapshot) {
    if (graphHistory) graphHistory.clear();
    scanEngine._programTrace = [];
    if (scanEngine._oneShotFired) scanEngine._oneShotFired.clear();
    scanEngine.errors = [];
    persistence.writeJson('project.est.json', packProjectDoc(deps, normalized.project || {}));
  }

  scanEngine.loadSettings();
  scanEngine.loadProgram();

  return {
    ...packProjectDoc(deps, normalized.project || {}),
    importWarnings,
  };
}

/** @deprecated use applyProjectDoc */
async function apply(doc, deps, opts = {}) {
  return applyProjectDoc(doc, deps, opts);
}

function exportFilename(name) {
  const base = String(name || 'project').trim().replace(/[^\w.-]+/g, '_').replace(/^\.+/, '') || 'project';
  return `${base}.est.zip`;
}

function patchWorkspaceDrivers(drivers) {
  const ws = persistence.readJson('workspace.est.json', null);
  if (!ws || ws.format !== EST_FORMAT || !Array.isArray(ws.drivers)) return false;
  ws.drivers = drivers;
  ws.savedAt = new Date().toISOString();
  persistence.writeJson('workspace.est.json', ws);
  return true;
}

module.exports = {
  EST_FORMAT,
  EST_VERSION,
  ARCHIVE_FORMAT,
  ARCHIVE_VERSION,
  exportFilename,
  packProjectDoc,
  pack,
  validateImport,
  coerceImportDoc,
  normalizeTagImport,
  blankProjectDoc,
  isProjectSnapshot,
  mergePortableSettings,
  patchWorkspaceDrivers,
  applyProjectDoc,
  apply,
};
