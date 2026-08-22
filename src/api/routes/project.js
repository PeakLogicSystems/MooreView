'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const persistence = require('../../persistence');
const programStore = require('../../programs/programStore');
const projectStore = require('../../project/projectStore');
const { packProjectDoc, applyProjectDoc, blankProjectDoc, exportFilename } = require('../../project/estFile');
const {
  packArchive,
  applyArchive,
  applyArchiveBuffer,
  applyImportBuffer,
  isZipBuffer,
  archiveFilename,
} = require('../../project/projectArchive');
const PACKAGE_VERSION = require('../../../package.json').version;
const { finishProjectImport } = require('../../project/projectImport');
const { pickProjectImportFile } = require('../../project/nativeProjectPicker');
const { invalidateDashboardCaches } = require('./dashboard');

function afterProjectApplied(out) {
  invalidateDashboardCaches();
  return out;
}

function openDirInShell(dir) {
  if (process.platform === 'win32') {
    spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [dir], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [dir], { detached: true, stdio: 'ignore' }).unref();
  }
}

function createProjectRoutes(deps) {
  const { tagStore, driverManager, scanEngine, graphHistory } = deps;
  const router = require('express').Router();

  router.get('/project/archive', (req, res) => {
    try {
      const name = req.query.name || 'project';
      const buf = packArchive(deps, { name, exportedBy: PACKAGE_VERSION });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${archiveFilename(name)}"`);
      res.send(buf);
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/project/archive', express.raw({
    type: ['application/zip', 'application/json', 'application/octet-stream', 'application/x-zip-compressed', '*/*'],
    limit: '64mb',
  }), async (req, res) => {
    try {
      const raw = Buffer.isBuffer(req.body) ? req.body : null;
      if (!raw || !raw.length) {
        return res.status(400).json({ error: 'Expected a MooreVIEW project file (.est.zip or .est.json)' });
      }
      const out = await applyImportBuffer(raw, deps);
      res.json(await finishProjectImport(raw, deps, afterProjectApplied(out)));
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/workspace/save', async (req, res) => {
    try {
      const meta = req.body?.project || {};
      const buf = packArchive(deps, { ...meta, exportedBy: PACKAGE_VERSION });
      persistence.writeBinary('workspace.est.zip', buf);
      res.json({ ok: true });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.get('/projects', (req, res) => {
    res.json({
      projects: projectStore.listProjects(),
      projectsDir: projectStore.projectsDir(),
    });
  });

  router.get('/projects/importable', (req, res) => {
    res.json({
      files: projectStore.listImportableProjects(),
      projectsDir: projectStore.projectsDir(),
    });
  });

  router.post('/projects/import-library', async (req, res) => {
    try {
      const file = String(req.body?.file || '').trim();
      if (!file) return res.status(400).json({ error: 'Missing file' });
      const { buffer } = projectStore.readImportableProjectBuffer(file);
      const out = await applyImportBuffer(buffer, deps);
      res.json(await finishProjectImport(buffer, deps, afterProjectApplied(out)));
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/projects/import-pick', (req, res) => {
    try {
      const dir = projectStore.projectsDir();
      const picked = pickProjectImportFile(dir);
      if (!picked) {
        return res.json({ ok: false, cancelled: true });
      }
      res.json({
        ok: true,
        path: picked,
        file: path.basename(picked),
      });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/projects/import-path', async (req, res) => {
    try {
      const fp = String(req.body?.path || '').trim();
      if (!fp || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) {
        return res.status(400).json({ error: 'Project file not found' });
      }
      if (fs.statSync(fp).size > 64 * 1024 * 1024) {
        return res.status(400).json({ error: 'Project file too large (max 64 MB)' });
      }
      const buffer = fs.readFileSync(fp);
      const out = await applyImportBuffer(buffer, deps);
      const result = await finishProjectImport(buffer, deps, afterProjectApplied(out));
      result.sourceFile = fp;
      res.json(result);
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.get('/projects/:id/archive', (req, res) => {
    try {
      const buf = projectStore.readProjectArchiveBuffer(req.params.id);
      const listed = projectStore.listProjects().find((p) => p.id === req.params.id);
      const name = listed?.name || req.params.id;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${archiveFilename(name)}"`);
      res.send(buf);
    } catch (e) {
      res.status(e.status || 404).json({ error: e.message || String(e) });
    }
  });

  router.post('/projects/open-folder', (req, res) => {
    const dir = projectStore.projectsDir();
    try {
      openDirInShell(dir);
      res.json({ ok: true, projectsDir: dir });
    } catch (e) {
      res.status(500).json({ error: e.message || 'Could not open folder', projectsDir: dir });
    }
  });

  router.post('/projects/save', async (req, res) => {
    try {
      const name = req.body?.name || req.body?.project?.name || 'project';
      const buf = packArchive(deps, { name, exportedBy: PACKAGE_VERSION });
      const saved = projectStore.saveProjectArchive(name, buf);
      res.json({ ok: true, id: saved.id, projects: projectStore.listProjects() });
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/projects/new', async (req, res) => {
    try {
      const name = String(req.body?.name || 'untitled').trim() || 'untitled';
      const doc = blankProjectDoc(name);
      const activeProgram = doc.activeProgram || programStore.suggestRelFromFilename(`${name}.st`);
      if (activeProgram) programStore.writeProgram(activeProgram, '(* New project *)\n');
      const out = await applyProjectDoc(
        doc,
        { tagStore, driverManager, scanEngine, persistence, graphHistory },
        { prunePrograms: true, programs: activeProgram ? { [activeProgram]: '(* New project *)\n' } : {} },
      );
      afterProjectApplied(out);
      res.json({
        ok: true,
        project: out,
        tagCount: tagStore.count(),
        driverCount: driverManager.list().length,
      });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/projects/open', async (req, res) => {
    try {
      const id = req.body?.id;
      const unpacked = projectStore.loadProjectArchive(id);
      const out = await applyArchive(unpacked, { tagStore, driverManager, scanEngine, persistence, graphHistory });
      afterProjectApplied(out);
      res.json({
        ok: true,
        project: out,
        tagCount: tagStore.count(),
        driverCount: driverManager.list().length,
        importWarnings: out.importWarnings || [],
      });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.delete('/projects', (req, res) => {
    const id = req.query?.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    projectStore.deleteProjectDoc(id);
    res.json({ ok: true, projects: projectStore.listProjects() });
  });

  router.post('/config/import', async (req, res) => {
    try {
      const doc = await applyProjectDoc(req.body, { tagStore, driverManager, scanEngine, persistence });
      afterProjectApplied(doc);
      res.json({ ok: true, tagCount: tagStore.count(), project: doc.project });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createProjectRoutes, exportFilename };
