'use strict';

const { listSerialPorts } = require('../../system/serialPorts');
const { moveOnce, moveReverse } = require('../../drivers/modbusMove');

function createMiscRoutes(deps) {
  const { graphHistory, tagStore, driverManager } = deps;
  const router = require('express').Router();

  router.get('/system/serial-ports', async (req, res) => {
    res.json({ ports: await listSerialPorts() });
  });

  router.post('/debug/force', (req, res) => {
    try {
      const t = tagStore.setForce(req.body.tagId, {
        forceInput: req.body.forceInput,
        forceOutput: req.body.forceOutput,
        forceValue: req.body.forceValue,
      });
      if (!t) return res.status(404).json({ error: 'Tag not found' });
      res.json({ tag: t });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.delete('/debug/force', (req, res) => {
    res.json({ tag: tagStore.clearForce(req.query.tagId, req.query.which || null) });
  });

  router.post('/graph/clear', (req, res) => {
    graphHistory.clear(req.body?.tagId);
    res.json({ ok: true });
  });

  router.post('/modbus/move', async (req, res) => {
    const fn = req.body.direction === 'tcp_to_rtu' ? moveReverse : moveOnce;
    res.json({ ok: true, results: await fn(req.body) });
  });

  router.get('/hal/status', (req, res) => {
    if (!driverManager?.halStatus) {
      return res.json({ nativeAvailable: false, drivers: [] });
    }
    res.json(driverManager.halStatus());
  });

  return router;
}

module.exports = { createMiscRoutes };
