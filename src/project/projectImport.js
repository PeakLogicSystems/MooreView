'use strict';

const persistence = require('../persistence');
const projectStore = require('./projectStore');
const { packArchive, isZipBuffer } = require('./projectArchive');
const { rememberLastOpenedProject } = require('./startupLoader');
const PACKAGE_VERSION = require('../../package.json').version;

async function finishProjectImport(raw, deps, out) {
  const projectName = String(
    out.project?.project?.name || out.project?.name || 'project',
  ).trim() || 'project';
  const workspaceBuf = isZipBuffer(raw)
    ? raw
    : packArchive(deps, { name: projectName, exportedBy: PACKAGE_VERSION });
  persistence.writeBinary('workspace.est.zip', workspaceBuf);
  await persistence.flushConfig();
  let savedProjectId = null;
  try {
    const saved = projectStore.saveProjectArchive(projectName, workspaceBuf);
    savedProjectId = saved.id;
    await rememberLastOpenedProject(saved.id, projectName);
  } catch (err) {
    console.warn('[project] import library save failed:', err.message);
  }
  return {
    ok: true,
    projectName,
    savedProjectId,
    project: out,
    tagCount: deps.tagStore.count(),
    driverCount: deps.driverManager.list().length,
    importWarnings: out.importWarnings || [],
  };
}

module.exports = { finishProjectImport };
