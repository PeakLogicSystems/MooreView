'use strict';

/**
 * Manufacturing I/O map data — hvac-opta-parc configs A–D.
 * All fan and compressor MCSA: single-phase with start capacitor (1P+cap).
 */

const {
  HVAC_CFG,
  CONFIG_META,
  PROJECT,
  OPTA_DEVICE_ID,
  OPTA_DEVICE_ID_2,
} = require('./project-data');

const PROJECT_NAME = PROJECT.name;
const PROGRAM = PROJECT.programFile;
const FIRMWARE = PROJECT.commissioning.firmware;

const MCSA_1P_CAP = {
  wiring: '1P + start cap (MV_MOTOR_WIRE_1P_CAP)',
  edgeModel: 'single-phase-start-v1',
  note: 'Run CT on line/run terminal; start-winding CT on start cap branch. End-of-start = start CT current drops.',
};

const MCSA_SETUP_B_D = [
  'Open http://<opta-ip>/mcsa (or /hvac alias)',
  'Enable MCSA monitor; I/O layout = HVAC',
  'deviceType = 5 (all loads) or compressor + fan classes',
  'Set each motor wiring to 1P + start cap (not plain 1P)',
  'Compressor: assetId compressor, run CT on I1',
  'Condenser fan: assetId fan, run CT on I2',
  'M4 edge AI uses single-phase-start-v1 for start-cap health',
  'Save → Reboot; verify COMP_FLT / FAN_FLT and mcsa[] telemetry',
];

const SHARED_HARDWARE = [
  'Arduino Opta WiFi (AFX00001) — flash MooreviewOptaMqttSt v2.3.81+ (M7 + M4 MCSA)',
  '24 VDC field supply — leak DI pull-ups and NTC dividers',
  '0–1 V DC CT on run and start-winding branches (1P+cap motors)',
  '10K NTC thermistors — Opta 24 VDC divider',
  'Spot leak detectors — dry contact to +24 V',
];

const SHARED_WIRING = [
  'All monitored fans and compressors: single-phase with start capacitor (1P+cap).',
  `${MCSA_1P_CAP.wiring} · Edge model ${MCSA_1P_CAP.edgeModel}.`,
  'Digital inputs: +24 VDC active (contact closed = ON).',
  'CT inputs: 0–10 V ADC; use 0–1 V CT transmitters on run and start CTs.',
  'NTC: 24 V → 10K NTC → analog in → 10K to GND.',
  'Set HVAC_CFG tag (0–3) before field test.',
];

const WIFI_MFG = [
  'Enable WiFi AP on http://<opta-ip>/setup or http://192.168.4.1:8080/setup',
  'Default AP SSID: MooreVIEW-Opta (password ≥ 8 chars)',
  'Pages: /setup, /mcsa, /api/status',
  'MQTT test → mooreview/v1/{deviceId}/setup-test',
  'MQTT password ≤ 47 characters',
];

const ioRow = (terminal, point, wiring, tag, desc) => [terminal, point, wiring, tag, desc];
const motorRow = (motor, wiring, runCt, startCt, tag, desc) => [
  motor, wiring, runCt, startCt || '—', tag, desc,
];

function configA() {
  return {
    cfg: HVAC_CFG.AHU_SINGLE,
    letter: 'A',
    ...CONFIG_META[HVAC_CFG.AHU_SINGLE],
    project: `${PROJECT_NAME} — Config A (HVAC_CFG=0)`,
    program: PROGRAM,
    template: 'arduino_opta_parc',
    deviceIds: [OPTA_DEVICE_ID],
    mcsaSetup: null,
    hardware: [
      SHARED_HARDWARE[0],
      'Base Opta only — blower 1P+cap (run + start CT)',
    ],
    wiringNotes: [
      ...SHARED_WIRING,
      'Blower run CT → I2; start-winding CT → I3 (same 1P+cap motor).',
      'I1 pan leak (digital). I4 safety switch (NC). I6/I7 supply and return NTC.',
    ],
    mfgChecklist: [
      'Flash firmware v2.3.81+; label device ID',
      'Set HVAC_CFG=0',
      'Wire blower run CT I2, start CT I3, leak I1, safety I4, NTC I6/I7',
      'Calibrate NTC; verify AHU1_FAN_AMPS and AHU1_START_AMPS',
      'Test leak and CT overload alarms',
    ],
    sections: [
      {
        title: 'Digital inputs',
        rows: [
          ioRow('I1', 'DI', 'NC +24V', 'AHU1_PAN_LEAK', 'Pan spot leak'),
          ioRow('I4', 'DI', 'NC +24V', 'AHU1_SAFETY_SW', 'HVAC safety switch'),
        ],
      },
      {
        title: 'Blower — 1P + start cap CTs',
        rows: [
          motorRow('Blower', '1P+cap', 'I2', 'I3', 'AHU1_FAN_AMPS / AHU1_START_AMPS', 'Run CT I2 · start CT I3'),
        ],
      },
      {
        title: 'Temperature (NTC)',
        rows: [
          ioRow('I6', 'AI', '—', 'AHU1_SUPPLY_TEMP_F', 'Supply air'),
          ioRow('I7', 'AI', '—', 'AHU1_RETURN_TEMP_F', 'Return air'),
        ],
      },
      {
        title: 'Relay outputs',
        rows: [
          ioRow('R1', 'DO', '—', 'R1', 'AHU alarm'),
          ioRow('R3', 'DO', '—', 'R3', 'Site OK'),
        ],
      },
    ],
  };
}

