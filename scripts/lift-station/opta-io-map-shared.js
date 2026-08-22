'use strict';

/** Shared Opta base + A0602 sections for all lift-station variants. */

function baseRelayRows(opts = {}) {
  const pumps = opts.pumps || 2;
  const ezmeter = opts.ezmeter === true;
  return [
    ['R1', 'Relay out 1', 'BOOL', 'R1', 'MOTOR1_RUN', 'Pump 1 contactor'],
    ['R2', 'Relay out 2', 'BOOL', 'R2', pumps >= 2 ? 'MOTOR2_RUN' : '—', pumps >= 2 ? 'Pump 2 contactor' : 'Spare'],
    ['R3', 'Relay out 3', 'BOOL', 'R3', pumps >= 3 ? 'MOTOR3_RUN' : '—', pumps >= 3 ? 'Pump 3 contactor' : 'Spare'],
    [
      'R4',
      'Relay out 4',
      'BOOL',
      'R4',
      'R4',
      opts.alarmDetail || 'Station alarm relay (horn, strobe, or SCADA contact)',
    ],
  ];
}

function baseDigitalSpareRows() {
  return [
    ['I7', 'Digital in 7', 'BOOL', 'I7', '—', 'Spare (I1–I6 used as analog CT inputs)'],
    ['I8', 'Digital in 8', 'BOOL', 'I8', '—', 'Spare digital'],
  ];
}

function baseAnalogRows(opts = {}) {
  const pumps = opts.pumps || 2;
  const ctCount = opts.ctCount ?? (pumps >= 2 ? 6 : pumps === 1 ? 3 : 0);
  const rows = [];
  if (ctCount === 2) {
    rows.push(
      ['AI1 / I1', 'Analog in 1', 'REAL', 'I1_RAW', 'AI1', 'Pump CT 1 (0–50 A)'],
      ['AI2 / I2', 'Analog in 2', 'REAL', 'I2_RAW', 'AI2', 'Pump CT 2 (0–50 A)'],
    );
  } else {
    if (pumps >= 1 && ctCount >= 3) {
      rows.push(
        ['AI1 / I1', 'Analog in 1', 'REAL', 'I1_RAW', 'AI1', 'Motor 1 phase A amps'],
        ['AI2 / I2', 'Analog in 2', 'REAL', 'I2_RAW', 'AI2', 'Motor 1 phase B amps'],
        ['AI3 / I3', 'Analog in 3', 'REAL', 'I3_RAW', 'AI3', 'Motor 1 phase C amps'],
      );
    }
    if (pumps >= 2) {
      rows.push(
        ['AI4 / I4', 'Analog in 4', 'REAL', 'I4_RAW', 'AI4', 'Motor 2 phase A amps'],
        ['AI5 / I5', 'Analog in 5', 'REAL', 'I5_RAW', 'AI5', 'Motor 2 phase B amps'],
        ['AI6 / I6', 'Analog in 6', 'REAL', 'I6_RAW', 'AI6', 'Motor 2 phase C amps'],
      );
    }
  }
  if (ctCount !== 2) {
    rows.push(
      ['I7_RAW', 'Analog raw 7', 'INT', 'I7_RAW', '—', 'Spare raw (if I7 configured analog)'],
      ['I8_RAW', 'Analog raw 8', 'INT', 'I8_RAW', '—', 'Spare raw (if I8 configured analog)'],
    );
  }
  if (pumps >= 3) {
    rows.push(['—', '—', '—', '—', '—', 'Pump 3 CTs: expansion analog or spare (not base I1–I6)']);
  }
  return rows;
}

/** Simplex: floats and faults on base digital I3–I8 (I1–I2 = CT analog). */
function simplexBaseDigitalRows() {
  return [
    ['I3', 'Digital in 3', 'BOOL', 'I3', 'LVL_START', 'Start float — wet = call pump'],
    ['I4', 'Digital in 4', 'BOOL', 'I4', 'LVL_STOP', 'Stop float — dry = stop pump'],
    ['I5', 'Digital in 5', 'BOOL', 'I5', 'LVL_HIGH', 'High level alarm float'],
    ['I6', 'Digital in 6', 'BOOL', 'I6', 'LVL_LO', 'Low level alarm float'],
    ['I7', 'Digital in 7', 'BOOL', 'I7', 'PUMP_FAIL', 'Pump fault / overload contact'],
    ['I8', 'Digital in 8', 'BOOL', 'I8', 'P1_RUN_FB', 'Run feedback (optional fail-to-run)'],
  ];
}

function expansionRelaySpareRows() {
  return [
    ['X1_R1', 'Relay out 1', 'BOOL', 'X1_R1', '—', 'Spare (pump contactors on base R1–R3)'],
    ['X1_R2', 'Relay out 2', 'BOOL', 'X1_R2', '—', 'Spare'],
    ['X1_R3', 'Relay out 3', 'BOOL', 'X1_R3', '—', 'Spare'],
    ['X1_R4', 'Relay out 4', 'BOOL', 'X1_R4', '—', 'Spare'],
    ['X1_R5', 'Relay out 5', 'BOOL', 'X1_R5', '—', 'Spare'],
    ['X1_R6', 'Relay out 6', 'BOOL', 'X1_R6', '—', 'Spare'],
    ['X1_R7', 'Relay out 7', 'BOOL', 'X1_R7', '—', 'Spare'],
    ['X1_R8', 'Relay out 8', 'BOOL', 'X1_R8', '—', 'Spare'],
  ];
}

