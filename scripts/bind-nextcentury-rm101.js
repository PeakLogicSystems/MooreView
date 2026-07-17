#!/usr/bin/env node
'use strict';

/**
 * Bind RM101's NextCentury leak sensors (property 40074) to their ALF tags in
 * the Mongo-backed config store, keeping the auto-generated NC_* mirrors:
 *   RM101_AC_PAN_LEAK ← FA003A90.leakActive
 *   RM101_TOILET_LEAK ← FA003190.leakActive
 *
 * These sensors are why room 101's summary/detail leak lamps stayed gray: the
 * ALF semantic map only wired RM102, so the RM101_* tags were never driven.
 *
 * Updates both the active config document (tags.json) and the saved project
 * snapshot for the active project, so the bindings survive a project reload.
 *
 * IMPORTANT: run with the MooreVIEW server STOPPED, otherwise the running
 * process can flush its stale in-memory tags and clobber this write:
 *   npm run stop
 *   node scripts/bind-nextcentury-rm101.js
 *   npm start
 *
 * Bind a single custom sensor instead via env:
 *   NC_DEVICE, NC_FIELD, NC_TAG_ID, NC_TAG_LABEL (FORCE=1 to override running)
 */

const fs = require('fs');
const path = require('path');
const configStore = require('../src/configStore');
const { DATA_DIR } = require('../src/config');

/** Default: bind both RM101 leak sensors. Env overrides collapse to one target. */
const TARGETS = process.env.NC_DEVICE
  ? [{
    device: process.env.NC_DEVICE,
    field: process.env.NC_FIELD || 'leakActive',
    tagId: process.env.NC_TAG_ID || 'RM101_AC_PAN_LEAK',
    label: process.env.NC_TAG_LABEL || 'RM101 A/C pan leak',
  }]
  : [
    { device: 'FA003A90', field: 'leakActive', tagId: 'RM101_AC_PAN_LEAK', label: 'RM101 A/C pan leak' },
    { device: 'FA003190', field: 'leakActive', tagId: 'RM101_TOILET_LEAK', label: 'RM101 toilet leak' },
  ];

function serverLooksRunning() {
  try {
    const pid = Number(fs.readFileSync(path.join(DATA_DIR, 'mooreview.pid'), 'utf8').trim());
    if (!Number.isFinite(pid) || pid <= 0) return false;
    process.kill(pid, 0); // throws if the process is gone
    return pid;
  } catch {
    return false;
  }
}

function findNcDriverId(drivers) {
  const nc = (drivers || []).find((d) => d && d.type === 'nextcentury');
  return nc ? nc.id : 'nextcentury1';
}

function makeBoolInputTag(driverId, target) {
  return {
    id: target.tagId,
    label: target.label,
    type: 'BOOL',
    role: 'input',
    driverId,
    driverAddress: { deviceId: target.device, field: target.field },
    default: false,
    scale: 1,
    offset: 0,
    alarmsEnabled: true,
    alarmOuterLow: null,
    alarmInnerLow: null,
    alarmInnerHigh: null,
    alarmOuterHigh: null,
    alarmCondition: 'on',
    readonly: false,
    preset: 0,
    mode: 'TON',
    arrayLen: 1,
    value: false,
    quality: 'GOOD',
    wordWidth: 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: false,
    dirty: false,
    alarmLevel: null,
    fb: {},
  };
}

/** Ensure target.tagId is bound to its NC device; never touches the NC_ mirror tag. */
function bindTag(tags, driverId, target) {
  const list = Array.isArray(tags) ? tags.slice() : [];
  const mirrorId = `NC_${target.device}_LEAK`;
  const idx = list.findIndex((t) => t && t.id === target.tagId);
  const address = { deviceId: target.device, field: target.field };
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = {
      ...prev,
      role: 'input',
      driverId,
      driverAddress: address,
      label: prev.label || target.label,
      ncAuto: false,
    };
    return { list, action: 'updated' };
  }
  const mirror = list.find((t) => t && t.id === mirrorId);
  const tag = mirror
    ? {
      ...mirror,
      id: target.tagId,
      label: target.label,
      role: 'input',
      ncAuto: false,
      readonly: false,
      alarmsEnabled: true,
      alarmCondition: 'on',
    }
    : makeBoolInputTag(driverId, target);
  tag.driverId = driverId;
  tag.driverAddress = address;
  list.push(tag);
  return { list, action: 'created' };
}

/** Bind every target into a tag list; returns the new list + per-target actions. */
function bindTargets(tags, driverId) {
  let list = Array.isArray(tags) ? tags.slice() : [];
  const actions = [];
  for (const target of TARGETS) {
    const res = bindTag(list, driverId, target);
    list = res.list;
    actions.push({ target, action: res.action, mirrorKept: list.some((t) => t && t.id === `NC_${target.device}_LEAK`) });
  }
  return { list, actions };
}

async function main() {
  const running = serverLooksRunning();
  if (running && !process.env.FORCE) {
    console.error(
      `MooreVIEW appears to be running (pid ${running}). Stop it first (npm run stop) `
      + 'or re-run with FORCE=1 to override.',
    );
    process.exit(1);
  }

  await configStore.init();

  const drivers = configStore.readSync('drivers.json', []);
  const driverId = findNcDriverId(drivers);
  console.log(`NextCentury driver id: ${driverId}`);

  // 1) Active config document (what the running app reads on boot).
  const activeTags = configStore.readSync('tags.json', []);
  const before = Array.isArray(activeTags) ? activeTags.length : 0;
  const { list, actions } = bindTargets(activeTags, driverId);
  configStore.writeSync('tags.json', list);
  await configStore.flushPending();
  console.log(`tags.json: ${before} -> ${list.length} tag(s)`);
  for (const a of actions) {
    console.log(
      `  ${a.action} ${a.target.tagId} -> ${a.target.device}.${a.target.field} `
      + `(NC mirror ${a.mirrorKept ? 'kept' : 'not present'})`,
    );
  }

  // 2) Patch the saved project snapshot(s) so a project reload keeps the bindings.
  const settings = configStore.readSync('settings.json', {});
  const projectName = settings && settings.project ? settings.project.name : null;
  const projects = configStore.listProjectsSync();
  for (const p of projects) {
    if (projectName && p.name !== projectName && p.id !== projectName) continue;
    try {
      const doc = await configStore.loadProjectDoc(p.id);
      if (!doc || !Array.isArray(doc.tags)) continue;
      const nc = findNcDriverId(doc.drivers);
      const res = bindTargets(doc.tags, nc);
      doc.tags = res.list;
      await configStore.saveProjectDoc(p.id, doc);
      console.log(`project snapshot "${p.id}": ${res.actions.map((a) => `${a.action} ${a.target.tagId}`).join(', ')}`);
    } catch (e) {
      console.warn(`project snapshot "${p.id}": skipped (${e.message})`);
    }
  }

  await configStore.shutdown();
  console.log('Done. Start the server (npm start) to load the updated config.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
