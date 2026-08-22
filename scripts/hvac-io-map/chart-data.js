'use strict';

/**
 * HVAC Opta I/O comparison — five configs (one unit per column where applicable).
 * Fac.* = Opta + D1608E · Split unit = res/com base Opta only.
 */

const CHART_COLUMNS = [
  { key: 'ahu', label: 'Fac. AHU', hardware: 'Opta + D1608E' },
  { key: 'cond', label: 'Fac. cond', hardware: 'Opta + D1608E' },
  { key: 'rtu', label: 'RTU', hardware: 'Opta + D1608E' },
  { key: 'splitAhu', label: 'Split unit AHU', hardware: 'Res/com · base Opta' },
  { key: 'splitCond', label: 'Split unit cond', hardware: 'Res/com · base Opta' },
];

const PIN_ROWS = [
  {
    fn: 'Supply / blower start CT',
    ahu: 'I1',
    cond: '—',
    rtu: 'I1',
    splitAhu: 'I1',
    splitCond: '—',
  },
  {
    fn: 'Supply / blower run CT',
    ahu: 'I2',
    cond: '—',
    rtu: 'I2',
    splitAhu: 'I2',
    splitCond: '—',
  },
  {
    fn: 'Condenser fan start CT',
    ahu: '—',
    cond: 'I1',
    rtu: 'I3',
    splitAhu: '—',
    splitCond: 'I1',
  },
  {
    fn: 'Condenser fan run CT',
    ahu: '—',
    cond: 'I2',
    rtu: 'I4',
    splitAhu: '—',
    splitCond: 'I2',
  },
  {
    fn: 'Compressor start CT',
    ahu: '—',
    cond: 'I5',
    rtu: 'I5',
    splitAhu: '—',
    splitCond: 'I3',
  },
  {
    fn: 'Compressor run CT',
    ahu: '—',
    cond: 'I6',
    rtu: 'I6',
    splitAhu: '—',
    splitCond: 'I4',
  },
  {
    fn: 'Supply air NTC',
    ahu: 'I5',
    cond: '—',
    rtu: 'X1_IRAW3',
    splitAhu: 'I3',
    splitCond: '—',
  },
  {
    fn: 'Return air NTC',
    ahu: 'I6',
    cond: '—',
    rtu: 'X1_IRAW4',
    splitAhu: 'I4',
    splitCond: '—',
  },
  {
    fn: 'Refrigerant low-side NTC',
    ahu: '—',
    cond: 'X1_IRAW1',
    rtu: 'X1_IRAW1',
    splitAhu: '—',
    splitCond: 'I5',
  },
  {
    fn: 'Refrigerant high-side NTC',
    ahu: '—',
    cond: 'X1_IRAW2',
    rtu: 'X1_IRAW2',
    splitAhu: '—',
    splitCond: 'I6',
  },
  {
    fn: 'Pan leak (analog mV)',
    ahu: 'X1_IRAW1',
    cond: '—',
    rtu: 'X1_IRAW5',
    splitAhu: 'I5',
    splitCond: '—',
  },
  {
    fn: 'Commissioning',
    ahu: '/ct-cal + /ahu-env',
    cond: '/mcsa',
    rtu: '/mcsa + /ahu-env',
    splitAhu: '/mcsa + /ahu-env',
    splitCond: '/mcsa',
  },
  {
    fn: 'MooreVIEW driver',
    ahu: 'opta_ahu',
    cond: 'opta_cond',
    rtu: 'opta_rtu',
    splitAhu: 'opta_split_ahu',
    splitCond: 'opta_split_cond',
  },
  {
    fn: 'Default MQTT device ID',
    ahu: 'hvac_ahu_01',
    cond: 'hvac_cond_01',
    rtu: 'hvac_rtu_01',
    splitAhu: 'hvac_split_ahu_01',
    splitCond: 'hvac_split_cond_01',
  },
];

