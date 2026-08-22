#!/usr/bin/env node
'use strict';

/**
 * Verify duplex lift station DUPLEXLS screen HMI bindings vs SVG and tags.
 *
 * Usage: node scripts/duplex-lift-station/verify-hmi-bindings.js
 */

const fs = require('fs');
const path = require('path');
const {
  compositeBindingElementId,
  listHmiComposites,
  repairCompositeBindings,
} = require('../../src/hmi/hmiComposites');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const EST = path.join(ROOT, 'data', 'projects', 'duplex-lift-station.est.json');
const TAGS = path.join(ROOT, 'st', 'fixtures', 'tags.duplex_lift_station.json');

const SCREEN_ID = 'screen_2';
const TILE = 't1_1_z0__';

function loadJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function svgElementIds(svgPath) {
  const text = fs.readFileSync(svgPath, 'utf8');
  const ids = new Set();
  for (const m of text.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

function bindingFor(bindings, elementId, property) {
  return bindings.find((b) => b.screenId === SCREEN_ID && b.elementId === elementId && b.property === property);
}

function assert(condition, msg, errors) {
  if (!condition) errors.push(msg);
}

function main() {
  const errors = [];
  const est = loadJson(EST);
  const tagIds = new Set(loadJson(TAGS).map((t) => t.id));
  const composites = listHmiComposites(PUBLIC);
  const duplexManifest = composites.find((c) => c.composite?.id === 'duplexls')?.composite;
  if (!duplexManifest) {
    console.error('Missing duplexls composite manifest');
    process.exit(1);
  }

  const screen = est.settings.hmi.screens.find((s) => s.id === SCREEN_ID);
  assert(screen, `Missing ${SCREEN_ID}`, errors);
  assert(!est.settings.hmi.screens.some((s) => s.id === 'screen_3'), 'screen_3 should be removed', errors);
  assert(screen?.tiles?.[0]?.compositeId === 'duplexls', 'screen_2 tile should be duplexls composite', errors);

  const hmi = {
    screens: est.settings.hmi.screens,
    bindings: JSON.parse(JSON.stringify(est.settings.hmi.bindings)),
  };
  repairCompositeBindings(hmi, PUBLIC);
  const bindings = hmi.bindings.filter((b) => b.screenId === SCREEN_ID);

  const svgIds = svgElementIds(path.join(PUBLIC, duplexManifest.parts[0].svg.replace(/^\//, '')));

  for (const def of duplexManifest.defaultBindings) {
    const elementId = compositeBindingElementId(0, 0, duplexManifest, def);
    assert(svgIds.has(def.elementId), `SVG missing ${def.elementId}`, errors);
    const b = bindingFor(bindings, elementId, def.property);
    assert(b, `Missing binding ${elementId} (${def.property})`, errors);
    if (!b) continue;
    const role = duplexManifest.tagRoles?.[def.tagRole];
    if (role?.tagId) {
      assert(b.tagId === role.tagId, `${elementId}: expected tag ${role.tagId}, got ${b.tagId}`, errors);
      if (!def.tagField) assert(tagIds.has(b.tagId), `${elementId}: tag ${b.tagId} not in fixture`, errors);
    }
    if (def.format) assert(b.format === def.format, `${elementId}: expected format ${def.format}`, errors);
    if (def.interaction) assert(b.interaction === def.interaction, `${elementId}: expected interaction ${def.interaction}`, errors);
    if (def.tagField) assert(b.tagField === def.tagField, `${elementId}: missing tagField ${def.tagField}`, errors);
  }

  assert(
    bindingFor(bindings, `${TILE}btn_p1_start`, 'fill')?.tagId === 'MOTOR1_START',
    'MOTOR1 start binding missing or wrong tag',
    errors,
  );
  assert(
    bindingFor(bindings, `${TILE}btn_p2_start`, 'fill')?.tagId === 'MOTOR2_START',
    'MOTOR2 start binding missing or wrong tag',
    errors,
  );
  assert(
    bindingFor(bindings, `${TILE}lamp_status`, 'fill5')?.tagId === 'STATION_STA',
    'station status lamp should bind STATION_STA',
    errors,
  );

  if (errors.length) {
    console.error(`verify-hmi-bindings: ${errors.length} issue(s):\n`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log('verify-hmi-bindings: OK');
  console.log(`  screen: ${SCREEN_ID} (@composite/duplexls)`);
  console.log(`  bindings: ${duplexManifest.defaultBindings.length}`);
}

main();
