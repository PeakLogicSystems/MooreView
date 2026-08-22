#!/usr/bin/env node
'use strict';

/**
 * Publish simulated Parc telemetry for Putnam County fleet (6 lifts + MLE plant).
 *
 * Usage:
 *   npm run mqtt:start
 *   npm run start:cloud   (or npm start)
 *   npm run putnam-fleet:sim
 */

const mqtt = require('mqtt');
const { allFleetDevices, buildTelemetryReport } = require('./telemetry-fixtures');

const BROKER = process.env.MOOREVIEW_MQTT_BROKER || 'mqtt://127.0.0.1:1883';
const TOPIC_PREFIX = process.env.MOOREVIEW_MQTT_TOPIC_PREFIX || 'mooreview/v1';

function parseArgs(argv) {
  const out = {
    intervalMs: 2000,
    alarm: false,
    alarmDevice: '',
    scenario: 'normal',
    once: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--interval' && argv[i + 1]) { out.intervalMs = Number(argv[++i]) || 2000; continue; }
    if (a === '--alarm') { out.alarm = true; continue; }
    if (a === '--alarm-device' && argv[i + 1]) { out.alarmDevice = argv[++i]; out.alarm = true; continue; }
    if (a === '--scenario' && argv[i + 1]) { out.scenario = argv[++i]; continue; }
    if (a === '--once') { out.once = true; continue; }
    if (a === '--help' || a === '-h') {
      console.log(`Usage: node publish-eval-telemetry.js [options]
  --interval <ms>           default: 2000
  --alarm                   force alarm on Yelvington triplex
  --alarm-device <id>       force alarm on specific deviceId
  --scenario normal|high_level|pump_run
  --once                    publish one burst and exit`);
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const devices = allFleetDevices();
  const alarmDeviceId = args.alarmDevice
    || (args.alarm ? devices.find((d) => d.stationType === 'triplex')?.deviceId : '');

  const client = mqtt.connect(BROKER, { reconnectPeriod: 2000 });
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
    setTimeout(() => reject(new Error(`MQTT connect timeout — run: npm run mqtt:start (${BROKER})`)), 8000);
  });

  const publishAll = () => {
    for (const d of devices) {
      const body = buildTelemetryReport(d, {
        alarmDeviceId,
        scenario: args.scenario,
      });
      const topic = `${TOPIC_PREFIX}/${d.deviceId}/telemetry`;
      client.publish(topic, JSON.stringify(body), { qos: 1 });
      client.publish(`${TOPIC_PREFIX}/${d.deviceId}/online`, JSON.stringify({ online: true }), { qos: 1, retain: true });
    }
  };

  console.log(`Putnam fleet sim → ${BROKER} (${devices.length} devices: 6 lifts + MLE plant)`);
  if (alarmDeviceId) console.log(`  alarm injected on: ${alarmDeviceId}`);
  publishAll();

  if (args.once) {
    client.end(true);
    console.log('Published one telemetry burst.');
    return;
  }

  const timer = setInterval(publishAll, args.intervalMs);
  console.log(`Publishing every ${args.intervalMs}ms — Ctrl+C to stop`);
  process.on('SIGINT', () => {
    clearInterval(timer);
    client.end(true);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
