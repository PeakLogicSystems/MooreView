'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { pushRemoteTagForce, pushRemoteHmiMemoryWrite, scheduleRemoteHmiMemoryWrite, resolveForceDeviceId } = require('../src/api/pushRemoteTagForce');
const { registry } = require('../src/parc/deviceRegistry');
const { MqttParcOptaDriver } = require('../src/drivers/mqttParcOptaDriver');

describe('pushRemoteTagForce', () => {
  it('syncs force when PC runtime never started (remoteExecution unset on scanEngine)', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    drv.syncTagForce = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    registry.ingestReport({
      deviceId: 'opta_st_01',
      platform: 'arduino-opta-mqtt-st',
      tags: [{ id: 'R1', type: 'BOOL', value: false }],
    });
    const driverManager = {
      configs: [{
        id: 'opta_st_01',
        type: 'mqtt_parc',
        enabled: true,
        deviceId: 'opta_st_01',
      }],
      instances: new Map([['opta_st_01', drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = { remoteExecution: false, loadSettings: () => {} };
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteTagForce(driverManager, scanEngine, {
        id: 'R1',
        driverId: 'opta_st_01',
        forceOutput: true,
        forceValue: true,
      });
      assert.equal(result.ok, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].opts.deviceId, 'opta_st_01');
    } finally {
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('redirects stale template tag driverId to sole live mqtt_parc driver', async () => {
    const liveId = 'opta_0123b636f1c23964ee';
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: liveId,
      type: 'mqtt_parc',
      deviceId: liveId,
      ateccSerial: '0123b636f1c23964ee',
    });
    drv.syncTagForce = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    registry.ingestReport({
      deviceId: liveId,
      platform: 'arduino-opta-mqtt-st',
      ateccSerial: '0123b636f1c23964ee',
      tags: [{ id: 'R1', type: 'BOOL', value: false }],
    });
    const driverManager = {
      configs: [{
        id: liveId,
        type: 'mqtt_parc',
        enabled: true,
        deviceId: liveId,
        ateccSerial: '0123b636f1c23964ee',
      }],
      instances: new Map([[liveId, drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = { remoteExecution: false, loadSettings: () => {} };
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteTagForce(driverManager, scanEngine, {
        id: 'R1',
        driverId: 'opta_st_01',
        forceOutput: true,
        forceValue: true,
      });
      assert.equal(result.ok, true);
      assert.equal(result.driverId, liveId);
      assert.equal(result.deviceId, liveId);
      assert.equal(result.redirected, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].opts.deviceId, liveId);
    } finally {
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('redirects stale template tag driverId on force clear (DELETE path)', async () => {
    const liveId = `opta_force_clear_${Date.now()}`;
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: liveId,
      type: 'mqtt_parc',
      deviceId: liveId,
    });
    drv.syncTagForce = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    registry.ingestReport({
      deviceId: liveId,
      platform: 'arduino-opta-mqtt-st',
      tags: [{ id: 'R1', type: 'BOOL', value: false }],
    });
    const driverManager = {
      configs: [{
        id: liveId,
        type: 'mqtt_parc',
        enabled: true,
        deviceId: liveId,
      }],
      instances: new Map([[liveId, drv]]),
      _connectCfg: (cfg) => cfg,
    };
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteTagForce(driverManager, null, {
        id: 'R1',
        driverId: 'opta_st_01',
      });
      assert.equal(result.ok, true);
      assert.equal(result.redirected, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].opts.deviceId, liveId);
    } finally {
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('redirects offline template driver to another live mqtt_parc driver', () => {
    const liveId = `opta_force_live_${Date.now()}`;
    registry.ingestReport({
      deviceId: liveId,
      platform: 'arduino-opta-mqtt-st',
      tags: [],
    });
    const templateId = `opta_force_tpl_${Date.now()}`;
    const driverManager = {
      configs: [
        { id: templateId, type: 'mqtt_parc', enabled: true, deviceId: templateId },
        { id: `${templateId}_hw`, type: 'mqtt_parc', enabled: true, deviceId: liveId },
      ],
    };
    const resolved = resolveForceDeviceId({
      id: templateId,
      deviceId: templateId,
      type: 'mqtt_parc',
    }, driverManager);
    assert.equal(resolved, liveId);
  });

  it('throws when driver device is offline and no live Opta exists', () => {
    const offlineId = `opta_force_missing_${Date.now()}`;
    assert.throws(
      () => resolveForceDeviceId({ id: offlineId, deviceId: offlineId }),
      /not reachable/i,
    );
  });

  it('skips local tags without driverId when not remote ST', async () => {
    const persistence = require('../src/persistence');
    const origRead = persistence.readJson;
    persistence.readJson = (name, fb) => (
      name === 'settings.json' ? { remoteExecution: false } : origRead(name, fb)
    );
    try {
      const result = await pushRemoteTagForce(
        { configs: [], instances: new Map() },
        { remoteExecution: false },
        { id: 'LOCAL', role: 'memory', driverId: null },
      );
      assert.equal(result.skipped, true);
      assert.equal(result.reason, 'local tag');
    } finally {
      persistence.readJson = origRead;
    }
  });

  it('forwards memory tag force without driverId to live Opta under remote ST', async () => {
    const deviceId = 'mv_test_mem_force';
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'arduino_opta_st',
      type: 'mqtt_parc',
      deviceId,
    });
    drv.syncTagForce = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    drv.startRuntime = async () => {};
    registry.ingestReport({
      deviceId,
      platform: 'arduino-opta-mqtt-st',
      runtime: { running: true, programOk: true },
      tags: [{ id: 'MOTOR1_HAND', type: 'BOOL', role: 'memory', value: false }],
    });
    const driverManager = {
      configs: [{
        id: 'arduino_opta_st',
        type: 'mqtt_parc',
        enabled: true,
        deviceId,
      }],
      instances: new Map([['arduino_opta_st', drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = { ast: { remote: true }, remoteExecution: true, loadSettings: () => {} };
    const persistence = require('../src/persistence');
    const origRead = persistence.readJson;
    persistence.readJson = (name, fb) => (
      name === 'settings.json' ? { remoteExecution: true } : origRead(name, fb)
    );
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteTagForce(driverManager, scanEngine, {
        id: 'MOTOR1_HAND',
        role: 'memory',
        type: 'BOOL',
        driverId: null,
        forceOutput: true,
        forceValue: true,
      });
      assert.equal(result.ok, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].opts.deviceId, deviceId);
      assert.equal(sent[0].tag.id, 'MOTOR1_HAND');
    } finally {
      persistence.readJson = origRead;
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('pushRemoteHmiMemoryWrite forwards memory tag writes to running Opta ST', async () => {
    const deviceId = 'mv_test_hmi_write';
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'arduino_opta_st',
      type: 'mqtt_parc',
      deviceId,
    });
    drv.syncTagMemory = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    registry.ingestReport({
      deviceId,
      platform: 'arduino-opta-mqtt-st',
      runtime: { running: true },
      tags: [{ id: 'MOTOR1_START', type: 'BOOL', role: 'memory', value: false }],
    });
    const driverManager = {
      configs: [{
        id: 'arduino_opta_st',
        type: 'mqtt_parc',
        enabled: true,
        deviceId,
      }],
      instances: new Map([['arduino_opta_st', drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = { ast: { remote: true }, remoteExecution: true, loadSettings: () => {} };
    const persistence = require('../src/persistence');
    const origRead = persistence.readJson;
    persistence.readJson = (name, fb) => (
      name === 'settings.json' ? { remoteExecution: true } : origRead(name, fb)
    );
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteHmiMemoryWrite(driverManager, scanEngine, {
        id: 'MOTOR1_START',
        role: 'memory',
        type: 'BOOL',
        value: true,
      });
      assert.equal(result.ok, true);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].tag.id, 'MOTOR1_START');
      assert.equal(sent[0].tag.value, true);
      assert.equal(sent[0].opts.deviceId, deviceId);

      const release = await pushRemoteHmiMemoryWrite(driverManager, scanEngine, {
        id: 'MOTOR1_START',
        role: 'memory',
        type: 'BOOL',
        value: false,
      });
      assert.equal(release.skipped, true);
      assert.equal(release.reason, 'momentary release');
      assert.equal(sent.length, 1);
    } finally {
      persistence.readJson = origRead;
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('pushRemoteHmiMemoryWrite forwards when remoteExecution on and PC runtime is stopped', async () => {
    const deviceId = 'mv_test_hmi_write_idle';
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'arduino_opta_st',
      type: 'mqtt_parc',
      deviceId,
    });
    drv.syncTagMemory = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    registry.ingestReport({
      deviceId,
      platform: 'arduino-opta-mqtt-st',
      runtime: { running: true },
      tags: [{ id: 'MOTOR1_START', type: 'BOOL', role: 'memory', value: false }],
    });
    const driverManager = {
      configs: [{
        id: 'arduino_opta_st',
        type: 'mqtt_parc',
        enabled: true,
        deviceId,
      }],
      instances: new Map([['arduino_opta_st', drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = { running: false, ast: null, remoteExecution: true, loadSettings: () => {} };
    const persistence = require('../src/persistence');
    const origRead = persistence.readJson;
    persistence.readJson = (name, fb) => (
      name === 'settings.json' ? { remoteExecution: true } : origRead(name, fb)
    );
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteHmiMemoryWrite(driverManager, scanEngine, {
        id: 'MOTOR1_START',
        role: 'memory',
        type: 'BOOL',
        value: true,
      });
      assert.equal(result.ok, true);
      assert.equal(sent.length, 1);
    } finally {
      persistence.readJson = origRead;
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('scheduleRemoteHmiMemoryWrite keeps forceInput when a newer write is pending', async () => {
    const deviceId = 'mv_test_hmi_write_gen';
    let resolveFirst;
    const firstPush = new Promise((r) => { resolveFirst = r; });
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'arduino_opta_st',
      type: 'mqtt_parc',
      deviceId,
    });
    drv.syncTagMemory = async (tag, opts) => {
      sent.push({ tag, opts });
      if (sent.length === 1) await firstPush;
      return { ok: true };
    };
    registry.ingestReport({
      deviceId,
      platform: 'arduino-opta-mqtt-st',
      runtime: { running: true },
      tags: [{ id: 'MOTOR1_START', type: 'BOOL', role: 'memory', value: false }],
    });
    const driverManager = {
      configs: [{
        id: 'arduino_opta_st',
        type: 'mqtt_parc',
        enabled: true,
        deviceId,
      }],
      instances: new Map([['arduino_opta_st', drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = { ast: { remote: true }, remoteExecution: true, loadSettings: () => {} };
    const { TagStore } = require('../src/tags/tagStore');
    const tagStore = new TagStore();
    tagStore.replaceAll([{ id: 'MOTOR1_START', type: 'BOOL', role: 'memory', value: false }]);
    const persistence = require('../src/persistence');
    const origRead = persistence.readJson;
    persistence.readJson = (name, fb) => (
      name === 'settings.json' ? { remoteExecution: true } : origRead(name, fb)
    );
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      scheduleRemoteHmiMemoryWrite(tagStore, driverManager, scanEngine, {
        id: 'MOTOR1_START',
        role: 'memory',
        type: 'BOOL',
        value: true,
      });
      scheduleRemoteHmiMemoryWrite(tagStore, driverManager, scanEngine, {
        id: 'MOTOR1_START',
        role: 'memory',
        type: 'BOOL',
        value: true,
      });
      assert.equal(tagStore.get('MOTOR1_START').forceInput, true);
      resolveFirst({ ok: true });
      await new Promise((r) => setTimeout(r, 20));
      assert.equal(tagStore.get('MOTOR1_START').forceInput, true);
      assert.equal(sent.length, 2);
    } finally {
      persistence.readJson = origRead;
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
    }
  });

  it('pushRemoteHmiMemoryWrite skips runtime_start when PC remote runtime is active', async () => {
    const deviceId = 'mv_test_hand_skip_start';
    const sent = [];
    let startCalls = 0;
    const drv = new MqttParcOptaDriver({
      id: 'arduino_opta_st',
      type: 'mqtt_parc',
      deviceId,
    });
    drv.startRuntime = async () => {
      startCalls += 1;
      throw new Error('MQTT command timeout (runtime_start)');
    };
    drv.syncTagMemory = async (tag, opts) => {
      sent.push({ tag, opts });
      return { ok: true };
    };
    registry.ingestReport({
      deviceId,
      platform: 'arduino-opta-mqtt-st',
      runtime: { running: false, programOk: true },
      tags: [{ id: 'MOTOR1_HAND', type: 'BOOL', role: 'memory', value: false }],
    });
    const driverManager = {
      configs: [{
        id: 'arduino_opta_st',
        type: 'mqtt_parc',
        enabled: true,
        deviceId,
      }],
      instances: new Map([['arduino_opta_st', drv]]),
      _connectCfg: (cfg) => ({ ...cfg, remoteExecution: true }),
    };
    const scanEngine = {
      running: true,
      ast: { remote: true },
      remoteExecution: true,
      loadSettings: () => {},
    };
    const persistence = require('../src/persistence');
    const origRead = persistence.readJson;
    persistence.readJson = (name, fb) => (
      name === 'settings.json' ? { remoteExecution: true } : origRead(name, fb)
    );
    const origBootstrap = require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected;
    const hub = {
      isLive: () => true,
      sendCommand: async (_deviceId, op) => {
        if (op === 'runtime_status') throw new Error('MQTT command timeout (runtime_status)');
        return {};
      },
    };
    const origHub = require('../src/parc/mqttCentralHub').getMqttCentralHub;
    require('../src/parc/mqttCentralHub').getMqttCentralHub = () => hub;
    require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = async () => ({ connected: true });
    try {
      const result = await pushRemoteHmiMemoryWrite(driverManager, scanEngine, {
        id: 'MOTOR1_HAND',
        role: 'memory',
        type: 'BOOL',
        value: true,
      });
      assert.equal(result.ok, true);
      assert.equal(startCalls, 0);
      assert.equal(sent.length, 1);
      assert.equal(sent[0].tag.id, 'MOTOR1_HAND');
    } finally {
      persistence.readJson = origRead;
      require('../src/parc/mqttParcBootstrap').ensureMqttHubConnected = origBootstrap;
      require('../src/parc/mqttCentralHub').getMqttCentralHub = origHub;
    }
  });
});
