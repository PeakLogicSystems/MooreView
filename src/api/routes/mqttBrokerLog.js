'use strict';

const mongoSysLog = require('../../logger/mongoSysLog');
const mosquittoLogIngest = require('../../mqtt/mosquittoLogIngest');

function ingestToken() {
  return String(
    process.env.MOOREVIEW_MQTT_LOG_INGEST_TOKEN
    || process.env.PLATFORM_ADMIN_KEY
    || process.env.MOOREVIEW_TOKEN
    || '',
  ).trim();
}

function authorizeIngest(req, res) {
  const expected = ingestToken();
  if (!expected) {
    res.status(503).json({ error: 'MQTT log ingest not configured — set MOOREVIEW_MQTT_LOG_INGEST_TOKEN' });
    return false;
  }
  const hdr = String(req.headers.authorization || '');
  const bearer = hdr.startsWith('Bearer ') ? hdr.slice(7).trim() : '';
  const bodyToken = String(req.body?.token || req.query?.token || '').trim();
  const token = bearer || bodyToken;
  if (token !== expected) {
    res.status(401).json({ error: 'Unauthorized ingest token' });
    return false;
  }
  return true;
}

function createMqttBrokerLogRoutes() {
  const router = require('express').Router();

  router.get('/mqtt-broker-log/status', (req, res) => {
    res.json({
      ok: true,
      ingestTokenConfigured: !!ingestToken(),
      ...mosquittoLogIngest.status(),
      sysLog: mongoSysLog.status(),
    });
  });

  router.get('/mqtt-broker-log', async (req, res) => {
    try {
      const filter = {
        tenantId: mongoSysLog.status().tenantId,
        category: 'mqtt',
      };
      const level = String(req.query.level || '').trim();
      const event = String(req.query.event || '').trim();
      if (level) filter.level = level;
      const entries = await mongoSysLog.query(filter, {
        limit: req.query.limit,
        since: req.query.since,
        until: req.query.until,
      });
      const filtered = event
        ? entries.filter((e) => String(e.detail?.event || '') === event)
        : entries;
      res.json({ ok: true, entries: filtered });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.post('/mqtt-broker-log/ingest', async (req, res) => {
    if (!authorizeIngest(req, res)) return;
    try {
      const host = String(req.body?.host || req.headers['x-mv-mqtt-host'] || '').trim();
      const tenantId = String(req.body?.tenantId || '').trim() || undefined;
      const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
      const ctx = { host: host || undefined, tenantId };
      const result = lines.length
        ? await mosquittoLogIngest.ingestLines(lines.map(String), ctx)
        : { ingested: 0, skipped: 0, entries: [] };
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createMqttBrokerLogRoutes };
