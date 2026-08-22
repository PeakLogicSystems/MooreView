'use strict';

const { analyzeUnknown } = require('./unknown-analyzer');

class FlowRegistry {
  constructor() {
    /** @type {Map<string, object>} */
    this.flows = new Map();
    this.packetCount = 0;
    this.unknownCount = 0;
  }

  flowKey(record) {
    const ip = record.ip;
    if (!ip) return `arp:${record.arp?.senderIp || '?'}`;
    const a = `${ip.srcIp}:${ip.srcPort || 0}`;
    const b = `${ip.dstIp}:${ip.dstPort || 0}`;
    return [a, b].sort().join('<->');
  }

  servicePort(record) {
    const ip = record.ip;
    if (!ip?.dstPort) return null;
    const local = record.endpoint?.local;
    return local ? ip.srcPort : ip.dstPort;
  }

  ingest(record) {
    this.packetCount += 1;
    const key = this.flowKey(record);
    let flow = this.flows.get(key);
    if (!flow) {
      flow = {
        key,
        l4: record.ip?.protocol || 'arp',
        ports: {
          a: record.ip?.srcPort,
          b: record.ip?.dstPort,
        },
        peers: new Set([record.ip?.srcIp, record.ip?.dstIp].filter(Boolean)),
        packets: 0,
        bytes: 0,
        schemes: {},
        prefixes: {},
        lengths: [],
        samples: [],
        unknownSamples: [],
      };
      this.flows.set(key, flow);
    }

    flow.packets += 1;
    const app = record.stream?.application || record.application;
    const scheme = app?.scheme || 'unclassified';
    flow.schemes[scheme] = (flow.schemes[scheme] || 0) + 1;

    const buf = extractPayloadBuffer(record);
    if (buf?.length) {
      flow.bytes += buf.length;
      flow.lengths.push(buf.length);
      const p4 = buf.subarray(0, Math.min(4, buf.length)).toString('hex');
      flow.prefixes[p4] = (flow.prefixes[p4] || 0) + 1;

      if (flow.samples.length < 8) {
        flow.samples.push({
          len: buf.length,
          prefixHex4: p4,
          analysis: analyzeUnknown(buf, { knownMqtt: scheme.includes('mqtt') }),
        });
      }

      if (scheme === 'unknown') {
        this.unknownCount += 1;
        if (flow.unknownSamples.length < 12) {
          flow.unknownSamples.push(buf.subarray(0, Math.min(128, buf.length)));
        }
      }
    }

    return flow;
  }

  snapshot() {
    const flows = [];
    for (const flow of this.flows.values()) {
      flows.push({
        key: flow.key,
        l4: flow.l4,
        ports: flow.ports,
        peers: [...flow.peers],
        packets: flow.packets,
        bytes: flow.bytes,
        schemes: flow.schemes,
        topPrefixes: topEntries(flow.prefixes, 5),
        lengthStats: lengthStats(flow.lengths),
        samples: flow.samples,
        unknownSampleCount: flow.unknownSamples.length,
      });
    }
    flows.sort((a, b) => b.bytes - a.bytes);
    return {
      packetCount: this.packetCount,
      unknownCount: this.unknownCount,
      flowCount: flows.length,
      flows,
    };
  }
}

function payloadHexToBuf(record) {
  const hex = record?.payload?.hex || record?.stream?.payload?.hex;
  if (!hex) return null;
  try {
    return Buffer.from(String(hex).replace(/…$/, ''), 'hex');
  } catch {
    return null;
  }
}

function extractPayloadBuffer(record) {
  return payloadHexToBuf(record) || payloadHexToBuf(record.stream);
}

function topEntries(obj, n) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, count]) => ({ prefix: k, count }));
}

function lengthStats(lengths) {
  if (!lengths.length) return null;
  const sorted = [...lengths].sort((a, b) => a - b);
  const sum = lengths.reduce((a, b) => a + b, 0);
  const hist = {};
  for (const len of lengths) {
    const bucket = len < 64 ? '<64' : len < 256 ? '64-255' : len < 1024 ? '256-1k' : '1k+';
    hist[bucket] = (hist[bucket] || 0) + 1;
  }
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(sum / lengths.length),
    median: sorted[Math.floor(sorted.length / 2)],
    histogram: hist,
    fixedSize: sorted[0] === sorted[sorted.length - 1] ? sorted[0] : null,
  };
}

module.exports = { FlowRegistry };
