'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { wsIntervalMs, buildLivePayload, LIVE_WS_PATH } = require('../src/live/liveWebSocket');
const { TagStore } = require('../src/tags/tagStore');
const { DriverManager } = require('../src/drivers');
const { ScanEngine } = require('../src/runtime/scanEngine');
const { GraphHistory } = require('../src/runtime/graphHistory');

describe('liveWebSocket', () => {
  it('uses dedicated path that does not overlap go2rtc proxy', () => {
    assert.equal(LIVE_WS_PATH, '/api/live');
    assert.ok(!LIVE_WS_PATH.startsWith('/api/go2rtc'));
  });

  it('scales push interval with tag count', () => {
    assert.equal(wsIntervalMs(100), 250);
    assert.equal(wsIntervalMs(500), 250);
    assert.equal(wsIntervalMs(501), 500);
    assert.equal(wsIntervalMs(2000), 500);
    assert.equal(wsIntervalMs(2001), 1000);
  });

  it('buildLivePayload includes slim live snapshot', () => {
    const tagStore = new TagStore();
    tagStore.upsert({ id: 'T1', type: 'REAL', role: 'memory', value: 1.5 });
    const driverManager = new DriverManager(tagStore);
    const graphHistory = new GraphHistory();
    const scanEngine = new ScanEngine(tagStore, driverManager, graphHistory);
    const payload = buildLivePayload({ tagStore, driverManager, scanEngine });
    assert.ok(payload.tagCount >= 1);
    assert.equal(Array.isArray(payload.live), true);
    const row = payload.live.find((r) => r.tagId === 'T1');
    assert.equal(row?.value, 1.5);
    assert.equal(payload.runtime.running, false);
  });
});
