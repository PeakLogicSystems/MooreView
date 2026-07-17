#!/usr/bin/env node
'use strict';

/**
 * Zap the tag database and repopulate it with ONLY the tags currently reported
 * by the NextCentury driver(s), keyed by device serial:
 *   NC_<serial>_USAGE / _TEMP / _LEAK / _INTERVAL  (+ NC_STATUS_DEVICES / _LAST_COLLECT)
 *
 * Polls the live NextCentury report, rebuilds the tag set, and overwrites the
 * active tags.json config document. Saved project snapshots are left untouched
 * (re-save the project afterward if you want this to be the stored baseline).
 *
 * Manual tags are preserved via KEEP (comma-separated ids), e.g. the RM101 alias:
 *   KEEP=RM101_AC_PAN_LEAK node scripts/reset-nextcentury-tags.js --apply
 *
 * Needs network access + credentials from the driver config (or NEXTCENTURY_EMAIL
 * / NEXTCENTURY_PASSWORD). Run with the server STOPPED (otherwise the running
 * process re-saves its stale in-memory tags right over this write):
 *   npm run stop
 *   node scripts/reset-nextcentury-tags.js            # dry run (report only)
 *   node scripts/reset-nextcentury-tags.js --apply    # zap + repopulate
 *   npm start
 */

const fs = require('fs');
const path = require('path');
const configStore = require('../src/configStore');
const { DATA_DIR } = require('../src/config');
const { NextcenturyDriver } = require('../src/drivers/nextcenturyDriver');
const { buildNextcenturyTags, dedupeById } = require('../src/drivers/nextcenturyTagSync');

const APPLY = process.argv.includes('--apply');
const KEEP_IDS = new Set(
  String(process.env.KEEP || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);

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

function resolveNcCfg(cfg) {
  return {
    ...cfg,
    email: cfg.email || process.env.NEXTCENTURY_EMAIL,
    password: cfg.password || process.env.NEXTCENTURY_PASSWORD,
    pollIntervalMs: Number(cfg.pollIntervalMs) > 0 ? Number(cfg.pollIntervalMs) : 900000,
    reportId: cfg.reportId || 'rt_4510',
    autoSyncTags: true,
  };
}

/** Connect, run one report poll, and return the reported tag rows for this driver. */
async function pollDriverTags(cfg) {
  const resolved = resolveNcCfg(cfg);
  const driver = new NextcenturyDriver(resolved);
  await driver.connect(resolved);
  if (!driver.connected) {
    throw new Error(driver._lastError || 'connection failed');
  }
  // readBatch with no store still polls the report and fills the device cache.
  await driver.readBatch([], null);
  const cache = driver._deviceCache;
  if (!cache || cache.size === 0) {
    throw new Error('report returned no devices (check property IDs / credentials)');
  }
  const tags = buildNextcenturyTags(cache, cfg.id, {
    _deviceCount: cache.size,
    _lastCollectEpoch: driver._lastCollectEpoch,
  });
  await driver.disconnect();
  return { tags, deviceCount: cache.size };
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
  console.log(APPLY ? '=== APPLY MODE (zap + repopulate) ===' : '=== DRY RUN (no changes) — pass --apply to write ===');

  const drivers = configStore.readSync('drivers.json', []);
  const ncDrivers = (drivers || []).filter((d) => d && d.type === 'nextcentury' && d.enabled !== false);
  if (!ncDrivers.length) {
    console.error('No enabled nextcentury driver found in config.');
    await configStore.shutdown();
    process.exit(1);
  }

  let reported = [];
  for (const cfg of ncDrivers) {
    console.log(`Polling driver "${cfg.id}"...`);
    const { tags, deviceCount } = await pollDriverTags(cfg);
    console.log(`  ${deviceCount} device(s) -> ${tags.length} tag(s)`);
    reported = reported.concat(tags);
  }
  reported = dedupeById(reported);

  const prev = configStore.readSync('tags.json', []);
  const reportedIds = new Set(reported.map((t) => t.id));
  const kept = (Array.isArray(prev) ? prev : []).filter(
    (t) => t && KEEP_IDS.has(t.id) && !reportedIds.has(t.id),
  );
  const missingKeep = [...KEEP_IDS].filter(
    (id) => !kept.some((t) => t.id === id) && !reportedIds.has(id),
  );
  const finalTags = dedupeById([...kept, ...reported]);

  console.log(`\nTag database: ${Array.isArray(prev) ? prev.length : 0} tag(s) -> ${finalTags.length} tag(s)`);
  if (kept.length) {
    console.log(`Kept (manual, via KEEP): ${kept.map((t) => t.id).join(', ')}`);
  }
  if (missingKeep.length) {
    console.log(`WARNING: KEEP ids not found in current DB and not reported: ${missingKeep.join(', ')}`);
  }
  console.log('Reported tags (by serial):');
  for (const t of reported) {
    const addr = t.driverAddress ? `${t.driverAddress.deviceId || '_meta'} · ${t.driverAddress.field}` : '';
    console.log(`  ${t.id}\t${addr}`);
  }

  if (!APPLY) {
    await configStore.shutdown();
    console.log('\nDry run complete. Re-run with --apply to zap + repopulate.');
    return;
  }

  configStore.writeSync('tags.json', finalTags);
  await configStore.flushPending();
  await configStore.shutdown();
  console.log(
    `\nDone. Tag database replaced (${finalTags.length} tags: ${reported.length} reported`
    + `${kept.length ? ` + ${kept.length} kept` : ''}). Start the server (npm start).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
