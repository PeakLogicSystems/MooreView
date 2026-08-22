'use strict';

/**
 * Unified Opta physical I/O maps — simplex, duplex, triplex lift stations.
 * Used by build-lift-station-io-map-pdf.js and docs/projects/LIFT-STATION-OPTA-IO-MAP.md
 */

const shared = require('./opta-io-map-shared');

const VARIANTS = {
  simplex: {
    id: 'simplex',
    project: 'Simplex Lift Station (SIMPLEXLS)',
    program: 'logic/35_lift_simplex.st',
    template: 'lift_station_simplex',
    pumps: 1,
    floats: 4,
    alternator: 'None',
    ezmeter: false,
    flashFlags: [],
    hardware: [
      'Arduino Opta base unit only (I1–I8, R1–R4) — no Sequent expansion',
      '2× 0–1 V CT transmitters on analog inputs I1 and I2',
      'Floats and fault contacts on digital inputs I3–I8',
    ],
    wiringNotes: [
      'Simplex panel: Opta base unit only — no D1608E or A0602 expansion.',
      'Analog I1–I2: 0–1 V CT transmitters, linear 0–50 A (1.00 V = 50 A). Tags AI1, AI2.',
      'Digital I3–I8: +24 V active when float wet or contact made.',
      'Program 35 uses logical tags — bind I3–I8 to LVL_START, LVL_STOP, LVL_HIGH, LVL_LO, PUMP_FAIL in Cloud Studio.',
      'R1 drives pump contactor (MOTOR1_RUN); R4 drives station alarm on ALT_FAULT.',
    ],
    sections: [
      ...shared.buildBaseSections({
        pumps: 1,
        ctCount: 2,
        alarmDetail: 'Station alarm ← ALT_FAULT (high/low level, pump fault)',
      }),
    ],
  },

  duplex: {
    id: 'duplex',
    project: 'Duplex Lift Station (DUPLEXLS)',
    program: 'logic/36_duplex_lift_station.st',
    template: 'lift_station_dual_duplex',
    pumps: 2,
    floats: 4,
    alternator: 'ALT2',
    ezmeter: false,
    flashFlags: ['MV_FIELDBUS=1'],
    hardware: shared.standardHardware(true),
    wiringNotes: [
      ...shared.ctWiringNotes(),
      'Relay outputs R1/R2 drive pump contactors; R4 drives station alarm on ALT_FAULT.',
      'Float DIs: HIGH (X1_I1) · LEAD (X1_I2) · LAG (X1_I3) · OFF (X1_I4).',
      'PHASE_FAULT (X1_I7) clears auto pump demand — same effect as dry OFF float while upper floats are on.',
      'R3 spare on duplex (triplex: R3 = pump 3 contactor).',
      'A0602 slot 2: wire 8× 2-wire PT100 RTDs; Opta /setup → enable **A0602 RTD** (values °C on X2_AI1–X2_AI8).',
      'Generator panels: control-panel UPS AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost). Tag **POWER_FAIL** — not facility power (use EZ Meter / **PHASE_FAULT**). Leave unwired on non-generator panels.',
    ],
    sections: [
      ...shared.buildBaseSections({
        pumps: 2,
        ezmeter: false,
        alarmDetail: 'Station alarm ← ALT_FAULT (alternator fault, fail-to-run)',
      }),
      {
        title: 'Expansion slot 1 — Sequent D1608E digital inputs',
        rows: [
          ['X1_I1', 'DI 1', 'BOOL', 'X1_I1', 'LVL_HIGH', 'High level float'],
          ['X1_I2', 'DI 2', 'BOOL', 'X1_I2', 'LVL_LEAD', 'Lead float'],
          ['X1_I3', 'DI 3', 'BOOL', 'X1_I3', 'LVL_LAG', 'Lag float'],
          ['X1_I4', 'DI 4', 'BOOL', 'X1_I4', 'LVL_OFF', 'Off float'],
          ['X1_I5', 'DI 5', 'BOOL', 'X1_I5', 'P1_RUN_FB', 'Pump 1 run feedback (fail-to-run)'],
          ['X1_I6', 'DI 6', 'BOOL', 'X1_I6', 'P2_RUN_FB', 'Pump 2 run feedback (fail-to-run)'],
          ['X1_I7', 'DI 7', 'BOOL', 'X1_I7', 'PHASE_FAULT', 'Phase fault'],
          ['X1_I8', 'DI 8', 'BOOL', 'X1_I8', 'GEN_RUN', 'Generator running'],
          ['X1_I9', 'DI 9', 'BOOL', 'X1_I9', 'GEN_FUEL_FAULT', 'Generator fuel fault'],
          ['X1_I10', 'DI 10', 'BOOL', 'X1_I10', 'GEN_FAULT', 'Generator fault'],
          ['X1_I11', 'DI 11', 'BOOL', 'X1_I11', '—', 'Spare'],
          ['X1_I12', 'DI 12', 'BOOL', 'X1_I12', '—', 'Spare'],
          ['X1_I13', 'DI 13', 'BOOL', 'X1_I13', '—', 'Spare'],
          ['X1_I14', 'DI 14', 'BOOL', 'X1_I14', '—', 'Spare'],
          ['X1_I15', 'DI 15', 'BOOL', 'X1_I15', '—', 'Spare'],
          ['X1_I16', 'DI 16', 'BOOL', 'X1_I16', 'POWER_FAIL', 'Control-panel AC loss — generator panels; UPS +24 V when AC to panel lost'],
        ],
      },
      ...shared.buildExpansionTailSections({ pumps: 2, rtdsEnabled: true }),
    ],
  },

  duplexEzmeter: {
    id: 'duplexEzmeter',
    project: 'Duplex Lift Station + EZ Meter (DUPLEXLS)',
    program: 'logic/38_duplex_lift_station_ezmeter.st',
    template: 'lift_station_dual_duplex_ezmeter',
    pumps: 2,
    floats: 4,
    alternator: 'ALT2',
    ezmeter: true,
    flashFlags: ['MV_FIELDBUS=1', 'MV_EZMETER=1'],
    hardware: [
      ...shared.standardHardware(true),
      'EZ Meter DDS-RGB on Opta RS485 (A/B, 9600 8N1, slave ID 1)',
    ],
    wiringNotes: [
      ...shared.ctWiringNotes(),
      'Relay outputs R1/R2 drive pump contactors; R4 drives station alarm horn/strobe (LVL_HIGH, MECH_PQ_ALM, motor fault DIs).',
      'EZ Meter DDS-RGB on Opta RS485. Flash with MV_FIELDBUS=1 MV_EZMETER=1.',
      'Float DIs: HIGH (X1_I1) · LEAD (X1_I2) · LAG (X1_I3) · OFF (X1_I4).',
      'PHASE_FAULT (X1_I7) clears auto pump demand in ST — same effect as dry off float while upper floats are on.',
      'A0602 slot 2: wire 8× 2-wire PT100 RTDs; Opta /setup → enable **A0602 RTD** (values °C on X2_AI1–X2_AI8).',
      'Generator panels: control-panel UPS AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost). Tag **POWER_FAIL** — not facility power (use EZ Meter / **PHASE_FAULT**). Leave unwired on non-generator panels.',
    ],
    sections: [
      ...shared.buildBaseSections({
        pumps: 2,
        ezmeter: true,
        alarmDetail: 'Station alarm (high level / EZ Meter PQ / motor fault)',
      }),
      {
        title: 'Expansion slot 1 — Sequent D1608E digital inputs',
        rows: [
          ['X1_I1', 'DI 1', 'BOOL', 'X1_I1', 'LVL_HIGH', 'High level float'],
          ['X1_I2', 'DI 2', 'BOOL', 'X1_I2', 'LVL_LEAD', 'Lead float'],
          ['X1_I3', 'DI 3', 'BOOL', 'X1_I3', 'LVL_LAG', 'Lag float'],
          ['X1_I4', 'DI 4', 'BOOL', 'X1_I4', 'LVL_OFF', 'Off float'],
          ['X1_I5', 'DI 5', 'BOOL', 'X1_I5', 'P1_RUN_FB', 'Pump 1 run feedback (fail-to-run)'],
          ['X1_I6', 'DI 6', 'BOOL', 'X1_I6', 'P2_RUN_FB', 'Pump 2 run feedback (fail-to-run)'],
          ['X1_I7', 'DI 7', 'BOOL', 'X1_I7', 'PHASE_FAULT', 'Phase fault'],
          ['X1_I8', 'DI 8', 'BOOL', 'X1_I8', 'GEN_RUN', 'Generator running'],
          ['X1_I9', 'DI 9', 'BOOL', 'X1_I9', 'GEN_FUEL_FAULT', 'Generator fuel fault'],
          ['X1_I10', 'DI 10', 'BOOL', 'X1_I10', 'GEN_FAULT', 'Generator fault'],
          ['X1_I11', 'DI 11', 'BOOL', 'X1_I11', 'MOTOR1_FAULT', 'Pump 1 motor fault → R4'],
          ['X1_I12', 'DI 12', 'BOOL', 'X1_I12', 'MOTOR2_FAULT', 'Pump 2 motor fault → R4'],
          ['X1_I13', 'DI 13', 'BOOL', 'X1_I13', '—', 'Spare'],
          ['X1_I14', 'DI 14', 'BOOL', 'X1_I14', '—', 'Spare'],
          ['X1_I15', 'DI 15', 'BOOL', 'X1_I15', '—', 'Spare'],
          ['X1_I16', 'DI 16', 'BOOL', 'X1_I16', 'POWER_FAIL', 'Control-panel AC loss — generator panels; UPS +24 V when AC to panel lost'],
        ],
      },
      ...shared.buildExpansionTailSections({ pumps: 2, rtdsEnabled: true }),
    ],
  },

  triplexEzmeter: {
    id: 'triplexEzmeter',
    project: 'Triplex Lift Station + EZ Meter (TRIPLEXLS)',
    program: 'logic/39_triplex_lift_station_ezmeter.st',
    template: 'lift_station_triplex_ezmeter',
    pumps: 3,
    floats: 5,
    alternator: 'ALT3',
    ezmeter: true,
    flashFlags: ['MV_FIELDBUS=1', 'MV_EZMETER=1'],
    hardware: [
      ...shared.standardHardware(true),
      'EZ Meter DDS-RGB on Opta RS485 (A/B, 9600 8N1, slave ID 1)',
    ],
    wiringNotes: [
      ...shared.ctWiringNotes(),
      'Relay outputs R1–R3 drive pump contactors; R4 drives station alarm (LVL_HIGH, MECH_PQ_ALM, motor faults).',
      'EZ Meter DDS-RGB on Opta RS485. Flash with MV_FIELDBUS=1 MV_EZMETER=1.',
      'Float DIs: HIGH (X1_I1) · LEAD (X1_I2) · LAG (X1_I3) · LAG2 (X1_I4) · OFF (X1_I5).',
      'PHASE_FAULT (X1_I9) clears auto pump demand in ST.',
      'A0602 slot 2: wire 8× 2-wire PT100 RTDs; Opta /setup → enable **A0602 RTD** (MOTOR1–3 on X2_AI1–3, RTD4–8 spare).',
      'Generator panels: control-panel UPS AC-loss dry contact → **X1_I16** (+24 V when AC to panel lost). Tag **POWER_FAIL** — not facility power (use EZ Meter / **PHASE_FAULT**). Leave unwired on non-generator panels.',
    ],
    sections: [
      ...shared.buildBaseSections({
        pumps: 3,
        ezmeter: true,
        alarmDetail: 'Station alarm (high level / EZ Meter PQ / motor fault)',
      }),
      {
        title: 'Expansion slot 1 — Sequent D1608E digital inputs',
        rows: [
          ['X1_I1', 'DI 1', 'BOOL', 'X1_I1', 'LVL_HIGH', 'High level float'],
          ['X1_I2', 'DI 2', 'BOOL', 'X1_I2', 'LVL_LEAD', 'Lead float'],
          ['X1_I3', 'DI 3', 'BOOL', 'X1_I3', 'LVL_LAG', 'Lag float'],
          ['X1_I4', 'DI 4', 'BOOL', 'X1_I4', 'LVL_LAG2', 'Lag2 float (3-pump stage)'],
          ['X1_I5', 'DI 5', 'BOOL', 'X1_I5', 'LVL_OFF', 'Off float'],
          ['X1_I6', 'DI 6', 'BOOL', 'X1_I6', 'P1_RUN_FB', 'Pump 1 run feedback (fail-to-run)'],
          ['X1_I7', 'DI 7', 'BOOL', 'X1_I7', 'P2_RUN_FB', 'Pump 2 run feedback (fail-to-run)'],
          ['X1_I8', 'DI 8', 'BOOL', 'X1_I8', 'P3_RUN_FB', 'Pump 3 run feedback (fail-to-run)'],
          ['X1_I9', 'DI 9', 'BOOL', 'X1_I9', 'PHASE_FAULT', 'Phase fault'],
          ['X1_I10', 'DI 10', 'BOOL', 'X1_I10', 'GEN_RUN', 'Generator running'],
          ['X1_I11', 'DI 11', 'BOOL', 'X1_I11', 'GEN_FUEL_FAULT', 'Generator fuel fault'],
          ['X1_I12', 'DI 12', 'BOOL', 'X1_I12', 'GEN_FAULT', 'Generator fault'],
          ['X1_I13', 'DI 13', 'BOOL', 'X1_I13', 'MOTOR1_FAULT', 'Pump 1 motor fault → R4'],
          ['X1_I14', 'DI 14', 'BOOL', 'X1_I14', 'MOTOR2_FAULT', 'Pump 2 motor fault → R4'],
          ['X1_I15', 'DI 15', 'BOOL', 'X1_I15', 'MOTOR3_FAULT', 'Pump 3 motor fault → R4'],
          ['X1_I16', 'DI 16', 'BOOL', 'X1_I16', 'POWER_FAIL', 'Control-panel AC loss — generator panels; UPS +24 V when AC to panel lost'],
        ],
      },
      ...shared.buildExpansionTailSections({ pumps: 3, rtdsEnabled: true }),
    ],
  },
};

