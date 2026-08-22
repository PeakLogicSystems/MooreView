'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('persistence writeJson', () => {
  it('writes and reads JSON with unique temp files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-persist-'));
    process.env.MOOREVIEW_DATA = dir;
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/persistence')];
    const persistence = require('../src/persistence');

    persistence.writeJson('_atomic-test.json', { devices: { a: { deviceId: 'a' } } });
    persistence.writeJson('_atomic-test.json', { devices: { b: { deviceId: 'b' } } });
    const out = persistence.readJson('_atomic-test.json', null);
    assert.equal(out.devices.b.deviceId, 'b');
    assert.ok(!fs.existsSync(path.join(dir, '_atomic-test.json.tmp')));
    const leftovers = fs.readdirSync(dir).filter((f) => f.includes('_atomic-test.json') && f.endsWith('.tmp'));
    assert.equal(leftovers.length, 0);

    delete process.env.MOOREVIEW_DATA;
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/persistence')];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('survives rapid repeated writes to the same file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-persist-burst-'));
    process.env.MOOREVIEW_DATA = dir;
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/persistence')];
    const persistence = require('../src/persistence');

    for (let i = 0; i < 50; i++) {
      persistence.writeJson('_burst-test.json', { i });
    }
    assert.equal(persistence.readJson('_burst-test.json', {}).i, 49);

    delete process.env.MOOREVIEW_DATA;
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/persistence')];
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exposes flushConfig for settings save paths', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-persist-flush-'));
    process.env.MOOREVIEW_DATA = dir;
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/persistence')];
    const persistence = require('../src/persistence');

    assert.equal(typeof persistence.flushConfig, 'function');
    persistence.writeJson('_flush-test.json', { ok: true });
    await persistence.flushConfig();
    assert.deepEqual(persistence.readJson('_flush-test.json', {}), { ok: true });

    delete process.env.MOOREVIEW_DATA;
    delete require.cache[require.resolve('../src/config')];
    delete require.cache[require.resolve('../src/persistence')];
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
