'use strict';

const fs = require('fs');
const path = require('path');
const { pickBackend } = require('./capture-backend');
const { FlowRegistry } = require('./flow-registry');
const { proposeDecodingScheme } = require('./scheme-proposer');
const { loadPlugins } = require('../decoders');
const { DATA_DIR } = require('./settings-store');

const MAX_RING = 1000;

class CaptureSession {
  constructor() {
    this.state = 'idle';
    this.error = null;
    this.backend = null;
    this.backendName = null;
    this.bpf = null;
    this.promiscuous = true;
    this.targetHost = null;
    this.startedAt = null;
    this.stoppedAt = null;
    this.registry = new FlowRegistry();
    this.proposal = null;
    this.packets = [];
    this.nextId = 1;
    this.outStream = null;
    this._runPromise = null;
    this._pluginsLoaded = false;
  }

  status() {
    const snap = this.registry.snapshot();
    return {
      state: this.state,
      error: this.error,
      targetHost: this.targetHost,
      bpf: this.bpf,
      promiscuous: this.promiscuous,
      backend: this.backendName,
      startedAt: this.startedAt,
      stoppedAt: this.stoppedAt,
      packetCount: snap.packetCount,
      flowCount: snap.flowCount,
      unknownCount: snap.unknownCount,
      ringSize: this.packets.length,
    };
  }

  listPackets({ limit = 100, offset = 0, scheme } = {}) {
    let rows = this.packets;
    if (scheme) {
      rows = rows.filter((p) => {
        const app = p.record.stream?.application || p.record.application;
        return app?.scheme === scheme;
      });
    }
    const end = rows.length - offset;
    const start = Math.max(0, end - limit);
    const slice = rows.slice(start, end);
    return {
      total: rows.length,
      offset,
      limit,
      packets: [...slice].reverse(),
    };
  }

  flows() {
    return this.registry.snapshot();
  }

  getProposal() {
    if (this.proposal) return this.proposal;
    return proposeDecodingScheme(this.registry.snapshot(), this.targetHost);
  }

  async start(opts) {
    if (this.state === 'capturing') {
      throw new Error('Capture already running');
    }

    this._resetSession();
    this.targetHost = opts.targetHost;
    this.bpf = opts.bpf || `host ${opts.targetHost}`;
    this.promiscuous = opts.promiscuous !== false;
    this.state = 'capturing';
    this.startedAt = new Date().toISOString();
    this.error = null;

    if (opts.plugins?.length && !this._pluginsLoaded) {
      loadPlugins(opts.plugins);
      this._pluginsLoaded = true;
    }

    const logPath = opts.logFile || path.join(DATA_DIR, 'capture.jsonl');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    this.outStream = fs.createWriteStream(logPath, { flags: 'a' });

    try {
      this.backend = pickBackend({
        targetHost: opts.targetHost,
        iface: opts.iface || 'auto',
        bpf: this.bpf,
        forceTshark: !!opts.forceTshark,
        promiscuous: this.promiscuous,
      });
      this.backendName = this.backend.name;
    } catch (e) {
      this.state = 'error';
      this.error = e.message;
      this.outStream?.end();
      this.outStream = null;
      throw e;
    }

    const ringMax = opts.ringSize || MAX_RING;
    const onRecord = (record) => {
      this.registry.ingest(record);
      const entry = { id: this.nextId++, ts: record.ts, record };
      this.packets.push(entry);
      if (this.packets.length > ringMax) this.packets.shift();
      if (this.outStream) this.outStream.write(`${JSON.stringify(record)}\n`);
    };

    this._runPromise = this.backend.start(onRecord).then(() => {
      this._finalize();
    }).catch((e) => {
      this.state = 'error';
      this.error = e.message || String(e);
      this._finalize();
    });

    return this.status();
  }

  stop() {
    if (this.state !== 'capturing' || !this.backend) {
      return this.status();
    }
    this.state = 'stopping';
    this.backend.stop();
    return this.status();
  }

  clear() {
    if (this.state === 'capturing') {
      throw new Error('Stop capture before clearing');
    }
    this._resetSession();
    return this.status();
  }

  _resetSession() {
    this.registry = new FlowRegistry();
    this.proposal = null;
    this.packets = [];
    this.nextId = 1;
    this.error = null;
    this.backend = null;
    this.backendName = null;
    this.bpf = null;
    this.startedAt = null;
    this.stoppedAt = null;
    if (this.outStream) {
      this.outStream.end();
      this.outStream = null;
    }
  }

  _finalize() {
    this.stoppedAt = new Date().toISOString();
    if (this.outStream) {
      this.outStream.end();
      this.outStream = null;
    }
    const snapshot = this.registry.snapshot();
    this.proposal = proposeDecodingScheme(snapshot, this.targetHost);
    const proposalPath = path.join(DATA_DIR, 'proposal.json');
    fs.writeFileSync(proposalPath, `${JSON.stringify(this.proposal, null, 2)}\n`);
    if (this.state !== 'error') this.state = 'idle';
    this.backend = null;
  }
}

module.exports = { CaptureSession, MAX_RING };
