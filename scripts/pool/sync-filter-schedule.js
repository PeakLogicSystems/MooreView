#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  FILTER_SCHEDULE_DAYS,
  FILTER_SLOTS_PER_DAY,
  FILTER_DAY_LABELS,
  MAX_FILTER_PUMPS,
  DEFAULT_TURNOVER,
  defaultSlotTime,
  defaultSlotPct,
  defaultSlotEnabled,
  turnoverSpeedPct,
  hmiElementId,
  buildScheduleTags,
  buildScheduleEvalSt,
  buildScheduleCompositeBindings,
} = require('../../src/pool/filterPumpSchedule');

const ROOT = path.resolve(__dirname, '..', '..');
const ST_FILE = path.join(ROOT, 'st', 'logic', '30_pool_controller.st');
const TAGS_FILE = path.join(ROOT, 'st', 'fixtures', 'tags.pool_controller.json');
const COMPOSITE_FILE = path.join(ROOT, 'public', 'hmi', 'svg', 'composites', 'pool_filter_schedule.json');
const SVG_FILE = path.join(ROOT, 'public', 'hmi', 'svg', 'library', 'schedules', 'mooreview', 'pool_filter_schedule.svg');

const MARK_START = '(* === FILTER SCHEDULE EVAL AUTO START === *)';
const MARK_END = '(* === FILTER SCHEDULE EVAL AUTO END === *)';
const SPA_START = '(* === SPA PUMP 2 AUTO START === *)';
const SPA_END = '(* === SPA PUMP 2 AUTO END === *)';

const PANEL_W = 728;
const PANEL_GAP = 16;
const MARGIN = 20;

