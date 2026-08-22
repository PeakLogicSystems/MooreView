'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parseFrame, frameInvolvesHost, endpointLabel } = require('./parse-packet');
const { classifyApplication } = require('../decoders');
const { TcpReassembler } = require('./tcp-reassembly');

function createCapBackend(options) {
  let Cap;
  let decoders;
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies, global-require
    const capPkg = require('cap');
    Cap = capPkg.Cap;
    decoders = capPkg.decoders;
  } catch (e) {
    throw new Error(
      `cap module not installed (${e.message}). Run: cd tools/net-capture && npm install. Also install Npcap: https://npcap.com/`,
    );
  }

  const cap = new Cap();
  const buffer = Buffer.alloc(65535);
  const filter = options.filter;
  const device = options.device;
  const bufSize = 10 * 1024 * 1024;
  const reasm = new TcpReassembler();
  const promiscuous = options.promiscuous !== false;

  return {
    name: promiscuous ? 'cap (promiscuous)' : 'cap',
    promiscuous,
    async start(onRecord) {
      // node-cap opens pcap_open_live with promisc=1 in native code (always promiscuous).
      const linkType = cap.open(device, filter, bufSize, buffer);
      cap.setMinBytes?.(0);

      cap.on('packet', (nbytes) => {
        let pkt = buffer.subarray(0, nbytes);
        if (linkType === 'LINKTYPE_ETHERNET' && decoders?.PROTOCOL?.ETHERNET) {
          pkt = decoders.Ethernet(pkt);
        }
        handleRaw(pkt, onRecord, options, reasm);
      });

      return new Promise((resolve) => {
        options._stop = () => {
          try { cap.close(); } catch { /* ignore */ }
          resolve();
        };
      });
    },
    stop() {
      options._stop?.();
    },
  };
}

function createTsharkBackend(options) {
  const reasm = new TcpReassembler();
  let child = null;
  const promiscuous = options.promiscuous !== false;

  return {
    name: promiscuous ? 'tshark (promiscuous)' : 'tshark',
    promiscuous,
    async start(onRecord) {
      const args = [
        '-i', String(options.deviceIndex),
        '-f', options.filter,
        '-l',
      ];
      // Promiscuous is ON by default; -p disables it (do not use -o capture.promiscuous — not in all tshark builds).
      if (!promiscuous) {
        args.push('-p');
      }
      args.push(
        '-T', 'fields',
        '-E', 'separator=\t',
        '-e', 'frame.time_epoch',
        '-e', 'eth.src',
        '-e', 'eth.dst',
        '-e', 'ip.src',
        '-e', 'ip.dst',
        '-e', 'ip.proto',
        '-e', 'tcp.srcport',
        '-e', 'tcp.dstport',
        '-e', 'tcp.flags',
        '-e', 'udp.srcport',
        '-e', 'udp.dstport',
        '-e', 'icmp.type',
        '-e', 'tcp.payload',
        '-e', 'udp.payload',
        '-e', 'arp.opcode',
        '-e', 'arp.src.proto_ipv4',
        '-e', 'arp.dst.proto_ipv4',
      );

      child = spawn(options.tshark, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      child.stderr.on('data', (d) => { stderr += d.toString(); });

      const rl = require('readline').createInterface({ input: child.stdout });
      rl.on('line', (line) => {
        handleTsharkLine(line, onRecord, options, reasm);
      });

      return new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code !== 0 && code !== null && !options._userStop) {
            reject(new Error(`tshark exited ${code}: ${stderr.trim()}`));
          } else {
            resolve();
          }
        });
        options._stop = () => {
          options._userStop = true;
          child?.kill('SIGTERM');
        };
      });
    },
    stop() {
      options._stop?.();
    },
  };
}

function attachPayload(record, buf) {
  if (!buf?.length) return;
  record.payload = {
    len: buf.length,
    hex: buf.length <= 512 ? buf.toString('hex') : `${buf.subarray(0, 256).toString('hex')}…`,
  };
}

function hexToBuf(hex) {
  const s = String(hex || '').replace(/:/g, '').trim();
  if (!s) return Buffer.alloc(0);
  return Buffer.from(s, 'hex');
}

