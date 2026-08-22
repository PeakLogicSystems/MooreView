'use strict';

const { DAY_MS, linearRegression, estimateRulFromFeatures } = require('./rulEstimate');

const DEFAULT_MOTOR_START_FAIL_MS = 5200;
const DEFAULT_MOTOR_START_TAG = 'MOTOR_START_MS';

function estimateTrendRul(points, { failValue, direction = 'below' } = {}) {
  const sorted = (points || [])
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v))
    .sort((a, b) => a.t - b.t);
  if (sorted.length < 3) {
    return { ok: false, error: 'Need at least 3 trend points' };
  }
  const t0 = sorted[0].t;
  const xs = sorted.map((p) => (p.t - t0) / DAY_MS);
  const ys = sorted.map((p) => p.v);
  const { slope } = linearRegression(xs, ys);
  const current = ys[ys.length - 1];
  const ratePerDay = Math.round(slope * 10000) / 10000;

  let rulDaysEstimate = null;
  if (direction === 'below') {
    if (slope < -0.00001 && current > failValue) {
      rulDaysEstimate = Math.max(0, Math.round((failValue - current) / slope));
    } else if (current <= failValue) {
      rulDaysEstimate = 0;
    }
  } else if (slope > 0.00001 && current < failValue) {
    rulDaysEstimate = Math.max(0, Math.round((failValue - current) / slope));
  } else if (current >= failValue) {
    rulDaysEstimate = 0;
  }

  let trend = 'stable';
  if (direction === 'below') {
    if (slope < -0.001) trend = 'degrading';
    else if (slope > 0.001) trend = 'improving';
  } else if (slope > 0.5) trend = 'degrading';
  else if (slope < -0.5) trend = 'improving';

  return {
    ok: true,
    currentValue: Math.round(current * 100) / 100,
    failValue,
    ratePerDay,
    rulDaysEstimate,
    trend,
    sampleCount: sorted.length,
    from: new Date(sorted[0].t).toISOString(),
    to: new Date(sorted[sorted.length - 1].t).toISOString(),
  };
}

function severityFromRul(rulDays) {
  if (rulDays == null) return 'unknown';
  if (rulDays <= 0) return 'failed';
  if (rulDays <= 7) return 'critical';
  if (rulDays <= 30) return 'warning';
  return 'ok';
}

function predictedFailureDate(rulDays, fromMs = Date.now()) {
  if (rulDays == null) return null;
  return new Date(fromMs + rulDays * DAY_MS).toISOString();
}

function headlineFromRul(rulDays, { assetId, faultType = 'failure' } = {}) {
  const who = assetId ? `${assetId}: ` : '';
  if (rulDays == null) return `${who}Insufficient trend data for failure forecast`;
  if (rulDays <= 0) return `${who}At or past predicted ${faultType} — service now`;
  if (rulDays === 1) return `${who}Estimated to fail in 1 day`;
  return `${who}Estimated to fail in ${rulDays} days`;
}

function extractTagTrend(features, tagId) {
  return (features || [])
    .map((f) => ({
      t: f.windowStartMs ?? Date.parse(f.at),
      v: f.scada?.tagStats?.[tagId]?.avg,
    }))
    .filter((p) => Number.isFinite(p.t) && p.v != null && Number.isFinite(p.v));
}

const DEFAULT_RUN_AMP_CREEP_PCT = 25;
const DEFAULT_STARTS_SPIKE_MULTIPLIER = 2.0;
const DEFAULT_RUNTIME_PER_START_CREEP_PCT = 35;

function extractDerivedTrend(features, key) {
  return (features || [])
    .map((f) => ({
      t: f.windowStartMs ?? Date.parse(f.at),
      v: f.derived?.[key],
    }))
    .filter((p) => Number.isFinite(p.t) && p.v != null && Number.isFinite(p.v));
}