function configB() {
  return {
    cfg: HVAC_CFG.COND_SINGLE,
    letter: 'B',
    ...CONFIG_META[HVAC_CFG.COND_SINGLE],
    project: `${PROJECT_NAME} — Config B (HVAC_CFG=1)`,
    program: PROGRAM,
    template: 'arduino_opta_mcsa_monitor',
    deviceIds: [OPTA_DEVICE_ID],
    mcsaSetup: MCSA_SETUP_B_D,
    hardware: [
      SHARED_HARDWARE[0],
      'Base Opta — MCSA HVAC layout',
      'Compressor + condenser fan: both 1P+cap',
    ],
    wiringNotes: [
      ...SHARED_WIRING,
      ...MCSA_SETUP_B_D.slice(0, 4),
      'I1 = compressor run CT (COMP_AMPS, COMP_FLT)',
      'I2 = condenser fan run CT (FAN_AMPS, FAN_FLT)',
      'Start-cap health from run CT waveform + M4 edge AI (single-phase-start-v1)',
      'I3/I4 NTC = high / low side refrigerant temps',
    ],
    mfgChecklist: [
      'Set HVAC_CFG=1; configure /mcsa per MCSA setup list',
      'Wire comp run CT I1, fan run CT I2, NTC I3/I4',
      'Verify COMP_FLT, FAN_FLT, T1_C, T2_C in telemetry',
      'Confirm mcsa[] shows compressor and fan load groups',
    ],
    sections: [
      {
        title: 'MCSA motors — 1P + start cap (run CT)',
        rows: [
          motorRow('Compressor', '1P+cap', 'I1', '—', 'COND1_COMP_AMPS', 'Run CT → COMP_AMPS / COMP_FLT'),
          motorRow('Cond. fan', '1P+cap', 'I2', '—', 'COND1_FAN_AMPS', 'Run CT → FAN_AMPS / FAN_FLT'),
        ],
      },
      {
        title: 'Thermistors',
        rows: [
          ioRow('I3', 'NTC', '—', 'COND1_HI_TEMP_F', 'High side T1_C'),
          ioRow('I4', 'NTC', '—', 'COND1_LO_TEMP_F', 'Low side T2_C'),
        ],
      },
      {
        title: '/mcsa configuration',
        rows: MCSA_SETUP_B_D.map((step, i) => [
          String(i + 1), 'Setup', '1P+cap', '—', step,
        ]),
      },
    ],
  };
}

function configC() {
  return {
    cfg: HVAC_CFG.AHU_DUAL,
    letter: 'C',
    ...CONFIG_META[HVAC_CFG.AHU_DUAL],
    project: `${PROJECT_NAME} — Config C (HVAC_CFG=2)`,
    program: PROGRAM,
    template: 'arduino_opta_parc',
    deviceIds: [OPTA_DEVICE_ID],
    mcsaSetup: null,
    hardware: [
      ...SHARED_HARDWARE.slice(0, 2),
      'D1608E (AFX00005) slot 1 — second leak DI',
    ],
    wiringNotes: [
      ...SHARED_WIRING,
      'Each blower 1P+cap — run CT only on I2 (AHU1) and I3 (AHU2) in this layout.',
      'AHU1 leak I1; AHU2 leak X1_I1 on D1608E.',
      'Safety switches X1_I2 (AHU1) and X1_I3 (AHU2) — NC +24 V.',
      'Four NTC: I6/I7 AHU1 supply/return; I8/I4 AHU2 supply/return.',
    ],
    mfgChecklist: [
      'Mount D1608E; scan on /setup',
      'Set HVAC_CFG=2',
      'Wire run CTs on I2 and I3 for 1P+cap blowers',
      'Wire leaks, safety switches, and four NTCs; test each AHU alarm',
    ],
    sections: [
      {
        title: 'Digital — leak & safety',
        rows: [
          ioRow('I1', 'DI', 'NC +24V', 'AHU1_PAN_LEAK', 'AHU 1 pan leak'),
          ioRow('X1_I1', 'DI', 'NC +24V', 'AHU2_PAN_LEAK', 'AHU 2 pan leak (D1608E)'),
          ioRow('X1_I2', 'DI', 'NC +24V', 'AHU1_SAFETY_SW', 'AHU 1 safety switch'),
          ioRow('X1_I3', 'DI', 'NC +24V', 'AHU2_SAFETY_SW', 'AHU 2 safety switch'),
        ],
      },
      {
        title: 'Blowers — 1P + start cap (run CT each)',
        rows: [
          motorRow('AHU 1 blower', '1P+cap', 'I2', '—', 'AHU1_FAN_AMPS', 'Run CT'),
          motorRow('AHU 2 blower', '1P+cap', 'I3', '—', 'AHU2_FAN_AMPS', 'Run CT'),
        ],
      },
      {
        title: 'Temperature (NTC)',
        rows: [
          ioRow('I6', 'AI', '—', 'AHU1_SUPPLY_TEMP_F', 'AHU 1 supply'),
          ioRow('I7', 'AI', '—', 'AHU1_RETURN_TEMP_F', 'AHU 1 return'),
          ioRow('I8', 'AI', '—', 'AHU2_SUPPLY_TEMP_F', 'AHU 2 supply'),
          ioRow('I4', 'AI', '—', 'AHU2_RETURN_TEMP_F', 'AHU 2 return'),
        ],
      },
    ],
  };
}

