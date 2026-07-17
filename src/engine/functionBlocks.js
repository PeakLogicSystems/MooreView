'use strict';

const { evaluateAlarmLevel } = require('../tags/tagAnalog');

function updateTimers(tags, dtMs) {
  for (const t of tags) {
    if (t.type !== 'TIMER') continue;
    const fb = t.fb || {};
    const mode = t.mode || 'TON';
    const inVal = !!fb.input;
    const preset = Number(t.preset) || 1000;
    let elapsed = fb.elapsed || 0;
    let done = !!fb.done;
    let running = !!fb.running;

    if (fb.reset) {
      elapsed = 0;
      done = false;
      running = false;
      fb.reset = false;
      fb.prevIn = false;
    }

    if (mode === 'TON') {
      if (inVal) {
        elapsed = Math.min(preset, elapsed + dtMs);
        running = elapsed < preset;
        done = elapsed >= preset;
      } else {
        elapsed = 0;
        running = false;
        done = false;
      }
    } else if (mode === 'TOF') {
      if (inVal) {
        elapsed = 0;
        running = false;
        done = true;
      } else {
        elapsed = Math.min(preset, elapsed + dtMs);
        running = elapsed < preset;
        done = elapsed < preset;
      }
    } else if (mode === 'TP') {
      if (inVal && !fb.prevIn) {
        elapsed = 0;
        done = false;
        running = true;
      }
      if (running) {
        elapsed += dtMs;
        if (elapsed >= preset) {
          running = false;
          done = true;
        }
      }
      fb.prevIn = inVal;
    }

    fb.elapsed = elapsed;
    fb.done = done;
    fb.running = running;
    t.fb = fb;
    t.value = done;
  }
}

