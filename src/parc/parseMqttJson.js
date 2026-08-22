'use strict';

/**
 * Sanitize MQTT JSON text before parse.
 * Firmware or truncated payloads may contain raw control chars inside strings.
 */
function sanitizeMqttJsonText(text) {
  let s = String(text ?? '').trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/[\u0000-\u001F]/g, (ch) => {
    if (ch === '\n' || ch === '\r' || ch === '\t') return ' ';
    return '';
  });
}

/**
 * @param {string} text raw MQTT payload
 * @param {{ dropOnError?: boolean }} [opts]
 * @returns {object|null} parsed object, null when empty or when dropOnError and unparseable
 */
function parseMqttJson(text, opts = {}) {
  const sanitized = sanitizeMqttJsonText(text);
  if (!sanitized) return null;
  try {
    return JSON.parse(sanitized);
  } catch (err) {
    if (opts.dropOnError) return null;
    throw err;
  }
}

module.exports = { parseMqttJson, sanitizeMqttJsonText };
