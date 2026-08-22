'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSerial,
  buildEventsTopic,
  extractSerial,
  mapServiceBusToMqtt,
} = require('../src/mapMessage');

describe('mapMessage', () => {
  it('normalizes hyphenated Nexcomm serial xxxx-xxxxxx', () => {
    assert.equal(normalizeSerial('ABCD-123456'), 'abcd123456');
    assert.equal(normalizeSerial('40a3-6bce47f3'), '40a36bce47f3');
    assert.equal(normalizeSerial(' 8624-06071948166 '), '862406071948166');
  });

  it('builds IoT Hub events topic from serial', () => {
    const topic = buildEventsTopic('/devices/{serial}/messages/events/', '40A36bce47f3');
    assert.equal(topic, '/devices/40a36bce47f3/messages/events/');
  });

  it('builds topic from hyphenated serial', () => {
    const topic = buildEventsTopic('/devices/{serial}/messages/events/', '40a3-6bce47f3');
    assert.equal(topic, '/devices/40a36bce47f3/messages/events/');
  });

  it('extracts serial from applicationProperties deviceId', () => {
    const serial = extractSerial({
      applicationProperties: { deviceId: '862406071948166' },
      body: { inputs: [] },
    });
    assert.equal(serial, '862406071948166');
  });

  it('extracts serial from LiftPoint Light body field 10', () => {
    const serial = extractSerial({
      applicationProperties: {},
      body: { '10': '862406071948166', in3_starts: 42 },
    });
    assert.equal(serial, '862406071948166');
  });

  it('maps Service Bus message to MQTT topic and JSON payload', () => {
    const mapped = mapServiceBusToMqtt({
      applicationProperties: { 'iothub-connection-device-id': '40a36bce47f3' },
      body: {
        inputs: [{ '9010': 0 }],
        in3_starts: 100,
        in4_starts: 50,
      },
    });
    assert.equal(mapped.topic, '/devices/40a36bce47f3/messages/events/');
    assert.match(mapped.payload, /"in3_starts":100/);
    assert.equal(mapped.serial, '40a36bce47f3');
  });

  it('unwraps nested body envelope from upstream exporter', () => {
    const mapped = mapServiceBusToMqtt({
      applicationProperties: { serial: '862406071948166' },
      body: {
        tenantId: 'ace-septic-waste',
        body: { in3_starts: 7, battery_power: 1 },
      },
    });
    assert.equal(mapped.topic, '/devices/862406071948166/messages/events/');
    assert.match(mapped.payload, /"in3_starts":7/);
  });
});