function updateCounters(tags) {
  for (const t of tags) {
    if (t.type !== 'COUNTER') continue;
    const fb = t.fb || {};
    const mode = t.mode || 'CTU';
    const preset = Number(t.preset) || 1;
    const cu = !!fb.cu;
    const cd = !!fb.cd;
    const reset = !!fb.reset;
    let count = fb.count || 0;
    let done = !!fb.done;

    if (reset) {
      count = 0;
      done = false;
      fb.reset = false;
    } else if (mode === 'CTU' && cu && !fb.prevCu) {
      count++;
      if (count >= preset) done = true;
    } else if (mode === 'CTD' && cd && !fb.prevCd) {
      count = Math.max(0, count - 1);
      if (count <= 0) done = true;
    }
    fb.prevCu = cu;
    fb.prevCd = cd;
    fb.count = count;
    fb.done = done;
    t.fb = fb;
    t.value = count;
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function effectiveAnalogValue(tag) {
  if (!tag) return 0;
  if (tag.forceInput || tag.forceOutput) {
    const fv = Number(tag.forceValue);
    if (Number.isFinite(fv)) return fv;
  }
  const v = Number(tag.value);
  return Number.isFinite(v) ? v : 0;
}

function analogTagValue(tag) {
  return effectiveAnalogValue(tag);
}

function pidDisplayFb(tag, byId) {
  const fb = { ...(tag?.fb || {}) };
  if (fb.pvId) fb.pv = effectiveAnalogValue(byId.get(fb.pvId));
  if (fb.spId) {
    fb.sp = effectiveAnalogValue(byId.get(fb.spId));
  } else {
    const sp = Number(tag?.preset);
    fb.sp = Number.isFinite(sp) ? sp : 0;
  }
  if (fb.outId) {
    fb.out = effectiveAnalogValue(byId.get(fb.outId));
  } else if (tag?.forceOutput) {
    const fv = Number(tag.forceValue);
    if (Number.isFinite(fv)) fb.out = fv;
  } else if (!Number.isFinite(fb.out)) {
    const v = Number(tag?.value);
    fb.out = Number.isFinite(v) ? v : 0;
  }
  const pv = Number.isFinite(fb.pv) ? fb.pv : 0;
  const level = evaluatePidPvAlarmLevel(tag, pv);
  fb.alarmHi = level === 'innerHigh' || level === 'outerHigh';
  fb.alarmLo = level === 'innerLow' || level === 'outerLow';
  return fb;
}

function wirePidTagInputs(tags, byId) {
  for (const t of tags) {
    if (t.type !== 'PID') continue;
    const fb = { ...(t.fb || {}) };
    if (fb.pvId) fb.pv = effectiveAnalogValue(byId.get(fb.pvId));
    if (fb.spId) {
      const sp = effectiveAnalogValue(byId.get(fb.spId));
      fb.sp = sp;
      t.preset = sp;
    } else {
      const sp = Number(t.preset);
      fb.sp = Number.isFinite(sp) ? sp : 0;
    }
    t.fb = fb;
  }
}

function writePidTagOutputs(tags, byId) {
  for (const t of tags) {
    if (t.type !== 'PID') continue;
    const outId = t.fb?.outId;
    if (!outId) continue;
    const out = byId.get(outId);
    if (!out || out.readonly || out.forceOutput) continue;
    if (out.type !== 'INT' && out.type !== 'REAL' && out.role !== 'memory' && out.role !== 'output') continue;
    const val = Number.isFinite(t.fb?.out) ? t.fb.out : Number(t.value);
    if (!Number.isFinite(val)) continue;
    out.value = out.type === 'INT' ? Math.trunc(val) : val;
    out.dirty = true;
  }
}

function evaluatePidPvAlarmLevel(tag, pv) {
  if (!tag?.alarmsEnabled) return null;
  return evaluateAlarmLevel({ ...tag, type: 'REAL' }, pv);
}

function writeBoolTag(byId, tagId, value) {
  if (!tagId) return;
  const out = byId.get(tagId);
  if (!out || out.type !== 'BOOL' || out.readonly || out.forceOutput) return;
  if (out.role !== 'memory' && out.role !== 'output') return;
  const next = !!value;
  if (out.value !== next) {
    out.value = next;
    out.dirty = true;
  }
}

function updatePidAlarms(tags, byId) {
  for (const t of tags) {
    if (t.type !== 'PID') continue;
    const fb = { ...(t.fb || {}) };
    const pv = Number.isFinite(fb.pv) ? fb.pv : 0;
    const level = evaluatePidPvAlarmLevel(t, pv);
    t.alarmLevel = level;
    const hiActive = level === 'innerHigh' || level === 'outerHigh';
    const loActive = level === 'innerLow' || level === 'outerLow';
    fb.alarmHi = hiActive;
    fb.alarmLo = loActive;
    t.fb = fb;
    writeBoolTag(byId, fb.alarmHiId, hiActive);
    writeBoolTag(byId, fb.alarmLoId, loActive);
  }
}

function updatePids(tags, dtMs) {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  wirePidTagInputs(tags, byId);
  updatePidAlarms(tags, byId);
  const dt = Math.max(dtMs / 1000, 0.001);
  for (const t of tags) {
    if (t.type !== 'PID') continue;
    const fb = t.fb || {};
    const sp = Number.isFinite(fb.sp) ? fb.sp : Number(t.preset) || 0;
    const pv = Number.isFinite(fb.pv) ? fb.pv : 0;
    const kp = Number(t.kp) || 0;
    const ki = Number(t.ki) || 0;
    const kd = Number(t.kd) || 0;
    const outMin = Number.isFinite(t.outMin) ? t.outMin : 0;
    const outMax = Number.isFinite(t.outMax) ? t.outMax : 100;
    const mode = t.mode || 'PID';

    fb.sp = sp;
    if (!fb.enabled) {
      fb.err = sp - pv;
      t.fb = fb;
      t.value = Number.isFinite(fb.out) ? fb.out : 0;
      continue;
    }

    const err = sp - pv;
    let integral = Number.isFinite(fb.integral) ? fb.integral : 0;
    integral += err * dt;

    const prevPv = Number.isFinite(fb.prevPv) ? fb.prevPv : pv;
    const dPv = (pv - prevPv) / dt;

    let pTerm = kp * err;
    let iTerm = ki * integral;
    let dTerm = (mode === 'PID') ? (-kd * dPv) : 0;
    let out = pTerm + iTerm + dTerm;

    if (out > outMax) {
      out = outMax;
      if (err > 0) integral = Number.isFinite(fb.integral) ? fb.integral : integral;
    } else if (out < outMin) {
      out = outMin;
      if (err < 0) integral = Number.isFinite(fb.integral) ? fb.integral : integral;
    }

    out = clamp(out, outMin, outMax);

    fb.pv = pv;
    fb.err = err;
    fb.integral = integral;
    fb.prevPv = pv;
    fb.out = out;
    t.fb = fb;
    t.value = out;
  }
  writePidTagOutputs(tags, byId);
}

const AVG_WINDOW_MAX = 256;

function updateAverages(tags) {
  for (const t of tags) {
    if (t.type !== 'AVG') continue;
    const fb = t.fb || {};
    const mode = t.mode || 'MOV';
    const window = Math.max(1, Math.min(AVG_WINDOW_MAX, Math.trunc(Number(t.preset) || 1)));

    if (fb.reset) {
      fb.samples = [];
      fb.sum = 0;
      fb.count = 0;
      fb.avg = Number.isFinite(fb.pv) ? fb.pv : 0;
      fb.ready = false;
      fb.reset = false;
      fb.ema = fb.avg;
      t.fb = fb;
      t.value = fb.avg;
      continue;
    }

    const sample = Number.isFinite(fb.pv) ? fb.pv : 0;
    let avg = sample;

    if (mode === 'EMA') {
      const alpha = 2 / (window + 1);
      const prev = Number.isFinite(fb.ema) ? fb.ema : sample;
      avg = alpha * sample + (1 - alpha) * prev;
      fb.ema = avg;
      fb.count = Math.min((fb.count || 0) + 1, window);
      fb.ready = fb.count >= window;
      fb.sum = avg;
      fb.samples = [];
    } else {
      let samples = Array.isArray(fb.samples) ? fb.samples.slice() : [];
      samples.push(sample);
      if (samples.length > window) samples = samples.slice(-window);
      const sum = samples.reduce((a, b) => a + b, 0);
      avg = samples.length ? sum / samples.length : sample;
      fb.samples = samples;
      fb.sum = sum;
      fb.count = samples.length;
      fb.ready = samples.length >= window;
    }

    fb.pv = sample;
    fb.avg = avg;
    t.fb = fb;
    t.value = avg;
  }
}

/** Flow meter: on linked 1-minute timer done, GPM = pulse count / K (K = counts per gallon). */
function updateFlowMeters(tags) {
  const byId = new Map(tags.map((tag) => [tag.id, tag]));
  for (const t of tags) {
    if (t.type !== 'FLOW') continue;
    const fb = t.fb || {};
    const ctr = fb.ctrId ? byId.get(fb.ctrId) : null;
    const tmr = fb.tmrId ? byId.get(fb.tmrId) : null;
    if (!ctr || !tmr || tmr.type !== 'TIMER' || ctr.type !== 'COUNTER') continue;

    const tmrFb = tmr.fb || {};
    const done = !!tmrFb.done;
    let k = Number(fb.k);
    if (!Number.isFinite(k) || k <= 0) {
      if (fb.kTagId) {
        const kTag = byId.get(fb.kTagId);
        k = Number(kTag?.value);
      }
      if (!Number.isFinite(k) || k <= 0) k = Number(t.preset) || 1;
    }

    if (done && !fb.prevTmrDone) {
      const count = Number(ctr.fb?.count ?? ctr.value) || 0;
      const gpm = k > 0 ? count / k : 0;
      fb.gpm = gpm;
      fb.ready = true;
      ctr.fb = { ...(ctr.fb || {}), reset: true };
      tmr.fb = { ...(tmr.fb || {}), reset: true };
      if (fb.outId) {
        const out = byId.get(fb.outId);
        if (out && (out.type === 'INT' || out.type === 'REAL' || out.role === 'memory' || out.role === 'output')) {
          out.value = out.type === 'INT' ? Math.trunc(gpm) : gpm;
          out.dirty = true;
        }
      }
    } else if (!done) {
      fb.ready = false;
    }

    fb.prevTmrDone = done;
    t.fb = fb;
    t.value = fb.gpm;
  }
}

module.exports = {
  updateTimers, updateCounters, updatePids, updateAverages, updateFlowMeters,
  pidDisplayFb, effectiveAnalogValue,
};
