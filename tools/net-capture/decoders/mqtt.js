'use strict';

const MQTT_TYPES = {
  1: 'CONNECT',
  2: 'CONNACK',
  3: 'PUBLISH',
  4: 'PUBACK',
  8: 'SUBSCRIBE',
  9: 'SUBACK',
  12: 'PINGREQ',
  13: 'PINGRESP',
  14: 'DISCONNECT',
};

function readMqttRemainingLength(buf, start) {
  let mult = 1;
  let value = 0;
  let pos = start;
  for (let i = 0; i < 4; i += 1) {
    if (pos >= buf.length) return null;
    const encoded = buf[pos++];
    value += (encoded & 0x7f) * mult;
    if ((encoded & 0x80) === 0) return { length: value, offset: pos };
    mult *= 128;
  }
  return null;
}

function readUtf8(buf, off) {
  if (off + 2 > buf.length) return null;
  const len = buf.readUInt16BE(off);
  if (off + 2 + len > buf.length) return null;
  return {
    value: buf.subarray(off + 2, off + 2 + len).toString('utf8'),
    offset: off + 2 + len,
  };
}

function decodeMqtt(buf) {
  if (!buf || buf.length < 2) return null;
  const type = (buf[0] >> 4) & 0x0f;
  const flags = buf[0] & 0x0f;
  const rem = readMqttRemainingLength(buf, 1);
  if (!rem) return null;
  const bodyEnd = rem.offset + rem.length;
  if (bodyEnd > buf.length) return null;

  const typeName = MQTT_TYPES[type] || `TYPE${type}`;
  const body = buf.subarray(rem.offset, bodyEnd);
  const out = { protocol: 'mqtt', messageType: typeName, flags };

  if (type === 3) {
    const qos = (flags >> 1) & 0x03;
    let pos = 0;
    const topic = readUtf8(body, pos);
    if (!topic) return out;
    pos = topic.offset;
    let packetId = null;
    if (qos > 0) {
      if (pos + 2 > body.length) return out;
      packetId = body.readUInt16BE(pos);
      pos += 2;
    }
    const payload = body.subarray(pos);
    out.topic = topic.value;
    out.qos = qos;
    out.packetId = packetId;
    out.payloadText = payload.toString('utf8');
    out.payloadLen = payload.length;
    if (payload[0] === 0x7b || payload[0] === 0x5b) {
      try { out.payloadJson = JSON.parse(out.payloadText); } catch { /* raw */ }
    }
    return out;
  }

  if (type === 1 && body.length >= 6) {
    const proto = readUtf8(body, 0);
    if (proto) {
      out.clientProtocol = proto.value;
      const cid = readUtf8(body, proto.offset + 2);
      if (cid) out.clientId = cid.value;
    }
    return out;
  }

  out.rawHex = body.length <= 32 ? body.toString('hex') : `${body.subarray(0, 32).toString('hex')}…`;
  return out;
}

module.exports = { decodeMqtt };