function handleTsharkLine(line, onRecord, options, reasm) {
  const f = line.split('\t');
  const ts = f[0] ? new Date(Number(f[0]) * 1000).toISOString() : new Date().toISOString();
  const srcIp = f[3] || '';
  const dstIp = f[4] || '';
  const arpSrc = f[15] || '';
  const arpDst = f[16] || '';

  if (!srcIp && !dstIp && arpSrc) {
    if (arpSrc !== options.targetHost && arpDst !== options.targetHost) return;
    onRecord({
      ts,
      target: options.targetHost,
      ethernet: { srcMac: f[1], dstMac: f[2] },
      arp: {
        layer: 'arp',
        opcode: f[14] === '1' ? 'request' : f[14] === '2' ? 'reply' : `op${f[14]}`,
        senderIp: arpSrc,
        targetIp: arpDst,
      },
    });
    return;
  }

  if (srcIp !== options.targetHost && dstIp !== options.targetHost) return;

  const tcpSport = f[6] ? Number(f[6]) : null;
  const tcpDport = f[7] ? Number(f[7]) : null;
  const udpSport = f[9] ? Number(f[9]) : null;
  const udpDport = f[10] ? Number(f[10]) : null;
  const icmpType = f[11] || '';

  let layer = 'ip';
  let payload = Buffer.alloc(0);
  const ip = {
    srcIp,
    dstIp,
    protocol: Number(f[5] || 0) === 6 ? 'tcp' : Number(f[5] || 0) === 17 ? 'udp' : 'other',
  };

  if (tcpSport) {
    layer = 'tcp';
    ip.layer = 'tcp';
    ip.srcPort = tcpSport;
    ip.dstPort = tcpDport;
    ip.flags = parseTcpFlags(f[8]);
    payload = hexToBuf(f[12]);
    ip.payload = payload;
    ip.payloadLen = payload.length;
  } else if (udpSport) {
    layer = 'udp';
    ip.layer = 'udp';
    ip.srcPort = udpSport;
    ip.dstPort = udpDport;
    payload = hexToBuf(f[13]);
    ip.payload = payload;
    ip.payloadLen = payload.length;
  } else if (icmpType) {
    ip.layer = 'icmp';
    ip.icmp = icmpType === '8' ? 'echo-request' : icmpType === '0' ? 'echo-reply' : `type${icmpType}`;
  }

  const local = srcIp === options.targetHost;
  const record = {
    ts,
    target: options.targetHost,
    endpoint: {
      local,
      peer: local ? dstIp : srcIp,
      port: tcpSport ? (local ? `${tcpSport}→${tcpDport}` : `${tcpDport}←${tcpSport}`) : undefined,
      direction: local ? 'egress' : 'ingress',
    },
    ethernet: { srcMac: f[1], dstMac: f[2] },
    ip,
  };

  if (payload.length) {
    attachPayload(record, payload);
    record.application = classifyApplication({ ip });
  }

  if (layer === 'tcp' && payload.length) {
    const frame = { ip };
    const chunk = reasm.feed(frame, options.targetHost);
    if (chunk) {
      const streamIp = { layer: 'tcp', payload: chunk.payload, srcPort: tcpSport, dstPort: tcpDport };
      record.stream = {
        key: chunk.streamKey,
        reassembled: true,
        application: classifyApplication({ ip: streamIp }),
      };
      attachPayload(record.stream, chunk.payload);
    }
  }

  onRecord(record);
}

function parseTcpFlags(flagHex) {
  const n = parseInt(flagHex, 16) || 0;
  return {
    fin: !!(n & 0x01),
    syn: !!(n & 0x02),
    rst: !!(n & 0x04),
    psh: !!(n & 0x08),
    ack: !!(n & 0x10),
    urg: !!(n & 0x20),
  };
}