function a0602Rows(opts = {}) {
  const pumps = opts.pumps || 2;
  const rtd = opts.rtdsEnabled !== false;
  const rtdNote = rtd
    ? '2-wire PT100 °C (Opta /setup → A0602 RTD enable, pinRtd)'
    : '0–10 V / 4–20 mA transmitter — cal in Tags';
  return [
    ['X2_AI1', 'Analog 1', 'REAL', 'X2_AI1', pumps >= 1 ? 'MOTOR1_TEMP' : '—', pumps >= 1 ? `Motor 1 winding temp — ${rtdNote}` : 'Spare'],
    ['X2_AI2', 'Analog 2', 'REAL', 'X2_AI2', pumps >= 2 ? 'MOTOR2_TEMP' : '—', pumps >= 2 ? `Motor 2 winding temp — ${rtdNote}` : 'Spare'],
    ['X2_AI3', 'Analog 3', 'REAL', 'X2_AI3', pumps >= 3 ? 'MOTOR3_TEMP' : 'RTD3_TEMP', pumps >= 3 ? `Motor 3 winding temp — ${rtdNote}` : `Spare RTD — ${rtdNote}`],
    ['X2_AI4', 'Analog 4', 'REAL', 'X2_AI4', 'RTD4_TEMP', `Spare RTD — ${rtdNote}`],
    ['X2_AI5', 'Analog 5', 'REAL', 'X2_AI5', 'RTD5_TEMP', `Spare RTD — ${rtdNote}`],
    ['X2_AI6', 'Analog 6', 'REAL', 'X2_AI6', 'RTD6_TEMP', `Spare RTD — ${rtdNote}`],
    ['X2_AI7', 'Analog 7', 'REAL', 'X2_AI7', 'RTD7_TEMP', `Spare RTD — ${rtdNote}`],
    ['X2_AI8', 'Analog 8', 'REAL', 'X2_AI8', 'RTD8_TEMP', `Spare RTD — ${rtdNote}`],
  ];
}

function a0602PwmRows() {
  return [
    ['X2_PWM1', 'PWM 1', 'REAL', 'X2_PWM1', '—', 'Spare'],
    ['X2_PWM2', 'PWM 2', 'REAL', 'X2_PWM2', '—', 'Spare'],
    ['X2_PWM3', 'PWM 3', 'REAL', 'X2_PWM3', '—', 'Spare'],
    ['X2_PWM4', 'PWM 4', 'REAL', 'X2_PWM4', '—', 'Spare'],
  ];
}

function standardHardware(includeExpansion = true) {
  const hw = [
    'Arduino Opta (base I1–I8 digital, I1–I6 analog, R1–R4 relay, RS485)',
  ];
  if (includeExpansion) {
    hw.push('Sequent D1608E digital expansion — slot 1 (X1_I1…X1_I16, X1_R1…X1_R8)');
    hw.push('Sequent A0602 analog expansion — slot 2 optional (X2_AI1…X2_AI8 as 8× 2-wire PT100 RTD when enabled, X2_PWM1…X2_PWM4)');
  }
  return hw;
}

function ctWiringNotes() {
  return [
    'Analog I1–I6: 0–1 V CT transmitters, linear 0–50 A (1.00 V = 50 A). Engineering tag = raw × 0.48828125.',
    'Expansion DIs (+24 V active): input ON when float wet, run aux made, or fault contact active. Unwired inputs read OFF.',
    'Run feedback and fault inputs: +24 V active (input ON when aux made or fault contact active).',
  ];
}

function buildBaseSections(opts) {
  const sections = [
    { title: 'Opta base — relay outputs', rows: baseRelayRows(opts) },
  ];
  if (opts.ctCount === 2) {
    sections.push(
      { title: 'Opta base — digital inputs', rows: simplexBaseDigitalRows() },
      { title: 'Opta base — analog inputs (2× CT 0–50 A)', rows: baseAnalogRows(opts) },
    );
  } else {
    sections.push(
      { title: 'Opta base — digital inputs (spare)', rows: baseDigitalSpareRows() },
      { title: 'Opta base — analog inputs (CT 0–50 A)', rows: baseAnalogRows(opts) },
    );
  }
  return sections;
}

function buildExpansionTailSections(opts) {
  const sections = [];
  if (opts.includeExpansion !== false) {
    sections.push(
      { title: 'Expansion slot 1 — Sequent D1608E relay outputs (spare)', rows: expansionRelaySpareRows() },
      { title: 'Expansion slot 2 — Sequent A0602 analog (optional RTD)', rows: a0602Rows(opts) },
      { title: 'Expansion slot 2 — Sequent A0602 PWM outputs (spare)', rows: a0602PwmRows() },
    );
  }
  return sections;
}

module.exports = {
  baseRelayRows,
  baseDigitalSpareRows,
  simplexBaseDigitalRows,
  baseAnalogRows,
  expansionRelaySpareRows,
  a0602Rows,
  a0602PwmRows,
  standardHardware,
  ctWiringNotes,
  buildBaseSections,
  buildExpansionTailSections,
};
