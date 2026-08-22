'use strict';

const persistence = require('../../persistence');
const { normalizePens } = require('../../graph/graphPens');

function createSettingsRoutes(deps) {
  const { tagStore, scanEngine, graphHistory } = deps;
  const router = require('express').Router();

  router.put('/settings', async (req, res) => {
    const prev = persistence.readJson('settings.json', {});
    const tagList = tagStore.list();
    const next = { ...prev, ...req.body };
    if (req.body.graphPens != null) {
      next.graphPens = normalizePens(req.body.graphPens, tagList);
    }
    if (req.body.scanMs != null) next.scanMs = req.body.scanMs;
    if (req.body.port != null) next.port = req.body.port;
    if (req.body.graphMaxPoints != null) {
      next.graphMaxPoints = req.body.graphMaxPoints;
      graphHistory.setMaxPoints(req.body.graphMaxPoints);
    }
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
