'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseProgram } = require('../src/engine/parser');
const { compileProgramBytecode, bytecodeToBase64 } = require('../src/engine/stBytecode');
const { BC_MAGIC, OP, BUILTIN } = require('../src/engine/stOpcodes');
const { buildOptaProgramBody } = require('../src/parc/mqttOptaProgram');

describe('stBytecode', () => {
  it('compiles minimal IF program', () => {
    const tagStore = {
      list: () => [
        { id: 'I1', type: 'BOOL', role: 'input' },
        { id: 'R1', type: 'BOOL', role: 'output' },
      ],
    };
    const src = 'IF IsON(I1) THEN TurnON(R1); ELSE TurnOFF(R1); END_IF;';
    const built = buildOptaProgramBody(src, tagStore, 'opta_st_01');
    assert.equal(built.ok, true);
    assert.ok(built.body.bc);
    const raw = Buffer.from(built.body.bc, 'base64');
    assert.equal(raw.slice(0, 4).toString(), BC_MAGIC.toString());
    assert.ok(raw.length < 256);
  });

  it('round-trips tag table in header', () => {
    const { ast } = parseProgram('IF IsON(I1) THEN TurnON(R1); END_IF;');
    const tagIds = ['I1', 'R1'];
    const tags = [{ id: 'I1', type: 'BOOL' }, { id: 'R1', type: 'BOOL' }];
    const buf = compileProgramBytecode(ast, tagIds, tags);
    const tagCount = buf.readUInt16LE(6);
    assert.equal(tagCount, 2);
    let off = 10;
    const names = [];
    for (let i = 0; i < tagCount; i++) {
      const nlen = buf.readUInt8(off++);
      names.push(buf.slice(off, off + nlen).toString());
      off += nlen + 2; // type + flags
    }
    assert.deepEqual(names, ['I1', 'R1']);
  });

  it('parses bytecode code/data stats', () => {
    const built = buildOptaProgramBody(
      'IF IsON(I1) THEN TurnON(R1); END_IF;',
      { list: () => [{ id: 'I1', type: 'BOOL' }, { id: 'R1', type: 'BOOL' }] },
      'x',
    );
    const { parseBytecodeStats } = require('../src/engine/stBytecode');
    const stats = parseBytecodeStats(Buffer.from(built.body.bc, 'base64'));
    assert.ok(stats);
    assert.ok(stats.codeBytes > 0);
    assert.ok(stats.dataBytes > 0);
    assert.equal(stats.totalBytes, stats.codeBytes + stats.dataBytes);
  });

  it('compiles SetInt assignment', () => {
    const tagStore = {
      list: () => [{ id: 'MOTOR1_STA', type: 'INT', role: 'memory' }],
    };
    const built = buildOptaProgramBody('SetInt(MOTOR1_STA, 1);', tagStore, 'opta_st_01');
    assert.equal(built.ok, true);
    assert.ok(built.body.bc);
  });

  it('encodes ALT tag metadata in bytecode header', () => {
    const { ast } = parseProgram('AltEnable(ALT1, SYS_RUN);');
    const tags = [{ id: 'ALT1', type: 'ALT', mode: 'ALT2', preset: 2 }, { id: 'SYS_RUN', type: 'BOOL' }];
    const tagIds = ['ALT1', 'SYS_RUN'];
    const buf = compileProgramBytecode(ast, tagIds, tags);
    let off = 10;
    const nlen = buf.readUInt8(off++);
    assert.equal(buf.slice(off, off + nlen).toString(), 'ALT1');
    off += nlen;
    assert.equal(buf.readUInt8(off++), 8);
    const flags = buf.readUInt8(off++);
    assert.equal(flags & 0x01, 0x01);
    assert.equal(flags & 0x02, 0x02);
    assert.equal(buf.readUInt32LE(off), 2);
    off += 4;
    assert.equal(buf.readUInt8(off), 8);
  });

  it('compiles INT tag comparisons via CounterValue (HOA hand branch)', () => {
    const tags = [
      { id: 'MOTOR1_HOA', type: 'INT', role: 'memory' },
      { id: 'MOTOR1_RUN', type: 'BOOL', role: 'memory' },
    ];
    const tagIds = tags.map((t) => t.id);
    const { ast } = parseProgram('IF MOTOR1_HOA = 2 THEN TurnON(MOTOR1_RUN); END_IF;');
    const buf = compileProgramBytecode(ast, tagIds, tags);
    const codeOff = 10 + tagIds.reduce((o, id) => {
      const meta = tags.find((t) => t.id === id);
      let extra = 2;
      if (meta.preset != null) extra += 4;
      return o + 1 + Buffer.byteLength(id) + extra;
    }, 0);
    const code = buf.slice(codeOff);
    const hoaIdx = tagIds.indexOf('MOTOR1_HOA');
    let found = false;
    for (let i = 0; i < code.length - 6; i++) {
      if (code[i] === OP.PUSH_TAG
        && code.readUInt16LE(i + 1) === hoaIdx
        && code[i + 3] === OP.CALL
        && code[i + 4] === BUILTIN.CounterValue) {
        found = true;
        break;
      }
    }
    assert.equal(found, true, 'MOTOR1_HOA expr must CALL CounterValue, not push table index');
  });
});
