'use strict';

/** Wire format magic — keep in sync with firmware mv_bc.h */
const BC_MAGIC = Buffer.from('MVBC');

const BC_VERSION = 1;

const OP = {
  PUSH_F32: 0x01,
  PUSH_I16: 0x02,
  PUSH_TAG: 0x03,
  NOT: 0x10,
  NEG: 0x11,
  AND: 0x20,
  OR: 0x21,
  ADD: 0x22,
  SUB: 0x23,
  MUL: 0x24,
  DIV: 0x25,
  MOD: 0x26,
  GT: 0x30,
  LT: 0x31,
  EQ: 0x32,
  GE: 0x33,
  LE: 0x34,
  NE: 0x35,
  CALL: 0x40,
  ACTION: 0x80,
  STORE_TAG: 0x81,
  JMP_IFNOT: 0x90,
  JMP: 0x91,
  END: 0xff,
};

const BUILTIN = {
  IsON: 0,
  IsOFF: 1,
  TimerDone: 2,
  TimerRun: 3,
  CounterDone: 4,
  CounterValue: 5,
  PidValue: 6,
  PidError: 7,
  PidAutoMode: 8,
  AvgValue: 9,
  AvgReady: 10,
  AvgCount: 11,
  WithInLimits: 12,
  OneShot: 13,
  FlowValue: 14,
  FlowReady: 15,
};

/** Built-in argc (stack args, bottom-first). */
const BUILTIN_ARGC = {
  IsON: 1,
  IsOFF: 1,
  TimerDone: 1,
  TimerRun: 1,
  CounterDone: 1,
  CounterValue: 1,
  PidValue: 1,
  PidError: 1,
  PidAutoMode: 1,
  AvgValue: 1,
  AvgReady: 1,
  AvgCount: 1,
  WithInLimits: 3,
  OneShot: 1,
  FlowValue: 1,
  FlowReady: 1,
};

const ACTION = {
  TurnON: 0,
  TurnOFF: 1,
  CounterReset: 2,
  CounterCu: 3,
  CounterCd: 4,
  TimerInput: 5,
  PidPv: 6,
  PidSp: 7,
  PidOut: 8,
  PidAuto: 9,
  PidManual: 10,
  AvgIn: 11,
  AvgReset: 12,
  AvgOut: 13,
  FlowCtr: 14,
  FlowTmr: 15,
  FlowK: 16,
  FlowOut: 17,
};

const TAG_TYPE = {
  BOOL: 0,
  INT: 1,
  REAL: 2,
  TIMER: 3,
  COUNTER: 4,
  PID: 5,
  AVG: 6,
  FLOW: 7,
};

const MODE_ID = {
  TON: 0,
  TOF: 1,
  TP: 2,
  CTU: 3,
  CTD: 4,
  PI: 5,
  MOV: 6,
  GPM: 7,
};

const META_PRESET = 0x01;
const META_MODE = 0x02;
const META_PID = 0x04;
const NO_TAG = 0xffff;

module.exports = {
  BC_MAGIC,
  BC_VERSION,
  OP,
  BUILTIN,
  BUILTIN_ARGC,
  ACTION,
  TAG_TYPE,
  MODE_ID,
  META_PRESET,
  META_MODE,
  META_PID,
  NO_TAG,
};
