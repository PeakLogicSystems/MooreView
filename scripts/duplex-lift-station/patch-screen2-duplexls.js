#!/usr/bin/env node
'use strict';

/**
 * Upgrade screen_2 to the DUPLEXLS composite faceplate in a workspace or .est.json.
 *
 * Usage:
 *   node scripts/duplex-lift-station/patch-screen2-duplexls.js [path]
 *   node scripts/duplex-lift-station/patch-screen2-duplexls.js /var/lib/mooreview/workspace.est.json
 */

const fs = require('fs');
const path = require('path');
const {
  explodeCompositeToEdit,
  listHmiComposites,
  repairCompositeBindings,
} = require('../../src/hmi/hmiComposites');
const { isHvacSplitProject, shouldUseDuplexSite3d } = require('../../src/hmi/duplexlsScreen');

const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const DUPLEXLS_GRID = { cols: 16, rows: 13, cellWidth: 64, cellHeight: 64 };
const DUPLEXLS_SVG = '/hmi/svg/library/lift-station-faceplates/mooreview/duplexls.svg';
const DUPLEXLS_OVERVIEW = { width: 1150, height: 620 };
const DUPLEXLS_VIEWPORT = { displayMaxWidth: 1229, displayMaxHeight: 922, scale: 120 };

function buildDuplexlsScreen(composites) {
  const duplexManifest = composites.find((c) => c.composite?.id === 'duplexls')?.composite;
  if (!duplexManifest) throw new Error('Missing duplexls composite manifest');
  return {
    id: 'screen_2',
    number: 2,
    isHome: false,
    inheritProjectLayout: false,
    name: 'DUPLEXLS',
    svg: DUPLEXLS_SVG,
    tiles: [explodeCompositeToEdit(duplexManifest, 0, 0, {
      colSpan: DUPLEXLS_GRID.cols,
      rowSpan: DUPLEXLS_GRID.rows,
    })],
    gridCols: DUPLEXLS_GRID.cols,
    gridRows: DUPLEXLS_GRID.rows,
    cellWidth: DUPLEXLS_GRID.cellWidth,
    cellHeight: DUPLEXLS_GRID.cellHeight,
    gridSize: DUPLEXLS_GRID.cols,
    width: DUPLEXLS_OVERVIEW.width,
    height: DUPLEXLS_OVERVIEW.height,
    naturalWidth: DUPLEXLS_OVERVIEW.width,
    naturalHeight: DUPLEXLS_OVERVIEW.height,
    displayMaxWidth: DUPLEXLS_VIEWPORT.displayMaxWidth,
    displayMaxHeight: DUPLEXLS_VIEWPORT.displayMaxHeight,
    scale: DUPLEXLS_VIEWPORT.scale,
    background: '#1a1a1a',
    fit: 'contain',
    offsetX: 0,
    offsetY: 0,
  };
}

function needsUpgrade(hmi) {
  const screen = hmi?.screens?.find((s) => s.id === 'screen_2');
  if (!screen) return false;
  if (screen.inheritProjectLayout !== false) return true;
  return screen.tiles?.[0]?.compositeId !== 'duplexls' || screen.name !== 'DUPLEXLS';
}

function patchDoc(doc, composites) {
  const hmi = doc.settings?.hmi;
  if (!hmi?.screens?.length) return { changed: false, reason: 'no hmi screens' };
  const projectName = String(doc.project?.name || doc.settings?.project?.name || '').trim();
  if (isHvacSplitProject(projectName, hmi)) {
    return { changed: false, reason: 'hvac split project' };
  }
  if (!shouldUseDuplexSite3d(hmi, projectName)) {
    return { changed: false, reason: 'not a duplex lift workspace' };
  }
  if (!needsUpgrade(hmi)) return { changed: false, reason: 'already duplexls' };

  const idx = hmi.screens.findIndex((s) => s.id === 'screen_2');
  if (idx < 0) return { changed: false, reason: 'no screen_2' };

  hmi.screens[idx] = buildDuplexlsScreen(composites);
  hmi.screens[idx].inheritProjectLayout = false;
  hmi.bindings = (hmi.bindings || []).filter((b) => b.screenId !== 'screen_2');
  repairCompositeBindings(hmi, PUBLIC);
  if (hmi.layout) hmi.layout.areaPopupScreens = ['screen_2'];
  doc.savedAt = new Date().toISOString();
  return { changed: true };
}

function main() {
  const target = path.resolve(process.argv[2] || path.join(ROOT, 'data', 'projects', 'duplex-lift-station.est.json'));
  if (!fs.existsSync(target)) {
    console.error(`Missing file: ${target}`);
    process.exit(1);
  }

  const composites = listHmiComposites(PUBLIC);
  const doc = JSON.parse(fs.readFileSync(target, 'utf8'));
  const result = patchDoc(doc, composites);
  if (!result.changed) {
    console.log(`patch-screen2-duplexls: skip ${target} (${result.reason})`);
    return;
  }

  fs.writeFileSync(target, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  const bindings = (doc.settings?.hmi?.bindings || []).filter((b) => b.screenId === 'screen_2').length;
  console.log(`patch-screen2-duplexls: updated ${target}`);
  console.log(`  screen_2: DUPLEXLS (@composite/duplexls), bindings: ${bindings}`);
}

main();
