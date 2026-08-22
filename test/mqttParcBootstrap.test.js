'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  ensureMqttParcInSettings,
  hasEnabledMqttParcDriver,
  hubBootSkipReason,
  defaultMqttParcSettings,
  mergeMqttParcSettings,
  remoteStIsAvailable,
} = require('../src/parc/mqttParcBootstrap');
const { reconcileMqttParcDriversFromRegistry } = require('../src/devices/bulkAddParcOpta');

describe('mqttParcBootstrap', () => {
  it('enables mqttParc when mqtt_parc driver present', () => {
    const { settings, changed } = ensureMqttParcInSettings(
      { remoteExecution: false },
      [{ id: 'opta_st_01', type: 'mqtt_parc', enabled: true }],
    );
    assert.equal(changed, true);
    assert.equal(settings.mqttParc.enabled, true);
    assert.equal(settings.remoteExecution, false);
  });

  it('hasEnabledMqttParcDriver detects opta_remote', () => {
    assert.equal(
      hasEnabledMqttParcDriver([{ type: 'opta_remote', enabled: true }]),
      true,
    );
  });

  it('does not re-enable mqttParc when user disabled explicitly', () => {
    const { settings, changed } = ensureMqttParcInSettings(
      { mqttParc: { enabled: false, brokerUrl: 'mqtt://x:1883' }, remoteExecution: false },
      [{ id: 'opta_st_01', type: 'mqtt_parc', enabled: true }],
    );
    assert.equal(settings.mqttParc.enabled, false);
    assert.equal(settings.mqttParc.brokerUrl, 'mqtt://x:1883');
    assert.equal(changed, false);
    assert.equal(settings.remoteExecution, false);
  });

  it('auto-enables mqttParc when remoteExecution on and mqttParc unset', () => {
    const { settings, changed } = ensureMqttParcInSettings(
      { remoteExecution: true },
      [{ id: 'mock1', type: 'mock', enabled: true }],
    );
    assert.equal(changed, true);
    assert.equal(settings.mqttParc.enabled, true);
  });

  it('defaultMqttParcSettings defaults autoDiscoverDrivers to false', () => {
    assert.equal(defaultMqttParcSettings({}).autoDiscoverDrivers, false);
    assert.equal(defaultMqttParcSettings({ autoDiscoverDrivers: true }).autoDiscoverDrivers, true);
  });

  it('defaultMqttParcSettings defaults globalSiteKey to 0x0001', () => {
    assert.equal(defaultMqttParcSettings({}).globalSiteKey, 0x0001);
    assert.equal(defaultMqttParcSettings({ globalSiteKey: 0xabcd }).globalSiteKey, 0xabcd);
  });

  it('mergeMqttParcSettings keeps prev enabled when snapshot omits it', () => {
    const merged = mergeMqttParcSettings(
      { brokerUrl: 'mqtt://192.168.1.233:1883' },
      { enabled: true, autoDiscoverDrivers: true, brokerUrl: 'mqtt://192.168.1.233:1883' },
    );
    assert.equal(merged.enabled, true);
    assert.equal(merged.autoDiscoverDrivers, true);
  });

  it('reconcileMqttParcDriversFromRegistry adds missing field devices', () => {
    const now = new Date().toISOString();
    const registry = {
      listDevices: () => [
        {
          deviceId: 'opta_0123b636f1c23964ee',
          lastReportAt: now,
          ageSec: 5,
          stale: false,
          meta: { ateccSerial: '0123b636f1c23964ee' },
        },
        { deviceId: 'opta_st_01', lastReportAt: now, ageSec: 5, stale: false },
        { deviceId: 'test-01', lastReportAt: now, ageSec: 5, stale: false },
        { deviceId: 'mv_test_hmi_write', lastReportAt: now, ageSec: 5, stale: false },
      ],
      getDevice: (id) => {
        if (id === 'opta_0123b636f1c23964ee') {
          return {
            deviceId: id,
            lastReportAt: now,
            ageSec: 5,
            stale: false,
            meta: { ateccSerial: '0123b636f1c23964ee' },
          };
        }
        return { deviceId: id, lastReportAt: now, ageSec: 5, stale: false };
      },
    };
    const { drivers, changed, added } = reconcileMqttParcDriversFromRegistry(
      [{ id: 'mock1', type: 'mock', enabled: true }],
      registry,
    );
    assert.equal(changed, true);
    assert.equal(added.length, 1);
    assert.equal(drivers.length, 2);
    assert.equal(drivers[1].type, 'mqtt_parc');
    assert.equal(drivers[1].id, added[0]);
    assert.equal(drivers[1].deviceId, 'opta_0123b636f1c23964ee');
  });

  it('defaultMqttParcSettings preserves explicit enabled=false', () => {
    assert.equal(defaultMqttParcSettings({ enabled: false }).enabled, false);
    assert.equal(defaultMqttParcSettings({}).enabled, true);
  });

  it('remoteStIsAvailable is false when MQTT hub disabled', () => {
    const drivers = [{ id: 'opta_st_01', type: 'mqtt_parc', enabled: true }];
    assert.equal(remoteStIsAvailable({ remoteExecution: true, mqttParc: { enabled: false } }, drivers), false);
    assert.equal(remoteStIsAvailable({ remoteExecution: true, mqttParc: { enabled: true } }, drivers), true);
    assert.equal(remoteStIsAvailable({ remoteExecution: false, mqttParc: { enabled: true } }, drivers), false);
  });

  it('hubBootSkipReason mentions Parc registry devices', () => {
    const orig = require('../src/parc/deviceRegistry').registry.listDevices;
    require('../src/parc/deviceRegistry').registry.listDevices = () => [
      { deviceId: 'opta_0123b636f1c23964ee' },
    ];
    try {
      const why = hubBootSkipReason({}, [{ id: 'mock1', type: 'mock' }]);
      assert.match(why, /opta_0123b636f1c23964ee/);
    } finally {
      require('../src/parc/deviceRegistry').registry.listDevices = orig;
    }
  });
});
