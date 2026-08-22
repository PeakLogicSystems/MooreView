'use strict';

/**
 * Normalize Nexcomm / EdgePoint serial for MQTT topics and lift_station_epi drivers.
 * Hyphenated forms like `xxxx-xxxxxx` become compact lowercase (`xxxxxxxxxx`).
 * Hex DSN and IMEI serials pass through (lowercase, no separators).
 *
 * @param {string|number|null|undefined} serial
 * @returns {string}
 */
function normalizeSerial(serial) {
  return String(serial ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s_]/g, '');
}

/**
 * Build MQTT topic for mooreVIEW lift_station_epi / EdgePoint drivers.
 * @param {string} template - e.g. /devices/{serial}/messages/events/
 * @param {string} serial
 */
function buildEventsTopic(template, serial) {
  const s = normalizeSerial(serial);
  if (!s) throw new Error('serial required for MQTT topic');
  return template.replace(/\{serial\}/gi, s);
}

/**
 * Extract device serial from Service Bus / IoT Hub envelope.
 * Supports Nexcomm JSON bodies and Azure system properties.
 *
 * @param {import('@azure/service-bus').ServiceBusReceivedMessage} message
 */
function extractSerial(message) {
  const props = message.applicationProperties || {};
  const candidates = [
    props.deviceId,
    props['iothub-connection-device-id'],
    props.serial,
    props.serialNum,
    props.SerialNumber,
  ].filter(Boolean);

  for (const c of candidates) {
    const s = normalizeSerial(c);
    if (s) return s;
  }

  const body = normalizeBody(message.body);
  if (body) {
    const fromBody = [
      body.serial,
      body.serialNum,
      body.deviceId,
      body['10'],
      body.dsn,
    ].find((v) => v != null && String(v).trim());
    if (fromBody) return normalizeSerial(fromBody);
  }

  const subject = message.subject || '';
  const subjMatch = subject.match(/devices\/([^/]+)\/messages/i);
  if (subjMatch) return normalizeSerial(subjMatch[1]);

  return null;
}

/**
 * Payload published to MQTT — pass-through Nexcomm device JSON when possible.
 * @param {import('@azure/service-bus').ServiceBusReceivedMessage} message
 */
function extractMqttPayload(message) {
  const body = normalizeBody(message.body);
  if (body == null) {
    throw new Error('empty message body');
  }
  if (typeof body === 'string') {
    return body;
  }
  if (body.body && typeof body.body === 'object') {
    return JSON.stringify(body.body);
  }
  if (body.payload && typeof body.payload === 'object') {
    return JSON.stringify(body.payload);
  }
  return JSON.stringify(body);
}

function normalizeBody(body) {
  if (body == null) return null;
  if (Buffer.isBuffer(body)) {
    const text = body.toString('utf8');
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

/**
 * @param {import('@azure/service-bus').ServiceBusReceivedMessage} message
 * @param {{ eventsTopicTemplate: string }} opts
 */
function mapServiceBusToMqtt(message, opts = {}) {
  const template = opts.eventsTopicTemplate || '/devices/{serial}/messages/events/';
  const serial = extractSerial(message);
  if (!serial) {
    throw new Error('could not resolve device serial from Service Bus message');
  }
  const topic = buildEventsTopic(template, serial);
  const payload = extractMqttPayload(message);
  return { topic, payload, serial };
}

module.exports = {
  normalizeSerial,
  buildEventsTopic,
  extractSerial,
  extractMqttPayload,
  mapServiceBusToMqtt,
};
