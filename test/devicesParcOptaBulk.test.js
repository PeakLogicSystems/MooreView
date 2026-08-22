'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
process.env.MOOREVIEW_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-bulk-'));

const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createDriverRoutes } = require('../src/api/routes/drivers');
const { registry } = require('../src/parc/deviceRegistry');
const { getMqttCentralHub } = require('../src/parc/mqttCentralHub');
const {
  isParcRegistryNoiseId,
  stripParcNoiseDrivers,
  pruneParcRegistryNoise,
  parseDeviceIds,
  buildParcOptaDriver,
  bulkAddParcOptaDrivers,
} = require('../src/devices/bulkAddParcOpta');

function mockDeps(initialDrivers = []) {
  const drivers = [...initialDrivers];
  const tags = [];
  return {
    driverManager: {
      list: () => drivers.slice(),
      save: (list) => {
        drivers.length = 0;
        drivers.push(...list);
      },
      rebuild: async () => {},
      health: () => [],
    },
    tagStore: {
      list: () => tags.slice(),
      replaceAll: (list) => {
        tags.length = 0;
        tags.push(...list);
      },
      count: () => tags.length,
    },
    _drivers: drivers,
    _tags: tags,
  };
}

async function postBulk(deps, body) {
  const app = express();
  app.use(express.json());
  app.use('/api', createDriverRoutes(deps));
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/drivers/parc-opta/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe('bulkAddParcOpta helper', () => {
  it('isParcRegistryNoiseId detects test, debug, and template ids', () => {
    assert.equal(isParcRegistryNoiseId('test-01'), true);
    assert.equal(isParcRegistryNoiseId('dbg-01'), true);
    assert.equal(isParcRegistryNoiseId('off-01'), true);
    assert.equal(isParcRegistryNoiseId('mv_test_hmi_write'), true);
    assert.equal(isParcRegistryNoiseId('opta_bulk_a'), true);
    assert.equal(isParcRegistryNoiseId('opta_sync_01'), true);
    assert.equal(isParcRegistryNoiseId('opta_force_clear_1'), true);
    assert.equal(isParcRegistryNoiseId('opta_st_01'), true);
    assert.equal(isParcRegistryNoiseId('opta_st_02'), true);
    assert.equal(isParcRegistryNoiseId('opta_0123b636f1c23964ee'), false);
  });

  it('stripParcNoiseDrivers removes mqtt_parc and opta_remote noise drivers', () => {
    const input = [
      { id: 'mock1', type: 'mock', enabled: true },
      { id: 'opta_st_01', type: 'mqtt_parc', deviceId: 'opta_st_01' },
      { id: 'dbg-01', type: 'opta_remote', deviceId: 'dbg-01' },
      { id: 'opta_0123b636f1c23964ee', type: 'mqtt_parc', deviceId: 'opta_0123b636f1c23964ee' },
    ];
    const { drivers, changed, removed } = stripParcNoiseDrivers(input);
    assert.equal(changed, true);
    assert.deepEqual(removed, ['opta_st_01', 'dbg-01']);
    assert.equal(drivers.length, 2);
    assert.equal(drivers[1].deviceId, 'opta_0123b636f1c23964ee');
  });

  it('pruneParcRegistryNoise removes noise entries from registry store', () => {
    const reg = new (require('../src/parc/deviceRegistry').DeviceRegistry)();
    reg.ingestReport({ deviceId: 'opta_st_01', tags: [{ id: 'I1', type: 'BOOL', value: false }] });
    reg.ingestReport({ deviceId: 'test-01', tags: [{ id: 'I1', type: 'BOOL', value: false }] });
    reg.ingestReport({
      deviceId: 'opta_0123b636f1c23964ee',
      ateccSerial: '0123b636f1c23964ee',
      tags: [{ id: 'I1', type: 'BOOL', value: false }],
    });
    const { removed } = pruneParcRegistryNoise(reg);
    assert.deepEqual(removed.sort(), ['opta_st_01', 'test-01'].sort());
    const ids = reg.listDevices().map((d) => d.deviceId);
    assert.deepEqual(ids, ['opta_0123b636f1c23964ee']);
  });

  it('parseDeviceIds fromRegistry skips test/debug/template noise by default', () => {
    const reg = {
      listDevices: () => [
        { deviceId: 'opta_st_01' },
        { deviceId: 'test-01' },
        { deviceId: 'dbg-01' },
        { deviceId: 'opta_0123b636f1c23964ee' },
      ],
    };
    const ids = parseDeviceIds({ fromRegistry: true }, reg);
    assert.deepEqual(ids, ['opta_0123b636f1c23964ee']);
  });

  it('parseDeviceIds builds range with pad', () => {
    const ids = parseDeviceIds({ useRange: true, prefix: 'opta_st_', start: 1, count: 3, pad: 2 }, registry);
    assert.deepEqual(ids, ['opta_st_01', 'opta_st_02', 'opta_st_03']);
  });

  it('parseDeviceIds rejects implicit range without deviceIds', () => {
    assert.throws(
      () => parseDeviceIds({ prefix: 'opta_st_', start: 1, count: 10 }, registry),
      /Provide deviceIds/,
    );
  });

  it('buildParcOptaDriver matches mqtt_parc shape', () => {
    const d = buildParcOptaDriver('opta_st_01');
    assert.equal(d.type, 'mqtt_parc');
    assert.equal(d.id, 'opta_st_01');
    assert.equal(d.deviceId, 'opta_st_01');
    assert.equal(d.scanMs, 100);
    assert.equal(d.reportIntervalSec, 300);
  });

  it('buildParcOptaDriver copies ateccSerial from registry device', () => {
    const d = buildParcOptaDriver('opta_012355b52d66a109ee', {}, {
      deviceId: 'opta_012355b52d66a109ee',
      ateccSerial: '012355b52d66a109ee',
    });
    assert.equal(d.ateccSerial, '012355b52d66a109ee');
  });

  it('bulkAddParcOptaDrivers skips existing id and deviceId', () => {
    const r = bulkAddParcOptaDrivers({
      driverList: [{ id: 'opta_st_01', type: 'mqtt_parc', deviceId: 'opta_st_01' }],
      body: { useRange: true, prefix: 'opta_st_', start: 1, count: 3, pad: 2 },
      registry,
    });
    assert.deepEqual(r.added, ['opta_st_02', 'opta_st_03']);
    assert.deepEqual(r.skipped, ['opta_st_01']);
  });
});

describe('POST /drivers/parc-opta/bulk', () => {
  after(async () => {
    await getMqttCentralHub(registry).stop();
  });

  it('adds three drivers by range', async () => {
    const deps = mockDeps();
    const r = await postBulk(deps, { useRange: true, prefix: 'opta_st_', start: 1, count: 3, pad: 2, syncTags: false });
    assert.equal(r.status, 200);
    assert.equal(r.data.added.length, 3);
    assert.equal(deps._drivers.length, 3);
    assert.ok(deps._drivers.every((d) => d.type === 'mqtt_parc'));
    assert.equal(deps._drivers[0].id, 'opta_st_01');
  });

  it('skips duplicate drivers', async () => {
    const deps = mockDeps([
      { id: 'opta_st_01', type: 'mqtt_parc', enabled: true, deviceId: 'opta_st_01', scanMs: 100 },
    ]);
    const r = await postBulk(deps, { useRange: true, prefix: 'opta_st_', start: 1, count: 2, pad: 2, syncTags: false });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.added, ['opta_st_02']);
    assert.deepEqual(r.data.skipped, ['opta_st_01']);
    assert.equal(deps._drivers.length, 2);
  });

  it('adds field devices from Parc registry (skips template noise)', async () => {
    registry.ingestReport({
      deviceId: 'opta_012355b52d66a109ee',
      ateccSerial: '012355b52d66a109ee',
      tags: [{ id: 'I1', type: 'BOOL', value: false }],
    });
    registry.ingestReport({ deviceId: 'opta_st_02', tags: [{ id: 'I1', type: 'BOOL', value: false }] });
    registry.ingestReport({ deviceId: 'opta_st_03', tags: [{ id: 'I1', type: 'BOOL', value: false }] });
    const deps = mockDeps();
    const r = await postBulk(deps, { fromRegistry: true, syncTags: false });
    assert.equal(r.status, 200);
    assert.ok(!deps._drivers.some((d) => /^opta_st_\d+$/i.test(String(d.deviceId || ''))));
    const snDrv = deps._drivers.find((d) => d.deviceId === 'opta_012355b52d66a109ee');
    assert.ok(snDrv, `expected field device among added=${JSON.stringify(r.data.added)}`);
    assert.notEqual(snDrv.id, snDrv.deviceId);
    const live = registry.getDevice('opta_012355b52d66a109ee');
    assert.equal(live?.meta?.ateccSerial || snDrv.ateccSerial, '012355b52d66a109ee');
  });

  it('fromRegistry with includeRegistryNoise adds test ids', async () => {
    registry.ingestReport({ deviceId: 'opta_bulk_a', tags: [{ id: 'I1', type: 'BOOL', value: false }] });
    const deps = mockDeps();
    const r = await postBulk(deps, { fromRegistry: true, includeRegistryNoise: true, syncTags: false });
    assert.equal(r.status, 200);
    assert.ok(deps._drivers.some((d) => d.deviceId === 'opta_bulk_a'));
  });

  it('syncs tags for fresh registry telemetry', async () => {
    registry.ingestReport({
      deviceId: 'opta_0123b636f1c23964ee',
      ateccSerial: '0123b636f1c23964ee',
      tags: [{ id: 'I1', type: 'BOOL', value: true }],
    });
    const deps = mockDeps();
    const r = await postBulk(deps, {
      deviceIds: ['opta_0123b636f1c23964ee'],
      syncTags: true,
      usePositionIds: false,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.syncResults?.[0]?.ok, true);
    assert.equal(deps._tags.length, 1);
    assert.equal(deps._tags[0].driverId, 'opta_0123b636f1c23964ee');
  });
});
