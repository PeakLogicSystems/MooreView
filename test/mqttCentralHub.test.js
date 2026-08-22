'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MqttCentralHub, defaultCentralSettings } = require('../src/parc/mqttCentralHub');

function mockHubClient(hub) {
  hub.cfg = defaultCentralSettings();
  hub._subsReady = true;
  const published = [];
  hub.client = {
    connected: true,
    subscribe: (_topic, _opts, cb) => cb(null),
    publish: (_topic, payload, _opts, cb) => {
      published.push(JSON.parse(payload));
      if (cb) cb(null);
    },
  };
  return published;
}

function resolvePublished(hub, entry) {
  const pending = hub._pending.get(entry.id);
  assert.ok(pending, `pending command ${entry.id}`);
  clearTimeout(pending.timer);
  hub._pending.delete(entry.id);
  pending.resolve({});
}

describe('mqttCentralHub connect lifecycle', () => {
  it('isLive reflects client connected state', () => {
    const hub = new MqttCentralHub({ registry: { getDevice() { return null; } } });
    assert.equal(hub.isLive(), false);
    hub.connected = true;
    hub.client = { connected: true };
    assert.equal(hub.isLive(), true);
    hub.client.connected = false;
    assert.equal(hub.isLive(), false);
  });
});

describe('mqttCentralHub telemetry parse', () => {
  it('_onMessage ingests telemetry with unescaped control characters', () => {
    const ingested = [];
    const hub = new MqttCentralHub({
      registry: {
        getDevice() { return null; },
        ingestReport(report) { ingested.push(report); },
      },
    });
    hub.cfg = defaultCentralSettings();
    const payload = '{"deviceId":"mv_test","runtime":{"programName":"logic/36_duplex_lift_station.st","running":false},"tags":[]}';
    const bad = payload.replace('logic', 'lo\ngic');
    hub._onMessage('mooreview/v1/mv_test/telemetry', Buffer.from(bad, 'utf8'));
    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].deviceId, 'mv_test');
    assert.match(ingested[0].runtime.programName, /lo gic/);
  });

  it('_onMessage ingests Dragino JSON on dragino topic', () => {
    const ingested = [];
    const hub = new MqttCentralHub({
      registry: {
        getDevice() { return null; },
        ingestReport(report) { ingested.push(report); },
      },
    });
    hub.cfg = defaultCentralSettings();
    hub._onMessage(
      'dragino/pump01/uplink',
      Buffer.from(JSON.stringify({
        Model: 'RS485-NB',
        IMEI: '863663062798815',
        Payload: '010304000100020008',
        battery: 3.605,
        signal: 25,
      }), 'utf8'),
    );
    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].deviceId, 'dragino_pump01');
    assert.equal(ingested[0].platform, 'dragino-rs485-nb');
    assert.ok(ingested[0].tags.some((t) => t.id === 'CELL_SIGNAL'));
  });

  it('_onMessage converts Dragino JSON on Parc telemetry topic', () => {
    const ingested = [];
    const hub = new MqttCentralHub({
      registry: {
        getDevice() { return null; },
        ingestReport(report) { ingested.push(report); },
      },
    });
    hub.cfg = defaultCentralSettings();
    hub._onMessage(
      'mooreview/v1/dragino_01/telemetry',
      Buffer.from(JSON.stringify({
        Model: 'RS485-NB',
        Payload: '0108b4',
        battery: 3.6,
        signal: 20,
      }), 'utf8'),
    );
    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].deviceId, 'dragino_01');
    assert.equal(ingested[0].platform, 'dragino-rs485-nb');
  });

  it('_onMessage ingests tenant-scoped Dragino JSON when cloudTenantIngest', () => {
    const ingested = [];
    const hub = new MqttCentralHub({
      registry: {
        getDevice() { return null; },
        ingestReport(report) { ingested.push(report); },
      },
    });
    hub.cfg = { ...defaultCentralSettings(), cloudTenantIngest: true };
    hub._onMessage(
      'mooreview/v1/acme-corp/dragino_pump01/telemetry',
      Buffer.from(JSON.stringify({
        Model: 'RS485-NB',
        Payload: '010304000100020008',
        battery: 3.5,
        signal: 22,
      }), 'utf8'),
    );
    assert.equal(ingested.length, 1);
    assert.equal(ingested[0].deviceId, 'dragino_pump01');
    assert.equal(ingested[0].meta.tenantId, 'acme-corp');
  });
});

