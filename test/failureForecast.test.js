'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  buildFailureForecast,
  estimateTrendRul,
  headlineFromRul,
  severityFromRul,
} = require('../src/pdm/failureForecast');

describe('failureForecast', () => {
  it('estimates motor start time RUL toward fail threshold', () => {
    const base = Date.parse('2026-06-01T00:00:00Z');
    const points = [];
    for (let i = 0; i < 10; i++) {
      points.push({ t: base + i * 24 * 60 * 60 * 1000, v: 3200 + i * 150 });
    }
    const trend = estimateTrendRul(points, { failValue: 5200, direction: 'above' });
    assert.equal(trend.ok, true);
    assert.equal(trend.trend, 'degrading');
    assert.ok(trend.rulDaysEstimate > 0);
    assert.ok(trend.rulDaysEstimate <= 10);
  });

  it('builds combined forecast with fail-in-X-days headline', () => {
    const base = Date.parse('2026-06-01T00:00:00Z');
    const features = [];
    for (let i = 0; i < 12; i++) {
      features.push({
        windowStartMs: base + i * 24 * 60 * 60 * 1000,
        healthIndex: 0.85 - i * 0.04,
        edge: { maxScore: 0.15 + i * 0.04 },
        scada: {
          tagStats: {
            MOTOR_START_MS: { avg: 3000 + i * 180 },
          },
        },
      });
    }
    const fc = buildFailureForecast({
      features,
      assetId: 'motor-202',
      failureThreshold: 0.3,
      now: base + 12 * 24 * 60 * 60 * 1000,
    });
    assert.equal(fc.ok, true);
    assert.equal(fc.assetId, 'motor-202');
    assert.ok(fc.rulDaysEstimate != null);
    assert.match(fc.headline, /Estimated to fail in \d+ day/);
    assert.ok(['ok', 'warning', 'critical', 'failed'].includes(fc.severity));
    assert.ok(fc.predictedFailureAt);
    assert.ok(fc.reportLines.length >= 2);
  });

  it('formats severity and headlines', () => {
    assert.equal(severityFromRul(0), 'failed');
    assert.equal(severityFromRul(5), 'critical');
    assert.equal(severityFromRul(20), 'warning');
    assert.equal(severityFromRul(60), 'ok');
    assert.match(headlineFromRul(14, { assetId: 'pump-101' }), /pump-101.*14 days/);
    assert.match(headlineFromRul(0, { assetId: 'pump-101' }), /service now/);
  });

  it('detects starts rate spike via starts_analytics', () => {
    const base = Date.parse('2026-06-01T00:00:00Z');
    const features = [];
    for (let day = 0; day < 14; day++) {
      const dailyStarts = day < 5 ? 8 : 22;
      for (let w = 0; w < 4; w++) {
        features.push({
          windowStartMs: base + day * 24 * 60 * 60 * 1000 + w * 15 * 60 * 1000,
          derived: {
            startsInWindow: dailyStarts / 4,
            deltaRunHours: 0.5,
            runtimePerStartMin: 6 + day * 0.1,
          },
        });
      }
    }
    const fc = buildFailureForecast({
      features,
      assetId: 'lakeland-retail-center-pump-1',
      forecastMethods: ['starts_analytics'],
      now: base + 14 * 24 * 60 * 60 * 1000,
    });
    assert.equal(fc.ok, true);
    assert.equal(fc.primaryMethod, 'starts_analytics');
    assert.ok(fc.rulDaysEstimate != null);
    assert.ok(fc.rulDaysEstimate <= 7);
    assert.ok(fc.methods.startsAnalytics.ok);
  });

  it('detects runtime-per-start creep via starts_analytics', () => {
    const base = Date.parse('2026-06-01T00:00:00Z');
    const features = [];
    for (let i = 0; i < 20; i++) {
      features.push({
        windowStartMs: base + i * 24 * 60 * 60 * 1000,
        derived: {
          startsInWindow: 4,
          deltaRunHours: 0.4 + i * 0.05,
          runtimePerStartMin: 6 + i * 0.8,
        },
      });
    }
    const fc = buildFailureForecast({
      features,
      assetId: 'spring-hill-apartments-pump-2',
      forecastMethods: ['starts_analytics'],
      runtimePerStartCreepFailPct: 25,
      now: base + 20 * 24 * 60 * 60 * 1000,
    });
    assert.equal(fc.ok, true);
    assert.equal(fc.primaryMethod, 'starts_analytics');
    assert.ok(fc.methods.startsAnalytics.primary.subMethod === 'runtime_per_start_creep'
      || fc.methods.startsAnalytics.primary.subMethod === 'starts_rate_spike');
  });
});
