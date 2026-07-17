'use strict';

function pad(n, width = 2) {
  return String(n).padStart(width, '0');
}

/** Local wall-clock timestamp for console prefixes (YYYY-MM-DD HH:MM:SS.mmm). */
function formatConsoleTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.`
    + `${pad(date.getMilliseconds(), 3)}`;
}

let installed = false;

/** Prefix console.log/info/warn/error/debug with a local timestamp. Idempotent. */
function installConsoleTimestamp() {
  if (installed) return;
  installed = true;
  for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[level]?.bind(console);
    if (!original) continue;
    console[level] = (...args) => {
      original(`[${formatConsoleTimestamp()}]`, ...args);
    };
  }
}

module.exports = {
  formatConsoleTimestamp,
  installConsoleTimestamp,
};
