#!/usr/bin/env node
'use strict';

/**
 * Remove duplicate NextCentury (NC_*) tag groups from the Mongo-backed config,
 * keeping the FIRST occurrence of each group. Handles exact duplicate ids and
 * near-duplicates caused by inconsistent device-id formatting
 * (e.g. "NC__FA003190_LEAK" vs "NC_FA003190_LEAK").
 *
 * Dry run by default (reports only). Pass --apply to write changes.
 * Run with the MooreVIEW server STOPPED so it does not clobber the write:
 *   npm run stop
 *   node scripts/dedupe-nextcentury-tags.js            # report only
 *   node scripts/dedupe-nextcentury-tags.js --apply    # write changes
 *   npm start
 */

const fs = require('fs');
const path = require('path');
const configStore = require('../src/configStore');
const { DATA_DIR } = require('../src/config');

const APPLY = process.argv.includes('--apply');

function serverLooksRunning() {
  try {
    const pid = Number(fs.readFileSync(path.join(DATA_DIR, 'mooreview.pid'), 'utf8').trim());
    if (!Number.isFinite(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return pid;
  } catch {
    return false;
  }
}

/** Grouping key: NC_ auto tags collapse separator runs so formatting variants
 *  collide; every other tag is keyed by its exact id. */
function groupKey(id) {
  const s = String(id || '');
  if (/^NC_/i.test(s)) return s.replace(/_+/g, '_').toUpperCase();
  return s;
}

/** Keep the first tag per group; return { kept, removed }. */
function dedupe(tags) {
  const seen = new Set();
  const kept = [];
  const removed = [];
  for (const t of tags || []) {
    if (!t || !t.id) { kept.push(t); continue; }
    const key = groupKey(t.id);
    if (seen.has(key)) {
      removed.push(t);
      continue;
    }
    seen.add(key);
    kept.push(t);
  }
  return { kept, removed };
}

function reportRemoved(scope, removed) {
  if (!removed.length) {
    console.log(`  ${scope}: no duplicates`);
    return;
  }
  console.log(`  ${scope}: removing ${removed.length} duplicate tag(s):`);
  for (const t of removed) {
    console.log(`    - ${t.id}${t.driverId ? ` (driver ${t.driverId})` : ''}`);
  }
}

async function main() {
  const running = serverLooksRunning();
  if (running && APPLY && !process.env.FORCE) {
    console.error(
      `MooreVIEW appears to be running (pid ${running}). Stop it first (npm run stop) `
      + 'or re-run with FORCE=1 to override.',
    );
    process.exit(1);
  }

  await configStore.init();
  console.log(APPLY ? '=== APPLY MODE (writing changes) ===' : '=== DRY RUN (no changes) — pass --apply to write ===');

  // Active config document.
  const activeTags = configStore.readSync('tags.json', []);
  const active = dedupe(activeTags);
  console.log(`tags.json (${(activeTags || []).length} tags):`);
  reportRemoved('tags.json', active.removed);
  if (APPLY && active.removed.length) {
    configStore.writeSync('tags.json', active.kept);
    await configStore.flushPending();
    console.log(`  tags.json written: ${active.kept.length} tags`);
  }

  // Saved project snapshots.
  const projects = configStore.listProjectsSync();
  for (const p of projects) {
    try {
      const doc = await configStore.loadProjectDoc(p.id);
      if (!doc || !Array.isArray(doc.tags)) continue;
      const res = dedupe(doc.tags);
      console.log(`project "${p.id}" (${doc.tags.length} tags):`);
      reportRemoved(p.id, res.removed);
      if (APPLY && res.removed.length) {
        doc.tags = res.kept;
        await configStore.saveProjectDoc(p.id, doc);
        console.log(`  project "${p.id}" written: ${res.kept.length} tags`);
      }
    } catch (e) {
      console.warn(`project "${p.id}": skipped (${e.message})`);
    }
  }

  await configStore.shutdown();
  console.log(APPLY ? 'Done. Start the server (npm start).' : 'Dry run complete. Re-run with --apply to write.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
