'use strict';

const path = require('path');
const fs = require('fs');
const persistence = require('../../persistence');
const programStore = require('../../programs/programStore');
const { parseProgram, collectProgramTagRefs } = require('../../engine/parser');
const { listSerialPorts } = require('../../system/serialPorts');
const { listPresets } = require('../../devices/devicePresets');
const { normalizePens, penTagIds } = require('../../graph/graphPens');
const { normalizeHmi, defaultDemoHmi } = require('../../hmi/hmiConfig');
const mongoTagLogger = require('../../logger/mongoTagLogger');
const projectStore = require('../../project/projectStore');
const { registry } = require('../../parc/deviceRegistry');
const { getMqttCentralHub } = require('../../parc/mqttCentralHub');
const { enrichParcDevicesWithDriverLink } = require('../../parc/parcDiscovery');
const { MAX_TAGS } = require('../../config');
const { normalizeReportConfig } = require('../../reports/reportConfig');
const { stripLegacyProjectHwDefaults } = require('../../settings/portableSettings');

function parcPayload(driverManager, settings) {
  return {
    settings: registry.settings(),
    devices: enrichParcDevicesWithDriverLink(
      registry.listDevices(),
      driverManager.list(),
      { hubBrokerUrl: settings?.mqttParc?.brokerUrl || '' },
    ),
    mqtt: getMqttCentralHub(registry).status(),
  };
}

const PUBLIC_ROOT = path.join(__dirname, '../../../public');
const SETTINGS_FILE = 'settings.json';
const SERIAL_PORTS_TTL_MS = 60_000;

/** @type {{ key: string, hmi: object } | null} */
let hmiCache = null;
/** @type {{ mtimeMs: number, refs: string[], programPath: string } | null} */
let programTagRefCache = null;
/** @type {{ at: number, ports: string[] } | null} */
let serialPortsCache = null;

function settingsMtimeMs() {
  try {
    return fs.statSync(persistence.filePath(SETTINGS_FILE)).mtimeMs;
  } catch {
    return 0;
  }
}

function readSettings() {
  return stripLegacyProjectHwDefaults(
    persistence.readJson(SETTINGS_FILE, { scanMs: 100, graphMaxPoints: 600, graphPens: [] }),
  );
}

function getNormalizedHmi(settings, tagList) {
  const key = `${settingsMtimeMs()}:${tagList.length}`;
  if (hmiCache?.key === key) return hmiCache.hmi;
  const hmi = normalizeHmi(
    settings.hmi?.screens?.length ? settings.hmi : defaultDemoHmi(),
    tagList,
    PUBLIC_ROOT,
  );
  hmiCache = { key, hmi };
  return hmi;
}

function getProgramTagRefs() {
  const programPath = programStore.activeRel();
  let mtimeMs = 0;
  if (programPath) {
    try {
      mtimeMs = fs.statSync(programStore.resolvePath(programPath)).mtimeMs;
    } catch { /* ignore */ }
  }
  if (programTagRefCache
    && programTagRefCache.programPath === programPath
    && programTagRefCache.mtimeMs === mtimeMs) {
    return programTagRefCache.refs;
  }
  const { ast } = parseProgram(programStore.readActive());
  const refs = ast ? collectProgramTagRefs(ast) : [];
  programTagRefCache = { mtimeMs, refs, programPath };
  return refs;
}

async function getSerialPortsCached() {
  const now = Date.now();
  if (serialPortsCache && now - serialPortsCache.at < SERIAL_PORTS_TTL_MS) {
    return serialPortsCache.ports;
  }
  let serialPorts = [];
  try { serialPorts = await listSerialPorts(); } catch { /* ignore */ }
  serialPortsCache = { at: now, ports: serialPorts };
  return serialPorts;
}

function createDashboardRoutes(deps) {
  const { tagStore, driverManager, scanEngine, graphHistory } = deps;
  const router = require('express').Router();

  router.get('/live', async (req, res) => {
    const tagList = tagStore.list();
    const qIds = (req.query.graphTags || '').split(',').filter(Boolean);
    res.json({
      runtime: scanEngine.status(),
      live: tagStore.liveSnapshotSlim(),
      tagCount: tagStore.count(),
      forces: tagList.filter((t) => t.forceInput || t.forceOutput),
      driverHealth: driverManager.health(),
      ...(qIds.length ? { graph: graphHistory.getHistory(qIds, 400) } : {}),
    });
  });

  router.get('/dashboard', async (req, res) => {
    const lite = String(req.query.lite || '').trim() === '1';
    const tagList = tagStore.list();
    const settings = readSettings();
    const graphPens = normalizePens(settings.graphPens, tagList);
    const hmiRev = settingsMtimeMs();
    const qIds = (req.query.graphTags || '').split(',').filter(Boolean);
    const graphIds = qIds.length ? qIds : penTagIds(graphPens);
    const programTagRefs = getProgramTagRefs();
    const serialPorts = await getSerialPortsCached();
    const reportConfig = normalizeReportConfig(settings.reportConfig);

    if (lite) {
      const { hmi, ...settingsRest } = settings;
      res.json({
        lite: true,
        hmiRev,
        runtime: scanEngine.status(),
        tagCount: tagStore.count(),
        maxTags: MAX_TAGS,
        drivers: driverManager.list(),
        driverHealth: driverManager.health(),
        program: programStore.readActive(),
        activeProgram: programStore.activeRel(),
        stDir: programStore.ST_DIR,
        programs: programStore.listPrograms(),
        settings: { ...settingsRest, graphPens, reportConfig },
        reportConfig,
        graphPens,
        programTagRefs,
        serialPorts,
        devicePresets: listPresets(),
        mongoLogger: mongoTagLogger.status(),
        parc: parcPayload(driverManager, settings),
      });
      return;
    }

    const hmi = getNormalizedHmi(settings, tagList);
    res.json({
      runtime: scanEngine.status(),
      tags: tagList,
      tagCount: tagStore.count(),
      maxTags: MAX_TAGS,
      drivers: driverManager.list(),
      driverHealth: driverManager.health(),
      program: programStore.readActive(),
      activeProgram: programStore.activeRel(),
      stDir: programStore.ST_DIR,
      programs: programStore.listPrograms(),
      settings: { ...settings, graphPens, hmi, reportConfig },
      hmiRev,
      reportConfig,
      forces: tagList.filter((t) => t.forceInput || t.forceOutput),
      graph: graphHistory.getHistory(graphIds.length ? graphIds : null, 400),
      graphPens,
      programTagRefs,
      live: tagStore.liveSnapshotSlim(),
      serialPorts,
      devicePresets: listPresets(),
      mongoLogger: mongoTagLogger.status(),
      projects: projectStore.listProjects(),
      parc: parcPayload(driverManager, settings),
    });
  });

  return router;
}

function invalidateDashboardCaches() {
  hmiCache = null;
  programTagRefCache = null;
}

module.exports = { createDashboardRoutes, invalidateDashboardCaches };
