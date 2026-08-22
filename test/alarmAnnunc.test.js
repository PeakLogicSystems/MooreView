'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { TagStore } = require('../src/tags/tagStore');
const { ALARM_LEVELS } = require('../src/tags/tagAnalog');

describe('alarm annunciator', () => {
  it('tracks active alarm and ack', () => {
    const store = new TagStore();
    store.replaceAll([{
      id: 'VPR1',
      type: 'REAL',
      role: 'memory',
      alarmsEnabled: true,
      alarmOuterLow: 0,
      alarmInnerLow: 10,
      alarmInnerHigh: 80,
      alarmOuterHigh: 90,
      value: -1,
    }]);
    const snap = store.liveSnapshot().find((e) => e.tagId === 'VPR1');
    assert.equal(snap.alarmLevel, ALARM_LEVELS.OUTER_LOW);
    assert.equal(snap.alarmAcked, false);
    assert.ok(snap.alarmSince);

    assert.equal(store.ackAlarm('VPR1'), true);
    const snap2 = store.liveSnapshot().find((e) => e.tagId === 'VPR1');
    assert.equal(snap2.alarmAcked, true);
    assert.equal(snap2.alarmAckedBy, null);

    assert.equal(store.ackAlarm('VPR1', { name: 'Operator A', email: 'op@example.com' }), true);
    const snap2b = store.liveSnapshot().find((e) => e.tagId === 'VPR1');
    assert.equal(snap2b.alarmAckedBy?.name, 'Operator A');

    store.setValue('VPR1', 50);
    const snap3 = store.liveSnapshot().find((e) => e.tagId === 'VPR1');
    assert.equal(snap3.alarmLevel, ALARM_LEVELS.NORMAL);
    assert.equal(snap3.alarmAcked, false);
  });

  it('re-alarm on severity change clears ack', () => {
    const store = new TagStore();
    store.replaceAll([{
      id: 'VPR2',
      type: 'REAL',
      role: 'memory',
      alarmsEnabled: true,
      alarmOuterLow: 0,
      alarmInnerLow: 10,
      alarmInnerHigh: 80,
      alarmOuterHigh: 90,
      value: 5,
    }]);
    store.ackAlarm('VPR2');
    store.setValue('VPR2', -1);
    const snap = store.liveSnapshot().find((e) => e.tagId === 'VPR2');
    assert.equal(snap.alarmLevel, ALARM_LEVELS.OUTER_LOW);
    assert.equal(snap.alarmAcked, false);
  });
});
