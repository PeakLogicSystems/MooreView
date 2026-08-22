'use strict';

const mqtt = require('mqtt');

function brokerConfig() {
  return {
    url: process.env.MQTT_BROKER_URL || process.env.MOOREVIEW_MQTT_BROKER || 'mqtts://mqtt.mooreview.io:8883',
    username: process.env.MQTT_USERNAME || process.env.MOSQUITTO_USER || '',
    password: process.env.MQTT_PASSWORD || process.env.MOSQUITTO_PASS || '',
    clientId: process.env.MQTT_CLIENT_ID || `nexcomm-sb-fn-${process.pid}`,
    qos: Number(process.env.MQTT_QOS || 1),
    retain: /^(1|true|yes|on)$/i.test(String(process.env.MQTT_RETAIN || '')),
  };
}

/**
 * Connect, publish one message, disconnect — suitable for Consumption Functions.
 * @param {string} topic
 * @param {string} payload
 */
async function publishOnce(topic, payload) {
  const cfg = brokerConfig();
  const opts = {
    clientId: `${cfg.clientId}-${Date.now()}`,
    keepalive: 30,
    reconnectPeriod: 0,
    clean: true,
    connectTimeout: 15000,
  };
  if (cfg.username) {
    opts.username = cfg.username;
    opts.password = cfg.password || '';
  }

  const client = mqtt.connect(cfg.url, opts);
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`MQTT connect timeout: ${cfg.url}`)), 15000);
      client.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      client.once('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    await new Promise((resolve, reject) => {
      client.publish(topic, payload, { qos: cfg.qos, retain: cfg.retain }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  } finally {
    await new Promise((resolve) => {
      client.end(false, {}, resolve);
    });
  }
}

module.exports = {
  brokerConfig,
  publishOnce,
};
