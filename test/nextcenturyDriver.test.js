'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  NextcenturyDriver,
  parseRt4510Row,
  leakIsActive,
  reportDateStr,
} = require('../src/drivers/nextcenturyDriver');
const { QUALITY } = require('../src/tags/constants');
const {
  loadNextcenturySample,
  createNextcenturyFetchMock,
  buildDeviceCacheFromSample,
  expectedTagValue,
} = require('./helpers/nextcenturySampleMock');

const TAGS_FIXTURE = path.join(__dirname, '../st/fixtures/tags.nextcentury.json');

describe('nextcenturyDriver', () => {  it('parseRt4510Row maps 14 columns', () => {
    const row = ['Type', 'Dry', 'u1', 'Bathroom', 'u2', 'Leak Sensor', '69.8', 'FA003195', 'Model', '100', '90', '15302.06', '12', 'Desc'];
    const doc = parseRt4510Row(row, 39990);
    assert.equal(doc.deviceId, 'FA003195');
    assert.equal(doc.temperature, 69.8);
    assert.equal(doc.totalUsage, 15302.06);
    assert.equal(doc.propertyId, 39990);
  });

  it('leakIsActive detects leak states', () => {
    assert.equal(leakIsActive('Dry'), false);
    assert.equal(leakIsActive('No Leak'), false);
    assert.equal(leakIsActive('Leak'), true);
    assert.equal(leakIsActive('Wet'), true);
  });

  it('reportDateStr uses M-D-YYYY', () => {
    const s = reportDateStr(new Date(2026, 5, 14));
    assert.equal(s, '6-14-2026');
  });

  it('readBatch polls API and maps tags by deviceId', async () => {
    const originalFetch = global.fetch;
    let loginCalls = 0;
    global.fetch = async (url, opts) => {
      if (String(url).includes('/login')) {
        loginCalls += 1;
        return { ok: true, json: async () => ({ token: 'jwt-test' }) };
      }
      if (String(url).endsWith('/Properties')) {
        return { ok: true, json: async () => [{ _id: 'p_100', name: 'Site A' }] };
      }
      if (String(url).includes('/RunReport/')) {
        return {
          ok: true,
          json: async () => ({
            rows: [['T', 'Dry', '', 'Kitchen', '', 'Meter', '72.1', 'DEV001', '', '10', '9', '42.5', '1', 'Main']],
          }),
        };
      }
      throw new Error(`unexpected fetch ${url}`);
    };

    const store = {
      _vals: new Map(),
      _tags: [],
      list() { return this._tags; },
      get(id) { return this._vals.get(id); },
      setValue(id, value, quality) {
        this._vals.set(id, { value, quality });
      },
      replaceAll(tags) {
        this._tags = tags;
      },
    };

    const drv = new NextcenturyDriver({
      id: 'nextcentury1',
      email: 'user@test.com',
      password: 'secret',
      pollIntervalMs: 0,
      propertyDelayMs: 0,
    });
    await drv.connect(drv.cfg);
    await drv.readBatch([], store);

    assert.equal(loginCalls, 1);
    assert.ok(store.list().some((t) => t.id === 'NC_DEV001_USAGE'));
    assert.equal(store.get('NC_DEV001_USAGE').value, 42.5);
    assert.equal(store.get('NC_DEV001_USAGE').quality, QUALITY.GOOD);
    assert.ok(store.list().some((t) => t.id === 'NC_STATUS_DEVICES'));

    global.fetch = originalFetch;
  });

  it('maps tags.nextcentury.json from nextcenturydata.sample.json', async () => {
    const sample = loadNextcenturySample();
    const tags = JSON.parse(fs.readFileSync(TAGS_FIXTURE, 'utf8'));
    const cache = buildDeviceCacheFromSample(sample);
    const originalFetch = global.fetch;
    global.fetch = createNextcenturyFetchMock(sample);

    const store = {
      _vals: new Map(),
      _tags: tags.slice(),
      list() { return this._tags; },
      get(id) { return this._vals.get(id); },
      setValue(id, value, quality) {
        this._vals.set(id, { value, quality });
      },
      replaceAll(newTags) {
        this._tags = newTags;
      },
    };

    const drv = new NextcenturyDriver({
      id: 'nextcentury1',
      email: 'debug@local',
      password: 'debug',
      pollIntervalMs: 0,
      propertyDelayMs: 0,
      propertyIds: [39990, 40074],
    });
    await drv.connect(drv.cfg);
    await drv.readBatch([], store);

    assert.equal(store.get('NC_STATUS_DEVICES').value, cache.size);
    assert.equal(store.get('NC_STATUS_DEVICES').quality, QUALITY.GOOD);
    assert.equal(store.get('NC_FA003195_USAGE').value, 15302.06);
    assert.equal(store.get('NC_FA003195_LEAK').value, false);
    assert.equal(store.get('NC_FA0032A8_LEAK').value, true);
    assert.equal(store.get('NC_FA0032A8_USAGE').value, 5264.8);
    assert.equal(store.get('NC_11F01BBC_USAGE').value, 28020.84);

    for (const tag of tags) {
      if (tag.driverAddress?.field === '_lastCollectEpoch') continue;
      const exp = expectedTagValue(tag, cache);
      const got = store.get(tag.id);
      assert.equal(got?.quality, QUALITY.GOOD, `${tag.id} quality`);
      if (exp != null) assert.equal(got.value, exp, tag.id);
    }

    global.fetch = originalFetch;
  });
});