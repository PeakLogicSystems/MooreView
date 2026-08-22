'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const { createTenantFleetRoutes } = require('../src/api/routes/tenantFleet');

function withServer(app, fn) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', async () => {
      const { port } = server.address();
      try {
        const result = await fn(port);
        server.close(() => resolve(result));
      } catch (e) {
        server.close(() => reject(e));
      }
    });
  });
}

function getJson(port, path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body = text;
        try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
        resolve({ status: res.statusCode, body });
      });
    }).on('error', reject);
  });
}

describe('tenantFleet appliance mount', () => {
  it('does not 404 sibling /api routes when not cloud deployment', async () => {
    const prev = process.env.MOOREVIEW_DEPLOYMENT;
    delete process.env.MOOREVIEW_DEPLOYMENT;

    const app = express();
    const api = express.Router();
    api.use(createTenantFleetRoutes());
    api.get('/dashboard', (req, res) => res.json({ ok: true }));
    api.get('/cameras', (req, res) => res.json({ cameras: [] }));
    app.use('/api', api);

    try {
      await withServer(app, async (port) => {
        const dash = await getJson(port, '/api/dashboard');
        assert.equal(dash.status, 200);
        assert.equal(dash.body.ok, true);

        const cams = await getJson(port, '/api/cameras');
        assert.equal(cams.status, 200);
        assert.deepEqual(cams.body.cameras, []);

        // Cloud-only fleet path should fall through (no handler → Express 404),
        // not return the old catch-all {"error":"Not found"} from this router.
        const fleet = await getJson(port, '/api/fleet');
        assert.equal(fleet.status, 404);
        assert.notEqual(fleet.body?.error, 'Not found');
      });
    } finally {
      if (prev === undefined) delete process.env.MOOREVIEW_DEPLOYMENT;
      else process.env.MOOREVIEW_DEPLOYMENT = prev;
    }
  });
});
