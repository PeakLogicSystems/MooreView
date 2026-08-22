'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { cmdFailureHint, brokerMismatchMessage, cmdTimeoutMessage, deviceIdMismatchHint, parcCmdPreflight, parcDeployErrorHint } = require('../src/parc/cmdFailureHint');
const { registry } = require('../src/parc/deviceRegistry');

describe('cmdFailureHint', () => {
  it('detects localhost broker mismatch', () => {
    const msg = brokerMismatchMessage(
      { meta: { mqttBroker: '127.0.0.1', mqttBrokerPort: 1883 } },
      'mqtt://192.168.1.233:1883',
    );
    assert.match(msg, /127\.0\.0\.1/);
    assert.match(msg, /\/setup/);
  });

  it('detects wrong broker when hub uses 127.0.0.1 (IOT-LINK appliance)', () => {
    const msg = brokerMismatchMessage(
      { meta: { mqttBroker: '10.99.88.77', mqttBrokerPort: 1883 } },
      'mqtt://127.0.0.1:1883',
    );
    assert.match(msg, /10\.99\.88\.77/);
    assert.match(msg, /\/setup/);
  });

  it('uses firmware-aware hint when telemetry is fresh', () => {
    const msg = cmdFailureHint(
      { meta: { firmwareVersion: '2.3.44' }, stale: false, ageSec: 5 },
      { hubBrokerUrl: 'mqtt://192.168.1.233:1883' },
    );
    assert.match(msg, /2\.3\.44/);
    assert.doesNotMatch(msg, /2\.3\.28/);
  });

  it('mentions mosquitto auth when hub uses credentials but no telemetry', () => {
    const msg = cmdFailureHint(null, {
      hubBrokerUrl: 'mqtt://127.0.0.1:1883',
      mqttHubUsername: 'mooreview',
    });
    assert.match(msg, /credentials|MOSQUITTO_USER|username\/password/);
  });

  it('suggests Opta /setup credentials on v2.3.63+ when auth fails', () => {
    const msg = cmdFailureHint(
      { meta: { firmwareVersion: '2.3.63', mqttAuthFailed: true }, stale: false, ageSec: 5 },
      { hubBrokerUrl: 'mqtt://192.168.1.233:1883', mqttHubUsername: 'mooreview' },
    );
    assert.match(msg, /\/setup/);
    assert.match(msg, /username\/password/);
  });

  it('cmdTimeoutMessage includes topic and detail', () => {
    const msg = cmdTimeoutMessage({
      deviceId: 'opta_test',
      op: 'runtime_status',
      dev: { meta: { firmwareVersion: '2.3.44' }, stale: false, ageSec: 2 },
      hubBrokerUrl: 'mqtt://192.168.1.233:1883',
    });
    assert.match(msg, /mooreview\/v1\/opta_test\/cmd/);
    assert.match(msg, /runtime_status/);
  });

  it('detects opta_ driver vs mv_ firmware telemetry', () => {
    const legacyId = 'opta_0123b636f1c23964ee';
    const mvId = 'mv_f2e689fd60d96bab';
    registry.ingestReport({
      deviceId: mvId,
      platform: 'arduino-opta-mqtt-st',
      tags: [{ id: 'I1', type: 'BOOL', value: false }],
      meta: { ateccSerial: '0123b636f1c23964ee', firmwareVersion: '2.3.48' },
    });
    const msg = cmdFailureHint(null, {
      hubBrokerUrl: 'mqtt://192.168.1.233:1883',
      deviceId: legacyId,
      registry,
    });
    assert.match(msg, /deviceId.*≠.*firmware.*mv_f2e689fd60d96bab/);
    assert.doesNotMatch(msg, /No fresh telemetry/);
    delete registry._store.devices[mvId];
  });

  it('detects legacy driver id from ateccSerial without fresh registry', () => {
    const msg = cmdFailureHint(null, {
      hubBrokerUrl: 'mqtt://192.168.1.233:1883',
      deviceId: 'opta_0123b636f1c23964ee',
      registry,
      ateccSerial: '0123b636f1c23964ee',
    });
    assert.match(msg, /mv_f2e689fd60d96bab/);
  });

  it('deviceIdMismatchHint returns empty when ids align', () => {
    assert.equal(deviceIdMismatchHint('opta_test', registry), '');
  });

  it('parcCmdPreflight rejects broker mismatch immediately', () => {
    const pre = parcCmdPreflight(
      { meta: { mqttBroker: '10.0.0.99', mqttBrokerPort: 1883 }, stale: false, ageSec: 5 },
      { hubBrokerUrl: 'mqtt://127.0.0.1:1883', deviceId: 'mv_test' },
    );
    assert.equal(pre.ok, false);
    assert.match(pre.error, /10\.0\.0\.99/);
  });

  it('parcCmdPreflight rejects stale telemetry', () => {
    const pre = parcCmdPreflight(
      { meta: { firmwareVersion: '2.3.58' }, stale: false, ageSec: 300 },
      { hubBrokerUrl: 'mqtt://192.168.1.233:1883', deviceId: 'mv_test' },
    );
    assert.equal(pre.ok, false);
    assert.match(pre.error, /No fresh telemetry|2\.3\.58/);
  });

  it('parcCmdPreflight allows runtime_status when telemetry is stale', () => {
    const { parcCmdPreflight } = require('../src/parc/cmdFailureHint');
    const pre = parcCmdPreflight(
      { meta: { firmwareVersion: '2.3.55' }, stale: true, ageSec: 900 },
      { hubBrokerUrl: 'mqtt://192.168.1.233:1883', deviceId: 'mv_test', op: 'runtime_status' },
    );
    assert.equal(pre.ok, true);
  });

  it('parcCmdPreflight allows stale when device ST is running', () => {
    const { parcCmdPreflight } = require('../src/parc/cmdFailureHint');
    const pre = parcCmdPreflight(
      { meta: { firmwareVersion: '2.3.55' }, stale: true, ageSec: 900, runtime: { running: true } },
      { hubBrokerUrl: 'mqtt://192.168.1.233:1883', deviceId: 'mv_test', op: 'put_program' },
    );
    assert.equal(pre.ok, true);
  });

  it('parcDeployErrorHint expands tag meta failures', () => {
    const msg = parcDeployErrorHint('tag meta ALT1 (140/128)');
    assert.match(msg, /tag meta ALT1/);
    assert.match(msg, /MooreviewOptaMqttSt/);
  });
});
