'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MqttParcOptaDriver, isWriteMemoryUnsupportedError, isMomentaryMemoryBoolTag } = require('../src/drivers/mqttParcOptaDriver');
const { registry } = require('../src/parc/deviceRegistry');

describe('MqttParcOptaDriver', () => {
  it('runScanCycle syncs unassigned program tags present in Parc telemetry', async () => {
    registry.ingestReport({
      deviceId: 'opta_st_01',
      tags: [
        { id: 'MOTOR1_RUN', type: 'BOOL', value: true },
        { id: 'MOTOR2_RUN', type: 'BOOL', value: false },
      ],
    });
    const rows = [
      { id: 'MOTOR1_RUN', type: 'BOOL', role: 'memory', driverId: null, value: false },
      { id: 'MOTOR2_RUN', type: 'BOOL', role: 'memory', driverId: null, value: false },
      { id: 'LOCAL_ONLY', type: 'BOOL', role: 'memory', driverId: null, value: false },
    ];
    const store = {
      list: () => rows,
      get: (id) => rows.find((t) => t.id === id),
      setValue(id, val) {
        const t = rows.find((row) => row.id === id);
        if (t) t.value = val;
        return !!t;
      },
    };
    const drv = new MqttParcOptaDriver({
      id: 'opta_mqtt_st',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
      remoteExecution: true,
    });
    const result = await drv.runScanCycle(store);
    assert.equal(result.tags, 2);
    assert.equal(store.get('MOTOR1_RUN').value, true);
    assert.equal(store.get('MOTOR2_RUN').value, false);
    assert.equal(store.get('LOCAL_ONLY').value, false);
  });

  it('syncs tags from Parc registry', async () => {
    registry.ingestReport({
      deviceId: 'opta_st_01',
      tags: [
        { id: 'I1', type: 'BOOL', value: true },
        { id: 'R1', type: 'BOOL', value: false },
      ],
    });
    const drv = new MqttParcOptaDriver({
      id: 'opta_mqtt_st',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
      remoteExecution: true,
    });
    const store = {
      list: () => [{ id: 'I1', type: 'BOOL', driverId: 'opta_mqtt_st', value: false }],
      get: (id) => ({ id, value: false }),
      setValue(id, val) { this._v = val; },
      _v: false,
    };
    await drv.runScanCycle(store);
    assert.equal(store._v, true);
  });

  it('ensureConnected delegates to connect', async () => {
    registry.ingestReport({
      deviceId: 'opta_st_01',
      tags: [{ id: 'I1', type: 'BOOL', value: true }],
    });
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    const hub = {
      status: () => ({ connected: false, brokerUrl: 'mqtt://127.0.0.1:1883' }),
      sendCommand: async () => {},
    };
    const orig = require('../src/parc/mqttCentralHub').getMqttCentralHub;
    require('../src/parc/mqttCentralHub').getMqttCentralHub = () => hub;
    try {
      assert.equal(typeof drv.ensureConnected, 'function');
      const ok = await drv.ensureConnected();
      assert.equal(ok, false);
      assert.match(drv._lastError, /hub not connected/i);
    } finally {
      require('../src/parc/mqttCentralHub').getMqttCentralHub = orig;
    }
  });

  it('syncTagMemory uses set_force forceOutput for HOA', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    drv.ensureConnected = async () => true;
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    await drv.syncTagMemory({ id: 'MOTOR1_HOA', type: 'INT', value: 2 });
    assert.equal(sent.length, 2);
    assert.equal(sent[0].op, 'set_force');
    assert.equal(sent[0].body.forceOutput, true);
    assert.equal(sent[0].body.forceValue, 2);
    assert.equal(sent[1].op, 'clear_force');
    assert.equal(sent[1].body.tagId, 'MOTOR1_HOA');
  });

  it('syncTagMemory forces HOA before HAND latch', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    drv.ensureConnected = async () => true;
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    await drv.syncTagMemory({ id: 'MOTOR1_HAND', type: 'BOOL', value: true });
    assert.equal(sent.length, 8);
    assert.equal(sent[0].body.tagId, 'MOTOR1_HOA');
    assert.equal(sent[0].body.forceValue, 2);
    assert.equal(sent[1].op, 'clear_force');
    assert.equal(sent[2].body.tagId, 'MOTOR1_START');
    assert.equal(sent[2].body.forceValue, false);
    assert.equal(sent[4].body.tagId, 'MOTOR1_STOP');
    assert.equal(sent[4].body.forceValue, false);
    assert.equal(sent[6].body.tagId, 'MOTOR1_HAND');
    assert.equal(sent[6].body.forceValue, true);
    assert.equal(sent[7].op, 'clear_force');
    assert.equal(sent[7].body.tagId, 'MOTOR1_HAND');
  });

  it('syncTagMemory forces HAND false (not clear_force) when latch released', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    drv.ensureConnected = async () => true;
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    await drv.syncTagMemory({ id: 'MOTOR1_HAND', type: 'BOOL', value: false });
    assert.equal(sent.length, 8);
    assert.equal(sent[0].body.tagId, 'MOTOR1_HOA');
    assert.equal(sent[0].body.forceValue, 2);
    assert.equal(sent[6].op, 'set_force');
    assert.equal(sent[6].body.tagId, 'MOTOR1_HAND');
    assert.equal(sent[6].body.forceValue, false);
    assert.equal(sent[7].op, 'clear_force');
    assert.equal(sent[7].body.tagId, 'MOTOR1_HAND');
  });

  it('syncTagMemory releases HAND when HOA leaves Hand mode', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    drv.ensureConnected = async () => true;
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    await drv.syncTagMemory({ id: 'MOTOR1_HOA', type: 'INT', value: 0 });
    assert.equal(sent.length, 4);
    assert.equal(sent[0].body.tagId, 'MOTOR1_HAND');
    assert.equal(sent[0].body.forceValue, false);
    assert.equal(sent[1].op, 'clear_force');
    assert.equal(sent[2].body.tagId, 'MOTOR1_HOA');
    assert.equal(sent[2].body.forceValue, 0);
    assert.equal(sent[3].op, 'clear_force');
  });

  it('syncTagMemory pulses momentary START tags', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
      scanMs: 10,
    });
    drv.ensureConnected = async () => true;
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    await drv.syncTagMemory({ id: 'MOTOR1_START', type: 'BOOL', value: true });
    assert.equal(sent.at(-3).op, 'clear_force');
    assert.equal(sent.at(-3).body.tagId, 'MOTOR1_START');
    assert.equal(sent.at(-2).op, 'set_force');
    assert.equal(sent.at(-2).body.tagId, 'MOTOR1_START');
    assert.equal(sent.at(-2).body.forceValue, false);
    assert.equal(sent.at(-1).op, 'clear_force');
    assert.equal(sent.at(-1).body.tagId, 'MOTOR1_START');
  });

  it('syncTagMemory clears START/STOP when writing MOTOR2_HAND', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
    });
    drv.ensureConnected = async () => true;
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    await drv.syncTagMemory({ id: 'MOTOR2_HAND', type: 'BOOL', value: false });
    const tagIds = sent.filter((s) => s.op === 'set_force').map((s) => s.body.tagId);
    assert.deepEqual(tagIds, ['MOTOR2_HOA', 'MOTOR2_START', 'MOTOR2_STOP', 'MOTOR2_HAND']);
    assert.equal(sent.find((s) => s.body.tagId === 'MOTOR2_START').body.forceValue, false);
    assert.equal(sent.find((s) => s.body.tagId === 'MOTOR2_STOP').body.forceValue, false);
  });

  it('writeBatch sends write_outputs using channel keys when remote I/O', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'ws_relay_acid',
      type: 'mqtt_parc',
      deviceId: 'ws_relay_acid',
      remoteExecution: false,
    });
    drv.ensureConnected = async () => {
      drv.connected = true;
      return true;
    };
    drv._hub = () => ({
      sendCommand: async (deviceId, op, body) => {
        sent.push({ deviceId, op, body });
        return {};
      },
    });
    const rows = [
      { id: 'DOSE_ACID', type: 'BOOL', role: 'output', driverAddress: { channel: 'R1' }, value: true },
    ];
    const store = { get: (id) => rows.find((t) => t.id === id) };
    await drv.writeBatch(rows, store);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].op, 'write_outputs');
    assert.equal(sent[0].deviceId, 'ws_relay_acid');
    assert.equal(sent[0].body.outputs.R1, true);
    assert.equal(sent[0].body.outputs.DOSE_ACID, true);
  });

  it('writeBatch is a no-op when remoteExecution is on', async () => {
    const sent = [];
    const drv = new MqttParcOptaDriver({
      id: 'opta_st_01',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
      remoteExecution: true,
    });
    drv._hub = () => ({
      sendCommand: async (_deviceId, op, body) => {
        sent.push({ op, body });
        return {};
      },
    });
    await drv.writeBatch([{ id: 'R1', type: 'BOOL', value: true }], { get: () => ({ value: true }) });
    assert.equal(sent.length, 0);
  });

  it('readBatch maps telemetry channel I1 onto a retargeted pool tag', async () => {
    registry.ingestReport({
      deviceId: 'ws_relay_acid',
      tags: [{ id: 'I1', type: 'BOOL', value: true }],
    });
    const drv = new MqttParcOptaDriver({
      id: 'ws_relay_acid',
      type: 'mqtt_parc',
      deviceId: 'ws_relay_acid',
      remoteExecution: false,
    });
    const rows = [
      {
        id: 'POOL_FLOW_SW',
        type: 'BOOL',
        role: 'input',
        driverId: 'ws_relay_acid',
        driverAddress: { channel: 'I1' },
        value: false,
      },
    ];
    const store = {
      list: () => rows,
      get: (id) => rows.find((t) => t.id === id),
      setValue(id, val) {
        const t = rows.find((row) => row.id === id);
        if (t) t.value = val;
        return !!t;
      },
    };
    await drv.readBatch(rows, store);
    assert.equal(store.get('POOL_FLOW_SW').value, true);
  });

  it('isWriteMemoryUnsupportedError matches unknown op only', () => {
    assert.equal(isWriteMemoryUnsupportedError(new Error('unknown op')), true);
    assert.equal(isWriteMemoryUnsupportedError(new Error('missing body')), false);
  });

  it('isMomentaryMemoryBoolTag detects motor command tags', () => {
    assert.equal(isMomentaryMemoryBoolTag({ id: 'MOTOR1_START', type: 'BOOL' }), true);
    assert.equal(isMomentaryMemoryBoolTag({ id: 'MOTOR1_HOA', type: 'INT' }), false);
    assert.equal(isMomentaryMemoryBoolTag({ id: 'MOTOR1_HAND', type: 'BOOL' }), false);
  });

  it('deployProgram skips put_program when NV CRC matches get_program', async () => {
    const { buildPcProgramDeployArtifact } = require('../src/parc/programDeployMatch');
    const tagStore = {
      list: () => [
        { id: 'I1', type: 'BOOL', role: 'input' },
        { id: 'R1', type: 'BOOL', role: 'output' },
      ],
    };
    const src = 'IF IsON(I1) THEN TurnON(R1); END_IF;';
    const artifact = buildPcProgramDeployArtifact(src, tagStore, 'opta_mqtt_st');
    assert.equal(artifact.ok, true);

    registry.ingestReport({
      deviceId: 'opta_st_01',
      runtime: { running: true, programOk: true, programNvCrc: artifact.crc },
      tags: [],
    });

    const sent = [];
    const hub = {
      publishDeviceConfig: () => {},
      sendCommand: async (_deviceId, op) => {
        sent.push(op);
        if (op === 'get_program') {
          return {
            programLoaded: true,
            programFromNv: true,
            programNvCrc: artifact.crc,
            autoRunOnBoot: true,
          };
        }
        throw new Error(`unexpected op ${op}`);
      },
    };
    const origHub = require('../src/parc/mqttCentralHub').getMqttCentralHub;
    const origPersistence = require('../src/persistence').readJson;
    require('../src/parc/mqttCentralHub').getMqttCentralHub = () => hub;
    require('../src/persistence').readJson = (file) => (
      file === 'settings.json'
        ? { mqttParc: { skipDeployWhenCrcMatches: true } }
        : origPersistence(file)
    );

    const drv = new MqttParcOptaDriver({
      id: 'opta_mqtt_st',
      type: 'mqtt_parc',
      deviceId: 'opta_st_01',
      remoteExecution: true,
    });
    drv._hub = () => hub;

    try {
      const result = await drv.deployProgram(src, tagStore);
      assert.equal(result.ok, true);
      assert.equal(result.skipped, true);
      assert.equal(result.needsRuntimeStart, false);
      assert.deepEqual(sent, ['get_program']);
    } finally {
      require('../src/parc/mqttCentralHub').getMqttCentralHub = origHub;
      require('../src/persistence').readJson = origPersistence;
    }
  });
});
