'use strict';

const programStore = require('../programs/programStore');
const { ensureMotorTags, isMotorProgramPath } = require('../programs/motorTags');
const { ensureTpoTags, isTpoProgramPath } = require('../programs/tpoTags');
const persistence = require('../persistence');
const { normalizePens, penTagIds, pensFromEnabledTags } = require('../graph/graphPens');
const mongoTagLogger = require('../logger/mongoTagLogger');
const { isGraphableTag } = require('../tags/graphableTags');
const { parseProgram, validateProgram } = require('../engine/parser');
const { execute, createContext, collectExpressionTrace } = require('../engine/executor');
const {
  updateTimers, updateCounters, updatePids, updateAverages, updateFlowMeters,
} = require('../engine/functionBlocks');

class ScanEngine {
  constructor(tagStore, driverManager, graphHistory) {
    this.tagStore = tagStore;
    this.driverManager = driverManager;
    this.graphHistory = graphHistory;
    this.running = false;
    this.paused = false;
    this.timer = null;
    this.scanMs = 100;
    this.lastCycleMs = 0;
    this.errors = [];
    this.ast = null;
    this._lastTick = Date.now();
    this.stats = { cycles: 0, overruns: 0 };
    this.remoteExecution = false;
    this._tickBusy = false;
    this._oneShotFired = new Set();
    this._programTrace = [];
  }

  loadSettings() {
    const s = persistence.readJson('settings.json', {});
    this.scanMs = s.scanMs || 100;
    this.remoteExecution = s.remoteExecution === true;
    if (this.graphHistory && s.graphMaxPoints) this.graphHistory.setMaxPoints(s.graphMaxPoints);
    const tagList = this.tagStore.list();
    this._graphPens = normalizePens(s.graphPens, tagList);
    this._graphPenIds = penTagIds(this._graphPens);
    return s;
  }

  _findRemoteDriver() {
    if (!this.remoteExecution) return null;
    for (const cfg of this.driverManager.configs) {
      if (cfg.enabled && (cfg.type === 'opta_remote' || cfg.type === 'mqtt_parc')) {
        return this.driverManager.instances.get(cfg.id);
      }
    }
    return null;
  }

  loadProgram() {
    if (isMotorProgramPath(programStore.activeRel())) {
      ensureMotorTags(this.tagStore);
    }
    if (isTpoProgramPath(programStore.activeRel())) {
      ensureTpoTags(this.tagStore);
    }
    const src = programStore.readActive();
    if (!src || !String(src).trim()) {
      this.ast = { type: 'program', body: [] };
      this.errors = [];
      return { ok: true, errors: [] };
    }
    const { ast, errors: parseErrs } = parseProgram(src);
    if (parseErrs.length) {
      this.ast = null;
      this.errors = parseErrs;
      return { ok: false, errors: parseErrs };
    }
    const errs = validateProgram(ast, this.tagStore.list().map((t) => t.id));
    if (errs.length) {
      this.ast = null;
      this.errors = errs;
      return { ok: false, errors: errs };
    }
    this.ast = ast;
    this.errors = [];
    return { ok: true, errors: [] };
  }

  validate(source) {
    const { ast, errors: parseErrs } = parseProgram(source);
    if (parseErrs.length) return { ok: false, errors: parseErrs, ast: null };
    const errors = validateProgram(ast, this.tagStore.list().map((t) => t.id));
    return { ok: errors.length === 0, errors, ast };
  }

