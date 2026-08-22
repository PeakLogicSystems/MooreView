#!/usr/bin/env node
'use strict';

/**
 * Duplex lift station — DUPLEXLS composite HMI + 3D oblique overview.
 *
 * Usage: node scripts/duplex-lift-station/generate-est.js
 */

const fs = require('fs');
const path = require('path');
const { MAX_TAGS } = require('../../src/config');
const { buildPdmSeedsFromPreset } = require('../../src/pdm/pdmAssetSeedFromTemplate');
const { normalizePdmSettings } = require('../../src/settings/pdmSettings');
const { getPreset } = require('../../src/devices/devicePresets');
const {
  explodeCompositeToEdit,
  listHmiComposites,
  repairCompositeBindings,
} = require('../../src/hmi/hmiComposites');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const OUT_EST = path.join(ROOT, 'data', 'projects', 'duplex-lift-station.est.json');
const LIVE_SETTINGS = path.join(ROOT, 'data', 'settings.json');
const LIVE_WORKSPACE = path.join(ROOT, 'data', 'workspace.est.json');
const LIVE_PROJECT = path.join(ROOT, 'data', 'project.est.json');
const LIVE_TAGS = path.join(ROOT, 'data', 'tags.json');
const LIVE_DRIVERS = path.join(ROOT, 'data', 'drivers.json');
const OUT_ST = path.join(ROOT, 'st', 'logic', '36_duplex_lift_station.st');
const TAGS_FIXTURE = path.join(ROOT, 'st', 'fixtures', 'tags.duplex_lift_station.json');
const OPTA_DRIVER_ID = 'arduino_opta_st';
/** Commissioning defaults — override with OPTA_DEVICE_ID / OPTA_ATECC_SERIAL env vars. */
const OPTA_DEVICE_ID = process.env.OPTA_DEVICE_ID || 'mv_f2e689fd60d96bab';
const OPTA_ATECC_SERIAL = process.env.OPTA_ATECC_SERIAL || '0123b636f1c23964ee';
const OPTA_HOST = process.env.OPTA_HOST || '192.168.1.234';
const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://192.168.1.233:1883';

const GRID = { cols: 16, rows: 13, cellWidth: 64, cellHeight: 64 };
const SVG = {
  overview: '/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg',
};
const OVERVIEW = { width: 1150, height: 620 };
/** +20% vs 1024×768 baseline so DUPLEXLS fills the area popup viewport. */
const DUPLEXLS_VIEWPORT = { displayMaxWidth: 1229, displayMaxHeight: 922, scale: 120 };

const BASE_IO_IDS = new Set([
  ...Array.from({ length: 16 }, (_, i) => `X1_I${i + 1}`),
  'AI1', 'AI2', 'AI3', 'AI4', 'AI5', 'AI6',
  'R1', 'R2',
]);

function baseTag(raw) {
  const isBaseIo = BASE_IO_IDS.has(raw.id);
  return {
    id: raw.id,
    label: raw.label || raw.id,
    type: raw.type || 'BOOL',
    role: raw.role || 'memory',
    driverId: isBaseIo ? OPTA_DRIVER_ID : null,
    driverAddress: raw.driverAddress ?? (isBaseIo ? { channel: raw.id } : null),
    default: raw.type === 'REAL' ? (raw.value ?? 0) : raw.type === 'INT' ? (raw.value ?? 0) : (raw.value ?? false),
    scale: raw.scale != null ? Number(raw.scale) : 1,
    offset: raw.offset != null ? Number(raw.offset) : 0,
    alarmsEnabled: !!raw.alarmsEnabled,
    alarmOuterLow: null,
    alarmInnerLow: null,
    alarmInnerHigh: null,
    alarmOuterHigh: null,
    alarmCondition: raw.alarmCondition ?? null,
    readonly: isBaseIo || raw.role === 'input',
    preset: raw.preset ?? (raw.type === 'COUNTER' ? 999999 : raw.type === 'ALT' ? 2 : 0),
    mode: raw.mode || (raw.type === 'COUNTER' ? 'CTU' : raw.type === 'ALT' ? 'ALT2' : 'TON'),
    arrayLen: 1,
    value: raw.value ?? (raw.type === 'BOOL' ? false : 0),
    quality: 'GOOD',
    wordWidth: raw.wordWidth ?? (raw.type === 'INT' ? 16 : 16),
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: !!raw.graphEnabled,
    dirty: false,
    alarmLevel: null,
    fb: raw.fb || {},
  };
}

function buildTags() {
  const fixture = JSON.parse(fs.readFileSync(TAGS_FIXTURE, 'utf8'));
  return fixture.map(baseTag);
}

