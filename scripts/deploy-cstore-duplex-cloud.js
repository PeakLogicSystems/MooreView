#!/usr/bin/env node
'use strict';
/**
 * Patch workspace + Mongo for C-store DUPLEXLS site (cloud-1).
 * - Adds HMI screen + bindings from duplex-lift-station template
 * - Merges ST program tags so normalizeHmi keeps bindings on boot
 * - Syncs tags/settings/drivers to Mongo configStore
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || process.env[key]) continue;
    process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

loadEnvFile(process.env.MOOREVIEW_SAAS_ENV || '/etc/mooreview/saas.env');

const { unpackArchive, packArchiveFromParts } = require('../src/project/projectArchive');
const { parseProgram, collectProgramTagRefs } = require('../src/engine/parser');
const { defaultMetaForId } = require('../src/parc/mqttOptaProgram');
const configStore = require('../src/configStore');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.MOOREVIEW_DATA || path.join(ROOT, 'data');
const TEMPLATE = process.env.DUPLEX_HMI_TEMPLATE
  || path.join(DATA_DIR, 'projects', 'duplex-lift-station.est.json');
const ST_FALLBACK = path.join(ROOT, 'st', 'logic', '36_duplex_lift_station.st');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
}

function slugScreenId(siteId) {
  return `screen_${String(siteId || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function buildDuplexScreen(screenId, siteName, number) {
  const tpl = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  const src = tpl.settings?.hmi?.screens?.find((s) => s.id === 'screen_2');
  if (!src) throw new Error('duplex-lift-station template missing screen_2');
  const screen = cloneJson(src);
  screen.id = screenId;
  screen.number = number;
  screen.name = `${siteName} (DUPLEXLS)`;
  screen.isHome = false;
  screen.inheritProjectLayout = false;
  screen.gridCols = screen.gridCols || 16;
  screen.gridRows = screen.gridRows || 13;
  if (Array.isArray(screen.tiles)) {
    for (const tile of screen.tiles) {
      if (tile.rowSpan > screen.gridRows) tile.rowSpan = screen.gridRows;
    }
  }
  return screen;
}

function buildDuplexBindings(screenId) {
  const tpl = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  return (tpl.settings?.hmi?.bindings || [])
    .filter((b) => b.screenId === 'screen_2')
    .map((b) => ({ ...cloneJson(b), screenId }));
}

function mergeTags(doc, { programSource, bindingTagIds }) {
  const byId = new Map((doc.tags || []).map((t) => [t.id, t]));
  const add = (id) => {
    if (!id || byId.has(id)) return;
    byId.set(id, defaultMetaForId(id));
  };
  if (programSource) {
    const { ast, errors } = parseProgram(programSource);
    if (!ast || errors.length) {
      throw new Error(`ST parse failed: ${errors.map((e) => e.message).join('; ')}`);
    }
    for (const id of collectProgramTagRefs(ast)) add(id);
  }
  for (const id of bindingTagIds || []) add(id);
  doc.tags = [...byId.values()];
  return doc.tags.length;
}

function patchFleetScreen(hmi) {
  const fleet = (hmi.screens || []).find((s) => s.number === 1 || s.isHome);
  if (!fleet) return;
  fleet.inheritProjectLayout = false;
  fleet.composerMode = '3d';
  fleet.facility3dUrl = fleet.facility3dUrl || '/samples/cstore-opta-parc-fleet-3d.html';
  fleet.navHidden = fleet.navHidden !== false;
}

function patchDoc(doc, opts) {
  const { screenId, siteName, deviceId, driverId } = opts;
  doc.settings = doc.settings || {};
  doc.settings.hmi = doc.settings.hmi || { screens: [], bindings: [], layout: {} };
  const hmi = doc.settings.hmi;
  hmi.screens = Array.isArray(hmi.screens) ? hmi.screens : [];
  hmi.bindings = Array.isArray(hmi.bindings) ? hmi.bindings : [];
  hmi.layout = hmi.layout || {};

  hmi.screens = hmi.screens.filter((s) => s.id !== screenId);
  hmi.bindings = hmi.bindings.filter((b) => b.screenId !== screenId);

  const nextNum = hmi.screens.reduce((m, s) => Math.max(m, Number(s.number) || 0), 0) + 1;
  hmi.screens.push(buildDuplexScreen(screenId, siteName, nextNum));
  const duplexBindings = buildDuplexBindings(screenId);
  hmi.bindings.push(...duplexBindings);

  const popups = new Set(Array.isArray(hmi.layout.areaPopupScreens) ? hmi.layout.areaPopupScreens : []);
  popups.add(screenId);
  hmi.layout.areaPopupScreens = [...popups];
  patchFleetScreen(hmi);

  if (deviceId && Array.isArray(doc.drivers)) {
    const targetId = driverId || 'arduino_opta_st';
    for (const d of doc.drivers) {
      if (d.type !== 'mqtt_parc' && d.type !== 'opta_remote') continue;
      if (targetId && d.id !== targetId) continue;
      d.deviceId = deviceId;
      d.enabled = d.enabled !== false;
    }
  }

  const bindingTagIds = duplexBindings.map((b) => b.tagId).filter(Boolean);
  const tagCount = mergeTags(doc, { programSource: opts.programSource, bindingTagIds });

  doc.savedAt = new Date().toISOString();
  return { bindingCount: duplexBindings.length, tagCount };
}

function resolveProgramSource(unpacked) {
  const manifestActive = unpacked.programsManifest?.active;
  const active = manifestActive || unpacked.project?.activeProgram;
  if (active && unpacked.programs?.[active]) return { rel: active, source: unpacked.programs[active] };
  if (fs.existsSync(ST_FALLBACK)) {
    return { rel: 'logic/36_duplex_lift_station.st', source: fs.readFileSync(ST_FALLBACK, 'utf8') };
  }
  throw new Error('No ST program in workspace and no local 36_duplex_lift_station.st');
}

(async () => {
  const siteId = arg('site-id', '7767_Land_O_Lakes_Blvd').trim();
  const siteName = arg('site-name', 'store 2707575').trim();
  const deviceId = arg('device-id', 'mv_f2e689fd60d96bab').trim();
  const driverId = arg('driver-id', 'arduino_opta_st').trim();
  const screenId = arg('screen-id', slugScreenId(siteId)).trim();
  const workspaceZip = arg('workspace-zip', path.join(DATA_DIR, 'workspace.est.zip'));

  if (!fs.existsSync(TEMPLATE)) throw new Error(`Missing template: ${TEMPLATE}`);

  const buf = fs.readFileSync(workspaceZip);
  const unpacked = unpackArchive(buf);
  const doc = cloneJson(unpacked.project);
  const prog = resolveProgramSource(unpacked);

  const { bindingCount, tagCount } = patchDoc(doc, {
    screenId, siteName, deviceId, driverId, programSource: prog.source,
  });
  if (!doc.activeProgram) doc.activeProgram = prog.rel;

  const outBuf = packArchiveFromParts({
    project: doc,
    programs: unpacked.programs,
    activeProgram: prog.rel,
    parc: unpacked.parc,
    mvDraw: unpacked.mvDraw,
    hmiAssets: unpacked.hmiAssets,
    mvDrawAssets: unpacked.mvDrawAssets,
    meta: { name: doc.project?.name, exportedBy: 'deploy-cstore-duplex-cloud' },
  });
  fs.writeFileSync(workspaceZip, outBuf);

  await configStore.init();
  const prev = configStore.readSync('settings.json', {});
  const startup = prev.startup || { mode: 'workspace', projectId: null, promptOnBoot: false };
  const nextSettings = {
    ...prev,
    ...doc.settings,
    startup,
    hmi: doc.settings.hmi,
    activeProgram: doc.activeProgram,
    project: {
      ...(prev.project || {}),
      ...(doc.project || {}),
      name: doc.project?.name || prev.project?.name || 'project',
    },
  };

  configStore.writeSync('tags.json', doc.tags);
  configStore.writeSync('drivers.json', doc.drivers || []);
  configStore.writeSync('settings.json', nextSettings);
  configStore.writeSync('workspace.est.json', doc);
  configStore.writeSync('project.est.json', doc);
  await configStore.flushPending();

  const screens = (nextSettings.hmi?.screens || []).map((s) => s.name);
  console.log(JSON.stringify({
    ok: true,
    workspaceZip,
    project: nextSettings.project?.name,
    activeProgram: doc.activeProgram,
    screens,
    bindings: bindingCount,
    tags: tagCount,
    deviceId,
  }, null, 2));
  await configStore.shutdown();
})().catch((e) => {
  console.error('[deploy-cstore-duplex]', e.message || e);
  process.exit(1);
});
