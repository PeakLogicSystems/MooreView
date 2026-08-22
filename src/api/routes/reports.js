'use strict';

const persistence = require('../../persistence');
const { normalizeReportConfig } = require('../../reports/reportConfig');
const { buildPdfReport } = require('../../reports/pdfReport');
const { penStatistics } = require('../../reports/penStats');
const { listCatalog } = require('../../reports/mongoReportCatalog');
const { normalizeReportSpec, normalizeReportDefs } = require('../../reports/mongoReportDefs');
const { runMongoReport, discoverCollectionFields } = require('../../reports/mongoReportEngine');
const { drawTablePdf } = require('../../reports/mongoTablePdf');
const gridfs = require('../../storage/gridfsStore');
const { mirrorUpload } = require('../../storage/gridfsMirror');

function createReportRoutes() {
  const router = require('express').Router();

  router.get('/reports/config', (req, res) => {
    const settings = persistence.readJson('settings.json', {});
    res.json({ reportConfig: normalizeReportConfig(settings.reportConfig) });
  });

  router.put('/reports/config', (req, res) => {
    const prev = persistence.readJson('settings.json', {});
    const reportConfig = normalizeReportConfig(req.body?.reportConfig ?? req.body);
    const next = { ...prev, reportConfig };
    persistence.writeJson('settings.json', next);
    res.json({ ok: true, reportConfig });
  });

  router.get('/reports/mongo/catalog', (req, res) => {
    res.json(listCatalog());
  });

  router.get('/reports/mongo/definitions', (req, res) => {
    const settings = persistence.readJson('settings.json', {});
    res.json({ definitions: normalizeReportDefs(settings.mongoReportDefs) });
  });

  router.put('/reports/mongo/definitions', (req, res) => {
    const prev = persistence.readJson('settings.json', {});
    const definitions = normalizeReportDefs(req.body?.definitions ?? req.body);
    persistence.writeJson('settings.json', { ...prev, mongoReportDefs: definitions });
    res.json({ ok: true, definitions });
  });

  router.get('/reports/mongo/discover', async (req, res) => {
    try {
      const result = await discoverCollectionFields(req.query.collection);
      if (result.error) return res.status(result.error.includes('not connected') ? 503 : 400).json({ error: result.error });
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.post('/reports/mongo/query', async (req, res) => {
    try {
      const result = await runMongoReport(req.body?.spec ?? req.body);
      if (!result.ok) {
        return res.status(result.error?.includes('not connected') ? 503 : 400).json({ error: result.error });
      }
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.post('/reports/mongo/pdf', async (req, res) => {
    try {
      const body = req.body || {};
      let columns = body.columns;
      let rows = body.rows;
      let title = body.title;
      if (!Array.isArray(rows)) {
        const result = await runMongoReport(body.spec ?? body);
        if (!result.ok) {
          return res.status(result.error?.includes('not connected') ? 503 : 400).json({ error: result.error });
        }
        columns = result.columns;
        rows = result.rows;
        title = result.spec.title;
      }
      if (!Array.isArray(rows) || !rows.length) {
        return res.status(400).json({ error: 'No rows to export' });
      }
      const buf = await drawTablePdf({
        title: title || 'MongoDB report',
        subtitle: body.subtitle || '',
        columns: columns || Object.keys(rows[0]).map((id) => ({ id, label: id })),
        rows,
        pageSize: body.pageSize || 'A4',
        orientation: body.orientation || 'landscape',
      });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `MooreVIEW_mongo_report_${stamp}.pdf`;
      if (body.storeInMongo !== false) {
        try {
          await mirrorUpload(gridfs.BUCKETS.report_pdfs, buf, {
            filename,
            contentType: 'application/pdf',
            metadata: { type: 'mongo_report', exportedAt: new Date().toISOString() },
          });
        } catch {
          // Non-fatal
        }
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  router.get('/reports/pdfs', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const files = await gridfs.listSummaries(gridfs.BUCKETS.report_pdfs, {}, { limit });
      res.json({ reports: files });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/reports/pdf', async (req, res) => {
    try {
      const pens = req.body?.pens;
      const history = req.body?.history;
      const pdm = req.body?.pdm && typeof req.body.pdm === 'object' ? req.body.pdm : null;
      if (!Array.isArray(pens) || !pens.some((p) => p?.tagId)) {
        return res.status(400).json({ error: 'At least one historian pen required' });
      }
      const stats = penStatistics(history, pens);
      const hasSamples = stats.some((s) => s.samples > 0);
      const hasPdm = !!(pdm?.forecast?.ok || pdm?.assetContext);
      if (!hasSamples && !hasPdm) {
        return res.status(400).json({ error: 'No historian samples or PdM content in selected range' });
      }
      const buf = await buildPdfReport({
        reportConfig: req.body?.reportConfig,
        meta: {
          ...(req.body?.meta || {}),
          exportedAt: req.body?.meta?.exportedAt || new Date().toISOString(),
        },
        pens,
        history: history || {},
        chartImage: req.body?.chartImage || null,
        pdm,
      });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const project = (req.body?.meta?.projectName || 'report').replace(/[^\w.-]+/g, '_').slice(0, 40);
      const filename = `MooreVIEW_${project}_${stamp}.pdf`;
      let gridfsFile = null;
      if (req.body?.storeInMongo !== false) {
        try {
          gridfsFile = await mirrorUpload(gridfs.BUCKETS.report_pdfs, buf, {
            filename,
            contentType: 'application/pdf',
            metadata: {
              projectName: project,
              exportedAt: req.body?.meta?.exportedAt || new Date().toISOString(),
              penCount: pens.length,
            },
          });
        } catch {
          // Non-fatal when MongoDB unavailable
        }
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      if (gridfsFile?.fileId) res.setHeader('X-GridFS-FileId', gridfsFile.fileId);
      res.send(buf);
    } catch (e) {
      res.status(500).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createReportRoutes };
