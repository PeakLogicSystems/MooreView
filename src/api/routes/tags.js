'use strict';

const { MAX_TAGS } = require('../../config');
const programStore = require('../../programs/programStore');
const { ensureMotorTags } = require('../../programs/motorTags');
const { ensureTpoTags } = require('../../programs/tpoTags');
const { ensureProgramTags } = require('../../programs/ensureProgramTags');

function createTagRoutes(deps) {
  const { tagStore } = deps;
  const router = require('express').Router();

  router.get('/tags', (req, res) => {
    res.json({ tags: tagStore.list(), count: tagStore.count(), max: MAX_TAGS });
  });

  router.put('/tags', (req, res) => {
    tagStore.replaceAll(req.body.tags || []);
    res.json({ ok: true, count: tagStore.count() });
  });

  router.post('/tags/ensure-motor', (req, res) => {
    const { added, labeled, count } = ensureMotorTags(tagStore);
    res.json({ ok: true, added, labeled, count });
  });

  router.post('/tags/ensure-tpo', (req, res) => {
    const { added, labeled, migrated, repaired, count } = ensureTpoTags(tagStore);
    res.json({ ok: true, added, labeled, migrated, repaired, count });
  });

  router.post('/tags/ensure-program', (req, res) => {
    const source = req.body?.source ?? programStore.readActive();
    const { added, labeled, errors, count } = ensureProgramTags(tagStore, source);
    if (errors?.length) {
      return res.status(400).json({ error: errors.join('; '), errors, added, labeled, count });
    }
    res.json({ ok: true, added, labeled, count });
  });

  router.post('/tags/write', (req, res) => {
    const tagId = req.body?.tagId;
    if (!tagId) {
      return res.status(400).json({ error: 'tagId required' });
    }
    try {
      if (/^TPO1_(ON_MIN|OFF_MIN|PULSE_REM)$/.test(String(tagId))) {
        ensureTpoTags(tagStore);
      }
      const t = tagStore.writeHmiMemory(tagId, req.body?.value);
      if (!t) {
        return res.status(404).json({ error: 'Tag not found' });
      }
      res.json({ tag: t });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { createTagRoutes };