function writeScheduleSvg() {
  const turnoverH = 200;
  const headerH = 88;
  const dayH = 282;
  const dayGap = 10;
  const cellW = 196;
  const cellH = 118;
  const slotGap = 16;
  const panelH = FILTER_SCHEDULE_DAYS * dayH + (FILTER_SCHEDULE_DAYS - 1) * dayGap + 72;
  const totalW = MARGIN * 2 + MAX_FILTER_PUMPS * PANEL_W + (MAX_FILTER_PUMPS - 1) * PANEL_GAP;
  const totalH = headerH + turnoverH + 16 + panelH + MARGIN;

  const t = DEFAULT_TURNOVER;
  const dayPct = turnoverSpeedPct(t.poolVolGal, t.poolTurnoverDayMin, t.pump1FlowGpm);
  const spaPct = turnoverSpeedPct(t.spaVolGal, t.spaTurnoverMin, t.pump2FlowGpm);

  function pumpPanel(pump, panelX, title, subtitle) {
    let days = '';
    for (let d = 0; d < FILTER_SCHEDULE_DAYS; d++) {
      const dy = headerH + turnoverH + 16 + 72 + d * (dayH + dayGap);
      const bg = d % 2 === 0 ? '#f8fafc' : '#eef2f7';
      days += `<rect x="${panelX + 4}" y="${dy}" width="${PANEL_W - 8}" height="${dayH}" rx="10" fill="${bg}" stroke="#cbd5e1" stroke-width="1.5"/>`;
      days += `<text x="${panelX + 50}" y="${dy + 40}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="28" font-weight="700" fill="#0f172a">${FILTER_DAY_LABELS[d]}</text>`;
      for (let s = 1; s <= FILTER_SLOTS_PER_DAY; s++) {
        const col = (s - 1) % 3;
        const row = Math.floor((s - 1) / 3);
        const cx = panelX + 112 + col * (cellW + slotGap);
        const cy = dy + 14 + row * (cellH + slotGap);
        const mins = defaultSlotTime(s);
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        const pct = pump === 1 ? defaultSlotPct(s) : (s === 1 ? spaPct : 0);
        const enFill = defaultSlotEnabled(s, pump) ? '#22c55e' : '#ffffff';
        days += `
      <rect x="${cx}" y="${cy}" width="${cellW}" height="${cellH}" rx="10" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>
      <g id="${hmiElementId(pump, d, s, 'en')}" transform="translate(${cx + 10}, ${cy + 10})">
        <rect width="18" height="18" rx="3" fill="${enFill}" stroke="#475569" stroke-width="1.5"/>
      </g>
      <text x="${cx + cellW / 2}" y="${cy + 24}" text-anchor="middle" font-size="18" font-weight="700" fill="#64748b">S${s}</text>
      <text id="${hmiElementId(pump, d, s, 't')}" x="${cx + cellW / 2}" y="${cy + 62}" text-anchor="middle" font-family="Consolas,monospace" font-size="40" font-weight="700" fill="#0f172a">${hh}:${mm}</text>
      <text id="${hmiElementId(pump, d, s, 'p')}" x="${cx + cellW / 2}" y="${cy + 102}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="32" font-weight="700" fill="#0369a1">${pct}%</text>`;
      }
    }
    const y0 = headerH + turnoverH + 16;
    const wrapStart = pump === 2 ? '<g id="grp_spa_pump">' : '';
    const wrapEnd = pump === 2 ? '</g>' : '';
    return `${wrapStart}
  <rect x="${panelX}" y="${y0}" width="${PANEL_W}" height="${panelH}" rx="14" fill="#ffffff" stroke="#475569" stroke-width="2.5"/>
  <text x="${panelX + PANEL_W / 2}" y="${y0 + 36}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="30" font-weight="700" fill="#0f172a">${title}</text>
  <text x="${panelX + PANEL_W / 2}" y="${y0 + 58}" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" fill="#64748b">${subtitle}</text>
  ${days}${wrapEnd}`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="#f1f5f9"/>
  <text id="sched_title" x="${totalW / 2}" y="40" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="34" font-weight="700" fill="#0f172a">Filter pump schedules</text>
  <text x="${totalW / 2}" y="72" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="18" fill="#64748b">Turnover sizing · pool 4–8h day / 8–12h night · spa ~30 min</text>

  <rect x="${MARGIN}" y="${headerH}" width="${totalW - MARGIN * 2}" height="${turnoverH}" rx="12" fill="#ffffff" stroke="#475569" stroke-width="2"/>
  <text x="${MARGIN + 16}" y="${headerH + 28}" font-size="18" font-weight="700" fill="#334155">Turnover sizing</text>
  <text x="${MARGIN + 16}" y="${headerH + 50}" font-size="14" fill="#64748b">Auto speed % = volume ÷ (turnover × flow). Tap values to edit.</text>

  <text x="${MARGIN + 24}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">POOL gal</text>
  <text id="pool_vol_gal" x="${MARGIN + 24}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${t.poolVolGal}</text>
  <text x="${MARGIN + 140}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">SPA gal</text>
  <text id="spa_vol_gal" x="${MARGIN + 140}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${t.spaVolGal}</text>
  <text x="${MARGIN + 250}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Pool flow</text>
  <text id="pump1_flow_gpm" x="${MARGIN + 250}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${t.pump1FlowGpm}</text>
  <text x="${MARGIN + 360}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Spa flow</text>
  <text id="pump2_flow_gpm" x="${MARGIN + 360}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${t.pump2FlowGpm}</text>
  <text x="${MARGIN + 470}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Day TO (h)</text>
  <text id="pool_turnover_day_h" x="${MARGIN + 470}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${(t.poolTurnoverDayMin / 60).toFixed(1)}</text>
  <text x="${MARGIN + 580}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Night TO (h)</text>
  <text id="pool_turnover_night_h" x="${MARGIN + 580}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${(t.poolTurnoverNightMin / 60).toFixed(1)}</text>
  <text x="${MARGIN + 700}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Spa TO (m)</text>
  <text id="spa_turnover_min" x="${MARGIN + 700}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">${t.spaTurnoverMin}</text>
  <text x="${MARGIN + 810}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Day start</text>
  <text id="pool_day_start" x="${MARGIN + 810}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">08:00</text>
  <text x="${MARGIN + 920}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Day end</text>
  <text id="pool_day_end" x="${MARGIN + 920}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0f172a">20:00</text>
  <text x="${MARGIN + 1030}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Pool %</text>
  <text id="fp1_active_pct" x="${MARGIN + 1030}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0369a1">${dayPct}%</text>
  <text x="${MARGIN + 1130}" y="${headerH + 82}" font-size="12" font-weight="600" fill="#64748b">Spa %</text>
  <text id="fp2_active_pct" x="${MARGIN + 1130}" y="${headerH + 108}" font-family="Consolas,monospace" font-size="22" font-weight="700" fill="#0369a1">${spaPct}%</text>

  <g id="chk_auto_turnover" transform="translate(${MARGIN + 1220}, ${headerH + 88})">
    <rect width="14" height="14" rx="3" fill="#22c55e" stroke="#475569" stroke-width="1.5"/>
    <text x="20" y="12" font-family="Segoe UI,sans-serif" font-size="12" font-weight="700" fill="#0f172a">AUTO</text>
  </g>
  <g id="chk_cfg_fp2" transform="translate(${MARGIN + 1300}, ${headerH + 88})">
    <rect width="14" height="14" rx="3" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>
    <text x="20" y="12" font-family="Segoe UI,sans-serif" font-size="12" font-weight="700" fill="#0f172a">SPA PUMP</text>
  </g>
  <text x="${MARGIN + 1420}" y="${headerH + 100}" font-size="12" font-weight="600" fill="#64748b">NOW</text>
  <text id="filter_tod" x="${MARGIN + 1420}" y="${headerH + 124}" font-family="Consolas,monospace" font-size="20" font-weight="700" fill="#0f172a">08:00</text>
  <text x="${MARGIN + 1500}" y="${headerH + 100}" font-size="12" font-weight="600" fill="#64748b">RUN</text>
  <text id="filter_sch_pct" x="${MARGIN + 1500}" y="${headerH + 124}" font-family="Consolas,monospace" font-size="20" font-weight="700" fill="#0369a1">0%</text>
  <text id="filter_sch2_pct" x="${MARGIN + 1560}" y="${headerH + 124}" font-family="Consolas,monospace" font-size="20" font-weight="700" fill="#0369a1">0%</text>
  <g id="chk_24hr" transform="translate(${MARGIN + 1620}, ${headerH + 92})">
    <rect width="14" height="14" rx="3" fill="#ffffff" stroke="#475569" stroke-width="1.5"/>
    <text x="20" y="12" font-family="Segoe UI,sans-serif" font-size="12" font-weight="700" fill="#0f172a">24HR</text>
  </g>
  <g id="btn_filter_enable" transform="translate(${MARGIN + 1700}, ${headerH + 86})">
    <rect width="64" height="26" rx="6" fill="#22c55e" stroke="#475569" stroke-width="1"/>
    <text x="32" y="18" text-anchor="middle" font-family="Segoe UI,sans-serif" font-size="11" font-weight="700" fill="#ffffff">ENABLE</text>
  </g>

  ${pumpPanel(1, MARGIN, 'Pool filter pump', 'Tap slot times · speed from turnover when AUTO')}
  ${pumpPanel(2, MARGIN + PANEL_W + PANEL_GAP, 'Spa filter pump', 'Enable SPA PUMP · ~30 min turnover')}
</svg>`;
  fs.mkdirSync(path.dirname(SVG_FILE), { recursive: true });
  fs.writeFileSync(SVG_FILE, svg, 'utf8');
}

const SCHEDULE_TAG_PREFIXES = [
  /^FP\d+_D\d+_S\d+_[TPE]$/,
  /^FILTER_DOW$/,
  /^FILTER_SCH/,
  /^FP[12]_(PCT|ACTIVE)/,
  /^CFG_FP/,
  /^SCH_AUTO/,
  /^POOL_VOL/,
  /^SPA_VOL/,
  /^PUMP[12]_FLOW/,
  /^POOL_TURNOVER/,
  /^SPA_TURNOVER/,
  /^POOL_DAY_/,
  /^VPB2$/,
  /^MOTOR2_/,
  /^PUMP2_/,
];

function isScheduleManagedTag(id) {
  return SCHEDULE_TAG_PREFIXES.some((re) => re.test(id));
}

function mergeTags() {
  const base = JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));
  const scheduleTags = buildScheduleTags(MAX_FILTER_PUMPS);
  const byId = new Map();
  for (const tag of base) {
    if (!isScheduleManagedTag(tag.id)) byId.set(tag.id, tag);
  }
  for (const tag of scheduleTags) byId.set(tag.id, tag);
  const merged = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(TAGS_FILE, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
}

function buildSpaPumpSt() {
  return [
    '(* Spa filter pump 2 — optional CFG_FP2 *)',
    'IF IsON(CFG_FP2) AND IsON(FILTER_EN) AND (IsON(FILTER_24HR) OR FILTER_SCH2_PCT > 0) THEN',
    '  TurnON(VPB2);',
    'ELSE',
    '  TurnOFF(VPB2);',
    'END_IF;',
    '',
    'IF IsON(MOTOR2_OFFLINE) THEN',
    '  TurnOFF(MOTOR2_RUN);',
    '  SetInt(MOTOR2_STA, 4);',
    'ELSE',
    '  IF MOTOR2_HOA = 1 THEN',
    '    TurnOFF(MOTOR2_RUN);',
    '    IF NOT IsON(MOTOR2_RUN) THEN SetInt(MOTOR2_STA, 0); END_IF;',
    '  ELSE',
    '    IF MOTOR2_HOA = 2 THEN',
    '      IF IsON(MOTOR2_START) THEN TurnON(MOTOR2_RUN); END_IF;',
    '      IF IsON(MOTOR2_STOP) THEN TurnOFF(MOTOR2_RUN); END_IF;',
    '    ELSE',
    '      IF IsON(CFG_FP2) AND IsON(FILTER_EN) AND IsON(VPB2) AND NOT IsON(MOTOR2_STOP) THEN',
    '        TurnON(MOTOR2_RUN);',
    '      ELSE',
    '        TurnOFF(MOTOR2_RUN);',
    '      END_IF;',
    '    END_IF;',
    '  END_IF;',
    'END_IF;',
    '',
    'IF IsON(MOTOR2_RUN) THEN',
    '  TurnON(PUMP2_RUN_CMD);',
    '  SetInt(PUMP2_RPM_CMD, PUMP2_SPEED * FILTER_SCH2_PCT / 100);',
    'ELSE',
    '  TurnOFF(PUMP2_RUN_CMD);',
    'END_IF;',
    '',
    'IF IsON(MOTOR2_RUN) THEN',
    '  SetInt(MOTOR2_HRS, MOTOR2_HRS + 0.0000277778);',
    'END_IF;',
    '',
    'CounterCu(MOTOR2_CNTR, MOTOR2_RUN);',
    'SetInt(MOTOR2_STARTS, CounterValue(MOTOR2_CNTR));',
    '',
    'TurnOFF(MOTOR2_START);',
    'TurnOFF(MOTOR2_STOP);',
  ].join('\n');
}

function patchSt() {
  let src = fs.readFileSync(ST_FILE, 'utf8');
  const evalBlock = `${MARK_START}\n${buildScheduleEvalSt()}\n${MARK_END}`;
  if (src.includes(MARK_START)) {
    src = src.replace(new RegExp(`${escapeRe(MARK_START)}[\\s\\S]*?${escapeRe(MARK_END)}`), evalBlock);
  } else {
    const anchor = '(* ========== FILTER PUMP SCHEDULE (Speck permissive) ========== *)';
    src = src.replace(anchor, `${anchor}\n\n${evalBlock}`);
  }

  const spaBlock = `${SPA_START}\n${buildSpaPumpSt()}\n${SPA_END}`;
  if (src.includes(SPA_START)) {
    src = src.replace(new RegExp(`${escapeRe(SPA_START)}[\\s\\S]*?${escapeRe(SPA_END)}`), spaBlock);
  } else {
    src = src.replace(
      '(* ========== BACKWASH SEQUENCE ========== *)',
      `${spaBlock}\n\n(* ========== BACKWASH SEQUENCE ========== *)`,
    );
  }

  fs.writeFileSync(ST_FILE, src, 'utf8');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function writeComposite() {
  const composite = {
    id: 'pool_filter_schedule',
    label: 'Filter pump weekly schedule',
    group: 'Schedules',
    subgroup: 'composites',
    preview: '/hmi/svg/library/schedules/mooreview/pool_filter_schedule.svg',
    tagRoles: {
      filterTod: { pick: 'tagId', tagId: 'FILTER_TOD', types: ['INT'] },
      filterDow: { pick: 'tagId', tagId: 'FILTER_DOW', types: ['INT'] },
      filterSchPct: { pick: 'tagId', tagId: 'FILTER_SCH_PCT', types: ['INT'] },
      filterSch2Pct: { pick: 'tagId', tagId: 'FILTER_SCH2_PCT', types: ['INT'] },
      filter24hr: { pick: 'tagId', tagId: 'FILTER_24HR', types: ['BOOL'] },
      filterEn: { pick: 'tagId', tagId: 'FILTER_EN', types: ['BOOL'] },
      cfgFp2: { pick: 'tagId', tagId: 'CFG_FP2', types: ['BOOL'] },
      schAutoTurnover: { pick: 'tagId', tagId: 'SCH_AUTO_TURNOVER', types: ['BOOL'] },
    },
    parts: [{
      role: 'faceplate',
      z: 0,
      kind: 'staticImage',
      svg: '/hmi/svg/library/schedules/mooreview/pool_filter_schedule.svg',
    }],
    defaultBindings: buildScheduleCompositeBindings(),
  };
  fs.writeFileSync(COMPOSITE_FILE, `${JSON.stringify(composite, null, 2)}\n`, 'utf8');
}

writeScheduleSvg();
mergeTags();
patchSt();
writeComposite();
console.log('Filter pump schedule synced: dual pump, turnover sizing, tags, ST, SVG, composite');