  async start() {
    if (this.running) {
      if (this.paused) this.resume();
      return;
    }
    this.loadSettings();
    if (this.remoteExecution) {
      let remote = this._findRemoteDriver();
      if (!remote?.connected && !this.driverManager.hasConnectedRtu()) {
        await this.driverManager.rebuild();
        remote = this._findRemoteDriver();
      }
      if (!remote) {
        throw Object.assign(
          new Error(
            'Remote is on but no mqtt_parc driver. Drivers → Apply template → Arduino Opta — MQTT Parc ST runtime, then Connect.',
          ),
          { errors: ['No enabled mqtt_parc driver for remote execution'] },
        );
      }
      if (!(await remote.ensureConnected?.())) {
        const hint = remote._lastError || 'Cannot reach Opta via MQTT Parc';
        throw Object.assign(new Error(hint), { errors: [hint] });
      }
      const src = programStore.readActive();
      const rel = programStore.activeRel() || '(program)';
      console.log(`[parc-deploy] ${rel} → device ${remote.cfg?.deviceId || remote.cfg?.id}`);
      const deploy = await remote.deployProgram(src, this.tagStore);
      if (!deploy.ok) {
        throw Object.assign(new Error(deploy.errors?.join('; ') || 'Program deploy failed'), {
          errors: deploy.errors || [],
        });
      }
      console.log(`[parc-deploy] OK — starting runtime on device`);
      await remote.startRuntime();
      this.ast = { type: 'program', body: [], remote: true };
      this.errors = [];
      this._programTrace = [];
    } else {
      const r = this.loadProgram();
      if (!r.ok) throw Object.assign(new Error('Program invalid'), { errors: r.errors });
    }
    this._oneShotFired = new Set();
    this.running = true;
    this.paused = false;
    this._lastTick = Date.now();
    this._schedule();
  }

  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this._lastTick = Date.now();
    this._schedule();
  }

  async stop() {
    this.running = false;
    this.paused = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const remote = this._findRemoteDriver();
    if (remote) {
      try { await remote.stopRuntime(); } catch { /* ignore */ }
    }
  }

  _schedule() {
    if (!this.running || this.paused) return;
    this.timer = setTimeout(() => this._tick(), this.scanMs);
  }

  async _tick() {
    if (this._tickBusy) {
      this.stats.overruns++;
      this._schedule();
      return;
    }
    this._tickBusy = true;
    const t0 = Date.now();
    const dt = t0 - this._lastTick;
    this._lastTick = t0;
    try {
      const remote = this._findRemoteDriver();
      if (remote && this.ast?.remote) {
        await remote.runScanCycle(this.tagStore);
      } else {
        await this.driverManager.readAll();
        this.tagStore.applyForcesAfterRead();
        if (this.ast && !this.ast.remote) {
          const trace = [];
          const ctx = createContext(this.tagStore, this._oneShotFired);
          execute(this.ast, ctx, trace);
          this._programTrace = trace;
        }
        updateTimers(this.tagStore.list(), dt);
        updateCounters(this.tagStore.list());
        updateFlowMeters(this.tagStore.list());
        updatePids(this.tagStore.list(), dt);
        updateAverages(this.tagStore.list());
        this.tagStore.applyForcesAfterLogic();
        await this.driverManager.writeAll();
      }
      const archiveTags = this.tagStore.list().filter(
        (t) => t.graphEnabled !== false && isGraphableTag(t),
      );
      if (this.graphHistory && archiveTags.length) {
        this.graphHistory.record(archiveTags);
      }
      if (this.running && !this.paused && archiveTags.length) {
        const archivePens = pensFromEnabledTags(this.tagStore.list(), this._graphPens);
        mongoTagLogger.logPenSamples({
          pens: archivePens,
          tags: this.tagStore.list(),
          runtime: { running: true, projectName: this.status().projectName },
        }).catch(() => {});
      }
    } catch (e) {
      if (!Array.isArray(this.errors)) this.errors = [];
      this.errors.push(`${new Date().toISOString()} ${e.message}`);
      if (this.errors.length > 50) this.errors.shift();
    } finally {
      this.lastCycleMs = Date.now() - t0;
      this.stats.cycles++;
      if (this.lastCycleMs > this.scanMs) this.stats.overruns++;
      this._tickBusy = false;
      this._schedule();
    }
  }

  buildProgramTrace() {
    if (!this.ast || this.ast.remote) return [];
    if (this.running && !this.paused) return this._programTrace || [];
    const ctx = createContext(this.tagStore, new Set());
    return collectExpressionTrace(this.ast, ctx);
  }

  status() {
    const settings = persistence.readJson('settings.json', {}) || {};
    const remoteDrv = this._findRemoteDriver();
    let remoteDriverId = null;
    let remoteConnected = false;
    for (const cfg of this.driverManager.configs) {
      if (cfg.enabled && (cfg.type === 'opta_remote' || cfg.type === 'mqtt_parc')) {
        remoteDriverId = cfg.id;
        remoteConnected = !!this.driverManager.instances.get(cfg.id)?.connected;
        break;
      }
    }
    return {
      running: this.running,
      paused: this.paused,
      scanMs: this.scanMs,
      lastCycleMs: this.lastCycleMs,
      stats: this.stats,
      errors: this.errors.slice(-10),
      programOk: !!this.ast,
      remoteExecution: this.remoteExecution,
      remoteDriverId,
      remoteConnected,
      remoteScanOnDevice: !!(remoteDrv && this.ast?.remote),
      projectName: settings?.project?.name || settings?.projectName || undefined,
      programTrace: this.buildProgramTrace(),
    };
  }
}

function shouldAutoStartRuntime(settings, configs) {
  if (settings?.autoStartRuntime === false) return false;
  if (settings?.autoStartRuntime === true) return true;
  return (configs || []).some((c) => c.enabled !== false && c.type === 'nextcentury');
}

module.exports = { ScanEngine, shouldAutoStartRuntime };