function aggregateDailyStarts(features) {
  const byDay = new Map();
  for (const f of features || []) {
    const t = f.windowStartMs ?? Date.parse(f.at);
    if (!Number.isFinite(t)) continue;
    const starts = f.derived?.startsInWindow;
    if (!Number.isFinite(starts)) continue;
    const dayKey = Math.floor(t / DAY_MS) * DAY_MS;
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + starts);
  }
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * LiftPoint Light / non-CT PdM — daily starts spike vs baseline (short cycling, I&I).
 */
function analyzeStartsRateSpike(features, { failMultiplier = DEFAULT_STARTS_SPIKE_MULTIPLIER } = {}) {
  const days = aggregateDailyStarts(features);
  if (days.length < 5) {
    return { ok: false, error: 'Need at least 5 days of starts data' };
  }
  const baselineCount = Math.max(3, Math.floor(days.length * 0.3));
  const baseline = days.slice(0, baselineCount).reduce((s, [, v]) => s + v, 0) / baselineCount;
  const recent = days.slice(-Math.min(7, days.length));
  const recentAvg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
  const ratio = baseline > 0 ? recentAvg / baseline : null;

  let rulDaysEstimate = null;
  let trend = 'stable';
  if (ratio != null && ratio >= failMultiplier) {
    trend = 'degrading';
    rulDaysEstimate = 0;
  } else if (ratio != null && ratio >= failMultiplier * 0.75) {
    trend = 'degrading';
    rulDaysEstimate = 7;
  }

  return {
    ok: true,
    method: 'starts_analytics',
    subMethod: 'starts_rate_spike',
    label: 'Starts rate / short cycling',
    currentValue: Math.round(recentAvg * 10) / 10,
    failValue: Math.round(baseline * failMultiplier * 10) / 10,
    baselineDailyStarts: Math.round(baseline * 10) / 10,
    spikeRatio: ratio != null ? Math.round(ratio * 100) / 100 : null,
    rulDaysEstimate,
    trend,
    sampleCount: days.length,
    detail: ratio != null
      ? `Daily starts ${recentAvg.toFixed(1)} vs baseline ${baseline.toFixed(1)}/day (${ratio.toFixed(2)}×)`
      : 'Starts rate analysis',
  };
}

/**
 * Runtime minutes per start trending up — impeller wear / partial clog without CT data.
 */
function analyzeRuntimePerStartCreep(features, { failPct = DEFAULT_RUNTIME_PER_START_CREEP_PCT } = {}) {
  const pts = extractDerivedTrend(features, 'runtimePerStartMin').filter((p) => p.v > 0);
  if (pts.length < 5) {
    return { ok: false, error: 'Need runtime-per-start trend' };
  }
  const baselineCount = Math.max(3, Math.floor(pts.length * 0.2));
  const baseline = pts.slice(0, baselineCount).reduce((s, p) => s + p.v, 0) / baselineCount;
  const failValue = baseline * (1 + failPct / 100);
  const trend = estimateTrendRul(pts, { failValue, direction: 'above' });
  if (!trend.ok) return trend;
  return {
    ...trend,
    method: 'starts_analytics',
    subMethod: 'runtime_per_start_creep',
    label: 'Runtime per start creep',
    detail: `Runtime/start ${trend.currentValue} min → fail at ${Math.round(failValue * 10) / 10} min (+${failPct}%)`,
  };
}

/**
 * Starts increment without matching runtime — ghost starts / dry run suspicion.
 */
function analyzeGhostStarts(features) {
  let ghostWindows = 0;
  let sampleWindows = 0;
  for (const f of features || []) {
    const starts = f.derived?.startsInWindow;
    const hrs = f.derived?.deltaRunHours;
    if (!Number.isFinite(starts)) continue;
    sampleWindows++;
    if (starts >= 2 && Number.isFinite(hrs) && hrs < 0.02) ghostWindows++;
  }
  if (sampleWindows < 5) {
    return { ok: false, error: 'Insufficient start/runtime windows' };
  }
  const ratio = ghostWindows / sampleWindows;
  if (ratio < 0.15) {
    return { ok: false, error: 'No ghost-start pattern' };
  }
  return {
    ok: true,
    method: 'starts_analytics',
    subMethod: 'ghost_starts',
    label: 'Ghost starts (starts without runtime)',
    currentValue: Math.round(ratio * 1000) / 10,
    failValue: 15,
    rulDaysEstimate: ratio >= 0.3 ? 0 : 14,
    trend: 'degrading',
    sampleCount: sampleWindows,
    detail: `${Math.round(ratio * 100)}% of windows had starts without runtime`,
  };
}

