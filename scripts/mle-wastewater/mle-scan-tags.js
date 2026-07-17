'use strict';

/** MooreVIEW tags for s::can recirculating analyzer + MLE AI tags. */
const { getAllScanTags } = require('./scan-instrumentation');
const { getProjectConfig } = require('./project-configs');

function makeTag(id, label, type = 'REAL', role = 'input', opts = {}) {
  return {
    id,
    label,
    type,
    role,
    driverId: null,
    driverAddress: null,
    default: 0,
    scale: 1,
    offset: 0,
    alarmsEnabled: type === 'REAL',
    alarmOuterLow: opts.alarmOuterLow ?? null,
    alarmInnerLow: opts.alarmInnerLow ?? null,
    alarmInnerHigh: opts.alarmInnerHigh ?? (type === 'REAL' && id.includes('NO3') ? 10 : null),
    alarmOuterHigh: opts.alarmOuterHigh ?? null,
    alarmCondition: null,
    readonly: false,
    preset: 0,
    mode: 'TON',
    arrayLen: 1,
    value: 0,
    quality: 'GOOD',
    wordWidth: 16,
    signed: true,
    forceInput: false,
    forceOutput: false,
    graphEnabled: true,
    dirty: false,
    alarmLevel: null,
    fb: {},
  };
}

function buildScanTags(cfg) {
  const labels = {
    INF_BOD: 'Influent BOD (s::can)',
    INF_COD: 'Influent COD (s::can)',
    INF_TSS: 'Influent TSS (s::can)',
    INF_NH3: 'Influent NH3-N (s::can)',
    INF_PH: 'Influent pH (s::can)',
    INF_SAC254: 'Influent UV254 SAC',
    ANOX_NO3: 'Anoxic NO3-N',
    ANOX_ORP: 'Anoxic ORP',
    ANOX_PH: 'Anoxic pH',
    ANOX_TSS: 'Anoxic TSS',
    ANOX_COD: 'Anoxic COD proxy',
    T1_ANOX_NO3: 'T1 anoxic NO3-N',
    T1_ANOX_ORP: 'T1 anoxic ORP',
    T1_ANOX_PH: 'T1 anoxic pH',
    T1_ANOX_TSS: 'T1 anoxic TSS',
    T1_ANOX_COD: 'T1 anoxic COD',
    T2_ANOX_NO3: 'T2 anoxic NO3-N',
    T2_ANOX_ORP: 'T2 anoxic ORP',
    T2_ANOX_PH: 'T2 anoxic pH',
    T2_ANOX_TSS: 'T2 anoxic TSS',
    T2_ANOX_COD: 'T2 anoxic COD',
    IR_NO3: 'IR stream NO3-N',
    IR_PH: 'IR stream pH',
    AER_NH3: 'Aerobic NH3-N',
    AER_PH: 'Aerobic pH',
    AER_TSS: 'Aerobic TSS',
    AER_DO: 'Aerobic DO (dedicated)',
    EFF_BOD: 'Effluent BOD',
    EFF_NO3: 'Effluent NO3-N',
    EFF_NH3: 'Effluent NH3-N',
    EFF_TSS: 'Effluent TSS',
    EFF_PH: 'Effluent pH',
    SCAN_RUN: 's::can scan pump run',
    SCAN_FAULT: 's::can system fault',
    SCAN_ACTIVE_PORT: 's::can active port #',
    SCAN_DWELL_MIN: 's::can port dwell min',
    INF_BOD_TKN: 'Influent BOD:TKN ratio',
    AI_IR_SP: 'AI suggested IR ratio',
    AI_WAS_SP: 'AI suggested WAS rate',
    AI_DO_SP: 'AI suggested DO setpoint',
    AI_AUTO: 'AI control auto mode',
    AI_CARBON_LIM: 'AI carbon limited flag',
    FLOW_GPM: 'Plant flow GPM',
    FLOW_GPD: 'Plant flow GPD',
  };
  return getAllScanTags(cfg).map((id) => makeTag(id, labels[id] || id, id === 'SCAN_FAULT' || id === 'AI_AUTO' || id === 'AI_CARBON_LIM' ? 'BOOL' : 'REAL', id.startsWith('AI_') ? 'memory' : 'input'));
}

module.exports = { makeTag, buildScanTags, getProjectConfig };
