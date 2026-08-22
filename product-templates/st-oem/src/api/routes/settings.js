'use strict';

const persistence = require('../../persistence');

function createSettingsRoutes(deps) {
  const { scanEngine } = deps;
  const router = require('express').Router();

  router.put('/settings', async (req, res) => {
    const prev = persistence.readJson('settings.json', {});
    const next = { ...prev, ...req.body };
    if (req.body.scanMs != null) next.scanMs = req.body.scanMs;
    if (req.body.port != null) next.port = req.body.port;
    persistence.writeJson('settings.json', next);
    scanEngine.loadSettings();
    res.json({
      settings: next,
      runtime: scanEngine.status(),
    });
  });

  return router;
}

module.exports = { createSettingsRoutes };
