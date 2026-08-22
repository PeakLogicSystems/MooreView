'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSerial,
  mapServiceBusToMqtt,
} = require('../src/lib/mapMessage');

describe('nexcomm function mapMessage', () => {
  it('normalizes xxxx-xxxxxx', () => {
    assert.equal(normalizeSerial('ABCD-123456'), 'abcd123456');
  });

  it('maps hyphenated deviceId to mqtt.mooreview.io topic shape', () => {
    const mapped = mapServiceBusToMqtt({
      applicationProperties: { deviceId: '40a3-6bce47f3' },
      body: { in3_starts: 1 },
    });
    assert.equal(mapped.serial, '40a36bce47f3');
    assert.equal(mapped.topic, '/devices/40a36bce47f3/messages/events/');
  });
});
