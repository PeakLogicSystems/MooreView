'use strict';

const simManager = require('../../cloud/simManager');
const { isCloudSimsEnabled } = require('../../cloud/cloudSimsEnabled');

const FEATURE_DISABLED_MSG = 'Cloud sim management requires MOOREVIEW_DEPLOYMENT=cloud, MOOREVIEW_CLOUD_SIMS=1, or settings cloudSims.enabled';

function requireCloudSims(req, res, next) {
  const path = String(req.path || '');
  if (!path.startsWith('/cloud')) return next();
  if (isCloudSimsEnabled()) return next();
  if (req.method === 'GET' && path === '/cloud/sims') {
    return res.json({ ok: true, enabled: false, sims: [], count: 0 });
  }
  return res.status(403).json({ error: FEATURE_DISABLED_MSG, enabled: false });
}

function createCloudSimRoutes() {
  const router = require('express').Router();

  router.get('/cloud/sims/status', (req, res) => {
    const enabled = isCloudSimsEnabled();
    res.json({ ok: true, enabled, ...simManager.managerStatus() });
  });

  router.use(requireCloudSims);

  router.get('/cloud/sims', async (req, res) => {
    try {
      const sims = await simManager.listSims();
      res.json({ ok: true, sims, count: sims.length });
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.post('/cloud/sims', async (req, res) => {
    try {
      const sim = await simManager.createSim(req.body || {});
      res.status(201).json({ ok: true, sim });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/cloud/sims/seed-website-demo', async (req, res) => {
    try {
      const result = await simManager.seedWebsiteDemoSims(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.get('/cloud/sims/:id', async (req, res) => {
    try {
      const sim = await simManager.getSim(req.params.id);
      if (!sim) return res.status(404).json({ error: 'Sim not found' });
      return res.json({ ok: true, sim });
    } catch (e) {
      return res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.put('/cloud/sims/:id', async (req, res) => {
    try {
      const sim = await simManager.updateSim(req.params.id, req.body || {});
      if (!sim) return res.status(404).json({ error: 'Sim not found' });
      return res.json({ ok: true, sim });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.delete('/cloud/sims/:id', async (req, res) => {
    try {
      const ok = await simManager.deleteSim(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Sim not found' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/cloud/sims/:id/start', async (req, res) => {
    try {
      const result = await simManager.startSim(req.params.id);
      if (!result) return res.status(404).json({ error: 'Sim not found' });
      return res.json({ ok: true, ...result });
    } catch (e) {
      return res.status(e.status || 502).json({
        error: e.message || String(e),
        sim: e.sim || undefined,
      });
    }
  });

  router.post('/cloud/sims/:id/stop', async (req, res) => {
    try {
      const result = await simManager.stopSim(req.params.id);
      if (!result) return res.status(404).json({ error: 'Sim not found' });
      return res.json({ ok: true, ...result });
    } catch (e) {
      return res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createCloudSimRoutes, requireCloudSims, FEATURE_DISABLED_MSG };
