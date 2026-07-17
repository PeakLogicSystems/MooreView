#!/usr/bin/env node
'use strict';

/**
 * Debug NextCentury driver + tags against nextcenturydata.sample.json (no live API).
 * Usage: node scripts/debug-nextcentury-fixture.js
 */

const fs = require('fs');
const path = require('path');
const { NextcenturyDriver } = require('../src/drivers/nextcenturyDriver');
const {
  loadNextcenturySample,
  createNextcenturyFetchMock,
  buildDeviceCacheFromSample,
  expectedTagValue,
} = require('../test/helpers/nextcenturySampleMock');

const ROOT = path.join(__dirname, '..');
const TAGS_PATH = path.join(ROOT, 'st/fixtures/tags.nextcentury.json');

function makeStore() {
  const vals = new Map();
  return {
    get(id) { return vals.get(id); },
    setValue(id, value, quality) {
      vals.set(id, { value, quality });
    },
    vals,
  };
}

async function main() {
  const sample = loadNextcenturySample();
  const tags = JSON.parse(fs.readFileSync(TAGS_PATH, 'utf8'));
  const cache = buildDeviceCacheFromSample(sample);

  const originalFetch = global.fetch;
  global.fetch = createNextcenturyFetchMock(sample);

  const drv = new NextcenturyDriver({
    email: 'debug@local',
    password: 'debug',
    pollIntervalMs: 0,
    propertyDelayMs: 0,
    propertyIds: sample.reports.map((r) => r.propertyId),
  });

  const store = makeStore();
  await drv.connect(drv.cfg);
  await drv.readBatch(tags, store);

  global.fetch = originalFetch;

  console.log('NextCentury fixture debug (sample data, no API)\n');
  console.log(`Properties: ${sample.reports.map((r) => `${r.propertyName} (${r.propertyId})`).join(', ')}`);
  console.log(`Devices in cache: ${cache.size}\n`);
  console.log('Tag ID                  | Expected   | Driver     | Q');
  console.log('------------------------|------------|------------|----');

  let mismatches = 0;
  for (const tag of tags) {
    const got = store.get(tag.id);
    const exp = expectedTagValue(tag, cache);
    const expStr = exp == null ? '—' : String(exp);
    const gotStr = got ? String(got.value) : '—';
    const ok = tag.driverAddress?.field === '_lastCollectEpoch'
      ? got?.quality === 'GOOD' && typeof got.value === 'number' && got.value > 0
      : exp == null
        ? got?.quality === 'STALE'
        : got && got.value === exp;
    if (!ok) mismatches += 1;
    const mark = ok ? ' ' : '!';
    console.log(
      `${mark}${tag.id.padEnd(23)} | ${expStr.padStart(10)} | ${gotStr.padStart(10)} | ${got?.quality || '—'}`
    );
  }

  console.log(`\n${mismatches ? `${mismatches} mismatch(es)` : 'All tag values match sample data.'}`);
  console.log('\nLoad in MooreVIEW: st/fixtures/drivers.nextcentury.json + tags.nextcentury.json');
  console.log('Live API: set NEXTCENTURY_EMAIL / NEXTCENTURY_PASSWORD on driver nextcentury1.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
