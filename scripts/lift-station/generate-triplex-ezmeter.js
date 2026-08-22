#!/usr/bin/env node
'use strict';

/**
 * Generate triplex lift + EZ Meter ST and tag fixture from duplex ezmeter artifacts.
 * Usage: node scripts/lift-station/generate-triplex-ezmeter.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DUPLEX_ST = path.join(ROOT, 'st/logic/38_duplex_lift_station_ezmeter.st');
const OUT_ST = path.join(ROOT, 'st/logic/39_triplex_lift_station_ezmeter.st');
const DUPLEX_TAGS = path.join(ROOT, 'st/fixtures/tags.duplex_lift_station_ezmeter.json');
const OUT_TAGS = path.join(ROOT, 'st/fixtures/tags.triplex_lift_station_ezmeter.json');

function clonePump2Tags(tags) {
  const pump2 = tags.filter((t) => /^(MOTOR2|P2_|M2_)/.test(t.id));
  const added = pump2.map((t) => {
    const out = JSON.parse(JSON.stringify(t));
    out.id = out.id.replace(/^MOTOR2/, 'MOTOR3').replace(/^P2_/, 'P3_').replace(/^M2_/, 'M3_');
    if (out.label) {
      out.label = out.label.replace(/Pump 2/g, 'Pump 3').replace(/pump 2/g, 'pump 3');
    }
    if (out.comment) {
      out.comment = out.comment.replace(/I4–I6/g, 'expansion CT spare');
    }
    return out;
  });
  return added;
}

function buildTriplexTags() {
  const duplex = JSON.parse(fs.readFileSync(DUPLEX_TAGS, 'utf8'));
  const ids = new Set(duplex.map((t) => t.id));
  const out = duplex.map((t) => JSON.parse(JSON.stringify(t)));

  const alt = out.find((t) => t.id === 'ALT1');
  if (alt) {
    alt.label = '3-pump triplex alternator';
    alt.mode = 'ALT3';
    alt.preset = 3;
    if (alt.fb) alt.fb.lag2Index = -1;
  }

  const ioUpdates = {
    X1_I4: 'Lag2 float',
    X1_I5: 'OFF float',
    X1_I6: 'Pump 1 run feedback',
    X1_I7: 'Pump 2 run feedback',
    X1_I8: 'Pump 3 run feedback',
    X1_I9: 'Phase fault',
    X1_I10: 'Gen run',
    X1_I11: 'Gen fuel fault',
    X1_I12: 'Gen fault',
    X1_I13: 'Pump 1 motor fault',
    X1_I14: 'Pump 2 motor fault',
    X1_I15: 'Pump 3 motor fault',
  };
  for (const t of out) {
    if (ioUpdates[t.id]) t.label = ioUpdates[t.id];
  }

  const r3 = out.find((t) => t.id === 'R3');
  if (r3) {
    r3.label = 'Pump 3 contactor';
  } else if (!ids.has('R3')) {
    out.push({
      id: 'R3',
      label: 'Pump 3 contactor',
      type: 'BOOL',
      role: 'output',
      value: false,
      driverAddress: { channel: 'R3' },
    });
  }

  const lag2 = {
    id: 'LVL_LAG2',
    label: 'Lag2 float (3 pumps)',
    type: 'BOOL',
    role: 'memory',
    value: false,
  };
  const lag2Call = {
    id: 'LAG2_CALL',
    label: 'Lag2 demand latch',
    type: 'BOOL',
    role: 'memory',
    value: false,
  };
  if (!ids.has('LVL_LAG2')) out.push(lag2);
  if (!ids.has('LAG2_CALL')) out.push(lag2Call);

  const m3Fault = {
    id: 'MOTOR3_FAULT',
    label: 'Pump 3 motor fault (X1_I15)',
    type: 'BOOL',
    role: 'memory',
    value: false,
  };
  if (!ids.has('MOTOR3_FAULT')) out.push(m3Fault);

  for (const t of clonePump2Tags(duplex)) {
    if (!ids.has(t.id)) {
      out.push(t);
      ids.add(t.id);
    }
  }

  return out;
}

function buildTriplexSt() {
  let st = fs.readFileSync(DUPLEX_ST, 'utf8');

  st = st
    .replace(/DUPLEXLS \+ EZ Meter/g, 'TRIPLEXLS + EZ Meter')
    .replace(/4-float ALT2 alternator/g, '5-float ALT3 alternator')
    .replace(/v38:/g, 'v39:')
    .replace(/logic\/36_duplex_lift_station\.st/g, 'logic/39_triplex_lift_station_ezmeter.st')
    .replace(/@composite\/duplexls/g, '@composite/triplexls')
    .replace(/duplex-lift-station-ortho-3d\.html/g, 'lift-station-3d.html')
    .replace(/LVL_LAG   Lag float — lead \+ lag \(both stay on until LVL_OFF clears\)\n\n    LVL_OFF   Off float/g,
      'LVL_LAG   Lag float — lead + lag (2 pumps)\n\n    LVL_LAG2  Lag2 float — lead + lag + lag2 (3 pumps)\n\n    LVL_OFF   Off float')
    .replace(/partner is offline\./g, 'partners are offline.')
    .replace(/X1_I4   OFF float        → LVL_OFF\n\n    X1_I5   Pump 1 run fb/g,
      'X1_I4   LAG2 float       → LVL_LAG2\n\n    X1_I5   OFF float        → LVL_OFF\n\n    X1_I6   Pump 1 run fb')
    .replace(/X1_I6   Pump 2 run fb     fail-to-run aux contact\n\n    X1_I7   Phase fault/g,
      'X1_I7   Pump 2 run fb     fail-to-run aux contact\n\n    X1_I8   Pump 3 run fb     fail-to-run aux contact\n\n    X1_I9   Phase fault')
    .replace(/X1_I7   Phase fault       → PHASE_FAULT\n\n    X1_I8   Gen run/g,
      'X1_I9   Phase fault       → PHASE_FAULT\n\n    X1_I10  Gen run')
    .replace(/X1_I8   Gen run           → GEN_RUN\n\n    X1_I9   Gen fuel fault/g,
      'X1_I10  Gen run           → GEN_RUN\n\n    X1_I11  Gen fuel fault')
    .replace(/X1_I9   Gen fuel fault    → GEN_FUEL_FAULT\n\n    X1_I10  Gen fault/g,
      'X1_I11  Gen fuel fault    → GEN_FUEL_FAULT\n\n    X1_I12  Gen fault')
    .replace(/X1_I10  Gen fault         → GEN_FAULT\n\n    X1_I11  Pump 1 motor fault → MOTOR1_FAULT\n\n    X1_I12  Pump 2 motor fault → MOTOR2_FAULT\n\n    X1_I13…X1_I16            Spare DIs/g,
      'X1_I12  Gen fault         → GEN_FAULT\n\n    X1_I13  Pump 1 motor fault → MOTOR1_FAULT\n\n    X1_I14  Pump 2 motor fault → MOTOR2_FAULT\n\n    X1_I15  Pump 3 motor fault → MOTOR3_FAULT\n\n    X1_I16                 Spare DI')
    .replace(/AI6  Motor 2 phase C amps\n\n    R1   Pump 1 contactor/g,
      'AI6  Motor 2 phase C amps\n\n    (Pump 3 CTs: wire to expansion analog or spare — not on base I1–I6)\n\n    R1   Pump 1 contactor')
    .replace(/R2   Pump 2 contactor ← MOTOR2_RUN\n\n    R4   Station alarm relay ← LVL_HIGH \/ MECH_PQ_ALM \/ MOTOR1_FAULT \/ MOTOR2_FAULT/g,
      'R2   Pump 2 contactor ← MOTOR2_RUN\n\n    R3   Pump 3 contactor ← MOTOR3_RUN\n\n    R4   Station alarm relay ← LVL_HIGH / MECH_PQ_ALM / MOTOR1_FAULT / MOTOR2_FAULT / MOTOR3_FAULT');

  st = st.replace(
    'IF IsON(X1_I4) THEN TurnON(LVL_OFF); ELSE TurnOFF(LVL_OFF); END_IF;',
    'IF IsON(X1_I4) THEN TurnON(LVL_LAG2); ELSE TurnOFF(LVL_LAG2); END_IF;\n\nIF IsON(X1_I5) THEN TurnON(LVL_OFF); ELSE TurnOFF(LVL_OFF); END_IF;',
  );

  st = st.replace(
    'IF IsON(X1_I5) THEN TurnON(P1_RUN_FB); ELSE TurnOFF(P1_RUN_FB); END_IF;\n\nIF IsON(X1_I6) THEN TurnON(P2_RUN_FB); ELSE TurnOFF(P2_RUN_FB); END_IF;',
    'IF IsON(X1_I6) THEN TurnON(P1_RUN_FB); ELSE TurnOFF(P1_RUN_FB); END_IF;\n\nIF IsON(X1_I7) THEN TurnON(P2_RUN_FB); ELSE TurnOFF(P2_RUN_FB); END_IF;\n\nIF IsON(X1_I8) THEN TurnON(P3_RUN_FB); ELSE TurnOFF(P3_RUN_FB); END_IF;',
  );

  st = st.replace(
    /IF IsON\(X1_I7\) THEN TurnON\(PHASE_FAULT\);[\s\S]*?IF IsON\(X1_I12\) THEN TurnON\(MOTOR2_FAULT\); ELSE TurnOFF\(MOTOR2_FAULT\); END_IF;/,
    `IF IsON(X1_I9) THEN TurnON(PHASE_FAULT); ELSE TurnOFF(PHASE_FAULT); END_IF;

IF IsON(X1_I10) THEN TurnON(GEN_RUN); ELSE TurnOFF(GEN_RUN); END_IF;

IF IsON(X1_I11) THEN TurnON(GEN_FUEL_FAULT); ELSE TurnOFF(GEN_FUEL_FAULT); END_IF;

IF IsON(X1_I12) THEN TurnON(GEN_FAULT); ELSE TurnOFF(GEN_FAULT); END_IF;

IF IsON(X1_I13) THEN TurnON(MOTOR1_FAULT); ELSE TurnOFF(MOTOR1_FAULT); END_IF;

IF IsON(X1_I14) THEN TurnON(MOTOR2_FAULT); ELSE TurnOFF(MOTOR2_FAULT); END_IF;

IF IsON(X1_I15) THEN TurnON(MOTOR3_FAULT); ELSE TurnOFF(MOTOR3_FAULT); END_IF;`,
  );

  st = st.replace(
    'IF IsON(LVL_LEAD) OR IsON(LVL_LAG) OR IsON(LVL_HIGH) THEN TurnON(LEAD_CALL); END_IF;',
    'IF IsON(LVL_LEAD) OR IsON(LVL_LAG) OR IsON(LVL_LAG2) OR IsON(LVL_HIGH) THEN TurnON(LEAD_CALL); END_IF;',
  );

  st = st.replace(
    'IF IsON(LVL_LAG) OR IsON(LVL_HIGH) THEN TurnON(LAG_CALL); END_IF;',
    'IF IsON(LVL_LAG) OR IsON(LVL_LAG2) OR IsON(LVL_HIGH) THEN TurnON(LAG_CALL); END_IF;\n\nIF IsON(LVL_LAG2) OR IsON(LVL_HIGH) THEN TurnON(LAG2_CALL); END_IF;',
  );

  st = st.replace(
    'IF IsOFF(LVL_OFF) THEN TurnOFF(LAG_CALL); END_IF;',
    'IF IsOFF(LVL_OFF) THEN TurnOFF(LAG_CALL); END_IF;\n\nIF IsOFF(LVL_OFF) THEN TurnOFF(LAG2_CALL); END_IF;',
  );

  st = st.replace(
    'IF IsON(PHASE_FAULT) OR IsON(MECH_PQ_UNDERVOLT) OR IsON(MECH_PQ_PHASE_LOSS) THEN TurnOFF(LAG_CALL); END_IF;',
    'IF IsON(PHASE_FAULT) OR IsON(MECH_PQ_UNDERVOLT) OR IsON(MECH_PQ_PHASE_LOSS) THEN TurnOFF(LAG_CALL); END_IF;\n\nIF IsON(PHASE_FAULT) OR IsON(MECH_PQ_UNDERVOLT) OR IsON(MECH_PQ_PHASE_LOSS) THEN TurnOFF(LAG2_CALL); END_IF;',
  );

  st = st.replace('(* ---- Alternator (ALT2) ---- *)', '(* ---- Alternator (ALT3) ---- *)');

  st = st.replace(
    'AltLow(ALT1, LAG_CALL);',
    'AltLow(ALT1, LAG_CALL);\n\nAltLag2(ALT1, LAG2_CALL);',
  );

  st = st.replace(
    'AltOnline(ALT1, 2, MOTOR2_ONLINE);\n\nAltUnitOut(ALT1, 1, P1_ALT_RUN);\n\nAltUnitOut(ALT1, 2, P2_ALT_RUN);',
    'AltOnline(ALT1, 2, MOTOR2_ONLINE);\n\nAltOnline(ALT1, 3, MOTOR3_ONLINE);\n\nAltUnitOut(ALT1, 1, P1_ALT_RUN);\n\nAltUnitOut(ALT1, 2, P2_ALT_RUN);\n\nAltUnitOut(ALT1, 3, P3_ALT_RUN);',
  );

  st = st.replace(
    'IF AltFault(ALT1) OR IsON(M1_FAIL) OR IsON(M2_FAIL) THEN TurnON(ALT_FAULT); ELSE TurnOFF(ALT_FAULT); END_IF;',
    'IF AltFault(ALT1) OR IsON(M1_FAIL) OR IsON(M2_FAIL) OR IsON(M3_FAIL) THEN TurnON(ALT_FAULT); ELSE TurnOFF(ALT_FAULT); END_IF;',
  );

  const pump2Block = st.match(/\(\* ========== Pump 2 HOA ========== \*\)[\s\S]*?TurnOFF\(MOTOR2_STOP\);\n\n\n\n\(\* Wet-well level/);
  if (!pump2Block) throw new Error('Pump 2 HOA block not found');
  const pump2Body = pump2Block[0].replace(/\n\n\(\* Wet-well level$/, '');
  const pump3Block = pump2Body
    .replace(/\(\* ========== Pump 2 HOA ========== \*\)/, '(* ========== Pump 3 HOA ========== *)')
    .replace(/Pump 2/g, 'Pump 3')
    .replace(/MOTOR2/g, 'MOTOR3')
    .replace(/M2_/g, 'M3_')
    .replace(/P2_/g, 'P3_');
  st = st.replace(pump2Body, `${pump2Body}\n\n${pump3Block}`);

  st = st.replace(
    `IF MOTOR2_HOA = 2 THEN

  TurnOFF(M2_FTR);

ELSE

  IF IsON(R2) AND IsOFF(P2_RUN_FB) THEN TurnON(M2_FTR); ELSE TurnOFF(M2_FTR); END_IF;

END_IF;`,
    `IF MOTOR2_HOA = 2 THEN

  TurnOFF(M2_FTR);

ELSE

  IF IsON(R2) AND IsOFF(P2_RUN_FB) THEN TurnON(M2_FTR); ELSE TurnOFF(M2_FTR); END_IF;

END_IF;



IF MOTOR3_HOA = 2 THEN

  TurnOFF(M3_FTR);

ELSE

  IF IsON(R3) AND IsOFF(P3_RUN_FB) THEN TurnON(M3_FTR); ELSE TurnOFF(M3_FTR); END_IF;

END_IF;`,
  );

  st = st.replace(
    'TimerInput(M2_FTR_TMR, M2_FTR);',
    'TimerInput(M2_FTR_TMR, M2_FTR);\n\nTimerInput(M3_FTR_TMR, M3_FTR);',
  );

  st = st.replace(
    'IF TimerDone(M2_FTR_TMR) THEN TurnON(M2_FAIL); END_IF;',
    'IF TimerDone(M2_FTR_TMR) THEN TurnON(M2_FAIL); END_IF;\n\nIF TimerDone(M3_FTR_TMR) THEN TurnON(M3_FAIL); END_IF;',
  );

  st = st.replace(
    '  TurnOFF(M2_FAIL);\n\nEND_IF;',
    '  TurnOFF(M2_FAIL);\n\n  TurnOFF(M3_FAIL);\n\nEND_IF;',
  );

  st = st.replace(
    'IF IsON(MOTOR2_OFFLINE) OR IsON(M2_FAIL) THEN TurnOFF(MOTOR2_ONLINE); ELSE TurnON(MOTOR2_ONLINE); END_IF;',
    'IF IsON(MOTOR2_OFFLINE) OR IsON(M2_FAIL) THEN TurnOFF(MOTOR2_ONLINE); ELSE TurnON(MOTOR2_ONLINE); END_IF;\n\nIF IsON(MOTOR3_OFFLINE) OR IsON(M3_FAIL) THEN TurnOFF(MOTOR3_ONLINE); ELSE TurnON(MOTOR3_ONLINE); END_IF;',
  );

  st = st.replace(
    'ELSIF IsON(LVL_LAG) THEN\n\n  SetInt(TANK_LVL, 68);',
    'ELSIF IsON(LVL_LAG2) THEN\n\n  SetInt(TANK_LVL, 78);\n\nELSIF IsON(LVL_LAG) THEN\n\n  SetInt(TANK_LVL, 68);',
  );

  st = st.replace(
    'ELSIF IsON(MOTOR1_RUN) OR IsON(MOTOR2_RUN) THEN',
    'ELSIF IsON(MOTOR1_RUN) OR IsON(MOTOR2_RUN) OR IsON(MOTOR3_RUN) THEN',
  );

  st = st.replace(
    'IF IsON(ALT_FAULT) OR IsON(M1_FAIL) OR IsON(M2_FAIL) OR IsON(PHASE_FAULT)',
    'IF IsON(ALT_FAULT) OR IsON(M1_FAIL) OR IsON(M2_FAIL) OR IsON(M3_FAIL) OR IsON(PHASE_FAULT)',
  );

  st = st.replace(
    'IF IsON(MOTOR2_RUN) THEN TurnON(R2); ELSE TurnOFF(R2); END_IF;\n\nIF IsON(LVL_HIGH) OR IsON(MECH_PQ_ALM) OR IsON(MOTOR1_FAULT) OR IsON(MOTOR2_FAULT) THEN',
    'IF IsON(MOTOR2_RUN) THEN TurnON(R2); ELSE TurnOFF(R2); END_IF;\n\nIF IsON(MOTOR3_RUN) THEN TurnON(R3); ELSE TurnOFF(R3); END_IF;\n\nIF IsON(LVL_HIGH) OR IsON(MECH_PQ_ALM) OR IsON(MOTOR1_FAULT) OR IsON(MOTOR2_FAULT) OR IsON(MOTOR3_FAULT) THEN',
  );

  return st;
}

function main() {
  fs.writeFileSync(OUT_TAGS, `${JSON.stringify(buildTriplexTags(), null, 2)}\n`);
  fs.writeFileSync(OUT_ST, buildTriplexSt());
  console.log('Wrote', path.relative(ROOT, OUT_ST));
  console.log('Wrote', path.relative(ROOT, OUT_TAGS));
}

main();
