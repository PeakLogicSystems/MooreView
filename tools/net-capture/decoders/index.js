'use strict';

const fs = require('fs');
const path = require('path');

const { decodeHttp } = require('./http');
const { decodeMqtt } = require('./mqtt');
const { decodeModbusTcp } = require('./modbus');
const { analyzeUnknown } = require('../lib/unknown-analyzer');

const WELL_KNOWN = {
  tcp: {
    80: 'http',
    443: 'tls',
    1883: 'mqtt',
    8883: 'mqtt-tls',
    502: 'modbus-tcp',
    8080: 'http-alt',
    5020: 'custom',
  },
  udp: {
    53: 'dns',
    67: 'dhcp-server',
    68: 'dhcp-client',
    5353: 'mdns',
  },
};

/** @type {Array<(payload: Buffer, ctx: object) => object|null>} */
let plugins = [];

function loadPlugins(names = []) {
  plugins = [];
  for (const name of names) {
    try {
      const mod = require(path.join(__dirname, 'plugins', `${name}.js`));
      if (typeof mod.enhance === 'function') plugins.push(mod.enhance);
    } catch (e) {
      throw new Error(`Plugin "${name}" not found: ${e.message}`);
    }
  }
}

function payloadFromFrame(frame) {
  return frame?.ip?.payload || Buffer.alloc(0);
}

/**
 * Decode pipeline: known protocols first, then unknown analysis always.
 */
function classifyApplication(frame, ctx = {}) {
  const ip = frame?.ip;
  const payload = payloadFromFrame(frame);
  if (!ip || !payload.length) return { scheme: 'no-payload', portHint: null };

  const srcPort = ip.srcPort;
  const dstPort = ip.dstPort;
  const portHint = (ip.layer === 'tcp' && (WELL_KNOWN.tcp[dstPort] || WELL_KNOWN.tcp[srcPort]))
    || (ip.layer === 'udp' && (WELL_KNOWN.udp[dstPort] || WELL_KNOWN.udp[srcPort]))
    || null;

  const known = tryKnownDecoders(payload, { portHint, srcPort, dstPort, ...ctx });
  const unknown = analyzeUnknown(payload, { knownMqtt: known?.protocol === 'mqtt' });

  let result = {
    scheme: known ? schemeId(known) : 'unknown',
    portHint,
    confidence: known ? 'known-decoder' : 'heuristic',
    decoded: known || undefined,
    unknown,
  };

  for (const enhance of plugins) {
    const extra = enhance(payload, { ...ctx, known, unknown, ip });
    if (extra) result = { ...result, ...extra };
  }

  return result;
}

function tryKnownDecoders(payload, ctx) {
  const { portHint, dstPort, srcPort } = ctx;
  const attempts = [];

  if (portHint === 'http' || portHint === 'http-alt' || ctx.ip?.layer === 'tcp') {
    const http = decodeHttp(payload);
    if (http) attempts.push(http);
  }
  if (portHint === 'mqtt' || dstPort === 1883 || srcPort === 1883) {
    const mqtt = decodeMqtt(payload);
    if (mqtt) attempts.push(mqtt);
  }
  if (portHint === 'modbus-tcp' || dstPort === 502 || srcPort === 502) {
    const modbus = decodeModbusTcp(payload);
    if (modbus) attempts.push(modbus);
  }

  return attempts[0] || null;
}

function schemeId(decoded) {
  if (decoded.protocol === 'http') return 'http/1.x';
  if (decoded.protocol === 'mqtt') return 'mqtt-3.1.1';
  if (decoded.protocol === 'modbus-tcp') return 'modbus-tcp';
  return decoded.protocol || 'known';
}

function decodingSchemeDoc(targetHost) {
  const { proposeDecodingScheme } = require('../lib/scheme-proposer');
  return proposeDecodingScheme({
    packetCount: 0,
    unknownCount: 0,
    flows: [],
  }, targetHost);
}

module.exports = {
  classifyApplication,
  decodingSchemeDoc,
  loadPlugins,
  WELL_KNOWN,
};