function configD() {
  return {
    cfg: HVAC_CFG.COND_DUAL,
    letter: 'D',
    ...CONFIG_META[HVAC_CFG.COND_DUAL],
    project: `${PROJECT_NAME} — Config D (HVAC_CFG=3)`,
    program: PROGRAM,
    template: 'arduino_opta_mcsa_monitor',
    deviceIds: [OPTA_DEVICE_ID, OPTA_DEVICE_ID_2],
    mcsaSetup: MCSA_SETUP_B_D,
    hardware: [
      'Primary + secondary Opta — each MCSA HVAC',
      'Primary D1608E — condenser 2 lockout DI',
      'Each unit: compressor + fan 1P+cap',
      ...SHARED_HARDWARE.slice(2),
    ],
    wiringNotes: [
      ...SHARED_WIRING,
      'Repeat MCSA HVAC wiring on each Opta (unique device ID).',
      'Per unit: I1 comp run CT, I2 fan run CT, I3/I4 hi/lo NTC.',
      'Primary X1_I1/X1_I2 = condenser 2 lockout / shutdown.',
    ],
    mfgChecklist: [
      'Flash both Optas; unique device IDs',
      'Set HVAC_CFG=3; /mcsa 1P+cap on both units',
      'Enable opta_hvac_02 driver in MooreVIEW',
      'Verify COND1_* and COND2_* MCSA faults independently',
    ],
    sections: [
      {
        title: 'Condenser 1 — primary Opta (1P+cap motors)',
        rows: [
          motorRow('Compressor', '1P+cap', 'I1', '—', 'COND1_COMP_AMPS', 'Run CT'),
          motorRow('Cond. fan', '1P+cap', 'I2', '—', 'COND1_FAN_AMPS', 'Run CT'),
          ioRow('I3', 'NTC', '—', 'COND1_HI_TEMP_F', 'High side'),
          ioRow('I4', 'NTC', '—', 'COND1_LO_TEMP_F', 'Low side'),
        ],
      },
      {
        title: 'Condenser 2 — secondary Opta (1P+cap motors)',
        rows: [
          motorRow('Compressor', '1P+cap', 'I1', '—', 'COND2_COMP_AMPS', 'Run CT'),
          motorRow('Cond. fan', '1P+cap', 'I2', '—', 'COND2_FAN_AMPS', 'Run CT'),
          ioRow('I3', 'NTC', '—', 'COND2_HI_TEMP_F', 'High side'),
          ioRow('I4', 'NTC', '—', 'COND2_LO_TEMP_F', 'Low side'),
        ],
      },
      {
        title: 'Primary D1608E — interlocks',
        rows: [
          ioRow('X1_I1', 'DI', '—', 'COND2_LOCKOUT', 'Condenser 2 lockout'),
          ioRow('X1_I2', 'DI', '—', 'COND2_SHUTDOWN', 'Optional shutdown'),
        ],
      },
    ],
  };
}

function configMatrixRows() {
  return [
    HVAC_CFG.AHU_SINGLE,
    HVAC_CFG.COND_SINGLE,
    HVAC_CFG.AHU_DUAL,
    HVAC_CFG.COND_DUAL,
  ].map((hvacCfg) => {
    const m = CONFIG_META[hvacCfg];
    return {
      letter: m.id,
      hvacCfg,
      label: m.label,
      hardware: m.hardware,
      expansion: m.expansion || '—',
      mcsa: m.mcsaLayout === 'HVAC' ? 'HVAC' : m.mcsaLayout ? 'Yes' : '—',
      mcsaWiring: m.mcsaWiring || '—',
      devices: m.id === 'D' ? '2× Opta' : '1× Opta',
    };
  });
}

function allConfigs() {
  return [configA(), configB(), configC(), configD()];
}

function getConfig(letter) {
  const map = { A: configA, B: configB, C: configC, D: configD };
  const fn = map[String(letter || '').toUpperCase()];
  if (!fn) throw new Error(`Unknown config "${letter}". Use A, B, C, or D.`);
  return fn();
}

module.exports = {
  PROJECT_NAME,
  PROGRAM,
  FIRMWARE,
  MCSA_1P_CAP,
  MCSA_SETUP_B_D,
  WIFI_MFG,
  SHARED_HARDWARE,
  SHARED_WIRING,
  configMatrixRows,
  allConfigs,
  getConfig,
};
