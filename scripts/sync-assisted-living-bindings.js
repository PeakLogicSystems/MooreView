'use strict';

const fs = require('fs');
const path = require('path');
const { normalizeHmi } = require('../src/hmi/hmiConfig');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PUBLIC_ROOT = path.join(ROOT, 'public');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function countByScreen(bindings) {
  const counts = {};
  for (const b of bindings || []) {
    const sid = b.screenId || '(none)';
    counts[sid] = (counts[sid] || 0) + 1;
  }
  return counts;
}

function main() {
  const projectPath = path.join(DATA, 'projects', 'assisted-living.est.json');
  const settingsPath = path.join(DATA, 'settings.json');
  const tagsPath = path.join(DATA, 'tags.json');

  const project = loadJson(projectPath);
  const settings = loadJson(settingsPath);
  const tagsRaw = loadJson(tagsPath);
  const tagList = Array.isArray(tagsRaw) ? tagsRaw : (tagsRaw.tags || []);

  const sourceBindings = project?.settings?.hmi?.bindings;
  if (!Array.isArray(sourceBindings) || !sourceBindings.length) {
    throw new Error('No bindings found in assisted-living.est.json');
  }

  settings.hmi = settings.hmi || {};
  settings.hmi.bindings = sourceBindings;

  const normalized = normalizeHmi(settings.hmi, tagList, PUBLIC_ROOT);
  settings.hmi.bindings = normalized.bindings;

  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

  const before = sourceBindings.length;
  const after = normalized.bindings.length;
  const counts = countByScreen(normalized.bindings);
  const screens = Object.keys(counts).sort((a, b) => {
    const na = Number(a.replace('screen_', '')) || 0;
    const nb = Number(b.replace('screen_', '')) || 0;
    return na - nb;
  });

  console.log(`Synced bindings: ${before} source → ${after} normalized (${before - after} dropped)`);
  for (const sid of screens) {
    console.log(`  ${sid}: ${counts[sid]}`);
  }
}

main();
