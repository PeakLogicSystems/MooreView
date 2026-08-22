'use strict';

const express = require('express');
const persistence = require('../../persistence');
const projectStore = require('../../project/projectStore');
const projectHubStore = require('../../project/projectHubStore');
const projectHubCloudClient = require('../../project/projectHubCloudClient');
const { adaptProjectForHost } = require('../../project/adaptProjectForHost');
const { packArchive, applyArchive, applyImportBuffer, unpackArchive, isZipBuffer, archiveFilename } = require('../../project/projectArchive');
const PACKAGE_VERSION = require('../../../package.json').version;
const { rememberLastOpenedProject } = require('../../project/startupLoader');
const { finishProjectImport } = require('../../project/projectImport');

async function deployArchiveBuffer(buf, deps, opts = {}) {
  const unpacked = unpackArchive(buf);
  const { doc: adapted, warnings: adaptWarnings } = adaptProjectForHost(unpacked.project);
  const out = await applyArchive({ ...unpacked, project: adapted }, deps, opts);
  const projectName = String(adapted.project?.name || adapted.settings?.project?.name || 'project').trim() || 'project';
  persistence.writeBinary('workspace.est.zip', buf);
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
      const { entry, buffer } = projectHubStore.loadArchiveBuffer(req.params.id);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${archiveFilename(entry.name)}"`);
      res.send(buffer);
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/project-hub/publish', async (req, res) => {
    try {
      const name = String(req.body?.name || req.body?.projectName || '').trim()
        || String(persistence.readJson('settings.json', {})?.project?.name || 'project').trim()
        || 'project';
      const buf = req.body?.archiveBase64
        ? Buffer.from(String(req.body.archiveBase64), 'base64')
        : packArchive(deps, { name, exportedBy: PACKAGE_VERSION });
      const entry = projectHubStore.publishArchive(name, buf, {
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
        || String(persistence.readJson('settings.json', {})?.project?.name || 'project').trim()
        || 'project';
      const buf = req.body?.archiveBase64
        ? Buffer.from(String(req.body.archiveBase64), 'base64')
        : packArchive(deps, { name, exportedBy: PACKAGE_VERSION });
      const result = await projectHubCloudClient.publishToCloud(buf, {
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
      let buf;

      if (req.body?.archiveBase64) {
        buf = Buffer.from(String(req.body.archiveBase64), 'base64');
      } else if (source === 'cloud') {
        if (!id) return res.status(400).json({ error: 'Missing project id' });
        buf = await projectHubCloudClient.fetchCloudArchive(id);
      } else {
        if (!id) return res.status(400).json({ error: 'Missing project id' });
        ({ buffer: buf } = projectHubStore.loadArchiveBuffer(id));
      }

      if (!isZipBuffer(buf)) {
        return res.status(400).json({ error: 'Expected a MooreVIEW project archive (.est.zip)' });
      }
      const result = await deployArchiveBuffer(buf, deps, { prunePrograms: false });
      if (source === 'local') {
        try {
          const saved = projectStore.saveProjectArchive(result.projectName, buf);
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

  router.post('/project-hub/deploy/file', express.raw({
    type: ['application/zip', 'application/json', 'application/octet-stream', 'application/x-zip-compressed', '*/*'],
    limit: '64mb',
  }), async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ error: 'Expected a MooreVIEW project file (.est.zip or .est.json)' });
      }
      const out = await applyImportBuffer(req.body, deps, { prunePrograms: false });
      const result = await finishProjectImport(req.body, deps, out);
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

module.exports = { createProjectHubRoutes, deployArchiveBuffer };
