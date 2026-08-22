'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseProgram, validateProgram } = require('../src/engine/parser');
const { ST_DIR } = require('../src/config');
const {
  isShippedSamplePath,
  pruneProgramsExcept,
  listProgramsInRoot,
  normalizeProgramSource,
} = require('../src/programs/programStore');

const FIXTURES = path.join(ST_DIR, 'fixtures');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
}

function listStFiles(dir, base = '') {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(full).isDirectory()) out.push(...listStFiles(full, rel));
    else if (name.endsWith('.st')) out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

const TAGS_BY_CATEGORY = {
  logic: () => loadJson('tags.logic.json').map((t) => t.id),
  mqtt: () => loadJson('tags.mqtt.json').map((t) => t.id),
  modbus: () => loadJson('tags.modbus.json').map((t) => t.id),
  opta: () => loadJson('tags.opta.json').map((t) => t.id),
  opta_eth: () => loadJson('tags.opta_eth.json').map((t) => t.id),
  root: () => loadJson('tags.logic.json').map((t) => t.id),
};

const TAGS_BY_FILE = {
  'logic/08_waveshare_di1_q1.st': () => loadJson('tags.waveshare_rtu_8ch.json').map((t) => t.id),
  'logic/21_all_st_features_memory.st': () => loadJson('tags.all_st_features.json').map((t) => t.id),
  'logic/22_motor_hoa.st': () => loadJson('tags.motor_hoa.json').map((t) => t.id),
  'logic/23_tpo_irrigation.st': () => loadJson('tags.tpo_irrigation.json').map((t) => t.id),
  'logic/24_motor_tpo_combined.st': () => loadJson('tags.motor_tpo_combined.json').map((t) => t.id),
  'logic/program.st': () => ['Q'],
  'opta/01_i1_to_r1.st': () => loadJson('tags.opta_eth.json').map((t) => t.id),
  'opta/02_analog_alarm_to_r2.st': () => loadJson('tags.opta_eth.json').map((t) => t.id),
  'opta/03_pid_avg.st': () => loadJson('tags.opta_eth.json').map((t) => t.id),
  'opta/04_timer_counter.st': () => loadJson('tags.opta_mqtt_st.json').map((t) => t.id),
  'opta/05_oneshot_init.st': () => loadJson('tags.opta_mqtt_st.json').map((t) => t.id),
  'opta/06_flow_gpm.st': () => loadJson('tags.opta_mqtt_st.json').map((t) => t.id),
  'opta/07_leak_ct_thermistor.st': () => loadJson('tags.opta_leak_demo.json').map((t) => t.id),
  'opta/09_moisture_ntc_ct.st': () => loadJson('tags.opta_sensor_test.json').map((t) => t.id),
  'modbus/08_waveshare_di1_q1.st': () => loadJson('tags.waveshare_rtu_8ch.json').map((t) => t.id),
  'modbus/09_ul212nt_e_level.st': () => loadJson('tags.ul212nt_e.json').map((t) => t.id),
};

describe('programStore prune', () => {
  it('normalizeProgramSource accepts strings and unwraps nested source', () => {
    assert.equal(normalizeProgramSource('IF x THEN y; END_IF;'), 'IF x THEN y; END_IF;');
    assert.equal(normalizeProgramSource({ source: 'TurnON(Q);' }), 'TurnON(Q);');
    assert.throws(() => normalizeProgramSource({ ast: { type: 'program' } }), /ST text/);
  });

  it('recognizes shipped sample paths', () => {
    assert.equal(isShippedSamplePath('logic/01_ison_turn_on.st'), true);
    assert.equal(isShippedSamplePath('modbus/08_waveshare_di1_q1.st'), true);
    assert.equal(isShippedSamplePath('opta-mqtt/foo.st'), true);
    assert.equal(isShippedSamplePath('logic/new_1.st'), false);
    assert.equal(isShippedSamplePath('logic/program1.st'), false);
  });

  it('pruneProgramsExcept removes user programs but keeps samples', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-st-prune-'));
    fs.mkdirSync(path.join(tmp, 'logic'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'logic', '01_sample.st'), '(* sample *)\n');
    fs.writeFileSync(path.join(tmp, 'logic', 'new_1.st'), '(* user *)\n');
    fs.writeFileSync(path.join(tmp, 'logic', 'program.st'), '(* active *)\n');
    pruneProgramsExcept('logic/program.st', { stRoot: tmp });
    const left = listProgramsInRoot(tmp).map((p) => p.path);
    assert.deepEqual(left.sort(), ['logic/01_sample.st', 'logic/program.st']);
  });
});

describe('st test programs', () => {
  it('lists programs under st/', () => {
    const files = listStFiles(ST_DIR);
    assert.ok(files.some((f) => f.startsWith('logic/')));
    assert.ok(files.some((f) => f.startsWith('mqtt/')));
    assert.ok(files.some((f) => f.startsWith('modbus/')));
    assert.ok(files.some((f) => f.startsWith('opta/')));
  });

  const SKIP_VALIDATE = new Set(['program.st', 'logic/17_waveshare_di1_q1.st']);
  for (const rel of listStFiles(ST_DIR).filter((f) => !SKIP_VALIDATE.has(f))) {
    const category = rel.includes('/') ? rel.split('/')[0] : 'root';
    if (!TAGS_BY_CATEGORY[category]) continue;
    it(`validates ${rel}`, () => {
      const src = fs.readFileSync(path.join(ST_DIR, rel), 'utf8');
      const { ast } = parseProgram(src);
      const tagIds = TAGS_BY_FILE[rel] ? TAGS_BY_FILE[rel]() : TAGS_BY_CATEGORY[category]();
      const errors = validateProgram(ast, tagIds);
      assert.deepEqual(errors, [], errors.join('; '));
    });
  }
});
