'use strict';

const ETHERTYPE_VLAN = 0x8100;
const ETHERTYPE_IPV4 = 0x0800;
const ETHERTYPE_ARP = 0x0806;
const IP_PROTO_ICMP = 1;
const IP_PROTO_TCP = 6;
const IP_PROTO_UDP = 17;

function readMac(buf, off) {
  return Array.from(buf.subarray(off, off + 6))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':');
}

function readIpv4(buf, off) {
  return `${buf[off]}.${buf[off + 1]}.${buf[off + 2]}.${buf[off + 3]}`;
}

function parseEthernet(buf) {
  if (buf.length < 14) return null;
  let l3Offset = 14;
  let etherType = buf.readUInt16BE(12);
  let vlan = null;

  if (etherType === ETHERTYPE_VLAN) {
    if (buf.length < 18) return null;
    vlan = buf.readUInt16BE(14) & 0x0fff;
    etherType = buf.readUInt16BE(16);
    l3Offset = 18;
  }

  return {
    dstMac: readMac(buf, 0),
    srcMac: readMac(buf, 6),
    vlan,
    etherType,
    l3Offset,
  };
}

function parseArp(buf, eth) {
  const off = eth.l3Offset;
  if (buf.length < off + 28) return null;
  const htype = buf.readUInt16BE(off);
  const ptype = buf.readUInt16BE(off + 2);
  if (htype !== 1 || ptype !== ETHERTYPE_IPV4) return null;
  const opcode = buf.readUInt16BE(off + 6);
  const senderMac = readMac(buf, off + 8);
  const senderIp = readIpv4(buf, off + 14);
  const targetMac = readMac(buf, off + 18);
  const targetIp = readIpv4(buf, off + 24);
  return {
    layer: 'arp',
    opcode: opcode === 1 ? 'request' : opcode === 2 ? 'reply' : `op${opcode}`,
    senderMac,
    senderIp,
    targetMac,
    targetIp,
  };
}

function parseIpv4(buf, eth) {
  const off = eth.l3Offset;
  if (buf.length < off + 20) return null;
  const verIhl = buf[off];
  const version = verIhl >> 4;
  if (version !== 4) return null;
  const ihl = (verIhl & 0x0f) * 4;
  if (buf.length < off + ihl) return null;

  const totalLen = buf.readUInt16BE(off + 2);
  const protocol = buf[off + 9];
  const srcIp = readIpv4(buf, off + 12);
  const dstIp = readIpv4(buf, off + 16);
  const l4Off = off + ihl;
  const payloadLen = Math.max(0, Math.min(totalLen - ihl, buf.length - l4Off));

  const base = {
    layer: 'ipv4',
    srcIp,
    dstIp,
    protocol,
    protocolName: protocolName(protocol),
    l4Offset: l4Off,
    payload: buf.subarray(l4Off, l4Off + payloadLen),
    totalLen,
  };

  if (protocol === IP_PROTO_TCP) {
    const tcp = parseTcp(buf, l4Off, payloadLen);
    if (tcp) Object.assign(base, tcp);
  } else if (protocol === IP_PROTO_UDP) {
    const udp = parseUdp(buf, l4Off, payloadLen);
    if (udp) Object.assign(base, udp);
  } else if (protocol === IP_PROTO_ICMP) {
    const icmp = parseIcmp(buf, l4Off, payloadLen);
    if (icmp) Object.assign(base, icmp);
  }

  return base;
}

function protocolName(p) {
  if (p === IP_PROTO_ICMP) return 'icmp';
  if (p === IP_PROTO_TCP) return 'tcp';
  if (p === IP_PROTO_UDP) return 'udp';
  return `ip-proto-${p}`;
}

function parseTcp(buf, off, maxLen) {
  if (buf.length < off + 20) return null;
  const srcPort = buf.readUInt16BE(off);
  const dstPort = buf.readUInt16BE(off + 2);
  const seq = buf.readUInt32BE(off + 4);
  const ack = buf.readUInt32BE(off + 8);
  const dataOff = ((buf[off + 12] >> 4) & 0x0f) * 4;
  const flags = {
    fin: !!(buf[off + 13] & 0x01),
    syn: !!(buf[off + 13] & 0x02),
    rst: !!(buf[off + 13] & 0x04),
    psh: !!(buf[off + 13] & 0x08),
    ack: !!(buf[off + 13] & 0x10),
    urg: !!(buf[off + 13] & 0x20),
  };
  const payloadOff = off + dataOff;
  const payload = buf.subarray(payloadOff, off + maxLen);
  return {
    layer: 'tcp',
    srcPort,
    dstPort,
    seq,
    ack,
    flags,
    payload,
    flowKey: `${srcPort}->${dstPort}`,
  };
}

function parseUdp(buf, off, maxLen) {
  if (buf.length < off + 8) return null;
  const srcPort = buf.readUInt16BE(off);
  const dstPort = buf.readUInt16BE(off + 2);
  const length = buf.readUInt16BE(off + 4);
  const payload = buf.subarray(off + 8, off + Math.min(maxLen, length));
  return {
    layer: 'udp',
    srcPort,
    dstPort,
    payload,
  };
}

function parseIcmp(buf, off, maxLen) {
  if (buf.length < off + 8) return null;
  const type = buf[off];
  const code = buf[off + 1];
  const payload = buf.subarray(off + 8, off + maxLen);
  return {
    layer: 'icmp',
    icmpType: type,
    icmpCode: code,
    icmpLabel: icmpLabel(type, code),
    payload,
  };
}

function icmpLabel(type, code) {
  if (type === 0) return 'echo-reply';
  if (type === 8) return 'echo-request';
  if (type === 3) return `dest-unreachable/${code}`;
  return `type${type}/code${code}`;
}

/**
 * Parse raw L2 frame into structured layers.
 * @returns {object|null}
 */
function parseFrame(buf) {
  const eth = parseEthernet(buf);
  if (!eth) return null;

  const frame = {
    ethernet: {
      srcMac: eth.srcMac,
      dstMac: eth.dstMac,
      vlan: eth.vlan,
    },
  };

  if (eth.etherType === ETHERTYPE_ARP) {
    frame.arp = parseArp(buf, eth);
    return frame;
  }

  if (eth.etherType === ETHERTYPE_IPV4) {
    frame.ip = parseIpv4(buf, eth);
    return frame;
  }

  frame.unknown = { etherType: `0x${eth.etherType.toString(16)}` };
  return frame;
}

/** True when either endpoint matches targetHost. */
function frameInvolvesHost(frame, targetHost) {
  const ip = frame?.ip;
  if (!ip) {
    if (frame?.arp) {
      return frame.arp.senderIp === targetHost || frame.arp.targetIp === targetHost;
    }
    return false;
  }
  return ip.srcIp === targetHost || ip.dstIp === targetHost;
}

function endpointLabel(frame, targetHost) {
  const ip = frame?.ip;
  if (!ip) return null;
  const local = ip.srcIp === targetHost;
  const remote = ip.dstIp === targetHost;
  const peer = local ? ip.dstIp : remote ? ip.srcIp : ip.dstIp;
  const port = ip.srcPort != null
    ? (local ? `${ip.srcPort}→${ip.dstPort}` : `${ip.dstPort}←${ip.srcPort}`)
    : null;
  return { local, peer, port, direction: local ? 'egress' : 'ingress' };
}

module.exports = {
  parseFrame,
  frameInvolvesHost,
  endpointLabel,
  IP_PROTO_TCP,
  IP_PROTO_UDP,
};