function screenLayout(id, name, number, extra = {}) {
  const width = extra.width || GRID.cols * GRID.cellWidth;
  const height = extra.height || GRID.rows * GRID.cellHeight;
  return {
    id,
    number,
    isHome: number === 1,
    name,
    svg: extra.svg || null,
    tiles: extra.tiles || [],
    gridCols: extra.gridCols ?? GRID.cols,
    gridRows: extra.gridRows ?? GRID.rows,
    cellWidth: extra.cellWidth ?? GRID.cellWidth,
    cellHeight: extra.cellHeight ?? GRID.cellHeight,
    gridSize: extra.gridSize ?? GRID.cols,
    width,
    height,
    displayMaxWidth: extra.displayMaxWidth ?? 1024,
    displayMaxHeight: extra.displayMaxHeight ?? 768,
    fit: extra.fit || 'contain',
    scale: extra.scale ?? 100,
    background: extra.background ?? '#f1f5f9',
    offsetX: 0,
    offsetY: 0,
    naturalWidth: extra.naturalWidth ?? null,
    naturalHeight: extra.naturalHeight ?? null,
  };
}

function duplexlsScreenLayout(liftManifest) {
  return screenLayout('screen_2', 'DUPLEXLS', 2, {
    svg: SVG.overview,
    tiles: [explodeCompositeToEdit(liftManifest, 0, 0, {
      colSpan: GRID.cols,
      rowSpan: GRID.rows,
    })],
    width: OVERVIEW.width,
    height: OVERVIEW.height,
    naturalWidth: OVERVIEW.width,
    naturalHeight: OVERVIEW.height,
    background: '#1a1a1a',
    displayMaxWidth: DUPLEXLS_VIEWPORT.displayMaxWidth,
    displayMaxHeight: DUPLEXLS_VIEWPORT.displayMaxHeight,
    scale: DUPLEXLS_VIEWPORT.scale,
  });
}

function buildScreens(composites) {
  const liftManifest = composites.find((c) => c.composite?.id === 'duplexls')?.composite;
  if (!liftManifest) {
    throw new Error('Missing duplexls composite manifest');
  }

  return [
    screenLayout('screen_1', '3D Overview', 1, { tiles: [] }),
    duplexlsScreenLayout(liftManifest),
  ];
}

function buildBindings(screens) {
  const hmi = { screens, bindings: [] };
  repairCompositeBindings(hmi, PUBLIC);
  return hmi.bindings;
}

function isDuplexLiftStationDoc(doc) {
  return String(doc?.project?.name || '').trim() === 'duplex-lift-station';
}

