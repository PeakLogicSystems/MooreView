#!/usr/bin/env node
'use strict';

/**
 * Publish sample EdgePoint lift payloads for Putnam County fleet to a local MQTT broker.
 * Prefer the built-in mqtt_sim driver (mqtt_sim_putnam) — no external script required.
 * Legacy lab: npm run mqtt:start && npm run simulate:putnam-mqtt-lifts
 */

const fs = require('fs');
const path = require('path');
const mqtt = require('mqtt');
const { LIFT_STATIONS } = require('./fleet-data');

const BROKER = process.env.NEXUS_MQTT_BROKER || 'mqtt://127.0.0.1:1883';
const INTERVAL_MS = Number(process.env.PUTNAM_MQTT_SIM_MS) || 5000;
const SAMPLE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../st/fixtures/edgepoint-lift-station-sample.json'),
  'utf8',
));

function topicFor(serialNum) {
  return `/devices/${serialNum}/messages/events/`;
}

function main() {
  const client = mqtt.connect(BROKER, { clientId: 'putnam-lift-sim' });
  client.on('connect', () => {
    console.log(`Putnam lift MQTT sim → ${BROKER} (${LIFT_STATIONS.length} stations, every ${INTERVAL_MS}ms)`);
    const publishAll = () => {
      for (const s of LIFT_STATIONS) {
        const payload = { ...SAMPLE, 10: s.serialNum, mac: s.serialNum };
        client.publish(topicFor(s.serialNum), JSON.stringify(payload), { qos: 0 });
      }
    };
    publishAll();
    setInterval(publishAll, INTERVAL_MS);
  });
  client.on('error', (e) => {
    console.error(`MQTT error: ${e.message}`);
    console.error('Start broker: npm run mqtt:start');
    process.exit(1);
  });
}

main();
