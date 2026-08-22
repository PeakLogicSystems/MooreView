'use strict';

const persistence = require('../../persistence');
const programStore = require('../../programs/programStore');
const { parseProgram, collectProgramTagRefs } = require('../../engine/parser');
const { listSerialPorts } = require('../../system/serialPorts');
const { listPresets } = require('../../devices/devicePresets');
const { normalizePens, penTagIds } = require('../../graph/graphPens');
const { MAX_TAGS } = require('../../config');

function createDashboardRoutes(deps) {
  const { tagStore, driverManager, scanEngine, graphHistory } = deps;
  const router = require('express').Router();

  router.get('/dashboard', async (req, res) => {
    const tagList = tagStore.list();
    const settings = persistence.readJson('settings.json', { scanMs: 100, graphMaxPoints: 600, graphPens: [] });
    const graphPens = normalizePens(settings.graphPens, tagList);
    const qIds = (req.query.graphTags || '').split(',').filter(Boolean);
    const graphIds = qIds.length ? qIds : penTagIds(graphPens);
    const { ast } = parseProgram(programStore.readActive());
    const programTagRefs = ast ? collectProgramTagRefs(ast) : [];
    let serialPorts = [];
    try { serialPorts = await listSerialPorts(); } catch { /* ignore */ }
    res.json({
      product: 'st-mvp',
      runtime: scanEngine.status(),
      tags: tagList,
      tagCount: tagStore.count(),
      maxTags: MAX_TAGS,
      drivers: driverManager.list(),
      driverHealth: driverManager.health(),
      program: programStore.readActive(),
      activeProgram: programStore.activeRel(),
      stDir: programStore.ST_DIR,
      programs: programStore.listPrograms(),
      settings: { ...settings, graphPens },
      forces: tagList.filter((t) => t.forceInput || t.forceOutput),
      graph: graphHistory.getHistory(graphIds.length ? graphIds : null, 400),
      graphPens,
      programTagRefs,
      live: tagStore.liveSnapshot(),
      serialPorts,
      devicePresets: listPresets(),
    });
  });

  return router;
}

module.exports = { createDashboardRoutes };
