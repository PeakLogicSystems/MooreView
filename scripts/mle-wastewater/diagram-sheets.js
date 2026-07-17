'use strict';

/** P&ID, mechanical, and instrumentation landscape drawing sheets. */

const { getScanPorts, SCAN_VENDOR } = require('./scan-instrumentation');

function box(x, y, w, h) {
  return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
}

function createDiagramSheets(ctx) {
  const { CFG, fmtGpd, ACCENT, FOOTER_COLOR, TITLE_COLOR, startNewPage } = ctx;
  const {
    diagramText,
    drawArrow,
    drawFlowLabel,
    drawUnitBox,
    drawPumpSymbol,
    drawInstrumentBubble,
    drawAnalyzer,
    drawTssAnalyzer,
    drawSampleLine,
    drawLegendItem,
    drawLegendAnalyzer,
    drawLegendTssAnalyzer,
  } = ctx.helpers;

  function drawDiagramHeader(doc, sectionNum, title, subtitle) {
    const left = doc.page.margins.left;
    const top = doc.page.margins.top;
    const drawW = doc.page.width - left * 2;
    diagramText(doc, `${sectionNum}. ${title}`, left, top, { size: 14, bold: true, color: ACCENT });
    diagramText(doc, subtitle || CFG.pfdSubtitle, left, top + 18, { size: 9, color: '#475569', width: drawW });
    return { left, top, drawW, pageH: doc.page.height };
  }

  function drawDiagramFooter(doc, left, drawW, pageH, sheetLabel) {
    diagramText(
      doc,
      `Drawing not to scale · ${CFG.siteName} · ${sheetLabel} · Rev 0`,
      left,
      pageH - 36,
      { size: 7, color: FOOTER_COLOR, width: drawW, align: 'center', lineBreak: false }
    );
    doc.x = left;
    doc.y = doc.page.margins.top;
  }

  function drawValveSymbol(doc, x, y, tag) {
    doc.save().strokeColor('#334155').lineWidth(0.9);
    doc.moveTo(x - 7, y).lineTo(x + 7, y).stroke();
    doc.moveTo(x, y - 7).lineTo(x, y + 7).stroke();
    doc.fontSize(5.5).font('Helvetica').fillColor('#334155');
    doc.text(tag, x - 14, y + 9, { width: 28, align: 'center' });
    doc.restore();
  }

  function drawPidTag(doc, x, y, tag) {
    doc.save();
    doc.fontSize(6).font('Helvetica-Bold').fillColor('#334155');
    doc.text(tag, x, y, { width: 40, align: 'center' });
    doc.restore();
  }

  function drawGhostProcess(doc, units) {
    doc.save().fillColor('#f1f5f9').strokeColor('#cbd5e1').lineWidth(0.8);
    units.forEach((u) => doc.roundedRect(u.x, u.y, u.w, u.h, 4).fillAndStroke());
    doc.restore();
  }

  function drawSheetLegend(doc, left, pageH, items) {
    const legY = pageH - 96;
    diagramText(doc, 'Legend', left, legY, { size: 8, bold: true, color: TITLE_COLOR });
    items.forEach((item, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = left + col * 130;
      const y = legY + 14 + row * 16;
      if (item.type === 'line') drawLegendItem(doc, x, y, item.color, item.dash, item.label);
      else if (item.type === 'at') drawLegendAnalyzer(doc, x, y);
      else if (item.type === 'tss') drawLegendTssAnalyzer(doc, x, y);
      else if (item.type === 'text') diagramText(doc, item.label, x, y, { size: 7, width: 120 });
    });
  }

  function drawSampleTap(doc, x, y, valve, portNum) {
    doc.save().circle(x, y, 5).lineWidth(0.9).stroke('#0ea5e9');
    doc.fontSize(5).font('Helvetica-Bold').fillColor('#0369a1');
    doc.text(`${valve}`, x - 14, y - 14, { width: 28, align: 'center' });
    doc.fontSize(4.5).font('Helvetica').fillColor('#64748b');
    doc.text(`P${portNum}`, x - 8, y + 7, { width: 16, align: 'center' });
    doc.restore();
    return { x, y, cx: x, cy: y };
  }

  function drawScanStation(doc, x, y, w, h, portCount) {
    drawUnitBox(doc, x, y, w, h, {
      fill: '#ecfeff',
      stroke: '#0891b2',
      title: 's::can Package',
      lines: ['spectro::lyser V3', 'pH::lyser · ORP cell', `sam::spector ${portCount}-port`, 'con::sole · Modbus'],
    });
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, right: x + w, bottom: y + h };
  }

  /** Recirculating sample loop on P&ID */
  function drawScanLoopPid(doc, taps, station, left, pageH) {
    drawPumpSymbol(doc, station.x - 36, station.cy, 'P-SCAN');
    drawUnitBox(doc, station.x - 58, station.y + 8, 36, 22, {
      fill: '#f1f5f9',
      stroke: '#64748b',
      title: 'Y-Str.',
      titleSize: 6,
      lines: ['Filter'],
    });
    drawFlowLabel(doc, 'L-SCAN recirc · return to source', station.x, station.bottom + 4, {
      width: station.w + 80,
      color: '#0891b2',
      size: 6.5,
    });
    doc.save().strokeColor('#0ea5e9').lineWidth(0.9).dash(3, { space: 2 });
    taps.forEach((t) => {
      doc.moveTo(station.cx, station.y).lineTo(t.cx, t.cy).stroke();
    });
    doc.moveTo(station.x - 36, station.cy).lineTo(station.x, station.cy).stroke();
    doc.undash().restore();
  }

  /** Phase parameter labels on instrumentation sheet */
  function drawScanPortPanel(doc, left, top, ports) {
    diagramText(doc, 's::can sequencer — parameters per port (when active):', left, top, {
      size: 7,
      bold: true,
      color: TITLE_COLOR,
    });
    let y = top + 14;
    ports.forEach((p) => {
      diagramText(
        doc,
        `P${p.port} ${p.valve} ${p.phase}: ${p.params.join(', ')}`,
        left,
        y,
        { size: 6.5, width: 680, lineBreak: false }
      );
      y += 11;
    });
  }

  function singleTankLayout(left, top) {
    const yMain = top + 88;
    const boxH = 118;
    const inf = box(left + 2, yMain + 24, 50, 68);
    const screen = box(inf.right + 12, yMain + 30, 46, 56);
    const pkgX = screen.right + 12;
    const pkgW = 298;
    const pkgY = yMain - 8;
    const pkgH = boxH + 16;
    const anoxW = Math.round(pkgW * 0.35);
    const aerW = pkgW - anoxW - 8;
    const innerY = pkgY + 22;
    const innerH = pkgH - 30;
    const anox = box(pkgX + 8, innerY, anoxW - 8, innerH);
    const aer = box(anox.right + 8, innerY, aerW - 8, innerH);
    const settler = box(aer.right + 12, yMain + 18, 68, 78);
    const eff = box(settler.right + 12, yMain + 24, 64, 66);
    return {
      yMain,
      inf,
      screen,
      pkgX,
      pkgY,
      pkgW,
      pkgH,
      anox,
      aer,
      settler,
      eff,
      irY: pkgY - 42,
      rasY: pkgY + pkgH + 38,
      wasY: settler.bottom + 52,
      crsX: aer.right - 28,
      crsY1: aer.y + 28,
      crsY2: aer.y + 78,
      pipeMidX: aer.right + 6,
    };
  }

  /** Small pipe nozzle marker with tag leader */
  function drawNozzle(doc, x, y, tag, opts = {}) {
    const side = opts.side || 'right';
    const color = opts.color || '#334155';
    doc.save();
    doc.circle(x, y, 5).lineWidth(1.2).fillAndStroke(opts.fill || '#ffffff', color);
    doc.fontSize(opts.size || 6).font('Helvetica-Bold').fillColor(color);
    const tx = side === 'left' ? x - 52 : side === 'center' ? x - 24 : x + 10;
    const ty = y + (opts.labelBelow ? 10 : -14);
    doc.text(tag, tx, ty, { width: 48, align: side === 'center' ? 'center' : side === 'left' ? 'right' : 'left' });
    if (opts.sub) {
      doc.fontSize(5).font('Helvetica').fillColor('#64748b');
      doc.text(opts.sub, tx, ty + 9, { width: 56, align: side === 'center' ? 'center' : side === 'left' ? 'right' : 'left' });
    }
    doc.restore();
    return { x, y };
  }

  /** Enlarged T-200 IBC bottom detail — 3-zone insert (RAS sump / WAS / standpipe overflow). */
  function drawToteClarifierDetail(doc, x, y, w, h, opts = {}) {
    const title = opts.title || 'Detail A — T-200 bottom insert (3 zones)';
    diagramText(doc, title, x, y, { size: 8, bold: true, color: TITLE_COLOR, width: w });

    const boxY = y + 14;
    const elevW = Math.round(w * 0.58);
    const planW = w - elevW - 10;
    const planX = x + elevW + 10;
    const innerH = h - 14;

    // ── Elevation (cross-section) ──
    const ex = x + 4;
    const bodyH = Math.round(innerH * 0.52);
    const coneH = Math.round(innerH * 0.22);
    const notesH = innerH - bodyH - coneH - 8;
    const coneTop = boxY + bodyH;
    const coneBot = coneTop + coneH;

    doc.save().lineWidth(1.5).strokeColor('#ca8a04');
    doc.rect(ex, boxY, elevW - 8, bodyH).fillAndStroke('#fffbeb', '#ca8a04');
    doc.moveTo(ex, coneTop).lineTo(ex + (elevW - 8) / 2, coneBot).lineTo(ex + elevW - 8, coneTop).fillAndStroke('#fef3c7', '#a16207');
    doc.restore();

    const standX = ex + (elevW - 8) / 2;
    const standTop = boxY + 18;
    const standBot = coneTop + 6;
    doc.save().lineWidth(1.2).strokeColor('#059669').fillColor('#ecfdf5');
    doc.rect(standX - 7, standTop, 14, standBot - standTop).fillAndStroke();
    doc.restore();
    diagramText(doc, 'Zone 3', standX - 28, boxY + 8, { size: 6, bold: true, color: '#059669', width: 24 });
    diagramText(doc, 'Standpipe', standX - 18, standTop + 4, { size: 5.5, color: '#047857', width: 40, align: 'center' });
    diagramText(doc, 'L-210 overflow', standX - 28, standTop - 2, { size: 5.5, bold: true, color: '#059669', width: 56, align: 'center' });

    const ifaceY = standBot - 4;
    doc.save().strokeColor('#78350f').lineWidth(0.8).dash(4, { space: 3 });
    doc.moveTo(ex + 6, ifaceY).lineTo(ex + elevW - 14, ifaceY).stroke();
    doc.undash().restore();
    diagramText(doc, 'Sludge interface (rim height)', ex + 10, ifaceY - 10, { size: 5, color: '#78350f', width: elevW - 20 });

    diagramText(doc, 'Supernatant → standpipe only', ex + 10, boxY + 10, { size: 5.5, color: '#475569', width: elevW - 24 });
    diagramText(doc, 'Zone 2 — sludge blanket', ex + 10, coneTop + 2, { size: 5.5, color: '#78350f', width: elevW - 20 });

    const rasX = ex + (elevW - 8) / 2;
    const rasY = coneBot - 4;
    const wasX = ex + elevW - 28;
    const wasY = coneTop + Math.round(coneH * 0.45);

    doc.save().fillColor('#b45309').circle(rasX, rasY, 5).fill();
    diagramText(doc, 'Zone 1', rasX - 30, rasY + 8, { size: 6, bold: true, color: '#b45309', width: 28 });
    diagramText(doc, 'L-RAS 2"', rasX - 14, rasY + 16, { size: 5.5, bold: true, color: '#b45309', width: 40, align: 'center' });
    diagramText(doc, 'apex', rasX - 12, rasY + 24, { size: 5, color: '#92400e', width: 32, align: 'center' });

    doc.save().fillColor('#dc2626').circle(wasX, wasY, 4).fill();
    diagramText(doc, 'Zone 2', wasX + 6, wasY - 4, { size: 6, bold: true, color: '#dc2626', width: 28 });
    diagramText(doc, 'L-WAS 1"', wasX + 6, wasY + 6, { size: 5.5, bold: true, color: '#dc2626', width: 40 });
    diagramText(doc, '+5" above apex', wasX + 6, wasY + 14, { size: 5, color: '#991b1b', width: 48 });

    diagramText(doc, 'HDPE funnel insert (45°)', ex + 8, coneBot + 2, { size: 5, color: '#64748b', width: elevW - 16 });

    // ── Plan view (bottom plate) ──
    const px = planX;
    const py = boxY;
    const pw = planW - 4;
    const ph = innerH - notesH - 6;
    diagramText(doc, 'Plan — bottom plate', px, py - 2, { size: 6.5, bold: true, color: TITLE_COLOR, width: pw });
    doc.save().lineWidth(1.2).strokeColor('#64748b').fillColor('#f8fafc');
    doc.roundedRect(px, py + 10, pw, ph - 10, 4).fillAndStroke();
    const pcx = px + pw / 2;
    const pcy = py + 10 + (ph - 10) / 2;
    doc.circle(pcx, pcy, 10).lineWidth(1).stroke('#059669');
    doc.circle(pcx, pcy, 3).fillAndStroke('#059669', '#047857');
    doc.circle(pcx - 18, pcy + 12, 4).fillAndStroke('#b45309', '#92400e');
    doc.circle(pcx + 20, pcy - 6, 3).fillAndStroke('#dc2626', '#991b1b');
    diagramText(doc, 'RAS', pcx - 24, pcy + 20, { size: 5, color: '#b45309', width: 20, align: 'center' });
    diagramText(doc, 'WAS', pcx + 20, pcy + 2, { size: 5, color: '#dc2626', width: 20, align: 'center' });
    diagramText(doc, 'Standpipe', pcx - 16, pcy - 18, { size: 5, color: '#059669', width: 40, align: 'center' });
    doc.restore();

    const ny = boxY + bodyH + coneH + 6;
    const bullets = opts.bullets || [
      'Zone 1 (RAS): only thickened sludge at apex — never route overflow here.',
      'Zone 2 (WAS): separate 1" port on cone wall, opposite RAS — timed waste draw.',
      'Zone 3 (overflow): standpipe rim above interface — clarified water to T-210 only.',
    ];
    bullets.forEach((line, i) => {
      diagramText(doc, `• ${line}`, x + 4, ny + i * 10, { size: 5.5, width: w - 8, lineBreak: false });
    });

    if (opts.showPumps) {
      const py2 = ny + bullets.length * 10 + 4;
      drawPumpSymbol(doc, x + 20, py2, 'P-RAS');
      drawValveSymbol(doc, x + 56, py2, 'TV-WAS');
      diagramText(doc, 'P-RAS ← Zone 1    TV-WAS ← Zone 2    HV-210 on Zone 3 tee', x + 88, py2 - 4, {
        size: 5.5,
        width: w - 92,
        lineBreak: false,
      });
    }

    return {
      x,
      y: boxY,
      w,
      h: innerH,
      coneBot,
      rasX,
      wasX,
      drainX: standX,
      drainY: standTop,
      portY: rasY,
      standTop,
      standBot,
    };
  }

  /** Bench POC: separate process tanks → 270 gal IBC clarifier → 200 gal final (low profile). */
  function pocToteLayout(left, top, drawW) {
    const yMain = top + 48;
    const inf = box(left + 4, yMain + 36, 54, 72);
    const screen = box(inf.right + 12, yMain + 42, 48, 60);
    const anox = box(screen.right + 16, yMain + 24, 78, 112);
    const aer = box(anox.right + 14, yMain + 14, 94, 128);
    const toteW = 108;
    const toteH = 168;
    const toteX = aer.right + 18;
    const toteY = yMain - 8;
    const tote = box(toteX, toteY, toteW, toteH);
    const finalW = 124;
    const finalH = 56;
    const final = box(toteX + (toteW - finalW) / 2, tote.bottom + 44, finalW, finalH);
    const eff = box(final.right + 16, final.cy - 30, 62, 60);

    const coneY = tote.bottom - 28;
    const rasPort = { x: tote.cx, y: tote.bottom - 8 };
    const wasPort = { x: tote.right - 22, y: coneY + 10 };
    const drainPort = { x: tote.cx, y: tote.y + Math.round(tote.h * 0.38) };
    const mlInlet = { x: tote.x + 12, y: tote.y + 28 };

    const detailW = 228;
    const detailH = 200;
    const detailX = drawW ? left + drawW - detailW - 4 : tote.right + 20;
    const detailY = toteY + 8;

    return {
      yMain,
      inf,
      screen,
      anox,
      aer,
      tote,
      final,
      eff,
      mlInlet,
      rasPort,
      wasPort,
      drainPort,
      coneY,
      detailX,
      detailY,
      detailW,
      detailH,
      irY: anox.y - 32,
      rasLoopY: final.bottom + 22,
      wasBoxX: detailX,
      wasBoxY: detailY + detailH + 8,
      crsX: aer.right - 24,
      crsY1: aer.y + 36,
      crsY2: aer.y + 82,
    };
  }

  /** ── Single train: P&ID ── */
  function drawSingleTankPid(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const L = singleTankLayout(left, top);

    drawUnitBox(doc, L.inf.x, L.inf.y, L.inf.w, L.inf.h, {
      fill: '#ffffff',
      title: 'Influent',
      lines: [`${CFG.flowAvgGpm} GPM`, 'L-100'],
    });
    drawPidTag(doc, L.inf.x, L.inf.y - 10, 'L-100');

    drawArrow(doc, L.inf.right, L.inf.cy, L.screen.x, L.screen.cy);
    drawUnitBox(doc, L.screen.x, L.screen.y, L.screen.w, L.screen.h, {
      fill: '#ffffff',
      title: 'Screen',
      lines: ['6 mm', 'L-101'],
    });
    drawValveSymbol(doc, L.screen.right - 8, L.screen.cy - 14, 'HV-101');

    drawArrow(doc, L.screen.right, L.screen.cy, L.pkgX, L.yMain + 60);
    doc.save().lineWidth(1.8).strokeColor('#0f172a');
    doc.roundedRect(L.pkgX, L.pkgY, L.pkgW, L.pkgH, 6).stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('T-100 MLE Package', L.pkgX + 8, L.pkgY + 6, { width: L.pkgW - 16, align: 'center' });
    doc.restore();

    doc.save().lineWidth(1.2).strokeColor('#64748b');
    doc.moveTo(L.anox.right + 4, L.anox.y).lineTo(L.anox.right + 4, L.anox.bottom).stroke();
    doc.restore();

    drawArrow(doc, L.anox.cx, L.anox.bottom - 8, L.aer.cx, L.aer.y + 12, { color: '#2563eb', width: 1.1 });
    drawFlowLabel(doc, 'Mixed liquor underflow', (L.anox.cx + L.aer.cx) / 2 - 40, L.anox.bottom + 2, { width: 80, size: 6.5 });

    drawArrow(doc, L.aer.right, L.aer.cy, L.settler.x, L.settler.cy);
    drawUnitBox(doc, L.settler.x, L.settler.y, L.settler.w, L.settler.h, {
      fill: '#ffffff',
      title: 'Settler',
      lines: ['L-110', 'RAS/WAS'],
    });
    drawArrow(doc, L.settler.right, L.settler.cy, L.eff.x, L.eff.cy);
    drawUnitBox(doc, L.eff.x, L.eff.y, L.eff.w, L.eff.h, {
      fill: '#ffffff',
      title: 'Effluent',
      lines: ['L-120', 'Discharge'],
    });

    drawPumpSymbol(doc, (L.aer.cx + L.anox.cx) / 2, L.irY, 'P-IR');
    drawArrow(doc, L.aer.cx, L.aer.y, L.aer.cx, L.irY + 12, { color: '#7c3aed', dash: 4, dashSpace: 3 });
    drawArrow(doc, L.aer.cx - 30, L.irY, L.anox.cx + 20, L.irY, { color: '#7c3aed', dash: 4, dashSpace: 3, width: 1.1 });
    drawArrow(doc, L.anox.cx + 20, L.irY, L.anox.cx + 20, L.anox.y, { color: '#7c3aed', dash: 4, dashSpace: 3 });
    drawFlowLabel(doc, `IR ${CFG.irRatio}× Q · ${CFG.irGpm} gpm · L-IR`, L.pkgX, L.irY - 28, {
      width: L.pkgW,
      bold: true,
      color: '#7c3aed',
    });
    drawValveSymbol(doc, L.anox.cx + 20, L.irY + 18, 'FCV-IR');

    drawPumpSymbol(doc, L.settler.cx, L.rasY, 'P-RAS');
    drawArrow(doc, L.settler.cx, L.settler.bottom, L.settler.cx, L.rasY - 12);
    drawArrow(doc, L.settler.cx - 10, L.rasY, L.anox.cx, L.rasY, { color: '#b45309', width: 1.1 });
    drawArrow(doc, L.anox.cx, L.rasY, L.anox.cx, L.anox.bottom);
    drawFlowLabel(doc, `RAS ${CFG.rasPct}% · ${CFG.rasGpm} gpm · L-RAS`, L.pkgX, L.rasY + 18, {
      width: L.pkgW,
      color: '#b45309',
    });

    drawPumpSymbol(doc, L.crsX - 8, (L.crsY1 + L.crsY2) / 2, 'P-CRS');
    drawUnitBox(doc, L.crsX + 14, L.crsY1 - 18, 54, 32, {
      fill: '#e0f2fe',
      stroke: '#0284c7',
      title: 'CRS NBG',
      lines: ['L-CRS', CFG.crsLineSize],
    });
    drawArrow(doc, L.aer.right - 18, L.crsY1, L.crsX - 18, L.crsY1, { color: '#0284c7' });
    drawArrow(doc, L.crsX - 18, L.crsY1, L.crsX - 18, (L.crsY1 + L.crsY2) / 2 - 12, { color: '#0284c7' });
    drawArrow(doc, L.crsX - 18, (L.crsY1 + L.crsY2) / 2 + 12, L.crsX - 18, L.crsY2, { color: '#0284c7' });
    drawArrow(doc, L.crsX - 18, L.crsY2, L.aer.right - 18, L.crsY2, { color: '#0284c7' });
    drawFlowLabel(doc, `CRS sidestream ${CFG.crsSidestreamGpm} GPM`, L.crsX - 10, L.aer.y + 6, {
      width: 110,
      color: '#0284c7',
      size: 7,
    });

    drawArrow(doc, L.settler.cx, L.settler.bottom + 4, L.settler.cx, L.wasY);
    drawValveSymbol(doc, L.settler.cx + 14, L.wasY - 8, 'TV-WAS');
    drawUnitBox(doc, L.settler.cx - 28, L.wasY, 56, 36, {
      fill: '#fee2e2',
      stroke: '#dc2626',
      title: 'WAS',
      lines: [`${CFG.wasGpd} gal/d`, 'L-WAS'],
    });

    const scanY = pageH - 118;
    const station = drawScanStation(doc, left + 8, scanY, 118, 52, getScanPorts(CFG).length);
    const taps = [
      drawSampleTap(doc, L.inf.cx, L.inf.bottom + 8, 'SV-101', 1),
      drawSampleTap(doc, L.anox.x, L.anox.bottom + 4, 'SV-102', 2),
      drawSampleTap(doc, (L.aer.cx + L.anox.cx) / 2, L.irY + 22, 'SV-103', 3),
      drawSampleTap(doc, L.aer.cx, L.aer.bottom + 4, 'SV-104', 4),
      drawSampleTap(doc, L.eff.cx, L.eff.bottom + 6, 'SV-105', 5),
    ];
    drawScanLoopPid(doc, taps, station, left, pageH);

    drawSheetLegend(doc, left, pageH, [
      { type: 'line', color: '#334155', dash: null, label: 'Process pipe' },
      { type: 'line', color: '#7c3aed', dash: 4, label: 'IR recycle' },
      { type: 'line', color: '#b45309', dash: null, label: 'RAS' },
      { type: 'line', color: '#0284c7', dash: null, label: 'CRS sidestream' },
      { type: 'line', color: '#0ea5e9', dash: 3, label: 's::can sample loop' },
      { type: 'text', label: '⊕ Gate / control valve' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'P&ID — Sheet 1');
  }

  /** ── Single train: Mechanical ── */
  function drawSingleTankMechanical(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const L = singleTankLayout(left, top);

    drawUnitBox(doc, L.inf.x, L.inf.y, L.inf.w, L.inf.h, {
      fill: '#f8fafc',
      title: 'Influent',
      lines: [`${CFG.flowAvgGpm} GPM`, `BOD ${CFG.influentBod}`, `TKN ${CFG.influentTkn}`],
    });
    drawUnitBox(doc, L.screen.x, L.screen.y, L.screen.w, L.screen.h, {
      fill: '#f1f5f9',
      title: 'Screen',
      lines: ['6 mm bar', 'SS316 frame'],
    });

    doc.save().lineWidth(1.8).strokeColor('#0f172a');
    doc.roundedRect(L.pkgX, L.pkgY, L.pkgW, L.pkgH, 6).stroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text(`${fmtGpd(CFG.reactorGal)} gal Package Reactor (MLE + IFAS)`, L.pkgX + 8, L.pkgY + 6, {
      width: L.pkgW - 16,
      align: 'center',
    });
    doc.restore();

    drawUnitBox(doc, L.anox.x, L.anox.y, L.anox.w, L.anox.h, {
      fill: '#dbeafe',
      stroke: '#2563eb',
      title: 'Pre-Anoxic Zone',
      lines: [`${fmtGpd(CFG.anoxicGal)} gal (35%)`, `Mixer ${CFG.anoxicMixerHp} HP`, 'Submersible', 'No aeration'],
    });
    doc.save().lineWidth(1.5).strokeColor('#64748b');
    doc.moveTo(L.anox.right + 4, L.anox.y).lineTo(L.anox.right + 4, L.anox.bottom).stroke();
    doc.restore();

    drawUnitBox(doc, L.aer.x, L.aer.y, L.aer.w, L.aer.h, {
      fill: '#dcfce7',
      stroke: '#16a34a',
      title: 'Aerobic IFAS Zone',
      lines: [`${fmtGpd(CFG.aerobicGal)} gal (65%)`, 'Fixed PVA 50%', `~${fmtGpd(CFG.pvaFt3)} ft³ media`, 'SS retention cages'],
    });
    doc.save().strokeColor('#86efac').lineWidth(0.5);
    for (let i = L.aer.x + 10; i < L.aer.right - 10; i += 12) {
      doc.moveTo(i, L.aer.y + 52).lineTo(i + 6, L.aer.y + 62).stroke();
    }
    doc.restore();

    drawUnitBox(doc, L.crsX + 14, L.crsY1 - 18, 54, 32, {
      fill: '#e0f2fe',
      stroke: '#0284c7',
      title: 'CRS NBG',
      lines: [CFG.crsLineSize, '316 SS', 'Passive cavitation'],
    });
    drawUnitBox(doc, L.aer.x + 8, L.aer.bottom - 28, 62, 22, {
      fill: '#ffffff',
      stroke: '#64748b',
      title: 'Backup diff.',
      titleSize: 7,
      lines: [`${CFG.backupBlowerHp} HP`, 'Fine bubble DO trim'],
    });
    drawFlowLabel(doc, `Sidestream pump ${CFG.sidestreamPumpHp} HP · ${CFG.crsSidestreamGpm} GPM`, L.crsX - 20, L.aer.y - 6, {
      width: 120,
      color: '#0284c7',
      size: 6.5,
    });

    drawUnitBox(doc, L.settler.x, L.settler.y, L.settler.w, L.settler.h, {
      fill: '#fef9c3',
      stroke: '#ca8a04',
      title: 'Lamella Settler',
      lines: [`~${fmtGpd(CFG.settlerGal)} gal`, 'Tube pack / plate', 'RAS + WAS ports'],
    });
    drawUnitBox(doc, L.eff.x, L.eff.y, L.eff.w, L.eff.h, {
      fill: '#ecfdf5',
      stroke: '#059669',
      title: 'Effluent',
      lines: ['BOD/TSS ≤10', 'NO3 ≤10 mg/L'],
    });
    drawUnitBox(doc, L.settler.cx - 28, L.wasY, 56, 36, {
      fill: '#fee2e2',
      stroke: '#dc2626',
      title: 'WAS',
      lines: [`${CFG.wasGpd} gal/d`, 'SRT 15–20 d'],
    });

    const scanY = L.pkgY + L.pkgH + 58;
    drawScanStation(doc, left + 4, scanY, 130, 56, getScanPorts(CFG).length);
    diagramText(doc, 'Analyzer shelter · heated cabinet · 120 V · sample pump P-SCAN', left + 140, scanY + 12, {
      size: 6.5,
      width: 400,
      lineBreak: false,
    });

    diagramText(doc, `Footprint ~${CFG.footprintSqFt} ft² · HRT ${CFG.hrtDays} d @ ${CFG.flowAvgGpm} GPM`, left, pageH - 72, {
      size: 7,
      width: drawW,
      lineBreak: false,
    });
    drawSheetLegend(doc, left, pageH, [
      { type: 'text', label: 'Blue = anoxic zone' },
      { type: 'text', label: 'Green = aerobic IFAS + PVA' },
      { type: 'text', label: 'Yellow = clarifier/settler' },
      { type: 'text', label: 'Cyan = CRS nanobubble loop' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'Mechanical — Sheet 2');
  }

  /** ── Single train: Instrumentation (s::can recirculating optical loop) ── */
  function drawSingleTankInstrumentation(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const L = singleTankLayout(left, top);
    const ports = getScanPorts(CFG);

    drawGhostProcess(doc, [
      L.inf,
      L.screen,
      box(L.pkgX, L.pkgY, L.pkgW, L.pkgH),
      L.settler,
      L.eff,
    ]);

    const scanY = L.pkgY + L.pkgH + 48;
    const station = drawScanStation(doc, left + 4, scanY, 124, 54, ports.length);
    const taps = [
      drawSampleTap(doc, L.inf.cx, L.inf.y - 6, 'SV-101', 1),
      drawSampleTap(doc, L.anox.x + 12, L.anox.y + 8, 'SV-102', 2),
      drawSampleTap(doc, (L.aer.cx + L.anox.cx) / 2, L.irY + 8, 'SV-103', 3),
      drawSampleTap(doc, L.aer.x + 20, L.aer.y + 10, 'SV-104', 4),
      drawSampleTap(doc, L.eff.cx, L.eff.y - 4, 'SV-105', 5),
    ];
    drawScanLoopPid(doc, taps, station, left, pageH);

    drawInstrumentBubble(doc, L.aer.x + 14, L.aer.y + 14, 'DO');
    drawFlowLabel(doc, 'AER_DO — dedicated continuous (not on scan loop)', L.aer.x, L.aer.y + 28, {
      width: 100,
      size: 6,
      color: '#16a34a',
    });

    const mvY = scanY + 62;
    drawUnitBox(doc, left + 4, mvY, 100, 52, {
      fill: '#f8fafc',
      stroke: '#64748b',
      title: 'MooreVIEW',
      lines: [CFG.mooreviewProject || 'mle-wastewater', 'All SCAN tags', 'Modbus TCP'],
    });
    drawUnitBox(doc, left + 112, mvY, 96, 52, {
      fill: '#faf5ff',
      stroke: '#7c3aed',
      title: 'AI Optimizer',
      lines: ['INF_BOD C:N', 'AI_CARBON_LIM', 'IR/WAS/DO'],
    });
    doc.save().strokeColor('#94a3b8').lineWidth(0.8).dash(3, { space: 2 });
    doc.moveTo(left + 104, mvY + 18).lineTo(left + 112, mvY + 18).stroke();
    doc.moveTo(left + 62, mvY).lineTo(station.cx, station.bottom).stroke();
    doc.undash().restore();

    drawScanPortPanel(doc, left + 220, scanY, ports);
    drawFlowLabel(doc, 'EFF_NO3 + INF_BOD → IR / carbon-limit logic', L.pkgX, L.irY - 6, {
      width: L.pkgW,
      color: '#7c3aed',
      size: 7,
    });
    diagramText(
      doc,
      `${SCAN_VENDOR} spectro::lyser: BOD/COD/NO3/NH3/TSS/SAC254 · pH::lyser + ORP at anoxic ports · ${CFG.scanDwellMin || 8} min/port`,
      left,
      pageH - 72,
      { size: 6.5, width: drawW, lineBreak: false }
    );

    drawSheetLegend(doc, left, pageH, [
      { type: 'line', color: '#0ea5e9', dash: 3, label: 'Sample loop' },
      { type: 'text', label: 'SV = sequencer sample valve' },
      { type: 'text', label: 'DO = dedicated aerobic probe' },
      { type: 'line', color: '#94a3b8', dash: 3, label: 'Modbus to SCADA' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'Instrumentation — Sheet 3');
  }

  /** ── POC tote layout: P&ID ── */
  function drawPocTotePid(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const L = pocToteLayout(left, top, drawW);

    drawUnitBox(doc, L.inf.x, L.inf.y, L.inf.w, L.inf.h, {
      fill: '#ffffff',
      title: 'Influent',
      lines: [`${CFG.flowAvgGpm} GPM`, 'L-100'],
    });
    drawPidTag(doc, L.inf.x, L.inf.y - 10, 'L-100');
    drawArrow(doc, L.inf.right, L.inf.cy, L.screen.x, L.screen.cy);
    drawUnitBox(doc, L.screen.x, L.screen.y, L.screen.w, L.screen.h, {
      fill: '#ffffff',
      title: 'Screen',
      lines: ['6 mm', 'L-101'],
    });
    drawValveSymbol(doc, L.screen.right - 8, L.screen.cy - 14, 'HV-101');

    drawArrow(doc, L.screen.right, L.screen.cy, L.anox.x, L.anox.cy);
    drawUnitBox(doc, L.anox.x, L.anox.y, L.anox.w, L.anox.h, {
      fill: '#dbeafe',
      stroke: '#2563eb',
      title: 'T-100 Anoxic',
      lines: [`${fmtGpd(CFG.anoxicGal)} gal`, 'L-102', 'RAS return here'],
    });
    drawPidTag(doc, L.anox.x, L.anox.y - 10, 'T-100');

    drawArrow(doc, L.anox.right, L.anox.cy, L.aer.x, L.aer.cy);
    drawFlowLabel(doc, 'Mixed liquor', (L.anox.right + L.aer.x) / 2 - 30, L.anox.cy - 10, { width: 60, size: 6.5 });
    drawUnitBox(doc, L.aer.x, L.aer.y, L.aer.w, L.aer.h, {
      fill: '#dcfce7',
      stroke: '#16a34a',
      title: 'T-110 Aerobic IFAS',
      lines: [`${fmtGpd(CFG.aerobicGal)} gal`, 'L-103', 'PVA + CRS'],
    });
    drawPidTag(doc, L.aer.x, L.aer.y - 10, 'T-110');

    drawArrow(doc, L.aer.right, L.aer.cy, L.mlInlet.x, L.mlInlet.y, { width: 1.4 });
    drawFlowLabel(doc, 'ML overflow → clarifier', L.aer.right + 4, L.aer.cy - 18, {
      width: 90,
      size: 6.5,
      align: 'left',
    });

    doc.save().lineWidth(1.8).strokeColor('#ca8a04').fillColor('#fffbeb');
    doc.roundedRect(L.tote.x, L.tote.y, L.tote.w, L.tote.h, 5).fillAndStroke();
    doc.moveTo(L.tote.x + 8, L.coneY)
      .lineTo(L.tote.cx, L.tote.bottom - 4)
      .lineTo(L.tote.right - 8, L.coneY)
      .lineWidth(1)
      .strokeColor('#a16207')
      .stroke();
    doc.lineWidth(1.2).strokeColor('#059669').fillColor('#ecfdf5');
    doc.rect(L.tote.cx - 5, L.drainPort.y - 6, 10, L.coneY - L.drainPort.y + 6).fillAndStroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('T-200 IBC Clarifier', L.tote.x + 6, L.tote.y + 8, { width: L.tote.w - 12, align: 'center' });
    doc.fontSize(6.5).font('Helvetica').fillColor('#475569');
    doc.text(`${fmtGpd(CFG.clarifierGal || CFG.settlerGal)} gal · 3-zone bottom`, L.tote.x + 6, L.tote.y + 22, {
      width: L.tote.w - 12,
      align: 'center',
    });
    doc.text('Detail A →', L.tote.x + 6, L.tote.y + 34, { width: L.tote.w - 12, align: 'center' });
    doc.restore();
    drawPidTag(doc, L.tote.x, L.tote.y - 10, 'T-200');

    drawNozzle(doc, L.rasPort.x, L.rasPort.y, 'L-RAS', { color: '#b45309', side: 'left', sub: 'Z1 apex' });
    drawNozzle(doc, L.wasPort.x, L.wasPort.y, 'L-WAS', { color: '#dc2626', side: 'right', sub: 'Z2 +5"' });
    drawNozzle(doc, L.drainPort.x, L.drainPort.y - 8, 'L-210', {
      color: '#059669',
      side: 'center',
      sub: 'Z3 pipe',
      labelBelow: false,
    });

    doc.save().strokeColor('#94a3b8').lineWidth(0.7).dash(2, { space: 2 });
    doc.moveTo(L.rasPort.x, L.rasPort.y).lineTo(L.detailX + 40, L.detailY + 120).stroke();
    doc.moveTo(L.wasPort.x, L.wasPort.y).lineTo(L.detailX + L.detailW - 30, L.detailY + 95).stroke();
    doc.moveTo(L.drainPort.x, L.drainPort.y).lineTo(L.detailX + L.detailW / 2, L.detailY + 40).stroke();
    doc.undash().restore();

    const detail = drawToteClarifierDetail(doc, L.detailX, L.detailY, L.detailW, L.detailH, {
      title: 'Detail A — 3-zone bottom insert (elevation + plan)',
      showPumps: true,
    });

    drawArrow(doc, L.drainPort.x, L.drainPort.y + 14, L.final.cx, L.final.y, { color: '#059669', width: 1.3 });
    drawValveSymbol(doc, L.tote.cx + 18, L.drainPort.y + 28, 'HV-210');
    drawFlowLabel(doc, 'Zone 3 — standpipe overflow (clarified only)', L.tote.cx - 72, L.drainPort.y + 18, {
      width: 144,
      size: 6,
      color: '#059669',
    });

    drawUnitBox(doc, L.final.x, L.final.y, L.final.w, L.final.h, {
      fill: '#ecfdf5',
      stroke: '#059669',
      title: 'T-210 Final',
      lines: [`${fmtGpd(CFG.finalTankGal)} gal`, 'Low profile', 'L-120 · SV-105'],
    });
    drawPidTag(doc, L.final.x, L.final.y - 10, 'T-210');

    drawArrow(doc, L.final.right, L.final.cy, L.eff.x, L.eff.cy);
    drawUnitBox(doc, L.eff.x, L.eff.y, L.eff.w, L.eff.h, {
      fill: '#ffffff',
      title: 'Effluent',
      lines: ['L-130', 'Discharge'],
    });

    drawPumpSymbol(doc, (L.aer.cx + L.anox.cx) / 2, L.irY, 'P-IR');
    drawArrow(doc, L.aer.cx, L.aer.y, L.aer.cx, L.irY + 12, { color: '#7c3aed', dash: 4, dashSpace: 3 });
    drawArrow(doc, L.aer.cx - 28, L.irY, L.anox.cx + 20, L.irY, { color: '#7c3aed', dash: 4, dashSpace: 3, width: 1.1 });
    drawArrow(doc, L.anox.cx + 20, L.irY, L.anox.cx + 20, L.anox.y, { color: '#7c3aed', dash: 4, dashSpace: 3 });
    drawFlowLabel(doc, `IR ${CFG.irRatio}× Q · ${CFG.irGpm} gpm · L-IR`, L.anox.x - 4, L.irY - 24, {
      width: L.aer.right - L.anox.x + 36,
      bold: true,
      color: '#7c3aed',
    });
    drawValveSymbol(doc, L.anox.cx + 20, L.irY + 14, 'FCV-IR');

    drawPumpSymbol(doc, L.rasPort.x - 28, L.rasLoopY, 'P-RAS');
    drawArrow(doc, L.rasPort.x, L.rasPort.y + 6, L.rasPort.x - 28, L.rasLoopY - 12, { color: '#b45309', width: 1.2 });
    drawArrow(doc, L.rasPort.x - 28, L.rasLoopY, L.anox.cx, L.rasLoopY, { color: '#b45309', width: 1.3 });
    drawArrow(doc, L.anox.cx, L.rasLoopY, L.anox.cx, L.anox.bottom, { color: '#b45309', width: 1.3 });
    drawFlowLabel(doc, `RAS ${CFG.rasPct}% · ${CFG.rasGpm} gpm from Zone 1 apex`, L.anox.x, L.rasLoopY + 14, {
      width: L.tote.x - L.anox.x,
      color: '#b45309',
      size: 6.5,
      align: 'left',
    });

    drawArrow(doc, L.wasPort.x, L.wasPort.y + 6, L.wasPort.x + 36, L.wasPort.y + 36, { color: '#dc2626', width: 1.1 });
    drawValveSymbol(doc, L.wasPort.x + 20, L.wasPort.y + 22, 'TV-WAS');
    drawUnitBox(doc, L.wasBoxX, L.wasBoxY, 72, 40, {
      fill: '#fee2e2',
      stroke: '#dc2626',
      title: 'WAS waste',
      lines: [`${CFG.wasGpd} gal/d`, 'L-WAS', 'Zone 2 draw'],
    });
    drawArrow(doc, L.wasPort.x + 36, L.wasPort.y + 36, L.wasBoxX, L.wasBoxY + 20, { color: '#dc2626', width: 1.1 });
    drawFlowLabel(doc, 'WAS: Zone 2 only — 1" port 5" above apex', L.wasPort.x - 20, L.wasPort.y + 36, {
      width: 130,
      size: 6,
      color: '#dc2626',
      align: 'left',
    });

    drawPumpSymbol(doc, L.crsX - 8, (L.crsY1 + L.crsY2) / 2, 'P-CRS');
    drawUnitBox(doc, L.crsX + 12, L.crsY1 - 16, 52, 32, {
      fill: '#e0f2fe',
      stroke: '#0284c7',
      title: 'CRS NBG',
      lines: ['L-CRS', CFG.crsLineSize],
    });
    drawArrow(doc, L.aer.right - 18, L.crsY1, L.crsX - 18, L.crsY1, { color: '#0284c7' });
    drawArrow(doc, L.crsX - 18, L.crsY1, L.crsX - 18, (L.crsY1 + L.crsY2) / 2 - 10, { color: '#0284c7' });
    drawArrow(doc, L.crsX - 18, (L.crsY1 + L.crsY2) / 2 + 10, L.crsX - 18, L.crsY2, { color: '#0284c7' });
    drawArrow(doc, L.crsX - 18, L.crsY2, L.aer.right - 18, L.crsY2, { color: '#0284c7' });

    const scanY = pageH - 108;
    const station = drawScanStation(doc, left + 8, scanY, 118, 48, getScanPorts(CFG).length);
    const taps = [
      drawSampleTap(doc, L.inf.cx, L.inf.bottom + 8, 'SV-101', 1),
      drawSampleTap(doc, L.anox.x + 10, L.anox.bottom + 4, 'SV-102', 2),
      drawSampleTap(doc, (L.aer.cx + L.anox.cx) / 2, L.irY + 18, 'SV-103', 3),
      drawSampleTap(doc, L.aer.cx, L.aer.bottom + 4, 'SV-104', 4),
      drawSampleTap(doc, L.final.cx, L.final.bottom + 6, 'SV-105', 5),
    ];
    drawScanLoopPid(doc, taps, station, left, pageH);

    drawSheetLegend(doc, left, pageH, [
      { type: 'line', color: '#334155', dash: null, label: 'Process / ML flow' },
      { type: 'line', color: '#b45309', dash: null, label: 'RAS — L-RAS @ cone sump (sludge)' },
      { type: 'line', color: '#dc2626', dash: null, label: 'WAS — L-WAS @ cone sump (waste)' },
      { type: 'line', color: '#059669', dash: null, label: 'L-210 overflow — supernatant to T-210' },
      { type: 'line', color: '#7c3aed', dash: 4, label: 'IR recycle' },
      { type: 'text', label: 'Z1 RAS apex · Z2 WAS on cone · Z3 standpipe overflow' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'P&ID — Sheet 1');
  }

  /** ── POC tote layout: Mechanical ── */
  function drawPocToteMechanical(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const L = pocToteLayout(left, top, drawW);

    drawUnitBox(doc, L.inf.x, L.inf.y, L.inf.w, L.inf.h, {
      fill: '#f8fafc',
      title: 'Influent',
      lines: [`${CFG.flowAvgGpm} GPM`, `BOD ${CFG.influentBod}`, `TKN ${CFG.influentTkn}`],
    });
    drawUnitBox(doc, L.screen.x, L.screen.y, L.screen.w, L.screen.h, {
      fill: '#f1f5f9',
      title: 'Screen',
      lines: ['6 mm bar', 'SS316'],
    });
    drawUnitBox(doc, L.anox.x, L.anox.y, L.anox.w, L.anox.h, {
      fill: '#dbeafe',
      stroke: '#2563eb',
      title: 'T-100 Anoxic',
      lines: [`${fmtGpd(CFG.anoxicGal)} gal`, `Mixer ${CFG.anoxicMixerHp} HP`, 'RAS enters here'],
    });
    drawUnitBox(doc, L.aer.x, L.aer.y, L.aer.w, L.aer.h, {
      fill: '#dcfce7',
      stroke: '#16a34a',
      title: 'T-110 Aerobic IFAS',
      lines: [`${fmtGpd(CFG.aerobicGal)} gal`, `PVA ~${fmtGpd(CFG.pvaFt3)} ft³`, 'ML out → T-200'],
    });
    drawUnitBox(doc, L.crsX + 10, L.crsY1 - 14, 50, 30, {
      fill: '#e0f2fe',
      stroke: '#0284c7',
      title: 'CRS NBG',
      lines: [CFG.crsLineSize, '316 SS'],
    });

    doc.save().lineWidth(2).strokeColor('#ca8a04').fillColor('#fef9c3');
    doc.roundedRect(L.tote.x, L.tote.y, L.tote.w, L.tote.h, 5).fillAndStroke();
    doc.moveTo(L.tote.x + 10, L.coneY)
      .lineTo(L.tote.cx, L.tote.bottom - 4)
      .lineTo(L.tote.right - 10, L.coneY)
      .lineWidth(1.2)
      .strokeColor('#a16207')
      .stroke();
    doc.lineWidth(1.2).strokeColor('#059669').fillColor('#ecfdf5');
    doc.rect(L.tote.cx - 5, L.drainPort.y - 6, 10, L.coneY - L.drainPort.y + 6).fillAndStroke();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('T-200 — 270 gal IBC', L.tote.x + 6, L.tote.y + 10, { width: L.tote.w - 12, align: 'center' });
    doc.fontSize(6.5).font('Helvetica').fillColor('#475569');
    doc.text('3-zone bottom insert · Detail A →', L.tote.x + 6, L.tote.y + 24, { width: L.tote.w - 12, align: 'center' });
    doc.text('Z1 RAS · Z2 WAS · Z3 standpipe', L.tote.x + 6, L.tote.y + 36, { width: L.tote.w - 12, align: 'center' });
    doc.restore();

    drawNozzle(doc, L.rasPort.x, L.rasPort.y, 'L-RAS', { color: '#b45309', side: 'left', sub: 'Z1 apex' });
    drawNozzle(doc, L.wasPort.x, L.wasPort.y, 'L-WAS', { color: '#dc2626', side: 'right', sub: 'Z2 +5"' });
    drawNozzle(doc, L.drainPort.x, L.drainPort.y - 8, 'L-210', {
      color: '#059669',
      side: 'center',
      sub: 'Z3 pipe',
      labelBelow: false,
    });

    drawToteClarifierDetail(doc, L.detailX, L.detailY, L.detailW, L.detailH + 36, {
      title: 'Detail A — 3-zone bottom insert (elevation + plan)',
      showPumps: true,
    });

    drawPumpSymbol(doc, L.rasPort.x - 30, L.rasLoopY, 'P-RAS');
    doc.save().strokeColor('#b45309').lineWidth(1.3);
    doc.moveTo(L.rasPort.x, L.rasPort.y + 6).lineTo(L.rasPort.x - 30, L.rasLoopY - 10).stroke();
    doc.moveTo(L.rasPort.x - 30, L.rasLoopY).lineTo(L.anox.cx, L.rasLoopY).stroke();
    doc.moveTo(L.anox.cx, L.rasLoopY).lineTo(L.anox.cx, L.anox.bottom).stroke();
    doc.restore();
    drawFlowLabel(doc, 'RAS line — Zone 1 thickened sludge', L.anox.x, L.rasLoopY + 12, {
      width: L.tote.x - L.anox.x,
      size: 6.5,
      color: '#b45309',
      align: 'left',
    });

    drawValveSymbol(doc, L.wasPort.x + 18, L.wasPort.y + 20, 'TV-WAS');
    drawUnitBox(doc, L.wasBoxX, L.wasBoxY, 88, 44, {
      fill: '#fee2e2',
      stroke: '#dc2626',
      title: 'WAS holding',
      lines: [`${CFG.wasGpd} gal/d`, 'Zone 2 draw', 'SRT 15–20 d'],
    });
    doc.save().strokeColor('#dc2626').lineWidth(1.2);
    doc.moveTo(L.wasPort.x, L.wasPort.y + 6).lineTo(L.wasPort.x + 18, L.wasPort.y + 20).stroke();
    doc.moveTo(L.wasPort.x + 36, L.wasPort.y + 28).lineTo(L.wasBoxX, L.wasBoxY + 22).stroke();
    doc.restore();

    drawArrow(doc, L.drainPort.x, L.drainPort.y + 14, L.final.cx, L.final.y, { color: '#059669', width: 1.4 });
    drawUnitBox(doc, L.final.x, L.final.y, L.final.w, L.final.h, {
      fill: '#ecfdf5',
      stroke: '#059669',
      title: 'T-210 Final Tank',
      lines: [`${fmtGpd(CFG.finalTankGal)} gal`, 'Low profile', 'SV-105 sample'],
    });
    drawUnitBox(doc, L.eff.x, L.eff.y, L.eff.w, L.eff.h, {
      fill: '#f0fdf4',
      stroke: '#16a34a',
      title: 'Discharge',
      lines: ['NO3 ≤10 mg/L', 'Grab + online'],
    });

    const mechNoteY = L.wasBoxY + 58;
    diagramText(doc, 'RAS vs WAS vs overflow (mechanical summary):', left, mechNoteY, {
      size: 7.5,
      bold: true,
      color: TITLE_COLOR,
      width: drawW,
    });
    diagramText(
      doc,
      '• L-RAS + P-RAS: 2" camlock at lowest point of IBC cone — thickened sludge blanket only; returns to T-100 anoxic inlet.',
      left,
      mechNoteY + 14,
      { size: 6.5, width: drawW - 8, lineBreak: false }
    );
    diagramText(
      doc,
      '• L-WAS + TV-WAS: separate 1" port at cone sump (same elevation, opposite side) — timed waste draw to holding tote; not mixed with RAS line.',
      left,
      mechNoteY + 26,
      { size: 6.5, width: drawW - 8, lineBreak: false }
    );
    diagramText(
      doc,
      '• L-210: center cone overflow — clarified supernatant only (above sludge interface) → T-210 final tank; HV-210 isolation valve.',
      left,
      mechNoteY + 38,
      { size: 6.5, width: drawW - 8, lineBreak: false }
    );

    diagramText(
      doc,
      `Footprint ~${CFG.footprintSqFt} ft² · bio ${fmtGpd(CFG.reactorGal)} gal + IBC ${fmtGpd(CFG.clarifierGal)} gal + final ${fmtGpd(CFG.finalTankGal)} gal`,
      left,
      pageH - 56,
      { size: 7, width: drawW, lineBreak: false }
    );
    drawSheetLegend(doc, left, pageH, [
      { type: 'text', label: 'Orange = RAS sludge recycle (cone sump)' },
      { type: 'text', label: 'Red = WAS waste draw (cone sump, separate port)' },
      { type: 'text', label: 'Green = clarified overflow to T-210 (not sludge)' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'Mechanical — Sheet 2');
  }

  /** ── POC tote layout: Instrumentation ── */
  function drawPocToteInstrumentation(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const L = pocToteLayout(left, top, drawW);
    const ports = getScanPorts(CFG);

    drawGhostProcess(doc, [L.inf, L.screen, L.anox, L.aer, L.tote, L.final, L.eff]);

    const scanY = L.final.bottom + 42;
    const station = drawScanStation(doc, left + 4, scanY, 124, 54, ports.length);
    const taps = [
      drawSampleTap(doc, L.inf.cx, L.inf.y - 6, 'SV-101', 1),
      drawSampleTap(doc, L.anox.x + 10, L.anox.y + 8, 'SV-102', 2),
      drawSampleTap(doc, (L.aer.cx + L.anox.cx) / 2, L.irY + 6, 'SV-103', 3),
      drawSampleTap(doc, L.aer.x + 18, L.aer.y + 10, 'SV-104', 4),
      drawSampleTap(doc, L.final.cx, L.final.y - 4, 'SV-105', 5),
    ];
    drawScanLoopPid(doc, taps, station, left, pageH);

    drawInstrumentBubble(doc, L.aer.x + 12, L.aer.y + 12, 'DO');
    drawFlowLabel(doc, 'AER_DO — dedicated continuous', L.aer.x, L.aer.y + 26, { width: 90, size: 6, color: '#16a34a' });

    const mvY = scanY + 62;
    drawUnitBox(doc, left + 4, mvY, 100, 52, {
      fill: '#f8fafc',
      stroke: '#64748b',
      title: 'MooreVIEW',
      lines: [CFG.mooreviewProject || 'mle-poc-50gpd', 'Modbus TCP'],
    });
    drawUnitBox(doc, left + 112, mvY, 96, 52, {
      fill: '#faf5ff',
      stroke: '#7c3aed',
      title: 'AI Optimizer',
      lines: ['INF_BOD C:N', 'EFF_NO3 @ T-210'],
    });
    drawScanPortPanel(doc, left + 220, scanY, ports);
    diagramText(
      doc,
      `EFF sample at T-210 final tank (SV-105) · clarifier T-200 tote — no online probe in supernatant zone`,
      left,
      pageH - 72,
      { size: 6.5, width: drawW, lineBreak: false }
    );
    drawSheetLegend(doc, left, pageH, [
      { type: 'line', color: '#0ea5e9', dash: 3, label: 'Sample loop' },
      { type: 'text', label: 'Permit point = T-210 final discharge' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'Instrumentation — Sheet 3');
  }

  /** ── Dual 125K: P&ID ── */
  function drawDual125kPid(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const yMain = top + 82;

    const inf = drawUnitBox(doc, left + 2, yMain + 28, 48, 62, {
      fill: '#ffffff',
      title: 'Influent',
      lines: [`${CFG.flowAvgGpm} GPM`, 'L-100'],
    });
    drawArrow(doc, inf.right, inf.cy, inf.right + 10, inf.cy);
    const eq = drawUnitBox(doc, inf.right + 10, yMain + 32, 52, 54, {
      fill: '#fef3c7',
      stroke: '#d97706',
      title: 'EQ Basin',
      lines: [`${fmtGpd(CFG.eqBasinGal)} gal`, 'L-105'],
    });
    drawArrow(doc, eq.right, eq.cy, eq.right + 10, eq.cy);

    const splitX = eq.right + 10;
    const trainW = 148;
    const trainH = 100;
    const trainY = yMain + 4;

    function pidTrain(x, label) {
      doc.save().lineWidth(1.6).strokeColor('#0f172a');
      doc.roundedRect(x, trainY, trainW, trainH + 18, 5).stroke();
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text(`${label} · T-${label.slice(-1)}00`, x + 4, trainY + 4, { width: trainW - 8, align: 'center' });
      doc.restore();
      drawPumpSymbol(doc, x + trainW / 2, trainY - 18, 'P-IR');
      drawFlowLabel(doc, `IR ${CFG.irRatio}× · L-IR${label.slice(-1)}`, x + trainW / 2 - 28, trainY - 32, {
        width: 60,
        size: 6,
        color: '#7c3aed',
      });
      drawValveSymbol(doc, x + trainW / 2 + 20, trainY - 8, `FCV-IR${label.slice(-1)}`);
      return { cx: x + trainW / 2, right: x + trainW, cy: trainY + trainH / 2, x };
    }

    const t1 = pidTrain(splitX, 'Train 1');
    const t2 = pidTrain(splitX + trainW + 14, 'Train 2');
    drawArrow(doc, eq.right, eq.cy - 8, t1.x + 20, trainY + trainH + 18);
    drawArrow(doc, eq.right, eq.cy + 8, t2.x + 20, trainY + trainH + 18);

    const clarX = t2.right + 12;
    const clar = drawUnitBox(doc, clarX, yMain + 18, 72, 78, {
      fill: '#ffffff',
      title: 'Clarifier',
      lines: ['L-110', 'RAS/WAS'],
    });
    drawArrow(doc, t1.right, t1.cy, clarX, t1.cy);
    drawArrow(doc, t2.right, t2.cy, clarX, t2.cy);
    drawArrow(doc, clar.right, clar.cy, clar.right + 10, clar.cy);
    drawUnitBox(doc, clar.right + 10, yMain + 26, 58, 62, {
      fill: '#ffffff',
      title: 'Effluent',
      lines: ['L-120'],
    });

    const rasY = trainY + trainH + 52;
    drawPumpSymbol(doc, clar.cx, rasY, 'P-RAS');
    drawArrow(doc, clar.cx, clar.bottom, clar.cx, rasY - 10);
    drawFlowLabel(doc, `RAS ${CFG.rasPct}% · ${CFG.rasGpm} gpm · L-RAS`, clarX - 20, rasY + 16, {
      width: 140,
      color: '#b45309',
    });

    const ports = getScanPorts(CFG);
    const scanY = pageH - 118;
    const station = drawScanStation(doc, left + 8, scanY, 124, 52, ports.length);
    const t1x = splitX;
    const t2x = splitX + trainW + 14;
    const taps = [
      drawSampleTap(doc, inf.cx, inf.bottom + 6, 'SV-101', 1),
      drawSampleTap(doc, t1x + 30, trainY + trainH + 8, 'SV-102', 2),
      drawSampleTap(doc, t2x + 30, trainY + trainH + 8, 'SV-103', 3),
      drawSampleTap(doc, t1x + trainW / 2, trainY - 6, 'SV-104', 4),
      drawSampleTap(doc, clarX + 36, yMain + 12, 'SV-105', 5),
      drawSampleTap(doc, clar.right + 34, yMain + 40, 'SV-106', 6),
    ];
    drawScanLoopPid(doc, taps, station, left, pageH);

    drawSheetLegend(doc, left, pageH, [
      { type: 'line', color: '#334155', dash: null, label: 'Process pipe' },
      { type: 'line', color: '#7c3aed', dash: 4, label: 'IR per train' },
      { type: 'line', color: '#b45309', dash: null, label: 'RAS' },
      { type: 'line', color: '#0ea5e9', dash: 3, label: 's::can sample loop' },
      { type: 'text', label: '⊕ Control valve' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'P&ID — Sheet 1');
  }

  /** ── Dual 125K: Mechanical ── */
  function drawDual125kMechanical(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const yMain = top + 82;

    drawUnitBox(doc, left + 2, yMain + 28, 48, 62, {
      fill: '#f8fafc',
      title: 'Influent',
      lines: [`${fmtGpd(CFG.flowAvgGpd)} GPD`, `BOD ${CFG.influentBod}`],
    });
    const eq = drawUnitBox(doc, left + 60, yMain + 32, 52, 54, {
      fill: '#fef3c7',
      stroke: '#d97706',
      title: 'EQ Basin',
      lines: [`${fmtGpd(CFG.eqBasinGal)} gal`, 'Peak shave'],
    });

    const splitX = eq.right + 10;
    const trainW = 148;
    const trainH = 100;
    const trainY = yMain + 4;

    function mechTrain(x, label) {
      doc.save().lineWidth(1.6).strokeColor('#0f172a');
      doc.roundedRect(x, trainY, trainW, trainH + 18, 5).stroke();
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text(`${label} — 125K gal MLE`, x + 4, trainY + 4, { width: trainW - 8, align: 'center' });
      doc.restore();
      const anoxW = Math.round(trainW * 0.35);
      drawUnitBox(doc, x + 6, trainY + 16, anoxW - 6, trainH - 8, {
        fill: '#dbeafe',
        stroke: '#2563eb',
        title: 'Anoxic',
        lines: [`${fmtGpd(CFG.perTrainAnoxicGal)} gal`, `${CFG.anoxicMixerHp} HP mixer`],
      });
      doc.save().lineWidth(1.2).strokeColor('#64748b');
      doc.moveTo(x + 6 + anoxW - 6 + 3, trainY + 16).lineTo(x + 6 + anoxW - 6 + 3, trainY + trainH + 8).stroke();
      doc.restore();
      drawUnitBox(doc, x + 6 + anoxW + 3, trainY + 16, trainW - anoxW - 14, trainH - 8, {
        fill: '#dcfce7',
        stroke: '#16a34a',
        title: 'Aerobic IFAS',
        lines: [`${fmtGpd(CFG.perTrainAerobicGal)} gal`, 'PVA 50%', 'CRS loop'],
      });
      drawFlowLabel(doc, `CRS ${CFG.crsSidestreamGpm}`, x + 8, trainY + trainH + 22, { width: trainW - 16, size: 6, color: '#0284c7' });
      return { right: x + trainW, cy: trainY + trainH / 2 };
    }

    const t1 = mechTrain(splitX, 'Train 1');
    const t2 = mechTrain(splitX + trainW + 14, 'Train 2');

    const clarX = t2.right + 12;
    drawUnitBox(doc, clarX, yMain + 18, 72, 78, {
      fill: '#fef9c3',
      stroke: '#ca8a04',
      title: 'Clarifier',
      lines: [CFG.clarifierNote.includes(' OR ') ? CFG.clarifierNote.split(' OR ')[0] : CFG.clarifierNote, CFG.clarifierNote.includes(' OR ') ? CFG.clarifierNote.split(' OR ')[1] : ''],
    });
    drawUnitBox(doc, clarX + 82, yMain + 26, 58, 62, {
      fill: '#ecfdf5',
      stroke: '#059669',
      title: 'Effluent',
      lines: ['≤10 NO3-N'],
    });

    diagramText(
      doc,
      `Total bio ${fmtGpd(CFG.reactorGal)} gal · HRT ${CFG.hrtDays} d · Footprint ~${CFG.footprintSqFt} ft² · Blower ${CFG.backupBlowerHp} HP`,
      left,
      pageH - 88,
      { size: 7, width: drawW, lineBreak: false }
    );
    drawScanStation(doc, left + 4, pageH - 118, 130, 48, getScanPorts(CFG).length);
    drawSheetLegend(doc, left, pageH, [
      { type: 'text', label: '2× parallel 125K gal MLE trains' },
      { type: 'text', label: 'EQ basin for seasonal peaking' },
      { type: 'text', label: 'Shared clarifier + effluent' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'Mechanical — Sheet 2');
  }

  /** ── Dual 125K: Instrumentation (s::can 6-port loop) ── */
  function drawDual125kInstrumentation(doc, frame) {
    const { left, top, drawW, pageH } = frame;
    const yMain = top + 82;
    const splitX = left + 120;
    const trainW = 148;
    const trainH = 100;
    const trainY = yMain + 4;
    const ports = getScanPorts(CFG);

    drawGhostProcess(doc, [
      box(left + 2, yMain + 28, 48, 62),
      box(left + 60, yMain + 32, 52, 54),
      box(splitX, trainY, trainW, trainH + 18),
      box(splitX + trainW + 14, trainY, trainW, trainH + 18),
      box(splitX + trainW * 2 + 26, yMain + 18, 72, 78),
    ]);

    const inf = box(left + 2, yMain + 28, 48, 62);
    const clarX = splitX + trainW * 2 + 26;
    const eff = box(clarX + 82, yMain + 26, 58, 62);

    const scanY = trainY + trainH + 36;
    const station = drawScanStation(doc, left + 4, scanY, 124, 54, ports.length);
    const taps = [
      drawSampleTap(doc, inf.cx, inf.y - 4, 'SV-101', 1),
      drawSampleTap(doc, splitX + 24, trainY + 20, 'SV-102', 2),
      drawSampleTap(doc, splitX + trainW + 38, trainY + 20, 'SV-103', 3),
      drawSampleTap(doc, splitX + trainW / 2, trainY - 4, 'SV-104', 4),
      drawSampleTap(doc, splitX + trainW + 14 + trainW / 2, trainY + 12, 'SV-105', 5),
      drawSampleTap(doc, eff.cx, eff.y - 4, 'SV-106', 6),
    ];
    drawScanLoopPid(doc, taps, station, left, pageH);

    const mvY = scanY + 62;
    drawUnitBox(doc, left + 4, mvY, 96, 50, {
      fill: '#f8fafc',
      stroke: '#64748b',
      title: 'MooreVIEW',
      lines: [CFG.mooreviewProject || 'pasco-rv-mle', 'Modbus TCP'],
    });
    drawUnitBox(doc, left + 106, mvY, 92, 50, {
      fill: '#faf5ff',
      stroke: '#7c3aed',
      title: 'AI Optimizer',
      lines: ['INF_BOD', 'T1/T2 balance', 'AI_CARBON_LIM'],
    });
    drawScanPortPanel(doc, left + 210, scanY, ports);
    diagramText(
      doc,
      `${SCAN_VENDOR} 6-port loop · T1/T2 anoxic ORP+pH · INF_BOD for C:N · AER_DO dedicated per train in basin`,
      left,
      pageH - 72,
      { size: 6.5, width: drawW, lineBreak: false }
    );
    drawSheetLegend(doc, left, pageH, [
      { type: 'line', color: '#0ea5e9', dash: 3, label: 'Sample loop' },
      { type: 'text', label: '6-port sam::spector sequencer' },
      { type: 'line', color: '#94a3b8', dash: 3, label: 'Modbus to SCADA' },
    ]);
    drawDiagramFooter(doc, left, drawW, pageH, 'Instrumentation — Sheet 3');
  }

  function drawAllDiagramPages(doc) {
    const pidSub = `${CFG.flowAvgGpm} GPM · Piping, valves, pumps, recycle loops`;
    const mechSub = `Equipment layout, volumes, materials · ${CFG.trainLabel}`;
    const instSub = `s::can recirculating optical loop · per-phase BOD/pH/ORP · MooreVIEW ${CFG.mooreviewProject || ''}`.trim();

    startNewPage(doc, { layout: 'landscape' });
    if (CFG.layout === 'dual-125k') {
      drawDual125kPid(doc, drawDiagramHeader(doc, 4, 'Piping & Instrumentation Diagram (P&ID)', pidSub));
    } else if (CFG.layout === 'poc-tote') {
      drawPocTotePid(doc, drawDiagramHeader(doc, 4, 'Piping & Instrumentation Diagram (P&ID)', pidSub));
    } else {
      drawSingleTankPid(doc, drawDiagramHeader(doc, 4, 'Piping & Instrumentation Diagram (P&ID)', pidSub));
    }

    startNewPage(doc, { layout: 'landscape' });
    if (CFG.layout === 'dual-125k') {
      drawDual125kMechanical(doc, drawDiagramHeader(doc, 5, 'Mechanical Drawing', mechSub));
    } else if (CFG.layout === 'poc-tote') {
      drawPocToteMechanical(doc, drawDiagramHeader(doc, 5, 'Mechanical Drawing', mechSub));
    } else {
      drawSingleTankMechanical(doc, drawDiagramHeader(doc, 5, 'Mechanical Drawing', mechSub));
    }

    startNewPage(doc, { layout: 'landscape' });
    if (CFG.layout === 'dual-125k') {
      drawDual125kInstrumentation(doc, drawDiagramHeader(doc, 6, 'Instrumentation Diagram', instSub));
    } else if (CFG.layout === 'poc-tote') {
      drawPocToteInstrumentation(doc, drawDiagramHeader(doc, 6, 'Instrumentation Diagram', instSub));
    } else {
      drawSingleTankInstrumentation(doc, drawDiagramHeader(doc, 6, 'Instrumentation Diagram', instSub));
    }

    startNewPage(doc);
  }

  return { drawAllDiagramPages };
}

module.exports = { createDiagramSheets };
