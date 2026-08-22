'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { mergeParcTagsIntoStore, parcRowToStoreTag } = require('../src/parc/parcTagSync');

describe('parcTagSync', () => {
  it('maps expansion tag rows with channel address', () => {
    const t = parcRowToStoreTag({ id: 'X1_I3', type: 'BOOL', role: 'input', value: true }, 'opta_st_01');
    assert.equal(t.id, 'X1_I3');
    assert.equal(t.driverId, 'opta_st_01');
    assert.equal(t.driverAddress.channel, 'X1_I3');
  });

  it('replaces tags on driver from Parc report', () => {
    const existing = [
      { id: 'I1', type: 'BOOL', driverId: 'opta_st_01' },
      { id: 'VPB1', type: 'BOOL', driverId: null },
    ];
    const parcTags = [
      { id: 'I1', type: 'BOOL', role: 'input', value: false },
      { id: 'X1_I1', type: 'BOOL', role: 'input', value: true },
    ];
    const r = mergeParcTagsIntoStore(existing, parcTags, 'opta_st_01');
    assert.equal(r.ok, true);
    assert.equal(r.count, 2);
    assert.equal(r.tags.filter((t) => t.driverId === 'opta_st_01').length, 2);
    assert.ok(r.tags.find((t) => t.id === 'VPB1'));
  });
});
