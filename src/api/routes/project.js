'use strict';

const { spawn } = require('child_process');
const persistence = require('../../persistence');
const programStore = require('../../programs/programStore');
const projectStore = require('../../project/projectStore');
const { pack, apply, blankProjectDoc } = require('../../project/estFile');
const { packEst, bundleFilename, resolveImportPayload } = require('../../project/projectBundle');
const PACKAGE_VERSION = require('../../../package.json').version;

function attachMvDrawToEstDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (doc.mvDraw) return doc;
  try {
    const { readActiveProject } = require('../../../mv-draw/src/mvDrawStore');
    const { normalizeMvDraw } = require('../../../mv-draw/src/mvDrawFormat');
    const active = readActiveProject();
    if (active && (active.nodes?.length || active.background || active.scale)) {
      doc.mvDraw = normalizeMvDraw(active);
      return doc;
    }
    const ws = persistence.readJson('workspace.est.json', null);
    const pe = persistence.readJson('project.est.json', null);
    const embedded = ws?.mvDraw || pe?.mvDraw || null;
    if (embedded) doc.mvDraw = embedded;
  } catch { /* optional */ }
  return doc;
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

  router.get('/project/est', (req, res) => {
    const doc = pack({ tagStore, driverManager, persistence }, { name: req.query.name || 'project' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="project.est"');
    res.send(JSON.stringify(doc, null, 2));
  });

  router.get('/project/bundle', (req, res) => {
    try {
      const doc = attachMvDrawToEstDoc(
        pack({ tagStore, driverManager, persistence }, { name: req.query.name || 'project' }),
      );
      const bundle = packEst(doc, { exportedBy: PACKAGE_VERSION });
      const name = String(doc.project?.name || req.query.name || 'project').trim() || 'project';
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${bundleFilename(name)}"`);
      res.send(JSON.stringify(bundle, null, 2));
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || String(e) });
    }
  });

  router.post('/project/est', async (req, res) => {
    try {
      const resolved = resolveImportPayload(req.body);
      if (resolved.type !== 'est') {
        return res.status(400).json({ error: 'Expected a MooreVIEW project file (.est.json or .mvbundle)' });
      }
      const doc = await apply(resolved.doc, { tagStore, driverManager, scanEngine, persistence, graphHistory });
      if (resolved.doc?.mvDraw) {
        try {
          const { writeActiveProject } = require('../../../mv-draw/src/mvDrawStore');
          const { patchEstSnapshotsWithMvDraw } = require('../../../mv-draw/src/projectSync');
          const { normalizeMvDraw } = require('../../../mv-draw/src/mvDrawFormat');
          const mv = normalizeMvDraw(resolved.doc.mvDraw);
          writeActiveProject(mv);
          patchEstSnapshotsWithMvDraw(mv);
        } catch { /* optional */ }
      }
      persistence.writeJson('project.est.json', doc);
      res.json({
        ok: true,
        project: doc,
        tagCount: tagStore.count(),
        driverCount: driverManager.list().length,
        importWarnings: resolved.warnings || [],
      });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  router.post('/workspace/save', async (req, res) => {
    const doc = pack({ tagStore, driverManager, persistence }, req.body?.project || {});
    persistence.writeJson('workspace.est.json', doc);
    programStore.writeActive(doc.program);
    if (doc.activeProgram) programStore.setActive(doc.activeProgram);
    res.json({ ok: true });
  });

  router.get('/projects', (req, res) => {
    res.json({
      projects: projectStore.listProjects(),
      projectsDir: projectStore.projectsDir(),
    });
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
    const name = req.body?.name || req.body?.project?.name || 'project';
    const doc = pack({ tagStore, driverManager, persistence }, { name });
    const saved = projectStore.saveProjectDoc(name, doc);
    let gridfsFile = null;
    try {
      const { mirrorUpload } = require('../../storage/gridfsMirror');
      const gridfs = require('../../storage/gridfsStore');
      const buf = Buffer.from(JSON.stringify(doc, null, 2), 'utf8');
      gridfsFile = await mirrorUpload(gridfs.BUCKETS.project_bundles, buf, {
        filename: `${saved.id || name}.est.json`,
        contentType: 'application/json',
        metadata: { projectId: saved.id, projectName: name, source: 'projects/save' },
      });
    } catch { /* ignore */ }
    res.json({ ok: true, id: saved.id, projects: projectStore.listProjects(), gridfsFileId: gridfsFile?.fileId || null });
  });

  router.post('/projects/new', async (req, res) => {
    try {
      const name = String(req.body?.name || 'untitled').trim() || 'untitled';
      const doc = blankProjectDoc(name);
      const out = await apply(
        doc,
        { tagStore, driverManager, scanEngine, persistence, graphHistory },
        { prunePrograms: true },
      );
      res.json({
        ok: true,
        project: out.project,
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
      const doc = projectStore.loadProjectDoc(id);
      const out = await apply(
        doc,
        { tagStore, driverManager, scanEngine, persistence, graphHistory },
      );
      res.json({
        ok: true,
        project: out.project,
        tagCount: tagStore.count(),
        driverCount: driverManager.list().length,
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
      const doc = await apply(req.body, { tagStore, driverManager, scanEngine, persistence });
      res.json({ ok: true, tagCount: tagStore.count(), project: doc.project });
    } catch (e) {
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  });

  return router;
}

module.exports = { createProjectRoutes };
