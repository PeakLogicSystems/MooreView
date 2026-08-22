'use strict';

const persistence = require('../../persistence');
const pdmService = require('../../pdm/pdmService');
const { normalizePdmSettings, listPdmAssets } = require('../../settings/pdmSettings');
const { normalizeCmmsSettings } = require('../../settings/cmmsSettings');
const {
  MOTOR_TYPES,
  APPLICATIONS_BY_MOTOR,
  CONFIGURATIONS_BY_MOTOR,
  LOCATION_CLASSES,
  SERVICE_EVENT_TYPES,
} = require('../../pdm/motorAssetSetup');
const { getBatchScheduler } = require('./pdmSchedulerHolder');

function createPdmRoutes() {
  const router = require('express').Router();

  router.get('/pdm/status', (req, res) => {
    const settings = persistence.readJson('settings.json', {});
    const scheduler = getBatchScheduler();
    res.json({
      ...pdmService.batchStatus(settings),
      scheduler: scheduler?.status?.() || null,
    });
  });

  router.get('/pdm/assets', (req, res) => {
    const settings = persistence.readJson('settings.json', {});
    const pdm = normalizePdmSettings(settings.pdm, settings);
    res.json({ assets: listPdmAssets(pdm), pdm });
  });

  router.get('/pdm/setup', (req, res) => {
    const settings = persistence.readJson('settings.json', {});
    res.json(pdmService.listAssetSetup(settings));
  });

  router.get('/pdm/setup/catalog', (_req, res) => {
    res.json({
      motorTypes: MOTOR_TYPES,
      applicationsByMotor: APPLICATIONS_BY_MOTOR,
      configurationsByMotor: CONFIGURATIONS_BY_MOTOR,
      locationClasses: LOCATION_CLASSES,
      serviceEventTypes: SERVICE_EVENT_TYPES,
    });
  });

  router.get('/pdm/context/:assetId', (req, res) => {
    const assetId = String(req.params.assetId || '').trim();
    const result = pdmService.getAssetContextView(assetId);
    if (!result.ok) return res.status(404).json(result);
    res.json(result);
  });

  router.put('/pdm/setup/:assetId', (req, res) => {
    const assetId = String(req.params.assetId || '').trim();
    const body = req.body || {};
    const tagIds = Array.isArray(body.tagIds) ? body.tagIds : undefined;
    const result = pdmService.saveAssetSetup(assetId, body.context ?? body, undefined, { tagIds });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  router.delete('/pdm/setup/:assetId', (req, res) => {
    const assetId = String(req.params.assetId || '').trim();
    const result = pdmService.deleteAssetSetup(assetId);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  router.get('/pdm/view', async (req, res) => {
    const assetId = String(req.query.asset || '').trim();
    if (!assetId) return res.status(400).json({ error: 'asset query param required' });
    const from = req.query.from ? Date.parse(req.query.from) : undefined;
    const to = req.query.to ? Date.parse(req.query.to) : undefined;
    const result = await pdmService.loadPdmView(assetId, { fromMs: from, toMs: to });
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  router.put('/pdm/settings', (req, res) => {
    const prev = persistence.readJson('settings.json', {});
    const pdm = normalizePdmSettings(req.body?.pdm ?? req.body, prev);
    const next = { ...prev, pdm };
    if (req.body?.cmms != null) {
      next.cmms = normalizeCmmsSettings(req.body.cmms, prev);
    }
    persistence.writeJson('settings.json', next);
    res.json({ ok: true, pdm, cmms: next.cmms, settings: next });
  });

  router.post('/pdm/proactive/run', async (req, res) => {
    const settings = persistence.readJson('settings.json', {});
    const body = req.body || {};
    if (body.assetId) {
      const result = await pdmService.evaluateProactiveForAsset(String(body.assetId), { settings });
      return res.json(result);
    }
    const result = await pdmService.evaluateProactiveCmms({ settings });
    res.json(result);
  });

  router.post('/pdm/report/pdf', async (req, res) => {
    try {
      const assetId = String(req.body?.assetId || req.query?.asset || '').trim();
      if (!assetId) return res.status(400).json({ error: 'assetId required' });
      const settings = persistence.readJson('settings.json', {});
      const { buf, reportConfig } = await pdmService.buildAssetReportPdf(assetId, {
        settings,
        days: req.body?.days,
        fromMs: req.body?.from ? Date.parse(req.body.from) : undefined,
        toMs: req.body?.to ? Date.parse(req.body.to) : undefined,
        reportConfig: req.body?.reportConfig,
      });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const safeAsset = assetId.replace(/[^\w.-]+/g, '_').slice(0, 40);
      const filename = `MooreVIEW_PdM_${safeAsset}_${stamp}.pdf`;
      if (req.body?.storeInMongo !== false) {
        try {
          const gridfs = require('../../storage/gridfsStore');
          const { mirrorUpload } = require('../../storage/gridfsMirror');
          await mirrorUpload(gridfs.BUCKETS.report_pdfs, buf, {
            filename,
            contentType: 'application/pdf',
            metadata: { type: 'pdm_report', assetId, exportedAt: new Date().toISOString() },
          });
        } catch { /* non-fatal */ }
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      if (reportConfig?.title) res.setHeader('X-Report-Title', reportConfig.title);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.post('/pdm/build', async (req, res) => {
    const scheduler = getBatchScheduler();
    const body = req.body || {};
    if (body.assetId) {
      const settings = persistence.readJson('settings.json', {});
      const toMs = body.to ? Date.parse(body.to) : Date.now();
      const fromMs = body.from ? Date.parse(body.from) : (toMs - 7 * 24 * 60 * 60 * 1000);
      const result = await pdmService.buildFeaturesForAsset(String(body.assetId), { fromMs, toMs, settings });
      const proactive = body.runProactive !== false
        ? await pdmService.evaluateProactiveForAsset(String(body.assetId), { settings, fromMs, toMs })
        : null;
      return res.json({ ok: true, count: 1, assets: [result], proactive });
    }
    const result = scheduler?.runNow
      ? await scheduler.runNow()
      : await (async () => {
        const settings = persistence.readJson('settings.json', {});
        const built = await pdmService.buildAllFeatures({ settings });
        const proactive = await pdmService.evaluateProactiveCmms({ settings });
        return { ok: true, ...built, proactive };
      })();
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  router.post('/pdm/sim/motor', async (req, res) => {
    const result = await pdmService.simulateMotorStart(req.body || {});
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  router.post('/pdm/sim/asset', async (req, res) => {
    const result = await pdmService.simulateMotorAsset(req.body || {});
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  });

  return router;
}

module.exports = { createPdmRoutes };
