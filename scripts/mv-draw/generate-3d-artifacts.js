#!/usr/bin/env node
'use strict';

/**
 * Generate 3D layout artifacts from an MV Draw project file.
 *
 * Usage:
 *   node scripts/mv-draw/generate-3d-artifacts.js --input data/mv-draw/projects/DWTS.mvdraw.json
 *   node scripts/mv-draw/generate-3d-artifacts.js --input data/mv-draw/active.json --slug dwts
 */

const fs = require('fs');
const path = require('path');
const { normalizeMvDraw } = require('../../mv-draw/src/mvDrawFormat');
const { buildSceneFromMvDraw } = require('../../mv-draw/src/sceneFromMvDraw');
const { slugFromProject, writeMvDraw3dArtifacts } = require('../../mv-draw/src/mvDrawArtifacts');

const ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const out = { input: null, slug: null, feetPerUnit: 1 };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--input' && argv[i + 1]) {
      out.input = argv[++i];
    } else if (a === '--slug' && argv[i + 1]) {
      out.slug = argv[++i];
    } else if (a === '--feet-per-unit' && argv[i + 1]) {
      out.feetPerUnit = +argv[++i];
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function slugFromPath(inputPath, doc) {
  const base = path.basename(inputPath, path.extname(inputPath))
    .replace(/\.mvdraw$/i, '')
    .replace(/[^\w.-]+/g, '-')
    .toLowerCase();
  return slugFromProject(doc, base);
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    console.log('Usage: node scripts/mv-draw/generate-3d-artifacts.js --input <path> [--slug name] [--feet-per-unit 1]');
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.isAbsolute(args.input)
    ? args.input
    : path.join(ROOT, args.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const doc = normalizeMvDraw(raw);
  const site = buildSceneFromMvDraw(doc, { feetPerUnit: args.feetPerUnit });
  const slug = args.slug || slugFromPath(inputPath, doc);
  const artifacts = writeMvDraw3dArtifacts(site, slug);

  console.log('MV Draw 3D artifacts generated:');
  console.log(`  Input: ${path.relative(ROOT, inputPath)}`);
  console.log(`  Placements: ${site.placements.length}`);
  console.log(`  Typed models: ${site.placements.filter((p) => p.model3d !== 'box').length}`);
  console.log(`  Pipes: ${site.pipes.length}`);
  console.log(`  Zones: ${site.zones.length}`);
  console.log(`  Plot: ${site.plot.label} (${(site.plot.maxX - site.plot.minX).toFixed(0)} × ${(site.plot.maxZ - site.plot.minZ).toFixed(0)} scene units)`);
  console.log(`  Config: public/samples/${artifacts.configName}`);
  console.log(`  Viewer: ${artifacts.url}`);
}

main();
