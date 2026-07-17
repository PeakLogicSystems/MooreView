'use strict';

const persistence = require('../../src/persistence');
const { exportFilename, EST_FORMAT } = require('../../src/project/estFile');
const { normalizeHmi } = require('../../src/hmi/hmiConfig');
const { normalizeMvDraw } = require('./mvDrawFormat');
const {
  readActiveProject,
  writeActiveProject,
  saveNamedProject,
} = require('./mvDrawStore');

const DEFAULT_FACILITY_PLAN_URL = '/mv-draw?embedded=1';
const PUBLIC_ROOT = require('path').join(__dirname, '../../public');

function readEstSnapshot() {
  const projectEst = persistence.readJson('project.est.json', null);
  if (projectEst?.format === EST_FORMAT) return projectEst;
  const workspaceEst = persistence.readJson('workspace.est.json', null);
  if (workspaceEst?.format === EST_FORMAT) return workspaceEst;
  return projectEst || workspaceEst || null;
}

function buildMooreviewProjectContext(settings, estSnapshot, activeMvDraw) {
  const projectName = String(settings?.project?.name || 'untitled').trim() || 'untitled';
  const estPath = `data/projects/${exportFilename(projectName)}`;
  const mvDraw = estSnapshot?.mvDraw || null;
  const synced = String(activeMvDraw?.meta?.mooreviewProject || '').trim() === projectName;
  return {
    projectName,
    lastOpenedId: settings?.project?.lastOpenedId || null,
    estPath,
    projectSavedAt: estSnapshot?.savedAt || null,
    hasProjectMvDraw: !!(mvDraw && (mvDraw.nodes?.length || mvDraw.background || mvDraw.scale)),
    mvDrawSavedAt: mvDraw?.savedAt || null,
    synced,
    composer: {
      composerMode: settings?.hmi?.layout?.composerMode || 'grid',
      facilityPlanUrl: settings?.hmi?.layout?.facilityPlanUrl || null,
      facility3dUrl: settings?.hmi?.layout?.facility3dUrl || null,
    },
  };
}

function readMooreviewProjectContext() {
  const settings = persistence.readJson('settings.json', {});
  const est = readEstSnapshot();
  return buildMooreviewProjectContext(settings, est, readActiveProject());
}

function integrationLibraryFileBase(context, doc) {
  const existing = String(doc?.libraryFile || '').replace(/\.mvdraw\.json$/i, '').trim();
  if (existing) return existing;
  return String(context?.projectName || 'untitled').trim().replace(/[^\w.-]+/g, '_').slice(0, 80) || 'untitled';
}

function alignMvDrawForMooreviewProject(doc, context, settings = {}) {
  const projectName = String(context?.projectName || 'untitled').trim() || 'untitled';
  const site = String(settings?.project?.site || doc?.meta?.site || '').trim();
  const client = String(settings?.project?.client || doc?.meta?.client || '').trim();
  return normalizeMvDraw({ ...doc, name: projectName }, {
    name: projectName,
    site,
    client,
    mooreviewProject: projectName,
  });
}

function patchEstSnapshotsWithMvDraw(mvDrawDoc) {
  const mvDraw = normalizeMvDraw(mvDrawDoc);
  const stamp = new Date().toISOString();
  const touched = [];
  for (const file of ['project.est.json', 'workspace.est.json']) {
    const est = persistence.readJson(file, null);
    if (!est || est.format !== EST_FORMAT) continue;
    est.mvDraw = mvDraw;
    est.savedAt = stamp;
    persistence.writeJson(file, est);
    touched.push(file);
  }
  return touched;
}

function linkComposerToPlan(settings, options = {}) {
  const linkComposer = options.linkComposer !== false;
  if (!linkComposer) return settings;
  const prev = settings && typeof settings === 'object' ? settings : {};
  const hmi = prev.hmi && typeof prev.hmi === 'object' ? { ...prev.hmi } : {};
  const layout = hmi.layout && typeof hmi.layout === 'object' ? { ...hmi.layout } : {};
  const planUrl = String(options.facilityPlanUrl || DEFAULT_FACILITY_PLAN_URL).trim()
    || DEFAULT_FACILITY_PLAN_URL;
  layout.facilityPlanUrl = planUrl;
  if (options.setComposerMode !== false && String(layout.composerMode || 'grid').toLowerCase() === 'grid') {
    layout.composerMode = 'plan';
  }
  hmi.layout = layout;
  const tagList = [];
  const next = { ...prev, hmi: normalizeHmi(hmi, tagList, PUBLIC_ROOT) };
  persistence.writeJson('settings.json', next);
  return next;
}