/** Keep active workspace/settings in sync — runtime loads these, not data/projects/*.est.json. */
function syncLiveWorkspace(est) {
  const synced = [];

  if (fs.existsSync(LIVE_SETTINGS)) {
    const settings = JSON.parse(fs.readFileSync(LIVE_SETTINGS, 'utf8'));
    if (isDuplexLiftStationDoc(settings)) {
      settings.hmi = est.settings.hmi;
      fs.writeFileSync(LIVE_SETTINGS, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
      synced.push('data/settings.json');
    }
  }

  if (fs.existsSync(LIVE_WORKSPACE)) {
    const workspace = JSON.parse(fs.readFileSync(LIVE_WORKSPACE, 'utf8'));
    if (isDuplexLiftStationDoc(workspace)) {
      workspace.savedAt = est.savedAt;
      workspace.tags = est.tags;
      workspace.drivers = est.drivers;
      workspace.program = est.program;
      workspace.activeProgram = est.activeProgram;
      workspace.settings = est.settings;
      fs.writeFileSync(LIVE_WORKSPACE, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8');
      synced.push('data/workspace.est.json');
    }
  }

  if (fs.existsSync(LIVE_PROJECT)) {
    const project = JSON.parse(fs.readFileSync(LIVE_PROJECT, 'utf8'));
    if (isDuplexLiftStationDoc(project)) {
      project.savedAt = est.savedAt;
      project.tags = est.tags;
      project.drivers = est.drivers;
      project.program = est.program;
      project.activeProgram = est.activeProgram;
      project.settings = est.settings;
      fs.writeFileSync(LIVE_PROJECT, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
      synced.push('data/project.est.json');
    }
  }

  if (fs.existsSync(LIVE_TAGS)) {
    const settings = JSON.parse(fs.readFileSync(LIVE_SETTINGS, 'utf8'));
    if (isDuplexLiftStationDoc(settings)) {
      fs.writeFileSync(LIVE_TAGS, `${JSON.stringify(est.tags, null, 2)}\n`, 'utf8');
      synced.push('data/tags.json');
    }
  }

  if (fs.existsSync(LIVE_DRIVERS)) {
    const settings = JSON.parse(fs.readFileSync(LIVE_SETTINGS, 'utf8'));
    if (isDuplexLiftStationDoc(settings)) {
      fs.writeFileSync(LIVE_DRIVERS, `${JSON.stringify(est.drivers, null, 2)}\n`, 'utf8');
      synced.push('data/drivers.json');
    }
  }

  return synced;
}

function buildProjectSettings(screens, bindings) {
  const preset = getPreset('lift_station_dual_duplex');
  const installDate = new Date().toISOString().slice(0, 10);
  const pdmSeeds = buildPdmSeedsFromPreset(preset, {
    deviceId: OPTA_DEVICE_ID,
    siteId: 'duplex-lift-station',
    siteName: 'Duplex Lift Station (DUPLEXLS)',
    installDate,
    presetLabel: preset?.label,
  });
  const pdm = normalizePdmSettings({
    assetContext: pdmSeeds.assetContext,
    assetTags: pdmSeeds.assetTags,
    windowMin: 5,
    failureThreshold: 0.3,
    simSeedDays: 180,
    buildEnabled: false,
  });

  return {
    project: { name: 'duplex-lift-station' },
    scanMs: 100,
    activeProgram: 'logic/36_duplex_lift_station.st',
    remoteExecution: true,
    autoStartRuntime: true,
    mqttParc: {
      enabled: true,
      brokerUrl: MQTT_BROKER_URL,
      topicPrefix: 'mooreview/v1',
    },
    demoFeatures: { hmiTestMode: true },
    pdm,
    hmi: {
      activeScreen: 'screen_1',
      testMode: false,
      layout: {
        gridCols: GRID.cols,
        gridRows: GRID.rows,
        cellWidth: GRID.cellWidth,
        cellHeight: GRID.cellHeight,
        gridSize: GRID.cols,
        width: GRID.cols * GRID.cellWidth,
        height: GRID.rows * GRID.cellHeight,
        displayMaxWidth: DUPLEXLS_VIEWPORT.displayMaxWidth,
        displayMaxHeight: DUPLEXLS_VIEWPORT.displayMaxHeight,
        fit: 'contain',
        showGridChrome: false,
        showLiveStatus: true,
        composerMode: '3d',
        facility3dUrl: '/samples/duplex-lift-station-ortho-3d.html',
        areaPopupScreens: ['screen_2'],
      },
      screens,
      bindings,
    },
  };
}

function main() {
  const composites = listHmiComposites(PUBLIC);
  const tags = buildTags();
  if (tags.length > MAX_TAGS) {
    console.error(`Tag count ${tags.length} exceeds MAX_TAGS ${MAX_TAGS}`);
    process.exit(1);
  }

  const screens = buildScreens(composites);
  const bindings = buildBindings(screens);
  const program = fs.readFileSync(OUT_ST, 'utf8');
  const drivers = [{
    id: OPTA_DRIVER_ID,
    type: 'mqtt_parc',
    enabled: true,
    deviceId: OPTA_DEVICE_ID,
    ateccSerial: OPTA_ATECC_SERIAL,
    host: OPTA_HOST,
    reportIntervalMs: 200,
    scanMs: 100,
    remoteExecution: true,
    ioBaseOnly: false,
  }];

  fs.mkdirSync(path.dirname(OUT_EST), { recursive: true });

  const est = {
    format: 'mooreview-est',
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: 'duplex-lift-station' },
    tags,
    drivers,
    program,
    activeProgram: 'logic/36_duplex_lift_station.st',
    settings: buildProjectSettings(screens, bindings),
  };

  fs.writeFileSync(OUT_EST, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  const synced = syncLiveWorkspace(est);
  console.log(`Generated ${OUT_EST}`);
  if (synced.length) console.log(`  Synced live workspace: ${synced.join(', ')}`);
  console.log(`  Tags: ${tags.length} / ${MAX_TAGS}`);
  console.log(`  Screens: ${screens.length}`);
  console.log(`  Bindings: ${bindings.length}`);
  console.log('  3D: /samples/duplex-lift-station-ortho-3d.html');
  console.log('  Control screen: @composite/duplexls (screen_2)');
  console.log(`  SVG: ${SVG.overview}`);
  console.log('  Preview: /samples/duplex-lift-station-overview.html');
  console.log('  Program: st/logic/36_duplex_lift_station.st');
}

main();
