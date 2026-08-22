# proto-sniff

Standalone Node app for **capturing LAN traffic** and **reverse-engineering unknown protocols**. It is not tied to any vendor stack — mooreVIEW support is an optional plugin.

## What it does

1. **Capture** — BPF-filtered packets for a target IP (e.g. `192.168.1.241`) via Npcap or tshark.
2. **Decode known protocols** when possible — HTTP, MQTT, Modbus TCP (best-effort).
3. **Analyze unknown payloads** — entropy, magic bytes, delimiters, length-field guesses, prefix repetition.
4. **Propose a decoding scheme** — per-flow framing hypothesis, field layout, and pseudocode written to `proposal.json`.

## Install

```bash
cd tools/net-capture
npm install
```

Windows: install [Npcap](https://npcap.com/) and run the terminal **as Administrator**.

## Web UI

```bash
npm start
# open http://127.0.0.1:3210
```

Set the **IP address of interest** in the sidebar, save, then **Start capture**. View live packets, flows, and the decoding proposal when you stop.

Port: `PROTO_SNIFF_PORT` (default `3210`).

## Capture (CLI)

```bash
node bin/capture.js --host 192.168.1.241 -d 120 -o capture.jsonl -v
```

| Flag | Purpose |
|------|---------|
| `--host` | Target IP (BPF: `host <ip>`) |
| `--bpf` | Custom filter, e.g. `host 192.168.1.241 and tcp port 502` |
| `-o` | JSONL log (one JSON object per packet/event) |
| `--proposal` | Output decoding proposal (default `proposal.json`) |
| `--plugin mooreview` | Optional vendor hints |

## Offline analysis

```bash
node bin/analyze.js capture.jsonl --proposal scheme.json -v
```

## Unknown protocol decoding methodology

```
L2 Ethernet → L3 IPv4/ARP → L4 TCP/UDP → L5 heuristics
```

For each **bidirectional flow** (sorted `src:port ↔ dst:port`):

| Signal | Interpretation |
|--------|----------------|
| Entropy > 7.5 | Encrypted, compressed, or random — need keys or cleartext port |
| Entropy < 4.5 + printable | Text protocol (CRLF lines, JSON, HTTP-like) |
| Same prefix in >80% packets | Fixed header (record first 4–8 bytes) |
| All payloads same size | Fixed-length frames |
| `uint16/32` at offset 0 matches body length | Length-prefixed binary |
| CRLF in payload | Line-oriented text commands |
| `0x16 0x03` | TLS — application data not decodable from PCAP |

### Proposal output (`proposal.json`)

Each flow includes:

- `proposedFraming` — e.g. `length-prefixed (uint16-be@0)`, `fixed-header prefix=a1b2c3d4`
- `confidence` — low / medium / high
- `evidence` — human-readable reasons
- `suggestedRecordLayout` — offset/size field list
- `decodePseudocode` — starting point for a custom decoder

### Adding your protocol decoder

Create `decoders/plugins/mydevice.js`:

```javascript
'use strict';
function enhance(payload, ctx) {
  if (ctx.ip?.dstPort !== 9000) return null;
  if (payload[0] !== 0x55) return null;
  return {
    scheme: 'mydevice-v1',
    decoded: { opcode: payload[1], len: payload.readUInt16BE(2) },
  };
}
module.exports = { enhance };
```

Run: `node bin/capture.js --plugin mydevice …`

## JSONL record shape

```json
{
  "ts": "…",
  "target": "192.168.1.241",
  "ip": { "srcIp": "…", "dstIp": "…", "protocol": "tcp", "dstPort": 9000 },
  "payload": { "len": 24, "hex": "55aa0010…" },
  "application": {
    "scheme": "unknown",
    "confidence": "heuristic",
    "unknown": {
      "entropy": 4.2,
      "prefixHex4": "55aa0010",
      "contentClass": "binary-length-prefixed",
      "lengthFields": [{ "format": "uint16-be@2", "match": "body" }],
      "hints": ["length-prefixed framing candidate: uint16-be@2"]
    }
  }
}
```

## Tests

```bash
npm test
```

## Limits

- Sees only traffic on your LAN segment (not routed elsewhere).
- TLS ciphertext cannot be decoded without keys.
- TCP reassembly is basic — long streams may need longer captures.
