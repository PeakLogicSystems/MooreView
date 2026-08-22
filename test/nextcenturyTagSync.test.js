'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildNextcenturyTags,
  mergeNextcenturyTagsIntoStore,
  tagIdFor,
  fieldsForDevice,
} = require('../src/drivers/nextcenturyTagSync');
const { parseRt4510Row } = require('../src/drivers/nextcenturyDriver');
const {
  loadNextcenturySample,
  buildDeviceCacheFromSample,
} = require('./helpers/nextcenturySampleMock');

describe('nextcenturyTagSync', () => {
  it('tagIdFor sanitizes device ids', () => {
    assert.equal(tagIdFor('FA003195', 'USAGE'), 'NC_FA003195_USAGE');
    assert.equal(tagIdFor('11F01BBC', 'TEMP'), 'NC_11F01BBC_TEMP');
  });

  it('fieldsForDevice adds leak tag for leak sensors only', () => {
    const leak = parseRt4510Row(['', 'Wet', '', 'Bath', '', 'Leak Sensor', '70', 'FA1', '', '1', '0', '10', '', ''], 1);
    const meter = parseRt4510Row(['', 'Dry', '', 'Kitchen', '', 'Meter', '72', 'FA2', '', '1', '0', '10', '', ''], 1);
    assert.ok(fieldsForDevice(leak).some((f) => f.field === 'leakActive'));
    assert.ok(!fieldsForDevice(meter).some((f) => f.field === 'leakActive'));
  });

  it('buildNextcenturyTags from sample cache matches fixture ids', () => {
    const sample = loadNextcenturySample();
    const cache = buildDeviceCacheFromSample(sample);
    const tags = buildNextcenturyTags(cache, 'nextcentury1', { _deviceCount: cache.size, _lastCollectEpoch: 1 });
    const ids = new Set(tags.map((t) => t.id));
    assert.ok(ids.has('NC_STATUS_DEVICES'));
    assert.ok(ids.has('NC_FA003195_USAGE'));
    assert.ok(ids.has('NC_FA0032A8_LEAK'));
    assert.ok(ids.has('NC_11F01BBC_USAGE'));
  });

  it('mergeNextcenturyTagsIntoStore preserves labels', () => {
    const sample = loadNextcenturySample();
    const cache = buildDeviceCacheFromSample(sample);
    const existing = [{
      id: 'NC_FA003195_USAGE',
      label: 'Custom bathroom label',
      driverId: 'nextcentury1',
      ncAuto: true,
    }];
    const merged = mergeNextcenturyTagsIntoStore(existing, cache, 'nextcentury1', {
      _deviceCount: cache.size,
      _lastCollectEpoch: 99,
    });
    assert.equal(merged.ok, true);
    const kept = merged.tags.find((t) => t.id === 'NC_FA003195_USAGE');
    assert.equal(kept.label, 'Custom bathroom label');
    assert.equal(merged.tags.filter((t) => t.driverId === 'nextcentury1').length, merged.count);
  });
});