function linkComposerTo3d(settings, facility3dUrl, options = {}) {
  const prev = settings && typeof settings === 'object' ? settings : {};
  const hmi = prev.hmi && typeof prev.hmi === 'object' ? { ...prev.hmi } : {};
  const layout = hmi.layout && typeof hmi.layout === 'object' ? { ...hmi.layout } : {};
  const url = String(facility3dUrl || '').trim();
  if (url) layout.facility3dUrl = url;
  if (options.setComposerMode !== false) layout.composerMode = '3d';
  hmi.layout = layout;
  const tagList = [];
  const next = { ...prev, hmi: normalizeHmi(hmi, tagList, PUBLIC_ROOT) };
  persistence.writeJson('settings.json', next);
  return next;
}

function saveMvDrawToMooreviewProject(doc, options = {}) {
  const context = readMooreviewProjectContext();
  const settings = persistence.readJson('settings.json', {});
  const aligned = alignMvDrawForMooreviewProject(doc || readActiveProject(), context, settings);
  const fileBase = integrationLibraryFileBase(context, aligned);
  const { project, file } = saveNamedProject(fileBase, aligned, { alignProjectName: true });
  writeActiveProject(project);
  const estTouched = patchEstSnapshotsWithMvDraw(project);
  const nextSettings = linkComposerToPlan(settings, options);
  return {
    project,
    file,
    context: buildMooreviewProjectContext(nextSettings, readEstSnapshot(), project),
    estPath: context.estPath,
    estTouched,
    facilityPlanUrl: nextSettings.hmi?.layout?.facilityPlanUrl || null,
    composerMode: nextSettings.hmi?.layout?.composerMode || 'grid',
  };
}

function loadMvDrawFromMooreviewProject() {
  const est = readEstSnapshot();
  if (!est?.mvDraw) {
    throw Object.assign(new Error('No site plan in the open MooreVIEW project'), { status: 404 });
  }
  const context = readMooreviewProjectContext();
  const settings = persistence.readJson('settings.json', {});
  const aligned = alignMvDrawForMooreviewProject(est.mvDraw, context, settings);
  const fileBase = integrationLibraryFileBase(context, aligned);
  const { project, file } = saveNamedProject(fileBase, aligned, { alignProjectName: true });
  const saved = writeActiveProject(project);
  return {
    project: saved,
    file,
    context: buildMooreviewProjectContext(settings, est, saved),
    estPath: context.estPath,
  };
}

function shouldAutoLoadFromProject(context, activeProject) {
  if (!context?.hasProjectMvDraw) return false;
  const nodes = activeProject?.nodes || [];
  const name = String(activeProject?.name || '').trim().toLowerCase();
  const isBlank = nodes.length === 0 && !activeProject?.background && !activeProject?.scale;
  const isUntitled = !name || name === 'untitled';
  const alreadySynced = context.synced;
  return isBlank && isUntitled && !alreadySynced;
}

async function saveMvDrawToProjectLibrary() {
  const settings = persistence.readJson('settings.json', {});
  const id = settings.project?.lastOpenedId;
  if (!id) return null;
  const est = persistence.readJson('project.est.json', null);
  if (!est || est.format !== EST_FORMAT) return null;
  const projectStore = require('../../src/project/projectStore');
  const saved = await projectStore.saveProjectDoc(id, est);
  return saved?.id || id;
}

module.exports = {
  DEFAULT_FACILITY_PLAN_URL,
  buildMooreviewProjectContext,
  readMooreviewProjectContext,
  alignMvDrawForMooreviewProject,
  patchEstSnapshotsWithMvDraw,
  linkComposerToPlan,
  linkComposerTo3d,
  saveMvDrawToMooreviewProject,
  loadMvDrawFromMooreviewProject,
  shouldAutoLoadFromProject,
  saveMvDrawToProjectLibrary,
};