function buildStartsAnalyticsForecast(features, opts = {}) {
  const parts = [
    analyzeStartsRateSpike(features, opts),
    analyzeRuntimePerStartCreep(features, opts),
    analyzeGhostStarts(features),
  ].filter((p) => p.ok && p.rulDaysEstimate != null);

  if (!parts.length) {
    return { ok: false, error: 'No starts analytics trend' };
  }
  const primary = parts.reduce((a, b) => {
    if (a.rulDaysEstimate == null) return b;
    if (b.rulDaysEstimate == null) return a;
    return a.rulDaysEstimate <= b.rulDaysEstimate ? a : b;
  });
  return { ok: true, primary, parts };
}

/**
 * Combined failure forecast from health index, run-amp creep, and motor start-time trends.
 */
function buildFailureForecast({
  features = [],
  assetId = '',
  failureThreshold = 0.3,
  motorStartFailMs = DEFAULT_MOTOR_START_FAIL_MS,
  motorStartTagId = DEFAULT_MOTOR_START_TAG,
  runAmpsTagId = null,
  runAmpCreepFailPct = DEFAULT_RUN_AMP_CREEP_PCT,
  startsSpikeFailMultiplier = DEFAULT_STARTS_SPIKE_MULTIPLIER,
  runtimePerStartCreepFailPct = DEFAULT_RUNTIME_PER_START_CREEP_PCT,
  forecastMethods = ['health_index', 'run_amps_creep', 'start_time_ms'],
  now = Date.now(),
} = {}) {
  const methods = new Set(forecastMethods || ['health_index', 'start_time_ms']);
  const health = methods.has('health_index')
    ? estimateRulFromFeatures(features, { failureThreshold })
    : { ok: false, error: 'disabled' };

  const startPts = methods.has('start_time_ms') ? extractTagTrend(features, motorStartTagId) : [];
  const startTime = startPts.length >= 3
    ? estimateTrendRul(startPts, { failValue: motorStartFailMs, direction: 'above' })
    : { ok: false, error: 'No motor start time trend' };

  let runAmps = { ok: false, error: 'No run amps trend' };
  if (methods.has('run_amps_creep') && runAmpsTagId) {
    const ampPts = extractTagTrend(features, runAmpsTagId);
    if (ampPts.length >= 3) {
      const baseline = ampPts.slice(0, Math.max(3, Math.floor(ampPts.length * 0.2)))
        .reduce((s, p) => s + p.v, 0) / Math.max(1, Math.floor(ampPts.length * 0.2));
      const failValue = baseline * (1 + runAmpCreepFailPct / 100);
      runAmps = estimateTrendRul(ampPts, { failValue, direction: 'above' });
      if (runAmps.ok) {
        runAmps.detail = `Run amps ${runAmps.currentValue} A → fail at ${Math.round(failValue * 10) / 10} A (+${runAmpCreepFailPct}% creep)`;
        runAmps.method = 'run_amps_creep';
        runAmps.label = 'Run amp creep (impeller/load)';
      }
    }
  }

  const candidates = [];
  if (health.ok && health.rulDaysEstimate != null) {
    candidates.push({
      method: 'health_index',
      label: 'Edge anomaly / health index',
      rulDaysEstimate: health.rulDaysEstimate,
      detail: `Health ${health.currentHealth} trending to threshold ${failureThreshold}`,
      ...health,
    });
  }
  if (startTime.ok && startTime.rulDaysEstimate != null) {
    candidates.push({
      method: 'start_time_ms',
      label: 'Motor start time (capacitor / hard start)',
      rulDaysEstimate: startTime.rulDaysEstimate,
      detail: `Start time ${startTime.currentValue} ms → fail at ${motorStartFailMs} ms`,
      ...startTime,
    });
  }
  if (runAmps.ok && runAmps.rulDaysEstimate != null) {
    candidates.push({
      method: 'run_amps_creep',
      label: runAmps.label || 'Run amp creep',
      rulDaysEstimate: runAmps.rulDaysEstimate,
      detail: runAmps.detail,
      ...runAmps,
    });
  }

  let startsAnalytics = { ok: false, error: 'No starts analytics trend' };
  if (methods.has('starts_analytics')) {
    startsAnalytics = buildStartsAnalyticsForecast(features, {
      failMultiplier: startsSpikeFailMultiplier,
      failPct: runtimePerStartCreepFailPct,
    });
    if (startsAnalytics.ok && startsAnalytics.primary) {
      candidates.push({
        ...startsAnalytics.primary,
        method: 'starts_analytics',
      });
    }
  }

  let primary = null;
  if (candidates.length) {
    primary = candidates.reduce((a, b) => {
      if (a.rulDaysEstimate == null) return b;
      if (b.rulDaysEstimate == null) return a;
      return a.rulDaysEstimate <= b.rulDaysEstimate ? a : b;
    });
  }

  const rulDaysEstimate = primary?.rulDaysEstimate ?? null;
  const severity = severityFromRul(rulDaysEstimate);
  const faultType = primary?.method === 'start_time_ms'
    ? 'capacitor/motor start failure'
    : primary?.method === 'run_amps_creep'
      ? 'run amp creep / impeller load'
      : primary?.method === 'starts_analytics'
        ? (primary.subMethod === 'ghost_starts'
          ? 'ghost starts / dry run'
          : primary.subMethod === 'runtime_per_start_creep'
            ? 'runtime per start creep / partial clog'
            : 'short cycling / abnormal starts rate')
        : 'health threshold breach';
  const headline = headlineFromRul(rulDaysEstimate, { assetId, faultType });
  const predictedFailureAt = predictedFailureDate(rulDaysEstimate, now);

  const reportLines = [
    headline,
    predictedFailureAt ? `Predicted date: ${new Date(predictedFailureAt).toLocaleString()}` : null,
    primary?.detail || null,
    health.ok ? `Health index: ${health.currentHealth} (${health.trend}, ${health.degradationRatePerDay ?? health.ratePerDay}/day)` : null,
    startTime.ok ? `Start time: ${startTime.currentValue} ms (${startTime.trend}, ${startTime.ratePerDay} ms/day)` : null,
    runAmps.ok ? `Run amps: ${runAmps.currentValue} A (${runAmps.trend}, ${runAmps.ratePerDay} A/day)` : null,
    startsAnalytics.ok && startsAnalytics.primary?.detail ? startsAnalytics.primary.detail : null,
  ].filter(Boolean);

  return {
    ok: !!(primary || health.ok || startTime.ok),
    assetId,
    rulDaysEstimate,
    predictedFailureAt,
    headline,
    severity,
    faultType,
    primaryMethod: primary?.method || null,
    reportLines,
    methods: {
      healthIndex: health,
      startTimeMs: startTime,
      runAmpsCreep: runAmps,
      startsAnalytics,
    },
    failureThreshold,
    motorStartFailMs,
  };
}

module.exports = {
  DEFAULT_MOTOR_START_FAIL_MS,
  DEFAULT_MOTOR_START_TAG,
  DEFAULT_STARTS_SPIKE_MULTIPLIER,
  DEFAULT_RUNTIME_PER_START_CREEP_PCT,
  estimateTrendRul,
  buildFailureForecast,
  buildStartsAnalyticsForecast,
  analyzeStartsRateSpike,
  analyzeRuntimePerStartCreep,
  headlineFromRul,
  severityFromRul,
  predictedFailureDate,
};