function handleRaw(raw, onRecord, options, reasm) {
  const frame = parseFrame(raw);
  if (!frame || !frameInvolvesHost(frame, options.targetHost)) return;

  const ts = new Date().toISOString();
  const ep = endpointLabel(frame, options.targetHost);
  const record = {
    ts,
    target: options.targetHost,
    endpoint: ep,
    ethernet: frame.ethernet,
    arp: frame.arp || undefined,
    ip: frame.ip ? summarizeIp(frame.ip) : undefined,
  };

  if (frame.ip?.payload?.length) {
    attachPayload(record, frame.ip.payload);
    record.application = classifyApplication(frame);
  }

  if (frame.ip?.layer === 'tcp') {
    const chunk = reasm.feed(frame, options.targetHost);
    if (chunk) {
      const synth = {
        ip: {
          layer: 'tcp',
          payload: chunk.payload,
          srcPort: frame.ip.srcPort,
          dstPort: frame.ip.dstPort,
        },
      };
      record.stream = {
        key: chunk.streamKey,
        reassembled: true,
        application: classifyApplication(synth),
      };
      attachPayload(record.stream, chunk.payload);
    }
  }

  onRecord(record);
}

function summarizeIp(ip) {
  const base = {
    srcIp: ip.srcIp,
    dstIp: ip.dstIp,
    protocol: ip.protocolName,
  };
  if (ip.layer === 'tcp') {
    base.srcPort = ip.srcPort;
    base.dstPort = ip.dstPort;
    base.flags = ip.flags;
    base.payloadLen = ip.payload?.length || 0;
  } else if (ip.layer === 'udp') {
    base.srcPort = ip.srcPort;
    base.dstPort = ip.dstPort;
    base.payloadLen = ip.payload?.length || 0;
  } else if (ip.layer === 'icmp') {
    base.icmp = ip.icmpLabel;
  }
  return base;
}

function resolveCapDevice(ifaceHint, targetHost) {
  let Cap;
  try {
    Cap = require('cap').Cap;
  } catch {
    return null;
  }
  const devices = Cap.deviceList();
  if (!devices?.length) return null;

  if (ifaceHint && ifaceHint !== 'auto') {
    const hit = devices.find((d) => d.name === ifaceHint || d.description?.includes(ifaceHint));
    if (hit) return hit.name;
  }

  const { detectInterfaceForHost } = require('./lan-interface');
  const lan = detectInterfaceForHost(targetHost);
  if (lan) {
    const hit = devices.find((d) => d.addresses?.some((a) => a.addr === lan.address));
    if (hit) return hit.name;
    const byName = devices.find((d) => d.name.includes(lan.name));
    if (byName) return byName.name;
  }
  return devices[0].name;
}

function pickBackend(opts) {
  const capDevice = resolveCapDevice(opts.iface, opts.targetHost);
  if (capDevice && !opts.forceTshark) {
    try {
      require('cap');
      return createCapBackend({
        device: capDevice,
        filter: opts.bpf || `host ${opts.targetHost}`,
        targetHost: opts.targetHost,
        promiscuous: opts.promiscuous !== false,
      });
    } catch {
      /* fall through */
    }
  }

  const { findTshark, tsharkListInterfaces, detectInterfaceForHost } = require('./lan-interface');
  const tshark = findTshark();
  if (!tshark) {
    throw new Error(
      'No capture backend available. Install Npcap (https://npcap.com/) then run `cd tools/net-capture && npm install`, or install Wireshark/tshark.',
    );
  }

  const ifaces = tsharkListInterfaces(tshark);
  let deviceIndex = ifaces[0]?.index ?? 1;
  const lan = detectInterfaceForHost(opts.targetHost);
  if (opts.iface && opts.iface !== 'auto') {
    const hit = ifaces.find((i) => i.name.includes(opts.iface) || String(i.index) === opts.iface);
    if (hit) deviceIndex = hit.index;
  } else if (lan) {
    const hit = ifaces.find((i) => i.name.includes(lan.name) || i.detail.includes(lan.address));
    if (hit) deviceIndex = hit.index;
  }

  return createTsharkBackend({
    tshark,
    deviceIndex,
    filter: opts.bpf || `host ${opts.targetHost}`,
    targetHost: opts.targetHost,
    promiscuous: opts.promiscuous !== false,
  });
}

module.exports = {
  pickBackend,
  createCapBackend,
  createTsharkBackend,
  resolveCapDevice,
};
