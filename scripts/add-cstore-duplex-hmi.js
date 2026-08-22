#!/usr/bin/env node
'use strict';

/**
 * Add an unprefixed DUPLEXLS HMI screen (duplex-lift-station bindings).
 *
 * Workspace mode (cloud-1 active project):
 *   node scripts/add-cstore-duplex-hmi.js \
 *     --workspace-zip /home/mooreview/data/workspace.est.zip \
 *     --site-id 7767_Land_O_Lakes_Blvd \
 *     --site-name "store 2707575"
 *
 * Mongo mode (per-tenant project library):
 *   node scripts/add-cstore-duplex-hmi.js --tenant-id <uuid> ...
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const { unpackArchive, packArchiveFromParts } = require('../src/project/projectArchive');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.MOOREVIEW_DATA || path.join(ROOT, 'data');
const TEMPLATE = process.env.DUPLEX_HMI_TEMPLATE
  || path.join(DATA_DIR, 'projects', 'duplex-lift-station.est.json');
const PROJECTS_COL = process.env.MOOREVIEW_CONFIG_PROJECTS_COLLECTION || 'project_snapshots';

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || process.env[key]) continue;
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile(process.env.MOOREVIEW_SAAS_ENV || '/etc/mooreview/saas.env');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function slugScreenId(siteId) {
  return `screen_${String(siteId || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
}

function cloneJson(v) {
  return JSON.parse(JSON.stringify(v));
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
  const bindings = (tpl.settings?.hmi?.bindings || []).filter((b) => b.screenId === 'screen_2');
  return bindings.map((b) => ({ ...cloneJson(b), screenId }));
}

function patchProjectHmi(doc, { screenId, siteName, deviceId, driverId }) {
  doc.settings = doc.settings || {};
  doc.settings.hmi = doc.settings.hmi || { screens: [], bindings: [], layout: {} };
  const hmi = doc.settings.hmi;
  hmi.screens = Array.isArray(hmi.screens) ? hmi.screens : [];
  hmi.bindings = Array.isArray(hmi.bindings) ? hmi.bindings : [];
  hmi.layout = hmi.layout || {};

  hmi.screens = hmi.screens.filter((s) => s.id !== screenId);
  hmi.bindings = hmi.bindings.filter((b) => b.screenId !== screenId);

  const nextNum = hmi.screens.reduce((m, s) => Math.max(m, Number(s.number) || 0), 0) + 1;
  const screen = buildDuplexScreen(screenId, siteName, nextNum);
  const bindings = buildDuplexBindings(screenId);

  hmi.screens.push(screen);
  hmi.bindings.push(...bindings);

  const popups = new Set(Array.isArray(hmi.layout.areaPopupScreens) ? hmi.layout.areaPopupScreens : []);
  popups.add(screenId);
  hmi.layout.areaPopupScreens = [...popups];

  if (deviceId && Array.isArray(doc.drivers)) {
    const targetId = driverId || 'arduino_opta_st';
    for (const d of doc.drivers) {
      if (d.type !== 'mqtt_parc' && d.type !== 'opta_remote') continue;
      if (targetId && d.id !== targetId) continue;
      d.deviceId = deviceId;
      d.enabled = d.enabled !== false;
    }
  }

  doc.savedAt = new Date().toISOString();
  return { bindingCount: bindings.length };
}

function findProjectId(rows, projectId, deviceId) {
  if (projectId) return projectId;
  const hit = rows.find((row) => {
    const doc = row.data || row;
    return (doc.drivers || []).some(
      (d) => d.type === 'mqtt_parc' && String(d.deviceId || '').trim() === deviceId,
    );
  });
  if (hit) return hit.projectId;
  const starter = rows.find((r) => r.projectId === 'cstore-opta-parc-starter');
  if (starter) return starter.projectId;
  if (rows.length === 1) return rows[0].projectId;
  throw new Error(`Ambiguous project — pass --project-id. Found: ${rows.map((r) => r.projectId).join(', ')}`);
}

async function patchMongo(opts) {
  const { tenantId, siteId, siteName, deviceId, projectId, screenId, driverId } = opts;
  const uri = process.env.MOOREVIEW_CONFIG_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) throw new Error('Set MONGODB_URI or MOOREVIEW_CONFIG_URI');

  const dbName = process.env.MOOREVIEW_CONFIG_DB || 'mooreview_config';
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection(PROJECTS_COL);

  const rows = await col.find({ tenantId }).project({ projectId: 1, name: 1, data: 1 }).toArray();
  if (!rows.length) throw new Error(`No projects for tenant ${tenantId}`);

  const pid = findProjectId(rows, projectId, deviceId);
  const row = rows.find((r) => r.projectId === pid);
  if (!row) throw new Error(`Project not found: ${pid}`);

  const doc = cloneJson(row.data || row);
  const { bindingCount } = patchProjectHmi(doc, { screenId, siteName, deviceId, driverId });

  await col.updateOne(
    { tenantId, projectId: pid },
    {
      $set: {
        tenantId,
        projectId: pid,
        name: doc.project?.name || row.name || pid,
        savedAt: doc.savedAt,
        tagCount: Array.isArray(doc.tags) ? doc.tags.length : null,
        driverCount: Array.isArray(doc.drivers) ? doc.drivers.length : null,
        data: doc,
        updatedAt: new Date(),
      },
    },
  );
  await client.close();
  return { mode: 'mongo', tenantId, projectId: pid, screenId, siteId, siteName, bindingCount, savedAt: doc.savedAt };
}

function patchWorkspaceZip(opts) {
  const { workspaceZip, outZip, siteId, siteName, deviceId, screenId, driverId } = opts;
  const buf = fs.readFileSync(workspaceZip);
  const unpacked = unpackArchive(buf);
  const doc = cloneJson(unpacked.project);
  const { bindingCount } = patchProjectHmi(doc, { screenId, siteName, deviceId, driverId });
  const out = packArchiveFromParts({
    project: doc,
    programs: unpacked.programs,
    activeProgram: unpacked.programsManifest?.active || doc.activeProgram,
    parc: unpacked.parc,
    mvDraw: unpacked.mvDraw,
    hmiAssets: unpacked.hmiAssets,
    mvDrawAssets: unpacked.mvDrawAssets,
    meta: { name: doc.project?.name, exportedBy: 'add-cstore-duplex-hmi' },
  });
  const target = outZip || workspaceZip;
  fs.writeFileSync(target, out);
  return {
    mode: 'workspace',
    workspaceZip: target,
    projectName: doc.project?.name,
    screenId,
    siteId,
    siteName,
    bindingCount,
    deviceId,
    savedAt: doc.savedAt,
  };
}

async function main() {
  const siteId = arg('site-id', '7767_Land_O_Lakes_Blvd').trim();
  const siteName = arg('site-name', 'store 2707575').trim();
  const deviceId = arg('device-id', 'mv_f2e689fd60d96bab').trim();
  const driverId = arg('driver-id', 'arduino_opta_st').trim();
  const screenId = arg('screen-id', slugScreenId(siteId)).trim();
  const workspaceZip = arg('workspace-zip', '').trim();
  const outZip = arg('out-zip', '').trim();

  let result;
  if (workspaceZip) {
    result = patchWorkspaceZip({ workspaceZip, outZip, siteId, siteName, deviceId, screenId, driverId });
  } else {
    const tenantId = arg('tenant-id').trim();
    if (!tenantId) {
      console.error('Pass --workspace-zip or --tenant-id');
      process.exit(1);
    }
    result = await patchMongo({
      tenantId,
      siteId,
      siteName,
      deviceId,
      projectId: arg('project-id', '').trim(),
      screenId,
      driverId,
    });
  }

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e) => {
  console.error('[add-duplex-hmi]', e.message || e);
  process.exit(1);
});
