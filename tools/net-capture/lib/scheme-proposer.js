'use strict';

const { analyzeUnknown } = require('./unknown-analyzer');

/**
 * Build a reverse-engineering proposal from captured flow statistics.
 */
function proposeDecodingScheme(registrySnapshot, targetHost) {
  const { flows, packetCount, unknownCount } = registrySnapshot;
  const proposals = [];

  for (const flow of flows) {
    const dominantScheme = topScheme(flow.schemes);
    const isUnknown = !dominantScheme || dominantScheme === 'unknown' || dominantScheme === 'unclassified';

    if (!isUnknown && !flow.unknownSampleCount) {
      proposals.push({
        flow: flow.key,
        l4: flow.l4,
        classification: dominantScheme,
        confidence: 'high',
        note: 'Matched a known decoder — refine in decoders/*.js',
      });
      continue;
    }

    const proposal = proposeUnknownFlow(flow, dominantScheme);
    proposals.push(proposal);
  }

  return {
    title: 'Proposed decoding scheme (unknown protocol analysis)',
    target: targetHost || null,
    methodology: [
      '1. Capture all L2–L4 traffic for the target host (BPF: host <ip>).',
      '2. Group payloads by bidirectional flow (src:port ↔ dst:port).',
      '3. Run entropy, magic-byte, delimiter, and length-field heuristics on each flow.',
      '4. Compare prefixes and payload length distributions across packets.',
      '5. Hypothesize framing (fixed header, length-prefix, delimiter-terminated, or stateful stream).',
      '6. Validate by replaying captured hex in a custom decoder script.',
    ],
    stats: {
      packets: packetCount,
      unknownPayloads: unknownCount,
      flows: flows.length,
    },
    layers: [
      { layer: 2, name: 'Ethernet', fields: ['dstMac', 'srcMac', 'vlan?'] },
      { layer: 2.5, name: 'ARP', fields: ['opcode', 'senderIp', 'targetIp'] },
      { layer: 3, name: 'IPv4', fields: ['srcIp', 'dstIp', 'protocol'] },
      { layer: 4, name: 'TCP/UDP/ICMP', fields: ['srcPort', 'dstPort', 'flags', 'payload'] },
      { layer: 5, name: 'Application (unknown)', fields: ['entropy', 'prefixHex', 'lengthFields', 'delimiters', 'contentClass'] },
    ],
    flowProposals: proposals,
    nextSteps: [
      'Capture longer sessions while exercising all device functions.',
      'If TLS detected, use browser/mitm or device-side logging — ciphertext is not decodable from PCAP alone.',
      'Add a custom decoder under decoders/plugins/<name>.js and pass --plugin <name>.',
      'Re-run: node bin/analyze.js capture.jsonl to refine proposals offline.',
    ],
  };
}

function proposeUnknownFlow(flow, dominantScheme) {
  const sample = flow.samples[0]?.analysis || {};
  const lengths = flow.lengthStats;
  const topPrefix = flow.topPrefixes[0];

  let framing = 'opaque-byte-stream';
  let confidence = 'low';
  const evidence = [];

  if (lengths?.fixedSize) {
    framing = `fixed-frame-${lengths.fixedSize}-bytes`;
    confidence = 'medium';
    evidence.push(`all ${flow.packets} payloads are exactly ${lengths.fixedSize} bytes`);
  } else if (sample.lengthFields?.length) {
    framing = `length-prefixed (${sample.lengthFields[0].format})`;
    confidence = 'medium';
    evidence.push(sample.lengthFields[0].format);
  } else if (sample.delimiters?.includes('CRLF')) {
    framing = 'text/crlf-delimited';
    confidence = 'medium';
    evidence.push('CRLF delimiters with printable ASCII');
  } else if (sample.contentClass === 'binary-tls') {
    framing = 'tls-encrypted';
    confidence = 'high';
    evidence.push('TLS record header 0x16 0x03');
  } else if (topPrefix && flow.topPrefixes[0].count / flow.packets > 0.8) {
    framing = `fixed-header prefix=${topPrefix.prefix}`;
    confidence = 'medium';
    evidence.push(`prefix ${topPrefix.prefix} in ${flow.topPrefixes[0].count}/${flow.packets} packets`);
  }

  if (sample.entropy > 7.5) {
    evidence.push(`entropy=${sample.entropy} — may need key material or is compressed`);
  }

  const port = flow.ports.b || flow.ports.a;
  const suggestedFields = suggestFieldLayout(flow, sample);

  return {
    flow: flow.key,
    l4: flow.l4,
    port,
    packets: flow.packets,
    bytes: flow.bytes,
    dominantScheme: dominantScheme || 'unknown',
    proposedFraming: framing,
    confidence,
    evidence,
    lengthStats: lengths,
    topPrefixes: flow.topPrefixes,
    sampleAnalysis: sample,
    suggestedRecordLayout: suggestedFields,
    decodePseudocode: pseudocode(framing, suggestedFields, port),
  };
}