describe('mqttCentralHub online lifecycle', () => {
  function makeRegistry() {
    const { DeviceRegistry } = require('../src/parc/deviceRegistry');
    const reg = new DeviceRegistry();
    reg.updateSettings({ enabled: true });
    reg.ingestReport({
      deviceId: 'mv_f2e689fd60d96bab',
      tags: [{ id: 'DI1', type: 'BOOL', value: false }],
      runtime: { running: true },
    });
    reg.attach('mv_f2e689fd60d96bab', { host: '127.0.0.1', port: 3080 });
    return reg;
  }

  it('online:false clears attach via markDeviceOffline', () => {
    const reg = makeRegistry();
    const hub = new MqttCentralHub({ registry: reg });
    hub.cfg = defaultCentralSettings();
    hub._onMessage(
      'mooreview/v1/mv_f2e689fd60d96bab/online',
      Buffer.from(JSON.stringify({ online: false })),
    );
    const dev = reg.getDevice('mv_f2e689fd60d96bab');
    assert.equal(dev.meta.online, false);
    assert.equal(dev.attach.active, false);
    assert.equal(dev.runtime.running, false);
  });

  it('online:true clears meta.online and triggers recovery', () => {
    const { setParcRecoveryHook } = require('../src/parc/deviceRegistry');
    const reg = makeRegistry();
    reg.markDeviceOffline('mv_f2e689fd60d96bab');
    const calls = [];
    setParcRecoveryHook((deviceId, opts) => calls.push({ deviceId, opts }));
    const hub = new MqttCentralHub({ registry: reg });
    hub.cfg = defaultCentralSettings();
    hub._onMessage(
      'mooreview/v1/mv_f2e689fd60d96bab/online',
      Buffer.from(JSON.stringify({ online: true })),
    );
    const dev = reg.getDevice('mv_f2e689fd60d96bab');
    assert.equal(dev.meta.online, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].opts.reason, 'online');
    setParcRecoveryHook(null);
  });
});

describe('mqttCentralHub sendCommand', () => {
  it('serializes concurrent commands for the same deviceId', async () => {
    const hub = new MqttCentralHub({ registry: { getDevice() { return null; } } });
    const published = mockHubClient(hub);
    const deviceId = 'opta_serial_test';

    const first = hub.sendCommand(deviceId, 'runtime_status', {}, { timeoutMs: 5000 });
    const second = hub.sendCommand(deviceId, 'runtime_status', {}, { timeoutMs: 5000 });

    await new Promise((r) => setImmediate(r));
    assert.equal(published.length, 1, 'only first command should publish while first is in flight');

    resolvePublished(hub, published[0]);

    await first;
    await new Promise((r) => setImmediate(r));
    assert.equal(published.length, 2, 'second command publishes after first completes');
    resolvePublished(hub, published[1]);
    await second;
    assert.notEqual(published[0].id, published[1].id);
  });

  it('does not serialize commands for different deviceIds', async () => {
    const hub = new MqttCentralHub({ registry: { getDevice() { return null; } } });
    const published = mockHubClient(hub);

    const a = hub.sendCommand('opta_a', 'runtime_status', {}, { timeoutMs: 5000 });
    const b = hub.sendCommand('opta_b', 'runtime_status', {}, { timeoutMs: 5000 });

    await new Promise((r) => setImmediate(r));
    assert.equal(published.length, 2, 'different devices may publish in parallel');

    for (const entry of published) {
      resolvePublished(hub, entry);
    }

    await Promise.all([a, b]);
  });

  it('_onMessage resolves pending commands from cmd/response topics', async () => {
    const hub = new MqttCentralHub({ registry: { getDevice() { return null; } } });
    const published = mockHubClient(hub);
    const deviceId = 'mv_f2e689fd60d96bab';
    const cmdPromise = hub.sendCommand(deviceId, 'runtime_status', {}, { timeoutMs: 5000 });
    await new Promise((r) => setImmediate(r));
    const entry = published[0];
    assert.ok(entry?.id, 'command published');
    hub._onMessage(
      `mooreview/v1/${deviceId}/cmd/response`,
      Buffer.from(JSON.stringify({ id: entry.id, ok: true, body: { running: false } })),
    );
    const body = await cmdPromise;
    assert.equal(body.running, false);
  });
});
