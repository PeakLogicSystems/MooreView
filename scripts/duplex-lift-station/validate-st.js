#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseProgram, validateProgram } = require('../../src/engine/parser');
const { buildOptaProgramBody } = require('../../src/parc/mqttOptaProgram');
const { assessStProgramLines } = require('../../src/programs/stProgramLimits');

const ROOT = path.resolve(__dirname, '..', '..');
const ST = path.join(ROOT, 'st', 'logic', '36_duplex_lift_station.st');
const TAGS = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'st', 'fixtures', 'tags.duplex_lift_station.json'),
  'utf8',
));

const src = fs.readFileSync(ST, 'utf8');
const tagIds = TAGS.map((t) => t.id);
const lineCheck = assessStProgramLines(src, { forParc: true });
const { ast, errors: parseErrs } = parseProgram(src);
const valErrs = ast ? validateProgram(ast, tagIds) : [];

const tagStore = {
  list: () => TAGS.map((t) => ({ ...t })),
};

const built = buildOptaProgramBody(src, tagStore, 'opta_st_01');

console.log('lines', lineCheck.lines, 'overLimit', lineCheck.overLimit);
console.log('parse', parseErrs.length ? parseErrs : 'ok');
console.log('validate', valErrs.length ? valErrs : 'ok');
console.log('bytecode', built.ok ? `ok tags=${built.tagIds?.length}` : built.errors);

if (parseErrs.length || valErrs.length || !built.ok) process.exit(1);