function suggestFieldLayout(flow, sample) {
  const fields = [{ offset: 0, name: 'header', size: 4, hex: sample.prefixHex4 }];

  if (sample.lengthFields?.[0]) {
    const lf = sample.lengthFields[0];
    const size = lf.format.includes('uint32') ? 4 : 2;
    fields.push({ offset: 0, name: 'length', size, encoding: lf.format });
    fields.push({ offset: size, name: 'payload', size: 'length', encoding: 'raw' });
    return fields;
  }

  if (sample.contentClass === 'text-json') {
    return [{ name: 'message', encoding: 'utf8-json-document' }];
  }
  if (sample.delimiters?.includes('CRLF')) {
    return [{ name: 'line', encoding: 'utf8-crlf-terminated' }];
  }

  if (flow.lengthStats?.fixedSize) {
    fields.push({ offset: 4, name: 'body', size: flow.lengthStats.fixedSize - 4, encoding: 'raw' });
  } else {
    fields.push({ offset: 4, name: 'body', size: 'variable', encoding: 'raw' });
  }
  return fields;
}

function pseudocode(framing, fields, port) {
  if (framing.startsWith('tls')) {
    return '// TLS — decrypt out-of-band or capture cleartext on another port';
  }
  if (framing.startsWith('length-prefixed')) {
    return `// TCP port ${port}\n// read uint16/32 length N, then read N bytes payload\n// validate N against remaining buffer`;
  }
  if (framing.startsWith('text/crlf')) {
    return `// TCP port ${port}\n// read until \\r\\n, parse line as command or header\n// optional body after blank line`;
  }
  if (framing.startsWith('fixed-frame')) {
    const size = framing.match(/\d+/)?.[0] || '?';
    return `// UDP/TCP port ${port}\n// each datagram = ${size} bytes\n// split: header(4) + body(${Number(size) - 4})`;
  }
  return `// port ${port}: inspect prefixes ${fields[0]?.hex || '????'}\n// compare multiple samples in capture.jsonl unknown.hexPreview`;
}

function topScheme(schemes) {
  const entries = Object.entries(schemes || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

/** Analyze raw buffers from offline replay (no flow context). */
function proposeFromSamples(buffers) {
  const analyses = buffers.map((b) => analyzeUnknown(b));
  const prefixes = {};
  const lengths = [];
  for (const a of analyses) {
    prefixes[a.prefixHex4] = (prefixes[a.prefixHex4] || 0) + 1;
    lengths.push(a.length);
  }
  const lfVotes = {};
  for (const a of analyses) {
    for (const lf of a.lengthFields) {
      lfVotes[lf.format] = (lfVotes[lf.format] || 0) + 1;
    }
  }
  return {
    sampleCount: buffers.length,
    topPrefixes: Object.entries(prefixes).sort((a, b) => b[1] - a[1]).slice(0, 5),
    lengthStats: lengths,
    lengthFieldVotes: lfVotes,
    analyses: analyses.slice(0, 5),
  };
}

module.exports = {
  proposeDecodingScheme,
  proposeFromSamples,
};
