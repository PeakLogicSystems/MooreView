'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { normalizeReportConfig, DEFAULT_REPORT_CONFIG } = require('../src/reports/reportConfig');
const { penStatistics } = require('../src/reports/penStats');
const { buildPdfReport } = require('../src/reports/pdfReport');

describe('reportConfig', () => {
  it('normalizes defaults', () => {
    const c = normalizeReportConfig({});
    assert.strictEqual(c.title, DEFAULT_REPORT_CONFIG.title);
    assert.strictEqual(c.pageSize, 'A4');
    assert.strictEqual(c.orientation, 'landscape');
    assert.strictEqual(c.sections.chart, true);
  });

  it('clamps page options', () => {
    const c = normalizeReportConfig({
      pageSize: 'letter',
      orientation: 'portrait',
      chartMaxHeight: 9999,
    });
    assert.strictEqual(c.pageSize, 'LETTER');
    assert.strictEqual(c.orientation, 'portrait');
    assert.strictEqual(c.chartMaxHeight, 400);
  });
});

describe('penStatistics', () => {
  it('computes scaled min/max/avg', () => {
    const pens = [{ tagId: 'AI1', scale: 2, offset: 1 }];
    const history = {
      AI1: [
        { ts: 1, value: 10 },
        { ts: 2, value: 20 },
      ],
    };
    const s = penStatistics(history, pens)[0];
    assert.strictEqual(s.samples, 2);
    assert.strictEqual(s.scaled.min, 21);
    assert.strictEqual(s.scaled.max, 41);
    assert.strictEqual(s.scaled.avg, 31);
  });
});

describe('buildPdfReport', () => {
  it('returns a non-empty PDF buffer', async () => {
    const pens = [{ tagId: 'T1', scale: 1, offset: 0, color: '#2563eb' }];
    const history = { T1: [{ ts: Date.now(), value: 42 }] };
    const buf = await buildPdfReport({
      reportConfig: { title: 'Test Report', sections: { chart: false } },
      meta: { projectName: 'test', rangeLabel: 'Last 1 hour' },
      pens,
      history,
    });
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 500);
    assert.strictEqual(buf.slice(0, 4).toString(), '%PDF');
  });

  it('includes PdM forecast and service history sections', async () => {
    const pens = [{ tagId: 'HEALTH_IDX', scale: 1, offset: 0 }];
    const history = { HEALTH_IDX: [{ ts: Date.now(), value: 0.72 }] };
    const buf = await buildPdfReport({
      reportConfig: {
        title: 'PdM Report',
        sections: { chart: false, penTable: false, statistics: false },
      },
      meta: { projectName: 'duplex', source: 'PdM', assetId: 'pump-2' },
      pens,
      history,
      pdm: {
        assetId: 'pump-2',
        assetContext: {
          assetId: 'pump-2',
          motorType: 'pump',
          application: 'lift_station',
          configuration: 'duplex',
          locationClass: 'strip_mall',
          installDate: '2017-06-01',
          pumpAgeYears: 8.2,
          ageFactor: 1.21,
          pumpRole: 'lag',
          pumpIndex: 2,
          serviceHistory: [
            { date: '2017-06-01', type: 'install', vendor: 'ABC', notes: 'Original' },
            { date: '2022-11-08', type: 'seal_service', vendor: 'ABC', notes: 'Seal replaced' },
          ],
        },
        forecast: {
          ok: true,
          headline: 'pump-2: Estimated to fail in 45 days',
          severity: 'warning',
          faultType: 'run amp creep / impeller load',
          reportLines: ['Run amps 11.2 A trending up'],
        },
        rul: { ok: true, currentHealth: 0.72, trend: 'degrading', rulDaysEstimate: 45 },
      },
    });
    assert.ok(buf.length > 2000);
    const text = buf.toString('latin1');
    assert.match(text, /PdM Report/);
  });
});