const VARIANT_ORDER = ['simplex', 'duplex', 'duplexEzmeter', 'triplexEzmeter'];

function getVariant(id) {
  const map = VARIANTS[id];
  if (!map) throw new Error(`Unknown lift-station IO map variant: ${id}`);
  return map;
}

function allVariants() {
  return VARIANT_ORDER.map((id) => VARIANTS[id]);
}

function configMatrixRows() {
  return VARIANT_ORDER.map((id) => {
    const v = VARIANTS[id];
    return {
      config: v.id.replace('Ezmeter', ' + EZ Meter').replace(/^./, (c) => c.toUpperCase()),
      pumps: v.pumps,
      floats: v.floats,
      alternator: v.alternator,
      program: v.program,
      template: v.template,
      ezmeter: v.ezmeter ? 'Yes' : 'No',
      r4Alarm: 'Yes',
      flashFlags: v.flashFlags.length ? v.flashFlags.join(' ') : 'Default',
    };
  });
}

/** Backward compat: duplex EZ Meter map used by legacy build-duplex-opta-io-map-pdf.js */
const legacyDuplexEzmeter = VARIANTS.duplexEzmeter;

module.exports = {
  VARIANTS,
  VARIANT_ORDER,
  getVariant,
  allVariants,
  configMatrixRows,
  ...legacyDuplexEzmeter,
};
