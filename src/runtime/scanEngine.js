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
  updateTimers, updateCounters, updatePids, updateAverages, updateFlowMeters, updateAlternators,
} = require('../engine/functionBlocks');
const { waitForParcCmdHealth, waitForParcDeviceTelemetry } = require('../parc/waitForParcDevice');
const { registry } = require('../parc/deviceRegistry');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Opta needs time after runtime_status before put_program (forced telemetry + cmd drain). */
function remoteDeploySettleMs(settings) {
  const raw = settings?.mqttParc?.bootDeployDelayMs;
  if (raw === 0 || raw === '0') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 8000;
}

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
    this._projectName = undefined;
    this._startPromise = null;
  }

  loadSettings() {
    const s = persistence.readJson('settings.json', {});
    this.scanMs = s.scanMs || 100;
    this.remoteExecution = s.remoteExecution === true;
    this._projectName = s?.project?.name || s?.projectName || undefined;
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
    if (this._startPromise) return this._startPromise;
    this._startPromise = this._startCore().finally(() => {
      this._startPromise = null;
    });
    return this._startPromise;
  }

  async _startCore() {
    const settings = this.loadSettings();
    const remoteRedeploy = this.running && !this.paused && this.remoteExecution;
    if (this.running) {
      if (this.paused) {
        this.resume();
        return;
      }
      if (!remoteRedeploy) return;
    }
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
      const health = await waitForParcCmdHealth(
        {
          deviceId: remote.cfg?.deviceId || remote.cfg?.id,
          ateccSerial: remote.cfg?.ateccSerial,
        },
        { attempts: 6, retryDelayMs: 2000, timeoutMs: 10000 },
      );
      if (!health.ok) {
        throw Object.assign(new Error(health.error), { errors: [health.error] });
      }
      remote.connected = true;
      remote._lastError = '';
      const deployDelayMs = remoteDeploySettleMs(settings);
      if (deployDelayMs > 0) {
        console.log(`[parc-deploy] waiting ${deployDelayMs}ms for Opta cmd link settle`);
        await sleep(deployDelayMs);
      }
      const skipCrcCheck = settings.mqttParc?.skipDeployWhenCrcMatches !== false;
      if (skipCrcCheck) {
        const telem = await waitForParcDeviceTelemetry(
          {
            deviceId: remote.cfg?.deviceId || remote.cfg?.id,
            ateccSerial: remote.cfg?.ateccSerial,
          },
          { timeoutMs: 15000, maxAgeSec: 120 },
        );
        if (!telem.ok) {
          console.warn(`[parc-deploy] telemetry probe: ${telem.error} — continuing with get_program CRC check`);
        }
      }
      const src = programStore.readActive();
      const rel = programStore.activeRel() || '(program)';
      const deviceId = remote.cfg?.deviceId || remote.cfg?.id;
      console.log(`[parc-deploy] ${rel} → device ${deviceId}`);
      const deploy = await remote.deployProgram(src, this.tagStore);
      if (!deploy.ok) {
        const dev = registry.getDevice(deviceId);
        const msg = deploy.errors?.join('; ') || 'Program deploy failed';
        if (dev?.runtime?.programOk) {
          console.warn(
            `[parc-deploy] deploy failed (${msg}) — NV program still on ${deviceId}; starting runtime`,
          );
          try {
            await remote.startRuntime();
          } catch (startErr) {
            throw Object.assign(new Error(`${msg}; runtime_start: ${startErr.message || startErr}`), {
              errors: [...(deploy.errors || []), startErr.message || String(startErr)],
            });
          }
        } else {
          console.error(`[parc-deploy] FAILED (${deviceId}): ${msg}`);
          throw Object.assign(new Error(msg), {
            errors: deploy.errors || [],
          });
        }
      } else if (deploy.skipped) {
        console.log(`[parc-deploy] skipped download — ${deploy.reason || 'NV CRC match'}`);
        if (deploy.needsRuntimeStart) {
          console.log(`[parc-deploy] starting runtime on device ${deviceId}`);
          await remote.startRuntime();
        } else if (typeof remote.ensureRemoteSession === 'function') {
          await remote.ensureRemoteSession({ deviceId });
        }
      } else {
        console.log(`[parc-deploy] OK — starting runtime on device ${deviceId}`);
        await remote.startRuntime();
      }
      this.ast = { type: 'program', body: [], remote: true };
      this.errors = [];
      this._programTrace = [];
    } else {
      const r = this.loadProgram();
      if (!r.ok) throw Object.assign(new Error('Program invalid'), { errors: r.errors });
    }
    if (!this.running) {
      this._oneShotFired = new Set();
      this.running = true;
      this.paused = false;
      this._lastTick = Date.now();
      this._schedule();
    }
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
      let tagList = this.tagStore.list();
      if (remote && this.ast?.remote) {
        await remote.runScanCycle(this.tagStore);
        this.tagStore.applyForcesAfterRead();
        tagList = this.tagStore.list();
      } else {
        await this.driverManager.readAll();
        this.tagStore.applyForcesAfterRead();
        tagList = this.tagStore.list();
        if (this.ast && !this.ast.remote) {
          const trace = [];
          const ctx = createContext(this.tagStore, this._oneShotFired);
          execute(this.ast, ctx, trace);
          this._programTrace = trace;
        }
        updateTimers(tagList, dt);
        updateCounters(tagList);
        updateFlowMeters(tagList);
        updatePids(tagList, dt);
        updateAverages(tagList);
        updateAlternators(tagList);
        this.tagStore.applyForcesAfterLogic();
        await this.driverManager.writeAll();
      }
      const archiveTags = tagList.filter(
        (t) => t.graphEnabled !== false && isGraphableTag(t),
      );
      if (this.graphHistory && archiveTags.length) {
        this.graphHistory.record(archiveTags);
      }
      if (this.running && !this.paused && archiveTags.length) {
        const archivePens = pensFromEnabledTags(tagList, this._graphPens);
        mongoTagLogger.logPenSamples({
          pens: archivePens,
          tags: tagList,
          runtime: { running: true, projectName: this._projectName },
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
      projectName: this._projectName,
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
