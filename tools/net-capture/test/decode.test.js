'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseFrame, frameInvolvesHost } = require('../lib/parse-packet');
const { classifyApplication } = require('../decoders');
const { decodeMqtt } = require('../decoders/mqtt');
const { decodeHttp } = require('../decoders/http');
const { analyzeUnknown } = require('../lib/unknown-analyzer');
const { FlowRegistry } = require('../lib/flow-registry');
const { proposeDecodingScheme } = require('../lib/scheme-proposer');

const TARGET = '192.168.1.241';
const PC = '192.168.1.100';

function buildIpv4TcpFrame(srcIp, dstIp, srcPort, dstPort, payload) {
  const tcpLen = 20 + payload.length;
  const ipLen = 20 + tcpLen;
  const frame = Buffer.alloc(14 + ipLen);
  frame.writeUInt16BE(0x0800, 12);
  const ipOff = 14;
  frame[ipOff] = 0x45;
  frame.writeUInt16BE(ipLen, ipOff + 2);
  frame[ipOff + 9] = 6;
  srcIp.split('.').forEach((o, i) => { frame[ipOff + 12 + i] = Number(o); });
  dstIp.split('.').forEach((o, i) => { frame[ipOff + 16 + i] = Number(o); });
  const tcpOff = ipOff + 20;
  frame.writeUInt16BE(srcPort, tcpOff);
  frame.writeUInt16BE(dstPort, tcpOff + 2);
  frame[tcpOff + 12] = 0x50;
  payload.copy(frame, tcpOff + 20);
  return frame;
}

test('known HTTP classified as http/1.x not vendor-specific', () => {
  const payload = Buffer.from('GET /api/status HTTP/1.0\r\nHost: x\r\n\r\n');
  const frame = buildIpv4TcpFrame(PC, TARGET, 54321, 80, payload);
  const parsed = parseFrame(frame);
  assert.ok(frameInvolvesHost(parsed, TARGET));
  const app = classifyApplication(parsed);
  assert.equal(app.scheme, 'http/1.x');
  assert.equal(app.decoded.method, 'GET');
  assert.ok(app.unknown);
});

test('unknown binary gets length-field hypothesis', () => {
  const body = Buffer.from([0x10, 0x00, 0x01, 0x02, 0x03]);
  const buf = Buffer.alloc(2 + body.length);
  buf.writeUInt16BE(body.length, 0);
  body.copy(buf, 2);
  const a = analyzeUnknown(buf);
  assert.ok(a.lengthFields.length >= 1);
  assert.equal(a.contentClass, 'binary-length-prefixed');
});

test('MQTT PUBLISH decoded generically', () => {
  const topic = 'devices/sensor1/reading';
  const body = JSON.stringify({ temp: 22.5 });
  const topicBuf = Buffer.from(topic, 'utf8');
  const bodyBuf = Buffer.from(body, 'utf8');
  const variable = Buffer.concat([
    Buffer.from([topicBuf.length >> 8, topicBuf.length & 0xff]),
    topicBuf,
    bodyBuf,
  ]);
  const mqtt = Buffer.concat([Buffer.from([0x30, variable.length]), variable]);
  const decoded = decodeMqtt(mqtt);
  assert.equal(decoded.messageType, 'PUBLISH');
  assert.equal(decoded.topic, topic);
  assert.equal(decoded.payloadJson.temp, 22.5);
});

test('flow registry proposes framing for fixed-size unknown', () => {
  const reg = new FlowRegistry();
  const fixed = Buffer.alloc(16, 0xab);
  for (let i = 0; i < 5; i += 1) {
    reg.ingest({
      target: TARGET,
      ip: { srcIp: PC, dstIp: TARGET, protocol: 'tcp', srcPort: 40000, dstPort: 9000, layer: 'tcp' },
      application: { scheme: 'unknown', unknown: analyzeUnknown(fixed) },
      payload: { len: 16, hex: fixed.toString('hex') },
    });
  }
  const proposal = proposeDecodingScheme(reg.snapshot(), TARGET);
  const flow = proposal.flowProposals.find((f) => f.port === 9000);
  assert.ok(flow);
  assert.match(flow.proposedFraming, /fixed-frame-16-bytes/);
});

test('HTTP JSON body parsed in response', () => {
  const payload = Buffer.from(
    'HTTP/1.0 200 OK\r\nContent-Type: application/json\r\n\r\n{"ok":true}',
  );
  const http = decodeHttp(payload);
  assert.equal(http.status, 200);
  assert.equal(http.bodyPreview.value.ok, true);
});
