#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { EST_FORMAT } = require('../../src/project/estFile');
const { PROJECT, buildTags, buildDrivers, buildSettings } = require('./project-data');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'data', 'projects', 'hvac-split-unit-ahu.est.json');

function main() {
  const est = {
    format: EST_FORMAT,
    version: 1,
    savedAt: new Date().toISOString(),
    project: { name: PROJECT.name },
    tags: buildTags('opta_split_ahu'),
    drivers: buildDrivers(),
    program: PROJECT.programFile,
    activeProgram: PROJECT.programFile,
    settings: buildSettings(),
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(est, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${OUT}`);
}

main();
