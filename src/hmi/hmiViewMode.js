'use strict';

/** HTTP fallback poll when WebSocket is unavailable (WebSocket is primary). */
const HMI_POLL_MS_NORMAL = 2_000;

/** Technician test mode — faster live refresh for commissioning. */
const HMI_POLL_MS_TEST = 500;

function normalizeUserLevel(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  return v === 'technician' ? 'technician' : 'operator';
}

function normalizeHmiTestMode(raw, settings) {
  if (raw !== true) return false;
  return canEnableHmiTestMode(settings);
}

/** Test mode is technician-only in production; demo projects may expose the toggle. */
function canEnableHmiTestMode(settings) {
  if (normalizeUserLevel(settings?.userLevel) === 'technician') return true;
  return settings?.demoFeatures?.hmiTestMode === true;
}

function hmiPollMsFromSettings(settings) {
  return normalizeHmiTestMode(settings?.hmi?.testMode, settings)
    ? HMI_POLL_MS_TEST
    : HMI_POLL_MS_NORMAL;
}

module.exports = {
  HMI_POLL_MS_NORMAL,
  HMI_POLL_MS_TEST,
  normalizeUserLevel,
  normalizeHmiTestMode,
  canEnableHmiTestMode,
  hmiPollMsFromSettings,
};
