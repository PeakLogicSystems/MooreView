'use strict';

const persistence = require('../../persistence');
const projectStore = require('../../project/projectStore');
const projectHubStore = require('../../project/projectHubStore');
const projectHubCloudClient = require('../../project/projectHubCloudClient');
const { adaptProjectForHost } = require('../../project/adaptProjectForHost');
const { pack, apply, exportFilename } = require('../../project/estFile');
const { packEst, resolveImportPayload, bundleFilename, isBundle } = require('../../project/projectBundle');
const PACKAGE_VERSION = require('../../../package.json').version;
const { rememberLastOpenedProject } = require('../../project/startupLoader');

async function deployEstDoc(doc, deps, opts = {}) {
  const { doc: adapted, warnings: adaptWarnings } = adaptProjectForHost(doc);
  const out = await apply(adapted, deps, opts);
  const projectName = String(adapted.project?.name || adapted.settings?.project?.name || 'project').trim() || 'project';
  persistence.writeJson('project.est.json', out);
  persistence.writeJson('workspace.est.json', out);
  await persistence.flushConfig();
  const importWarnings = [...(out.importWarnings || []), ...adaptWarnings];
  return {
    ok: true,
    projectName,
    project: out.project,
    tagCount: deps.tagStore.count(),
    driverCount: deps.driverManager.list().length,
    importWarnings,
  };
}

function createProjectHubRoutes(deps) {
  const router = require('express').Router();

  router.get('/project-hub/catalog', (req, res) => {
    const local = projectHubStore.listEntries();
    res.json({ projects: local, localCount: local.length });
  });

  router.get('/project-hub/cloud/catalog', async (req, res) => {
    try {
      const projects = await projectHubCloudClient.listCloudCatalog();
      res.json({ projects, cloudCount: projects.length });
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message || String(e) });
    }
  });

  router.get('/project-hub/catalog/:id/file', (req, res) => {
    try {
      const { entry, doc } = projectHubStore.loadEstDoc(req.params.id);
      const name = String(
        doc.project?.name || doc.name || entry.name,
      ).trim() || entry.name;
      const legacy = req.query?.legacy === '1' || req.query?.format === 'est';
      if (legacy && !isBundle(doc)) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${exportFilename(name)}"`);
        res.send(JSON.stringify(doc, null, 2));
        return;
      }
      const bundle = isBundle(doc) ? doc : packEst(doc, { name, exportedBy: PACKAGE_VERSION });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${bundleFilename(name)}"`);
      res.send(JSON.stringify(bundle, null, 2));
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/project-hub/publish', async (req, res) => {
    try {
      const name = String(req.body?.name || req.body?.projectName || '').trim()
        || String(deps.persistence.readJson('settings.json', {})?.project?.name || 'project').trim()
        || 'project';
      const estDoc = req.body?.doc && typeof req.body.doc === 'object'
        ? req.body.doc
        : pack({ tagStore: deps.tagStore, driverManager: deps.driverManager, persistence: deps.persistence }, { name });
      const bundle = isBundle(estDoc) ? estDoc : packEst(estDoc, { name, exportedBy: PACKAGE_VERSION });
      const entry = projectHubStore.publishDoc(name, bundle, {
        description: req.body?.description,
        slug: req.body?.slug,
      });
      res.json({ ok: true, entry });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/project-hub/cloud/publish', async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim()
        || String(deps.persistence.readJson('settings.json', {})?.project?.name || 'project').trim()
        || 'project';
      const estDoc = req.body?.doc && typeof req.body.doc === 'object'
        ? req.body.doc
        : pack({ tagStore: deps.tagStore, driverManager: deps.driverManager, persistence: deps.persistence }, { name });
      const bundle = isBundle(estDoc) ? estDoc : packEst(estDoc, { name, exportedBy: PACKAGE_VERSION });
      const result = await projectHubCloudClient.publishToCloud(bundle, {
        name,
        description: req.body?.description,
      });
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(e.status || 502).json({ error: e.message || String(e) });
    }
  });

  router.post('/project-hub/deploy', async (req, res) => {
    try {
      const source = String(req.body?.source || 'local').trim() || 'local';
      const id = String(req.body?.id || '').trim();

      let doc;
      let bundleWarnings = [];
      if (source === 'cloud') {
        if (!id) return res.status(400).json({ error: 'Missing project id' });
        doc = await projectHubCloudClient.fetchCloudEst(id);
      } else if (source === 'file') {
        if (!req.body?.doc || typeof req.body.doc !== 'object') {
          return res.status(400).json({ error: 'Missing doc for file deploy' });
        }
        const resolved = resolveImportPayload(req.body.doc);
        if (resolved.type !== 'est') {
          return res.status(400).json({ error: 'Expected a MooreVIEW project bundle or .est.json file' });
        }
        doc = resolved.doc;
        bundleWarnings = resolved.warnings || [];
      } else {
        if (!id) return res.status(400).json({ error: 'Missing project id' });
        ({ doc } = projectHubStore.loadEstDoc(id));
      }

      if (source !== 'file') {
        const resolved = resolveImportPayload(doc);
        if (resolved.type !== 'est') {
          return res.status(400).json({ error: 'Repository project is not a MooreVIEW bundle' });
        }
        doc = resolved.doc;
        bundleWarnings = [...bundleWarnings, ...(resolved.warnings || [])];
      }

      const result = await deployEstDoc(doc, deps, { prunePrograms: false });
      if (bundleWarnings.length) {
        result.importWarnings = [...(result.importWarnings || []), ...bundleWarnings];
      }
      if (source === 'local') {
        try {
          const saved = await projectStore.saveProjectDoc(
            result.projectName,
            pack(
              { tagStore: deps.tagStore, driverManager: deps.driverManager, persistence: deps.persistence },
              { name: result.projectName },
            ),
          );
          await rememberLastOpenedProject(saved.id, result.projectName);
          result.savedProjectId = saved.id;
        } catch (err) {
          console.warn('[project-hub] deploy saved locally but library save failed:', err.message);
        }
      }
      res.json(result);
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.delete('/project-hub/catalog/:id', (req, res) => {
    try {
      projectHubStore.removeEntry(req.params.id);
      res.json({ ok: true, projects: projectHubStore.listEntries() });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createProjectHubRoutes, deployEstDoc };
