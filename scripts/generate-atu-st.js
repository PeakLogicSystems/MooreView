'use strict';

const fs = require('fs');
const path = require('path');

const ST_DIR = path.join(__dirname, '..', 'st', 'logic');

const TPO_BODY = `
IF IsON({P}_EN) AND IsOFF({P}_OFFLINE) THEN
  SetInt({P}_TOD, {P}_TOD + {P}_TOD_STEP);
  IF {P}_TOD >= 1440 THEN SetInt({P}_TOD, {P}_TOD - 1440); END_IF;
END_IF;
IF IsON({P}_OFFLINE) THEN
  TurnOFF({P}_OUT); TurnOFF({P}_GAP); SetInt({P}_PULSE_REM, 0); SetInt({P}_STA, 1);
ELSE
  IF IsOFF({P}_EN) THEN
    TurnOFF({P}_OUT); TurnOFF({P}_GAP); SetInt({P}_PULSE_REM, 0); SetInt({P}_STA, 0);
  ELSE
    IF IsON({P}_24HR) OR ({P}_TOD >= {P}_START AND {P}_TOD < {P}_END) THEN
      IF {P}_PULSE_REM <= 0 THEN
        IF IsON({P}_OUT) THEN
          TurnOFF({P}_OUT); TurnON({P}_GAP); SetInt({P}_PULSE_REM, {P}_OFF_MIN); SetInt({P}_STA, 3);
        ELSE
          TurnON({P}_OUT); TurnOFF({P}_GAP); SetInt({P}_PULSE_REM, {P}_ON_MIN); SetInt({P}_STA, 2);
        END_IF;
      ELSE
        SetInt({P}_PULSE_REM, {P}_PULSE_REM - {P}_TOD_STEP);
        IF {P}_PULSE_REM < 0 THEN SetInt({P}_PULSE_REM, 0); END_IF;
      END_IF;
    ELSE
      TurnOFF({P}_OUT); TurnOFF({P}_GAP); SetInt({P}_PULSE_REM, 0); SetInt({P}_STA, 4);
    END_IF;
  END_IF;
END_IF;
`;

function sfx(n) {
  return n === 1 ? '' : String(n);
}

function unitBlock(n) {
  const s = sfx(n);
  const alt = `ALT${n}`;
  const p = `TPO${n}`;
  const m1 = (n - 1) * 2 + 1;
  const m2 = m1 + 1;
  const tpo = TPO_BODY.replace(/\{P\}/g, p);
  return `(* ===== Unit ${n}: ${p} + ${alt} ===== *)
${tpo}
IF IsON(${p}_OUT) THEN TurnON(SYS_RUN${s}); ELSE TurnOFF(SYS_RUN${s}); END_IF;
AltEnable(${alt}, SYS_RUN${s});
AltAutoFault(${alt}, SYS_RUN${s});
AltAdvance(${alt}, ALT_BUMP${s});
AltOff(${alt}, ALT_OFF${s});
AltHigh(${alt}, LVL_HIGH${s});
AltLow(${alt}, LVL_LAG${s});
AltOnline(${alt}, 1, MOTOR${m1}_ONLINE);
AltOnline(${alt}, 2, MOTOR${m2}_ONLINE);
AltUnitOut(${alt}, 1, MOTOR${m1}_RUN);
AltUnitOut(${alt}, 2, MOTOR${m2}_RUN);
AltLead(${alt}, LEAD_RUN${s});
IF AltFault(${alt}) THEN TurnON(ALT_FAULT${s}); ELSE TurnOFF(ALT_FAULT${s}); END_IF;
TurnOFF(ALT_BUMP${s});
`;
}

function buildProgram(units, rel) {
  const header = `(*
  ${units === 2 ? 'Dual' : 'Quad'} ATU — ${units} duplex alternators, each TPO-gated
  Tags: st/fixtures/tags.${units === 2 ? 'dual' : 'quad'}_atu.json
*)
`;
  const body = Array.from({ length: units }, (_, i) => unitBlock(i + 1)).join('\n');
  fs.writeFileSync(path.join(ST_DIR, rel), `${header}\n${body}\n`);
  console.log('wrote', rel);
}

if (require.main === module) {
  buildProgram(2, '33_dual_atu.st');
  buildProgram(4, '34_quad_atu.st');
}

module.exports = { buildProgram, unitBlock };
