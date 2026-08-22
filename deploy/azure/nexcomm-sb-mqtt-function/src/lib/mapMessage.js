'use strict';

/**
 * Shared with services/nexcomm-sb-mqtt-bridge — keep in sync.
 * Nexcomm serial `xxxx-xxxxxx` → compact lowercase for mqtt.mooreview.io topics.
 */

function normalizeSerial(serial) {
  return String(serial ?? '')
    .trim()
    .toLowerCase()
    .replace(/[-\s_]/g, '');
}

function buildEventsTopic(template, serial) {
  const s = normalizeSerial(serial);
  if (!s) throw new Error('serial required for MQTT topic');
  return template.replace(/\{serial\}/gi, s);
}

function extractSerial(message) {
  const userProps = message.userProperties
    || message.applicationProperties
    || {};
  const candidates = [
    userProps.deviceId,
    userProps['iothub-connection-device-id'],
    userProps.serial,
    userProps.serialNum,
    userProps.SerialNumber,
    message.deviceId,
  ].filter(Boolean);

  for (const c of candidates) {
    const s = normalizeSerial(c);
    if (s) return s;
  }

  const rawBody = Object.prototype.hasOwnProperty.call(message, 'body')
    ? message.body
    : message;
  const body = normalizeBody(rawBody);
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
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
  const subjMatch = String(subject).match(/devices\/([^/]+)\/messages/i);
  if (subjMatch) return normalizeSerial(subjMatch[1]);

  return null;
}

function extractMqttPayload(message) {
  const rawBody = Object.prototype.hasOwnProperty.call(message, 'body')
    ? message.body
    : message;
  const body = normalizeBody(rawBody);
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
