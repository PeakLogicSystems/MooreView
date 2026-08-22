'use strict';

function envBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(raw).trim());
}

function envInt(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  SERVICE_BUS_CONNECTION_STRING: process.env.SERVICE_BUS_CONNECTION_STRING || '',
  SERVICE_BUS_NAMESPACE: process.env.SERVICE_BUS_NAMESPACE || '',
  SERVICE_BUS_QUEUE: process.env.SERVICE_BUS_QUEUE || 'nexcomm-telemetry',
  SERVICE_BUS_SUBSCRIPTION: process.env.SERVICE_BUS_SUBSCRIPTION || '',
  /** topic name when using Service Bus topics instead of queues */
  SERVICE_BUS_TOPIC: process.env.SERVICE_BUS_TOPIC || '',

  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || process.env.MOOREVIEW_MQTT_BROKER || 'mqtt://127.0.0.1:1883',
  MQTT_USERNAME: process.env.MQTT_USERNAME || process.env.MOSQUITTO_USER || '',
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || process.env.MOSQUITTO_PASS || '',
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || `nexcomm-sb-bridge-${process.pid}`,
  MQTT_QOS: envInt('MQTT_QOS', 1),
  MQTT_RETAIN: envBool('MQTT_RETAIN', false),

  /** IoT Hub device events topic pattern used by lift_station_epi */
  MQTT_EVENTS_TOPIC_TEMPLATE: process.env.MQTT_EVENTS_TOPIC_TEMPLATE
    || '/devices/{serial}/messages/events/',

  MAX_CONCURRENT: envInt('BRIDGE_MAX_CONCURRENT', 8),
  LOG_EVERY_N: envInt('BRIDGE_LOG_EVERY_N', 100),
  HEALTH_LOG_INTERVAL_MS: envInt('BRIDGE_HEALTH_LOG_INTERVAL_MS', 60000),
};
