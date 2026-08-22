'use strict';

/** Set before api.js loads. Override via env at render time or inline script. */
window.MOOREVIEW_API_BASE = window.MOOREVIEW_API_BASE
  || (typeof MOOREVIEW_API_BASE_INJECT !== 'undefined' ? MOOREVIEW_API_BASE_INJECT : '')
  || '';
