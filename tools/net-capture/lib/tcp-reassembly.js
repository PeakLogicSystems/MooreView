'use strict';

const MAX_STREAM_BYTES = 256 * 1024;

class TcpReassembler {
  constructor() {
    /** @type {Map<string, {buf: Buffer, lastSeq: number|null, packets: number}>} */
    this.streams = new Map();
  }

  key(frame, targetHost) {
    const ip = frame.ip;
    const a = ip.srcIp === targetHost
      ? `${ip.srcIp}:${ip.srcPort}`
      : `${ip.dstIp}:${ip.dstPort}`;
    const b = ip.srcIp === targetHost
      ? `${ip.dstIp}:${ip.dstPort}`
      : `${ip.srcIp}:${ip.srcPort}`;
    return `${a}<->${b}`;
  }

  /**
   * Append TCP payload; return reassembled chunk when HTTP/MQTT boundary likely complete.
   */
  feed(frame, targetHost) {
    const ip = frame.ip;
    if (!ip || ip.layer !== 'tcp' || !ip.payload?.length) return null;

    const k = this.key(frame, targetHost);
    let st = this.streams.get(k);
    if (!st) {
      st = { buf: Buffer.alloc(0), lastSeq: null, packets: 0 };
      this.streams.set(k, st);
    }

    st.packets += 1;
    if (ip.flags.syn && !ip.flags.ack) {
      st.buf = Buffer.alloc(0);
      st.lastSeq = ip.seq + 1;
    }

    st.buf = Buffer.concat([st.buf, ip.payload]);
    if (st.buf.length > MAX_STREAM_BYTES) {
      st.buf = st.buf.subarray(st.buf.length - MAX_STREAM_BYTES);
    }

    if (this.looksComplete(st.buf)) {
      const chunk = st.buf;
      st.buf = Buffer.alloc(0);
      return { streamKey: k, payload: chunk, packets: st.packets };
    }
    return null;
  }

  looksComplete(buf) {
    if (!buf.length) return false;
    const text = buf.toString('latin1', 0, Math.min(buf.length, 12));
    if (/^(GET|POST|PUT|DELETE|HEAD|OPTIONS|HTTP\/)/.test(text)) {
      const end = buf.indexOf('\r\n\r\n');
      if (end < 0) return false;
      const headers = buf.toString('latin1', 0, end);
      const cl = headers.match(/content-length:\s*(\d+)/i);
      const bodyStart = end + 4;
      if (cl) {
        const need = bodyStart + Number(cl[1]);
        return buf.length >= need;
      }
      return true;
    }
    if ((buf[0] >> 4) >= 1 && (buf[0] >> 4) <= 14) {
      return this.mqttFrameComplete(buf);
    }
    return buf.length >= 4 && buf.length < 512;
  }

  mqttFrameComplete(buf) {
    const rem = this.mqttRemaining(buf, 1);
    if (!rem) return false;
    return buf.length >= rem.offset + rem.length;
  }

  mqttRemaining(buf, start) {
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
}

module.exports = { TcpReassembler };