const DUAL_STACK_ROWS = [
  {
    board: 'Dual AHU — 1× Opta + D1608E',
    u1: 'I1/I2 CT · I5/I6 NTC · X1_IRAW1 leak',
    u2: 'I3/I4 CT · I7/I8 NTC · X1_IRAW2 leak',
  },
  {
    board: 'Dual cond — 1× Opta + D1608E',
    u1: 'I1/I2 fan CT · I5/I6 comp CT · X1_IRAW1/2 NTC',
    u2: 'I3/I4 fan CT · I7/I8 comp CT · X1_IRAW3/4 NTC',
  },
  {
    board: 'RTU — 1× Opta + D1608E',
    u1: 'I1–I6 CT + X1_IRAW1–5 (single rooftop)',
    u2: '—',
  },
  {
    board: 'Split unit AHU — res/com · base Opta',
    u1: 'I1/I2 blower CT · I3/I4 NTC · I5 leak',
    u2: '—',
  },
  {
    board: 'Split unit cond — res/com · base Opta',
    u1: 'I1–I4 fan/comp CT · I5/I6 NTC',
    u2: '—',
  },
];

const NOTES = [
  'Facility + RTU: Opta + D1608E expansion. Split unit (res/com): base Opta analog I1–I8 only (no D1608E).',
  'All motor CT: single-phase with start cap (1P+cap, MCSA). Pan leak: analog mV on /ahu-env (never digital DI).',
  'Facility IoT-Link: 2 Optas (dual AHU + dual cond) + IoT-Link + EZ Meter.',
  'Split unit templates: hvac-split-unit-ahu · hvac-split-unit-cond (1 Opta each).',
];

/** Base Opta I1–I8 assignment per config (one logical unit). */
const BASE_PIN_GRID = [
  { pin: 'I1', ahu: 'Fan start CT', cond: 'Fan start CT', rtu: 'Blower start CT', splitAhu: 'Blower start CT', splitCond: 'Fan start CT' },
  { pin: 'I2', ahu: 'Fan run CT', cond: 'Fan run CT', rtu: 'Blower run CT', splitAhu: 'Blower run CT', splitCond: 'Fan run CT' },
  { pin: 'I3', ahu: '—', cond: '—', rtu: 'Fan start CT', splitAhu: 'Supply NTC', splitCond: 'Comp start CT' },
  { pin: 'I4', ahu: '—', cond: '—', rtu: 'Fan run CT', splitAhu: 'Return NTC', splitCond: 'Comp run CT' },
  { pin: 'I5', ahu: 'Supply NTC', cond: 'Comp start CT', rtu: 'Comp start CT', splitAhu: 'Pan leak (mV)', splitCond: 'Lo-side NTC' },
  { pin: 'I6', ahu: 'Return NTC', cond: 'Comp run CT', rtu: 'Comp run CT', splitAhu: '—', splitCond: 'Hi-side NTC' },
  { pin: 'I7', ahu: '—', cond: '—', rtu: '—', splitAhu: '—', splitCond: '—' },
  { pin: 'I8', ahu: '—', cond: '—', rtu: '—', splitAhu: '—', splitCond: '—' },
];

/** D1608E X1_IRAW1–5 (facility / RTU; split unit = none). */
const EXPANSION_PIN_GRID = [
  { pin: 'X1_IRAW1', ahu: 'Pan leak (mV)', cond: 'Lo-side NTC', rtu: 'Lo-side NTC', splitAhu: '—', splitCond: '—' },
  { pin: 'X1_IRAW2', ahu: '—', cond: 'Hi-side NTC', rtu: 'Hi-side NTC', splitAhu: '—', splitCond: '—' },
  { pin: 'X1_IRAW3', ahu: '—', cond: '—', rtu: 'Supply NTC', splitAhu: '—', splitCond: '—' },
  { pin: 'X1_IRAW4', ahu: '—', cond: '—', rtu: 'Return NTC', splitAhu: '—', splitCond: '—' },
  { pin: 'X1_IRAW5', ahu: '—', cond: '—', rtu: 'Pan leak (mV)', splitAhu: '—', splitCond: '—' },
];

const CHART_TITLE = 'HVAC Opta I/O Pin Chart — 5 Configs';

/** @param {string} key */
function pinTableRow(key) {
  return PIN_ROWS.map((r) => r[key]);
}

module.exports = {
  CHART_TITLE,
  CHART_COLUMNS,
  PIN_ROWS,
  BASE_PIN_GRID,
  EXPANSION_PIN_GRID,
  DUAL_STACK_ROWS,
  NOTES,
  pinTableRow,
};
